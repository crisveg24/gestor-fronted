import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import Cookies from 'js-cookie';
import type { AuthState, User, LoginCredentials, AxiosApiError } from '../types';
import api from '../lib/axios';
import logger from '../utils/logger';

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  setUser: (user: User) => void;
  checkAuth: () => boolean;
  verifyToken: () => Promise<boolean>;
  initializeAuth: () => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

// ==================== HELPERS PARA TOKENS ====================
const TOKEN_KEYS = {
  ACCESS: 'accessToken',
  REFRESH: 'refreshToken',
} as const;

// Configuración de cookies según entorno
const getCookieConfig = () => {
  const isProduction = import.meta.env.PROD;
  return {
    expires: 7, // 7 días
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'strict') as 'none' | 'strict',
    path: '/',
  };
};

// Guardar token en AMBOS: cookies Y localStorage (fallback)
const saveToken = (key: string, value: string) => {
  Cookies.set(key, value, getCookieConfig());
  localStorage.setItem(key, value);
};

// Obtener token: primero de cookies, luego de localStorage
const getToken = (key: string): string | undefined => {
  return Cookies.get(key) || localStorage.getItem(key) || undefined;
};

// Eliminar token de ambos lugares
const removeToken = (key: string) => {
  Cookies.remove(key, { path: '/' });
  localStorage.removeItem(key);
};

// Store de autenticación con verificación de token
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
  // State inicial
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,

      // ==================== LOGIN ====================
      login: async (credentials: LoginCredentials) => {
        try {
          set({ isLoading: true });

          logger.log('[AUTH] Iniciando sesión...');

          const response = await api.post('/auth/login', credentials);
          
          // El backend devuelve: { success: true, token, refreshToken, user }
          const { user, token, refreshToken } = response.data;

          logger.log('[AUTH] Login exitoso');

          // Guardar tokens en cookies Y localStorage (fallback para cross-domain)
          saveToken(TOKEN_KEYS.ACCESS, token);
          saveToken(TOKEN_KEYS.REFRESH, refreshToken);

          // Actualizar state
          set({
            user,
            accessToken: token,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          logger.log('[AUTH] Estado actualizado correctamente');
        } catch (error) {
          const axiosError = error as AxiosApiError;
          logger.error('[AUTH] Error al iniciar sesión:', error);
          set({ isLoading: false });
          throw new Error(axiosError.response?.data?.message || 'Error al iniciar sesión');
        }
      },

      // ==================== LOGOUT ====================
      logout: () => {
        logger.log('[AUTH] Cerrando sesión...');

        // Limpiar tokens de cookies Y localStorage
        removeToken(TOKEN_KEYS.ACCESS);
        removeToken(TOKEN_KEYS.REFRESH);

        // Limpiar state
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });

        // Limpiar sessionStorage y localStorage (solo claves de la app)
        sessionStorage.clear();
        localStorage.removeItem('auth-storage');

        // Prevenir botón "atrás" reemplazando historial
        window.history.pushState(null, '', '/login');
        window.history.replaceState(null, '', '/login');

        // Redirigir al login con replace para no dejar rastro en historial
        window.location.replace('/login');
      },

      // ==================== REFRESH AUTH ====================
      refreshAuth: async () => {
        try {
          const refreshToken = getToken(TOKEN_KEYS.REFRESH);

          if (!refreshToken) {
            logger.log('[AUTH] No hay refresh token disponible');
            get().logout();
            return;
          }

          logger.log('[AUTH] Refrescando tokens...');

          const response = await api.post('/auth/refresh', { refreshToken });
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data;

          // Guardar tokens en cookies Y localStorage (fallback)
          saveToken(TOKEN_KEYS.ACCESS, newAccessToken);
          saveToken(TOKEN_KEYS.REFRESH, newRefreshToken);

          // Obtener usuario actualizado
          const userResponse = await api.get('/auth/me');
          const user = userResponse.data.data;

          logger.log('[AUTH] Tokens refrescados exitosamente');

          set({
            user,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            isAuthenticated: true,
          });
        } catch (error) {
          logger.error('[AUTH] Error al refrescar tokens:', error);
          get().logout();
        }
      },

      // ==================== SET USER ====================
      setUser: (user: User) => {
        set({ user });
      },

      // ==================== CHECK AUTH ====================
      checkAuth: () => {
        const { user, isAuthenticated } = get();
        const accessToken = getToken(TOKEN_KEYS.ACCESS);
        const refreshToken = getToken(TOKEN_KEYS.REFRESH);

        const result = isAuthenticated && !!user && (!!accessToken || !!refreshToken);

        // Verificar que exista usuario autenticado Y al menos un token válido
        return result;
      },

      // ==================== VERIFY TOKEN ====================
      verifyToken: async () => {
        try {
          const accessToken = getToken(TOKEN_KEYS.ACCESS);
          
          if (!accessToken) {
            logger.log('[AUTH] No hay access token para verificar');
            return false;
          }

          // Verificar token con el backend usando /auth/me
          const response = await api.get('/auth/me');
          const user = response.data.data;

          logger.log('[AUTH] Token válido');

          // Actualizar state con datos del usuario
          set({
            user,
            accessToken,
            refreshToken: getToken(TOKEN_KEYS.REFRESH) || null,
            isAuthenticated: true,
          });

          return true;
        } catch {
          logger.log('[AUTH] Token inválido o expirado');
          return false;
        }
      },

      // ==================== INITIALIZE AUTH ====================
      initializeAuth: async () => {
        const accessToken = getToken(TOKEN_KEYS.ACCESS);
        const refreshToken = getToken(TOKEN_KEYS.REFRESH);

        logger.log('[AUTH] Inicializando autenticación...', { 
          hasAccessToken: !!accessToken, 
          hasRefreshToken: !!refreshToken 
        });

        // Si no hay tokens, no hacer nada
        if (!accessToken && !refreshToken) {
          set({ 
            isLoading: false, 
            isAuthenticated: false,
            user: null,
            accessToken: null,
            refreshToken: null,
          });
          return;
        }

        set({ isLoading: true });

        try {
          // Si tenemos access token, intentar verificar
          if (accessToken) {
            const isValid = await get().verifyToken();
            if (isValid) {
              logger.log('[AUTH] Sesión restaurada con access token');
              set({ isLoading: false });
              return;
            }
          }

          // Si el access token falló pero tenemos refresh token, intentar refrescar
          if (refreshToken) {
            await get().refreshAuth();
            logger.log('[AUTH] Sesión restaurada con refresh token');
            set({ isLoading: false });
            return;
          }

          // Si llegamos aquí, no pudimos restaurar la sesión
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
          
          // Limpiar tokens inválidos
          removeToken(TOKEN_KEYS.ACCESS);
          removeToken(TOKEN_KEYS.REFRESH);
        } catch (error) {
          logger.error('[AUTH] Error al inicializar autenticación:', error);
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
          
          // Limpiar tokens
          removeToken(TOKEN_KEYS.ACCESS);
          removeToken(TOKEN_KEYS.REFRESH);
        }
      },
    }),
    {
      name: 'auth-storage', // nombre de la key en localStorage
      storage: createJSONStorage(() => localStorage),
      // Solo persistir el estado de usuario, los tokens se manejan por separado
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
