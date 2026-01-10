import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';
import DOMPurify from 'dompurify';

// Configuración base de axios con medidas de seguridad
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://api.vrmajo.xyz/api',
  timeout: 60000, // 60 segundos para operaciones lentas como transacciones de ventas
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enviar cookies con cada request
});

// ==================== SEGURIDAD: SANITIZACIÓN XSS ====================
const sanitizeData = <T>(data: T): T => {
  if (typeof data === 'string') {
    return DOMPurify.sanitize(data, { ALLOWED_TAGS: [] }) as T; // Remueve todos los tags HTML
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item)) as T;
  }
  
  if (data !== null && typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitized[key] = sanitizeData((data as Record<string, unknown>)[key]);
      }
    }
    return sanitized as T;
  }
  
  return data;
};

// ==================== REQUEST INTERCEPTOR ====================
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 1. Agregar token de autenticación
    const accessToken = Cookies.get('accessToken');
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // 2. CSRF Protection - agregar token CSRF si está habilitado
    if (import.meta.env.VITE_CSRF_ENABLED === 'true') {
      const csrfToken = Cookies.get('XSRF-TOKEN');
      if (csrfToken && config.headers) {
        config.headers['X-CSRF-TOKEN'] = csrfToken;
      }
    }

    // 3. Sanitizar datos de entrada para prevenir XSS
    if (config.data) {
      config.data = sanitizeData(config.data);
    }

    // 4. Sanitizar query params
    if (config.params) {
      config.params = sanitizeData(config.params);
    }

    // 5. Log en desarrollo (no en producción por seguridad)
    if (import.meta.env.VITE_ENABLE_CONSOLE_LOGS === 'true') {
      console.log('🔹 Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        data: config.data,
      });
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ==================== RESPONSE INTERCEPTOR ====================
api.interceptors.response.use(
  (response) => {
    // Sanitizar datos de respuesta para prevenir XSS
    if (response.data) {
      response.data = sanitizeData(response.data);
    }

    // Log en desarrollo
    if (import.meta.env.VITE_ENABLE_CONSOLE_LOGS === 'true') {
      console.log('✅ Response:', {
        status: response.status,
        url: response.config.url,
        data: response.data,
      });
    }

    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Log de errores en desarrollo
    if (import.meta.env.VITE_ENABLE_CONSOLE_LOGS === 'true') {
      console.error('❌ Error Response:', {
        status: error.response?.status,
        message: error.message,
        url: originalRequest?.url,
      });
    }

    // ==================== REFRESH TOKEN LOGIC ====================
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = Cookies.get('refreshToken');
        
        if (!refreshToken) {
          // No hay refresh token, redirigir al login
          window.location.href = '/login';
          return Promise.reject(error);
        }

        // Intentar refrescar el token
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/auth/refresh`,
          { refreshToken },
          { withCredentials: true }
        );

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data;

        // Configuración de cookies para cross-domain HTTPS
        const isProduction = import.meta.env.PROD;
        
        const cookieConfig = {
          expires: 7,
          secure: isProduction,
          sameSite: (isProduction ? 'none' : 'strict') as 'none' | 'strict',
          path: '/',
        };

        // Guardar nuevos tokens con 7 días de duración
        Cookies.set('accessToken', newAccessToken, cookieConfig);
        Cookies.set('refreshToken', newRefreshToken, cookieConfig);

        // Reintentar request original con nuevo token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);

      } catch (refreshError) {
        // Refresh token expirado o inválido, limpiar y redirigir
        Cookies.remove('accessToken');
        Cookies.remove('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // ==================== MANEJO DE OTROS ERRORES ====================
    if (error.response?.status === 403) {
      // Forbidden - Sin permisos
      window.location.href = '/unauthorized';
    }

    // Los errores 404 y 500+ se manejan silenciosamente
    // El componente que hizo la llamada debe manejar el error apropiadamente

    return Promise.reject(error);
  }
);

export default api;
