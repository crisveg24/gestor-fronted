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

          console.log('🔐 [AUTH] Iniciando sesión...');

          const response = await api.post('/auth/login', credentials);
          
          // El backend devuelve: { success: true, token, refreshToken, user }
          const { user, token, refreshToken } = response.data;

          console.log('✅ [AUTH] Login exitoso, guardando sesión por 7 días');

          // Guardar tokens en cookies seguras con 7 días
          Cookies.set('accessToken', token, {
            secure: true,
            sameSite: 'strict',
            expires: 7,
          });

          Cookies.set('refreshToken', refreshToken, {
            secure: true,
            sameSite: 'strict',
            expires: 7,
          });

          // Actualizar state
          set({
            user,
            accessToken: token,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          console.log('✅ [AUTH] Estado actualizado correctamente');
        } catch (error: any) {
          console.error('❌ [AUTH] Error al iniciar sesión:', error);
          set({ isLoading: false });
          throw new Error(error.response?.data?.error?.message || 'Error al iniciar sesión');
        }
      },

      // ==================== LOGOUT ====================
      logout: () => {
        console.log('🚪 [AUTH] Cerrando sesión...');

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

        console.log('✅ [AUTH] Sesión cerrada, redirigiendo...');

        // Redirigir al login con replace para no dejar rastro en historial
        window.location.replace('/login');
      },

      // ==================== REFRESH AUTH ====================
      refreshAuth: async () => {
        try {
          const refreshToken = Cookies.get('refreshToken');

          if (!refreshToken) {
            console.log('❌ [AUTH] No hay refresh token disponible');
            get().logout();
            return;
          }

          console.log('🔄 [AUTH] Refrescando tokens...');

          const response = await api.post('/auth/refresh', { refreshToken });
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data;

          // Actualizar tokens con 7 días
          Cookies.set('accessToken', newAccessToken, {
            secure: true,
            sameSite: 'strict',
            expires: 7,
          });

          Cookies.set('refreshToken', newRefreshToken, {
            secure: true,
            sameSite: 'strict',
            expires: 7,
          });

          // Obtener usuario actualizado
          const userResponse = await api.get('/auth/me');
          const user = userResponse.data.data;

          console.log('✅ [AUTH] Tokens refrescados exitosamente');

          set({
            user,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            isAuthenticated: true,
          });
        } catch (error) {
          console.error('❌ [AUTH] Error al refrescar tokens:', error);
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

        console.log('🔍 [AUTH] Verificando autenticación:', { 
          isAuthenticated, 
          hasUser: !!user, 
          hasCookieToken: !!cookieToken, 
          hasCookieRefresh: !!cookieRefresh,
          result 
        });

        // Verificar que exista usuario autenticado Y al menos un token válido
        return result;
      },

      // ==================== VERIFY TOKEN ====================
      verifyToken: async () => {
        try {
          const accessToken = Cookies.get('accessToken');
          
          if (!accessToken) {
            console.log('⚠️ [AUTH] No hay access token para verificar');
            return false;
          }

          console.log('🔍 [AUTH] Verificando token con el backend...');

          // Verificar token con el backend usando /auth/me
          const response = await api.get('/auth/me');
          const user = response.data.data; // Backend devuelve el user directamente en data

          console.log('✅ [AUTH] Token válido, usuario obtenido:', user.email);

          // Actualizar state con datos del usuario
          set({
            user,
            accessToken,
            refreshToken: Cookies.get('refreshToken'),
            isAuthenticated: true,
          });

          return true;
        } catch (error) {
          // Token inválido o expirado, pero NO hacer logout aquí
          // El initializeAuth manejará el refresh si es necesario
          console.log('❌ [AUTH] Token inválido o expirado');
          return false;
        }
      },

      // ==================== INITIALIZE AUTH ====================
      initializeAuth: async () => {
        const accessToken = Cookies.get('accessToken');
        const refreshToken = Cookies.get('refreshToken');

        console.log('🔄 [AUTH] Inicializando autenticación...', { 
          hasAccessToken: !!accessToken, 
          hasRefreshToken: !!refreshToken 
        });

        // Si no hay tokens, no hacer nada
        if (!accessToken && !refreshToken) {
          console.log('❌ [AUTH] No hay tokens, sesión no iniciada');
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
            console.log('📝 [AUTH] Paso 1: Verificando access token...');
            const isValid = await get().verifyToken();
            if (isValid) {
              console.log('✅ [AUTH] Sesión restaurada exitosamente con access token');
              set({ isLoading: false });
              return;
            }
            console.log('⚠️ [AUTH] Access token inválido, intentando con refresh...');
          }

          // Si el access token falló pero tenemos refresh token, intentar refrescar
          if (refreshToken) {
            console.log('📝 [AUTH] Paso 2: Intentando refrescar token...');
            await get().refreshAuth();
            console.log('✅ [AUTH] Sesión restaurada exitosamente con refresh token');
            set({ isLoading: false });
            return;
          }

          // Si llegamos aquí, no pudimos restaurar la sesión
          console.log('❌ [AUTH] No se pudo restaurar la sesión, limpiando...');
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
          console.error('❌ [AUTH] Error al inicializar autenticación:', error);
          // No hacer logout automático, solo limpiar estado
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
