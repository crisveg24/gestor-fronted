import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Package,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  Store,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, Loading } from '../components/ui';
import api from '../lib/axios';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Tipos
interface DashboardStats {
  totalSales: number;
  totalRevenue: number;
  totalProducts: number;
  totalStores: number;
  salesGrowth: number;
  revenueGrowth: number;
  lowStockProducts: number;
  activeUsers: number;
}

interface SalesData {
  date: string;
  ventas: number;
  ingresos: number;
}

interface TopProduct {
  name: string;
  sales: number;
  revenue: number;
}

interface StorePerformance {
  name: string;
  ventas: number;
  ingresos: number;
}

interface LowStockItem {
  productName: string;
  sku: string;
  currentStock: number;
  minStock: number;
  storeName: string;
}

interface PaymentMethodStats {
  method: string;
  total: number;
  count: number;
  percentage: number;
}

const DashboardPage = () => {
  // Queries
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/dashboard/global');
      const data = response.data.data;
      
      // Mapear la respuesta del backend a la interfaz del frontend
      return {
        totalSales: data.overview?.totalSales || 0,
        totalRevenue: data.overview?.totalRevenue || 0,
        totalProducts: data.overview?.totalProducts || 0,
        totalStores: data.overview?.totalStores || 0,
        salesGrowth: data.growth?.sales || 0,
        revenueGrowth: data.growth?.revenue || 0,
        lowStockProducts: data.overview?.lowStockCount || 0,
        activeUsers: data.overview?.totalUsers || 0,
      };
    },
  });

  const { data: salesData, isLoading: salesLoading } = useQuery<SalesData[]>({
    queryKey: ['dashboard-sales'],
    queryFn: async () => {
      const response = await api.get('/dashboard/sales-trend', {
        params: { days: 30 }
      });
      // Mapear: { date, sales, revenue } -> { date, ventas, ingresos }
      return (response.data.data || []).map((item: any) => ({
        date: item.date,
        ventas: item.sales || 0,
        ingresos: item.revenue || 0,
      }));
    },
  });

  const { data: topProducts, isLoading: productsLoading } = useQuery<TopProduct[]>({
    queryKey: ['dashboard-top-products'],
    queryFn: async () => {
      const response = await api.get('/dashboard/top-products', {
        params: { limit: 10 }
      });
      // Mapear: { name, totalQuantity, totalRevenue } -> { name, sales, revenue }
      return (response.data.data || []).map((item: any) => ({
        name: item.name,
        sales: item.totalQuantity || 0,
        revenue: item.totalRevenue || 0,
      }));
    },
  });

  const { data: storesPerformance, isLoading: storesLoading } = useQuery<StorePerformance[]>({
    queryKey: ['dashboard-stores'],
    queryFn: async () => {
      const response = await api.get('/dashboard/comparison');
      // Mapear: { store: { name }, totalSales, totalRevenue } -> { name, ventas, ingresos }
      return (response.data.data || []).map((item: any) => ({
        name: item.store?.name || 'Sin nombre',
        ventas: item.totalSales || 0,
        ingresos: item.totalRevenue || 0,
      }));
    },
  });

  const { data: lowStockItems, isLoading: lowStockLoading } = useQuery<LowStockItem[]>({
    queryKey: ['dashboard-low-stock'],
    queryFn: async () => {
      const response = await api.get('/inventory/alerts/low-stock');
      return response.data.data || [];
    },
  });

  const { data: paymentMethodStats, isLoading: paymentStatsLoading } = useQuery<PaymentMethodStats[]>({
    queryKey: ['dashboard-payment-methods'],
    queryFn: async () => {
      const response = await api.get('/dashboard/payment-methods');
      return response.data.data;
    },
  });

  if (statsLoading) {
    return <Loading fullScreen text="Cargando dashboard..." />;
  }

  // Tarjetas de estadísticas
  const statCards = [
    {
      title: 'Ventas Totales',
      value: stats?.totalSales || 0,
      icon: ShoppingCart,
      color: 'bg-blue-500',
      growth: stats?.salesGrowth || 0,
      prefix: '',
      suffix: ' ventas',
    },
    {
      title: 'Ingresos',
      value: stats?.totalRevenue || 0,
      icon: DollarSign,
      color: 'bg-green-500',
      growth: stats?.revenueGrowth || 0,
      prefix: '$',
      suffix: '',
    },
    {
      title: 'Productos',
      value: stats?.totalProducts || 0,
      icon: Package,
      color: 'bg-purple-500',
      growth: 0,
      prefix: '',
      suffix: ' items',
    },
    {
      title: 'Tiendas Activas',
      value: stats?.totalStores || 0,
      icon: Store,
      color: 'bg-orange-500',
      growth: 0,
      prefix: '',
      suffix: ' tiendas',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Bienvenido de vuelta, resumen de tu negocio
        </p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
          >
            <Card hover>
              <Card.Body>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {stat.prefix}
                      {stat.value.toLocaleString()}
                      {stat.suffix}
                    </p>
                    {stat.growth !== 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        {stat.growth > 0 ? (
                          <>
                            <ArrowUpRight size={16} className="text-green-500" />
                            <span className="text-sm text-green-600 font-medium">
                              +{stat.growth}%
                            </span>
                          </>
                        ) : (
                          <>
                            <ArrowDownRight size={16} className="text-red-500" />
                            <span className="text-sm text-red-600 font-medium">
                              {stat.growth}%
                            </span>
                          </>
                        )}
                        <span className="text-sm text-gray-500">vs mes anterior</span>
                      </div>
                    )}
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <stat.icon className="text-white" size={24} />
                  </div>
                </div>
              </Card.Body>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
        >
          <Card>
            <Card.Header>
              <h3 className="text-lg font-semibold text-gray-900">Tendencia de Ventas</h3>
              <p className="text-sm text-gray-500">Últimos 7 días</p>
            </Card.Header>
            <Card.Body>
              {salesLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loading size="md" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => format(new Date(value), 'dd MMM', { locale: es })}
                      stroke="#6b7280"
                    />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="ventas"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={{ fill: '#2563eb', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="ingresos"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card.Body>
          </Card>
        </motion.div>

        {/* Top Products Chart */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          <Card>
            <Card.Header>
              <h3 className="text-lg font-semibold text-gray-900">Productos Más Vendidos</h3>
              <p className="text-sm text-gray-500">Top 5 productos</p>
            </Card.Header>
            <Card.Body>
              {productsLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loading size="md" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topProducts}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="sales" fill="#2563eb" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card.Body>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Store Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.3 }}
          className="lg:col-span-2"
        >
          <Card>
            <Card.Header>
              <h3 className="text-lg font-semibold text-gray-900">Rendimiento por Tienda</h3>
              <p className="text-sm text-gray-500">Comparativa de tiendas</p>
            </Card.Header>
            <Card.Body>
              {storesLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loading size="md" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={storesPerformance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" stroke="#6b7280" />
                    <YAxis dataKey="name" type="category" width={100} stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="ventas" fill="#2563eb" radius={[0, 8, 8, 0]} />
                    <Bar dataKey="ingresos" fill="#10b981" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card.Body>
          </Card>
        </motion.div>

        {/* Low Stock Alert */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.3 }}
        >
          <Card>
            <Card.Header>
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-orange-500" size={20} />
                <h3 className="text-lg font-semibold text-gray-900">Stock Bajo</h3>
              </div>
              <p className="text-sm text-gray-500">
                {lowStockItems?.length || 0} productos
              </p>
            </Card.Header>
            <Card.Body className="p-0">
              {lowStockLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loading size="md" />
                </div>
              ) : lowStockItems && lowStockItems.length > 0 ? (
                <div className="max-h-[300px] overflow-y-auto">
                  {lowStockItems.slice(0, 5).map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="px-6 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.productName}
                          </p>
                          <p className="text-xs text-gray-500">{item.storeName}</p>
                        </div>
                        <div className="text-right ml-2">
                          <p className="text-sm font-semibold text-orange-600">
                            {item.currentStock}
                          </p>
                          <p className="text-xs text-gray-500">min: {item.minStock}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-12 text-center text-gray-500">
                  <Package size={48} className="mx-auto mb-2 text-gray-300" />
                  <p>No hay productos con stock bajo</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </motion.div>
      </div>

      {/* Payment Methods Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.3 }}
      >
        <Card>
          <Card.Header>
            <div className="flex items-center gap-2">
              <DollarSign className="text-green-500" size={20} />
              <h3 className="text-lg font-semibold text-gray-900">Métodos de Pago</h3>
            </div>
            <p className="text-sm text-gray-500">
              Distribución de ventas del día
            </p>
          </Card.Header>
          <Card.Body>
            {paymentStatsLoading ? (
              <div className="h-48 flex items-center justify-center">
                <Loading size="md" />
              </div>
            ) : paymentMethodStats && paymentMethodStats.length > 0 ? (
              <div className="space-y-4">
                {/* Total del día */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600 font-medium">Total Venta del Día</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    ${paymentMethodStats.reduce((sum, pm) => sum + pm.total, 0).toLocaleString('es-CO', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>

                {/* Desglose por método */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {paymentMethodStats.map((pm, index) => {
                    const icons: Record<string, string> = {
                      efectivo: '💵',
                      nequi: '🟣',
                      daviplata: '🟠',
                      llave_bancolombia: '🔑',
                      tarjeta: '💳',
                      transferencia: '🏦',
                    };

                    const labels: Record<string, string> = {
                      efectivo: 'Efectivo',
                      nequi: 'Nequi',
                      daviplata: 'Daviplata',
                      llave_bancolombia: 'Llave Bancolombia',
                      tarjeta: 'Tarjeta',
                      transferencia: 'Transferencia',
                    };

                    const bgColors: Record<string, string> = {
                      efectivo: 'bg-green-50 border-green-200',
                      nequi: 'bg-purple-50 border-purple-200',
                      daviplata: 'bg-orange-50 border-orange-200',
                      llave_bancolombia: 'bg-yellow-50 border-yellow-200',
                      tarjeta: 'bg-blue-50 border-blue-200',
                      transferencia: 'bg-indigo-50 border-indigo-200',
                    };

                    const textColors: Record<string, string> = {
                      efectivo: 'text-green-700',
                      nequi: 'text-purple-700',
                      daviplata: 'text-orange-700',
                      llave_bancolombia: 'text-yellow-700',
                      tarjeta: 'text-blue-700',
                      transferencia: 'text-indigo-700',
                    };

                    return (
                      <motion.div
                        key={pm.method}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className={`${bgColors[pm.method] || 'bg-gray-50 border-gray-200'} p-4 rounded-lg border-2`}
                      >
                        <div className="text-center">
                          <div className="text-3xl mb-2">
                            {icons[pm.method] || '💰'}
                          </div>
                          <p className="text-xs font-medium text-gray-600 mb-1">
                            {labels[pm.method] || pm.method}
                          </p>
                          <p className={`text-lg font-bold ${textColors[pm.method] || 'text-gray-900'}`}>
                            ${pm.total.toLocaleString('es-CO', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {pm.count} {pm.count === 1 ? 'venta' : 'ventas'}
                          </p>
                          <div className="mt-2 bg-white rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full ${bgColors[pm.method]?.replace('bg-', 'bg-') || 'bg-gray-300'}`}
                              style={{ width: `${pm.percentage}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {pm.percentage.toFixed(1)}%
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Ejemplo como lo haces en papel */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-2 font-medium">💡 Ejemplo de cierre:</p>
                  <p className="text-sm text-gray-700 font-mono">
                    Total: ${paymentMethodStats.reduce((sum, pm) => sum + pm.total, 0).toLocaleString('es-CO')}
                    {paymentMethodStats.map(pm => {
                      const labels: Record<string, string> = {
                        nequi: 'Nequi',
                        daviplata: 'Daviplata',
                        llave_bancolombia: 'Llave Bancolombia',
                        efectivo: 'Efectivo',
                        tarjeta: 'Tarjeta',
                        transferencia: 'Transferencia',
                      };
                      return ` | ${labels[pm.method] || pm.method}: $${pm.total.toLocaleString('es-CO')}`;
                    }).join('')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <DollarSign size={48} className="mx-auto mb-2 text-gray-300" />
                <p>No hay ventas registradas hoy</p>
              </div>
            )}
          </Card.Body>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.3 }}
      >
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900">Acciones Rápidas</h3>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => (window.location.href = '/productos/nuevo')}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all group"
              >
                <Package className="text-gray-400 group-hover:text-primary-600 mb-2" size={32} />
                <span className="text-sm font-medium text-gray-700 group-hover:text-primary-700">
                  Nuevo Producto
                </span>
              </button>

              <button
                onClick={() => (window.location.href = '/ventas')}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all group"
              >
                <ShoppingCart className="text-gray-400 group-hover:text-primary-600 mb-2" size={32} />
                <span className="text-sm font-medium text-gray-700 group-hover:text-primary-700">
                  Registrar Venta
                </span>
              </button>

              <button
                onClick={() => (window.location.href = '/inventario')}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all group"
              >
                <Package className="text-gray-400 group-hover:text-primary-600 mb-2" size={32} />
                <span className="text-sm font-medium text-gray-700 group-hover:text-primary-700">
                  Ajustar Inventario
                </span>
              </button>

              <button
                onClick={() => (window.location.href = '/reportes')}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all group"
              >
                <TrendingUp className="text-gray-400 group-hover:text-primary-600 mb-2" size={32} />
                <span className="text-sm font-medium text-gray-700 group-hover:text-primary-700">
                  Ver Reportes
                </span>
              </button>
            </div>
          </Card.Body>
        </Card>
      </motion.div>
    </div>
  );
};

export default DashboardPage;
