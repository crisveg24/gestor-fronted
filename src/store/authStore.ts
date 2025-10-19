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
}

type AuthStore = AuthState & AuthActions;

// Store de autenticación SIN persistencia para testing
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
          const { user, accessToken, refreshToken } = response.data.data;

          // Guardar tokens en cookies seguras
          Cookies.set('accessToken', accessToken, {
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
            accessToken,
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

        // Redirigir al login
        window.location.href = '/login';
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
}));
