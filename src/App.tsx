import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import ProductFormPage from './pages/ProductFormPage';
import InventoryPage from './pages/InventoryPage';
import SalesPage from './pages/SalesPage';
import StoresPage from './pages/StoresPage';
import { useEffect } from 'react';
import { Toaster } from './components/ui';
import DashboardLayout from './components/layout/DashboardLayout';

// Configuración de React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutos
    },
  },
});

// ==================== PROTECTED ROUTE ====================
interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, checkAuth } = useAuthStore();
  
  // Verificar autenticación
  if (!checkAuth()) {
    return <Navigate to="/login" replace />;
  }
  
  // Verificar rol de admin si es requerido
  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/unauthorized" replace />;
  }
  
  return <DashboardLayout>{children}</DashboardLayout>;
}

// ==================== AUTH GUARD COMPONENT ====================
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { initializeAuth, isLoading, logout } = useAuthStore();

  useEffect(() => {
    // Inicializar autenticación al cargar la app
    initializeAuth();

    // Prevenir uso del botón "atrás" después de logout
    const handlePopState = () => {
      const { checkAuth } = useAuthStore.getState();
      if (!checkAuth() && window.location.pathname !== '/login') {
        logout();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [initializeAuth, logout]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ==================== APP COMPONENT ====================
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <BrowserRouter>
        <AuthGuard>
          <Routes>
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Protected Routes with Layout */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/productos"
              element={
                <ProtectedRoute>
                  <ProductsPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/productos/nuevo"
              element={
                <ProtectedRoute>
                  <ProductFormPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/productos/editar/:id"
              element={
                <ProtectedRoute>
                  <ProductFormPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/inventario"
              element={
                <ProtectedRoute>
                  <InventoryPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/ventas"
              element={
                <ProtectedRoute>
                  <SalesPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/tiendas"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <StoresPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <div className="p-8">
                    <h1 className="text-3xl font-bold">Usuarios</h1>
                    <p className="mt-4">Gestión de usuarios (próximamente)</p>
                  </div>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/reportes"
              element={
                <ProtectedRoute>
                  <div className="p-8">
                    <h1 className="text-3xl font-bold">Reportes</h1>
                    <p className="mt-4">Reportes y gráficos (próximamente)</p>
                  </div>
                </ProtectedRoute>
              }
            />
            
            {/* Error Routes */}
            <Route path="/unauthorized" element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-red-600">403</h1>
                  <p className="mt-2">No tienes permisos para acceder a esta página</p>
                </div>
              </div>
            } />
            
            <Route path="*" element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-4xl font-bold">404</h1>
                  <p className="mt-2">Página no encontrada</p>
                </div>
              </div>
            } />
          </Routes>
        </AuthGuard>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
