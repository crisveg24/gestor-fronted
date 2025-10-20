import { create } from 'zustand';
import Cookies from 'js-cookie';
import type { AuthState, User, LoginCredentials } from '../types';
import api from '../lib/axios';

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

          const response = await api.post('/auth/login', credentials);
          
          // El backend devuelve: { success: true, token, refreshToken, user }
          const { user, token, refreshToken } = response.data;

          // Guardar tokens en cookies seguras
          Cookies.set('accessToken', token, {
            secure: true,
            sameSite: 'strict',
            expires: 1 / 24, // 1 hora
          });

          Cookies.set('refreshToken', refreshToken, {
            secure: true,
            sameSite: 'strict',
            expires: 7, // 7 días
          });

          // Actualizar state
          set({
            user,
            accessToken: token,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          set({ isLoading: false });
          throw new Error(error.response?.data?.error?.message || 'Error al iniciar sesión');
        }
      },

      // ==================== LOGOUT ====================
      logout: () => {
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

        // Limpiar sessionStorage y localStorage
        sessionStorage.clear();
        localStorage.clear();

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
            get().logout();
            return;
          }

          const response = await api.post('/auth/refresh', { refreshToken });
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data;

          // Actualizar tokens
          Cookies.set('accessToken', newAccessToken, {
            secure: true,
            sameSite: 'strict',
            expires: 1 / 24,
          });

          Cookies.set('refreshToken', newRefreshToken, {
            secure: true,
            sameSite: 'strict',
            expires: 7,
          });

          set({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          });
        } catch (error) {
          get().logout();
        }
      },

      // ==================== SET USER ====================
      setUser: (user: User) => {
        set({ user });
      },

      // ==================== CHECK AUTH ====================
      checkAuth: () => {
        const { isAuthenticated, accessToken } = get();
        const cookieToken = Cookies.get('accessToken');

        // Verificar que el usuario esté autenticado y tenga token válido
        return isAuthenticated && (!!accessToken || !!cookieToken);
      },

      // ==================== VERIFY TOKEN ====================
      verifyToken: async () => {
        try {
          const accessToken = Cookies.get('accessToken');
          
          if (!accessToken) {
            return false;
          }

          // Verificar token con el backend usando /auth/me
          const response = await api.get('/auth/me');
          const { user } = response.data.data;

          // Actualizar state con datos del usuario
          set({
            user,
            accessToken,
            refreshToken: Cookies.get('refreshToken'),
            isAuthenticated: true,
          });

          return true;
        } catch (error) {
          // Token inválido o expirado, intentar refresh
          try {
            await get().refreshAuth();
            return true;
          } catch (refreshError) {
            // Ambos tokens inválidos, logout
            get().logout();
            return false;
          }
        }
      },

      // ==================== INITIALIZE AUTH ====================
      initializeAuth: async () => {
        const accessToken = Cookies.get('accessToken');
        const refreshToken = Cookies.get('refreshToken');

        if (!accessToken && !refreshToken) {
          return;
        }

        set({ isLoading: true });

        try {
          await get().verifyToken();
        } catch (error) {
          console.error('Error al inicializar autenticación:', error);
          get().logout();
        } finally {
          set({ isLoading: false });
        }
      },
}));
