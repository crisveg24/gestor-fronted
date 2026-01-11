import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { lazy, Suspense, useEffect } from 'react';
import { Toaster } from './components/ui';
import DashboardLayout from './components/layout/DashboardLayout';
import ErrorBoundary from './components/ErrorBoundary';
import logger from './utils/logger';

// ==================== LAZY LOADING DE PÁGINAS ====================
// Esto reduce el bundle inicial y carga las páginas bajo demanda
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const ProductFormPage = lazy(() => import('./pages/ProductFormPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
const StoresPage = lazy(() => import('./pages/StoresPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'));
const PurchaseOrdersPage = lazy(() => import('./pages/PurchaseOrdersPage'));
const PurchaseOrderFormPage = lazy(() => import('./pages/PurchaseOrderFormPage'));
const CreditsPage = lazy(() => import('./pages/CreditsPage'));
const TransfersPage = lazy(() => import('./pages/TransfersPage'));
const CashRegisterPage = lazy(() => import('./pages/CashRegisterPage'));
const ReturnsPage = lazy(() => import('./pages/ReturnsPage'));

// ==================== LOADING FALLBACK ====================
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
      <p className="mt-4 text-gray-600">Cargando...</p>
    </div>
  </div>
);

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
    // NO inicializar autenticación en la página de login
    if (window.location.pathname === '/login') {
      logger.log('[AUTH GUARD] En página de login, no inicializando auth');
      return;
    }
    
    logger.log('[AUTH GUARD] Inicializando autenticación...');
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
    return <PageLoader />;
  }

  return <>{children}</>;
}

// ==================== APP COMPONENT ====================
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Toaster />
        <BrowserRouter>
          <AuthGuard>
            <Suspense fallback={<PageLoader />}>
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
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/reportes"
              element={
                <ProtectedRoute>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/proveedores"
              element={
                <ProtectedRoute>
                  <SuppliersPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/ordenes-compra"
              element={
                <ProtectedRoute>
                  <PurchaseOrdersPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/ordenes-compra/nueva"
              element={
                <ProtectedRoute>
                  <PurchaseOrderFormPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/fiados"
              element={
                <ProtectedRoute>
                  <CreditsPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/transferencias"
              element={
                <ProtectedRoute>
                  <TransfersPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/caja"
              element={
                <ProtectedRoute>
                  <CashRegisterPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/devoluciones"
              element={
                <ProtectedRoute>
                  <ReturnsPage />
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
          </Suspense>
        </AuthGuard>
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
