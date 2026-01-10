import { create } from 'zustand';
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

// Store de autenticación con verificación de token
export const useAuthStore = create<AuthStore>()((set, get) => ({
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

          // Configuración de cookies para cross-domain HTTPS
          const isProduction = import.meta.env.PROD;
          
          const cookieConfig = {
            expires: 7,
            secure: isProduction, // true en producción (HTTPS)
            sameSite: (isProduction ? 'none' : 'strict') as 'none' | 'strict',
            path: '/',
          };

          // Guardar tokens en cookies seguras con 7 días
          Cookies.set('accessToken', token, cookieConfig);
          Cookies.set('refreshToken', refreshToken, cookieConfig);

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

        // Limpiar cookies
        Cookies.remove('accessToken');
        Cookies.remove('refreshToken');

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
          const refreshToken = Cookies.get('refreshToken');

          if (!refreshToken) {
            logger.log('[AUTH] No hay refresh token disponible');
            get().logout();
            return;
          }

          logger.log('[AUTH] Refrescando tokens...');

          const response = await api.post('/auth/refresh', { refreshToken });
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data;

          // Configuración de cookies para cross-domain HTTPS
          const isProduction = import.meta.env.PROD;
          
          const cookieConfig = {
            expires: 7,
            secure: isProduction,
            sameSite: (isProduction ? 'none' : 'strict') as 'none' | 'strict',
            path: '/',
          };

          // Actualizar tokens con 7 días
          Cookies.set('accessToken', newAccessToken, cookieConfig);
          Cookies.set('refreshToken', newRefreshToken, cookieConfig);

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
        const cookieToken = Cookies.get('accessToken');
        const cookieRefresh = Cookies.get('refreshToken');

        const result = isAuthenticated && !!user && (!!cookieToken || !!cookieRefresh);

        // Verificar que exista usuario autenticado Y al menos un token válido
        return result;
      },

      // ==================== VERIFY TOKEN ====================
      verifyToken: async () => {
        try {
          const accessToken = Cookies.get('accessToken');
          
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
            refreshToken: Cookies.get('refreshToken'),
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
        const accessToken = Cookies.get('accessToken');
        const refreshToken = Cookies.get('refreshToken');

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
          
          // Limpiar cookies inválidas
          Cookies.remove('accessToken');
          Cookies.remove('refreshToken');
        } catch (error) {
          logger.error('[AUTH] Error al inicializar autenticación:', error);
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
          
          // Limpiar cookies
          Cookies.remove('accessToken');
          Cookies.remove('refreshToken');
        }
      },
}));
