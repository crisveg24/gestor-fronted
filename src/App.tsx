import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';

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
  
  return <>{children}</>;
}

// ==================== APP COMPONENT ====================
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Redirect root to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div className="p-8">
                  <h1 className="text-3xl font-bold">Dashboard</h1>
                  <p className="mt-4">Bienvenido al Gestor de Tiendas</p>
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
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
