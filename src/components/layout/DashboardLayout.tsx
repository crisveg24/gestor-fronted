import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Store,
  Users,
  BarChart3,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Box,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../ui';

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  adminOnly?: boolean;
}

const menuItems: MenuItem[] = [
  { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' },
  { icon: <Package size={20} />, label: 'Productos', path: '/productos' },
  { icon: <Box size={20} />, label: 'Inventario', path: '/inventario' },
  { icon: <ShoppingCart size={20} />, label: 'Ventas', path: '/ventas' },
  { icon: <Store size={20} />, label: 'Tiendas', path: '/tiendas', adminOnly: true },
  { icon: <Users size={20} />, label: 'Usuarios', path: '/usuarios', adminOnly: true },
  { icon: <BarChart3 size={20} />, label: 'Reportes', path: '/reportes' },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    toast.success('Sesión cerrada exitosamente');
  };

  const isActive = (path: string) => location.pathname === path;

  const filteredMenuItems = menuItems.filter((item) => {
    if (item.adminOnly) {
      return user?.role === 'admin';
    }
    return true;
  });

  // Breadcrumbs
  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    return paths.map((path, index) => ({
      label: path.charAt(0).toUpperCase() + path.slice(1),
      path: '/' + paths.slice(0, index + 1).join('/'),
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Menu Backdrop */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 256 : 80 }}
        className="fixed left-0 top-0 h-full bg-white border-r border-gray-200 z-30 hidden lg:block"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
            <motion.div
              animate={{ opacity: sidebarOpen ? 1 : 0 }}
              className="flex items-center gap-2"
            >
              <Store className="text-primary-600" size={24} />
              {sidebarOpen && <span className="font-bold text-lg">Gestor</span>}
            </motion.div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {filteredMenuItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg
                    transition-all duration-200
                    ${
                      active
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  <span className={active ? 'text-primary-600' : 'text-gray-500'}>{item.icon}</span>
                  {sidebarOpen && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-700 font-semibold">
                  {user?.name.charAt(0).toUpperCase()}
                </span>
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={18} />
              {sidebarOpen && <span>Cerrar Sesión</span>}
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Sidebar - Mobile */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'tween' }}
            className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 z-50 lg:hidden"
          >
            <div className="flex flex-col h-full">
              {/* Logo */}
              <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Store className="text-primary-600" size={24} />
                  <span className="font-bold text-lg">Gestor</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Menu Items */}
              <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                {filteredMenuItems.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg
                        transition-all duration-200
                        ${
                          active
                            ? 'bg-primary-50 text-primary-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }
                      `}
                    >
                      <span className={active ? 'text-primary-600' : 'text-gray-500'}>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* User Profile */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-700 font-semibold">
                      {user?.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut size={18} />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div
        className="transition-all duration-300 lg:ml-0"
        style={{
          marginLeft: window.innerWidth >= 1024 ? (sidebarOpen ? '256px' : '80px') : '0',
        }}
      >
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-gray-200 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-20">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
          >
            <Menu size={24} />
          </button>

          {/* Breadcrumbs */}
          <div className="hidden md:flex items-center gap-2 text-sm">
            <Link to="/dashboard" className="text-gray-500 hover:text-gray-700">
              Inicio
            </Link>
            {getBreadcrumbs().map((crumb, index) => (
              <div key={crumb.path} className="flex items-center gap-2">
                <ChevronRight size={16} className="text-gray-400" />
                <Link
                  to={crumb.path}
                  className={
                    index === getBreadcrumbs().length - 1
                      ? 'text-gray-900 font-medium'
                      : 'text-gray-500 hover:text-gray-700'
                  }
                >
                  {crumb.label}
                </Link>
              </div>
            ))}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:block">
              {user?.store?.name || 'Todas las tiendas'}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
