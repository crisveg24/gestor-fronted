import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';
import DOMPurify from 'dompurify';

// Configuración base de axios con medidas de seguridad
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://gestor-qlwn.onrender.com/api',
  timeout: Number(import.meta.env.VITE_API_TIMEOUT) || 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enviar cookies con cada request
});

// ==================== SEGURIDAD: SANITIZACIÓN XSS ====================
const sanitizeData = (data: any): any => {
  if (typeof data === 'string') {
    return DOMPurify.sanitize(data, { ALLOWED_TAGS: [] }); // Remueve todos los tags HTML
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  
  if (data !== null && typeof data === 'object') {
    const sanitized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitized[key] = sanitizeData(data[key]);
      }
    }
    return sanitized;
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

        // Guardar nuevos tokens (secure, httpOnly simulado en frontend)
        Cookies.set('accessToken', newAccessToken, { 
          secure: true, 
          sameSite: 'strict',
          expires: 1 / 24 // 1 hora
        });
        
        Cookies.set('refreshToken', newRefreshToken, { 
          secure: true, 
          sameSite: 'strict',
          expires: 7 // 7 días
        });

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

    if (error.response?.status === 404) {
      // Not Found
      console.error('Recurso no encontrado');
    }

    if (error.response && error.response.status >= 500) {
      // Server Error
      console.error('Error del servidor');
    }

    return Promise.reject(error);
  }
);

export default api;
