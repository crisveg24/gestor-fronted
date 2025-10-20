import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Download,
  FileText,
  Calendar,
  Filter,
  DollarSign,
  Package,
} from 'lucide-react';
import { Card, Button, toast } from '../components/ui';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Función helper para formatear métodos de pago
const formatPaymentMethod = (method: string): string => {
  const methods: Record<string, string> = {
    efectivo: '💵 Efectivo',
    nequi: '🟣 Nequi',
    daviplata: '🟠 Daviplata',
    llave_bancolombia: '🔑 Llave Bancolombia',
    tarjeta: '💳 Tarjeta',
    transferencia: '🏦 Transferencia',
  };
  return methods[method] || method;
};

// Tipos
interface SalesTrendData {
  date: string;
  sales: number;
  revenue: number;
}

interface TopProductData {
  name: string;
  quantity: number;
  revenue: number;
}

interface StorePerformanceData {
  store: string;
  sales: number;
  revenue: number;
}

interface CategoryData {
  name: string;
  value: number;
  [key: string]: any;
}

interface PaymentMethodData {
  method: string;
  value: number;
  [key: string]: any;
}

interface ReportStats {
  totalSales: number;
  totalRevenue: number;
  totalProducts: number;
  averageTicket: number;
}

const ReportsPage = () => {
  const { user } = useAuthStore();

  // Estados
  const [dateFrom, setDateFrom] = useState(
    format(subDays(new Date(), 30), 'yyyy-MM-dd')
  );
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedStore, setSelectedStore] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>(
    'daily'
  );

  // Queries
  const { data: stores } = useQuery({
    queryKey: ['stores-list'],
    queryFn: async () => {
      const response = await api.get('/stores');
      return response.data.data.stores;
    },
    enabled: user?.role === 'admin',
  });

  const { data: stats, isLoading: loadingStats } = useQuery<ReportStats>({
    queryKey: ['report-stats', dateFrom, dateTo, selectedStore, selectedCategory],
    queryFn: async () => {
      const response = await api.get('/reports/stats', {
        params: {
          dateFrom,
          dateTo,
          store: selectedStore !== 'all' ? selectedStore : undefined,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
        },
      });
      return response.data.data;
    },
  });

  const { data: salesTrend, isLoading: loadingSalesTrend } = useQuery<
    SalesTrendData[]
  >({
    queryKey: [
      'report-sales-trend',
      dateFrom,
      dateTo,
      selectedStore,
      selectedCategory,
      period,
    ],
    queryFn: async () => {
      const response = await api.get('/reports/sales-trend', {
        params: {
          dateFrom,
          dateTo,
          store: selectedStore !== 'all' ? selectedStore : undefined,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          period,
        },
      });
      return response.data.data;
    },
  });

  const { data: topProducts, isLoading: loadingTopProducts } = useQuery<
    TopProductData[]
  >({
    queryKey: ['report-top-products', dateFrom, dateTo, selectedStore],
    queryFn: async () => {
      const response = await api.get('/reports/top-products', {
        params: {
          dateFrom,
          dateTo,
          store: selectedStore !== 'all' ? selectedStore : undefined,
          limit: 10,
        },
      });
      return response.data.data;
    },
  });

  const { data: storePerformance, isLoading: loadingStorePerformance } = useQuery<
    StorePerformanceData[]
  >({
    queryKey: ['report-store-performance', dateFrom, dateTo],
    queryFn: async () => {
      const response = await api.get('/reports/by-store', {
        params: { dateFrom, dateTo },
      });
      return response.data.data;
    },
    enabled: user?.role === 'admin',
  });

  const { data: categoryData, isLoading: loadingCategoryData } = useQuery<
    CategoryData[]
  >({
    queryKey: ['report-by-category', dateFrom, dateTo, selectedStore],
    queryFn: async () => {
      const response = await api.get('/reports/by-category', {
        params: {
          dateFrom,
          dateTo,
          store: selectedStore !== 'all' ? selectedStore : undefined,
        },
      });
      return response.data.data;
    },
  });

  const { data: paymentMethodData, isLoading: loadingPaymentMethodData } = useQuery<
    PaymentMethodData[]
  >({
    queryKey: ['report-by-payment', dateFrom, dateTo, selectedStore],
    queryFn: async () => {
      const response = await api.get('/reports/by-payment-method', {
        params: {
          dateFrom,
          dateTo,
          store: selectedStore !== 'all' ? selectedStore : undefined,
        },
      });
      return response.data.data;
    },
  });

  // Funciones de exportación
  const exportToPDF = () => {
    try {
      const doc = new jsPDF();

      // Header
      doc.setFontSize(20);
      doc.text('Reporte de Ventas', 14, 20);

      doc.setFontSize(10);
      doc.text(`Período: ${dateFrom} - ${dateTo}`, 14, 28);
      if (selectedStore !== 'all') {
        const storeName =
          stores?.find((s: any) => s._id === selectedStore)?.name || 'N/A';
        doc.text(`Tienda: ${storeName}`, 14, 34);
      }

      // Estadísticas
      let yPos = selectedStore !== 'all' ? 42 : 36;
      doc.setFontSize(14);
      doc.text('Resumen General', 14, yPos);

      yPos += 8;
      doc.setFontSize(10);
      doc.text(`Total de Ventas: ${stats?.totalSales || 0}`, 14, yPos);
      yPos += 6;
      doc.text(
        `Ingresos Totales: $${(stats?.totalRevenue || 0).toLocaleString()}`,
        14,
        yPos
      );
      yPos += 6;
      doc.text(`Productos Vendidos: ${stats?.totalProducts || 0}`, 14, yPos);
      yPos += 6;
      doc.text(
        `Ticket Promedio: $${(stats?.averageTicket || 0).toLocaleString()}`,
        14,
        yPos
      );

      // Top Products Table
      if (topProducts && topProducts.length > 0) {
        yPos += 12;
        doc.setFontSize(14);
        doc.text('Productos Más Vendidos', 14, yPos);

        autoTable(doc, {
          startY: yPos + 4,
          head: [['Producto', 'Cantidad', 'Ingresos']],
          body: topProducts.slice(0, 10).map((p) => [
            p.name,
            p.quantity.toString(),
            `$${p.revenue.toLocaleString()}`,
          ]),
          theme: 'grid',
          headStyles: { fillColor: [99, 102, 241] },
        });
      }

      // Store Performance Table (solo admin)
      if (
        user?.role === 'admin' &&
        storePerformance &&
        storePerformance.length > 0
      ) {
        const finalY = (doc as any).lastAutoTable.finalY || yPos + 40;
        doc.setFontSize(14);
        doc.text('Rendimiento por Tienda', 14, finalY + 12);

        autoTable(doc, {
          startY: finalY + 16,
          head: [['Tienda', 'Ventas', 'Ingresos']],
          body: storePerformance.map((s) => [
            s.store,
            s.sales.toString(),
            `$${s.revenue.toLocaleString()}`,
          ]),
          theme: 'grid',
          headStyles: { fillColor: [99, 102, 241] },
        });
      }

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Página ${i} de ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
        doc.text(
          `Generado el ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
          14,
          doc.internal.pageSize.getHeight() - 10
        );
      }

      doc.save(
        `reporte-ventas-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`
      );
      toast.success('Reporte PDF generado exitosamente');
    } catch (error) {
      console.error('Error al generar PDF:', error);
      toast.error('Error al generar el PDF');
    }
  };

  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Hoja 1: Resumen
      const summaryData = [
        ['Reporte de Ventas'],
        ['Período', `${dateFrom} - ${dateTo}`],
        [''],
        ['Estadística', 'Valor'],
        ['Total de Ventas', stats?.totalSales || 0],
        ['Ingresos Totales', stats?.totalRevenue || 0],
        ['Productos Vendidos', stats?.totalProducts || 0],
        ['Ticket Promedio', stats?.averageTicket || 0],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

      // Hoja 2: Top Products
      if (topProducts && topProducts.length > 0) {
        const productsData = [
          ['Producto', 'Cantidad', 'Ingresos'],
          ...topProducts.map((p) => [p.name, p.quantity, p.revenue]),
        ];
        const ws2 = XLSX.utils.aoa_to_sheet(productsData);
        XLSX.utils.book_append_sheet(wb, ws2, 'Top Productos');
      }

      // Hoja 3: Tendencia de Ventas
      if (salesTrend && salesTrend.length > 0) {
        const trendData = [
          ['Fecha', 'Ventas', 'Ingresos'],
          ...salesTrend.map((t) => [t.date, t.sales, t.revenue]),
        ];
        const ws3 = XLSX.utils.aoa_to_sheet(trendData);
        XLSX.utils.book_append_sheet(wb, ws3, 'Tendencia');
      }

      // Hoja 4: Por Tienda (solo admin)
      if (
        user?.role === 'admin' &&
        storePerformance &&
        storePerformance.length > 0
      ) {
        const storeData = [
          ['Tienda', 'Ventas', 'Ingresos'],
          ...storePerformance.map((s) => [s.store, s.sales, s.revenue]),
        ];
        const ws4 = XLSX.utils.aoa_to_sheet(storeData);
        XLSX.utils.book_append_sheet(wb, ws4, 'Por Tienda');
      }

      // Hoja 5: Por Categoría
      if (categoryData && categoryData.length > 0) {
        const catData = [
          ['Categoría', 'Ventas'],
          ...categoryData.map((c) => [c.name, c.value]),
        ];
        const ws5 = XLSX.utils.aoa_to_sheet(catData);
        XLSX.utils.book_append_sheet(wb, ws5, 'Por Categoría');
      }

      // Hoja 6: Por Método de Pago
      if (paymentMethodData && paymentMethodData.length > 0) {
        const paymentData = [
          ['Método de Pago', 'Total'],
          ...paymentMethodData.map((p) => [p.method, p.value]),
        ];
        const ws6 = XLSX.utils.aoa_to_sheet(paymentData);
        XLSX.utils.book_append_sheet(wb, ws6, 'Por Método de Pago');
      }

      XLSX.writeFile(
        wb,
        `reporte-ventas-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`
      );
      toast.success('Reporte Excel generado exitosamente');
    } catch (error) {
      console.error('Error al generar Excel:', error);
      toast.error('Error al generar el Excel');
    }
  };

  // Preset de fechas
  const setDatePreset = (preset: string) => {
    const today = new Date();
    switch (preset) {
      case 'today':
        setDateFrom(format(startOfDay(today), 'yyyy-MM-dd'));
        setDateTo(format(endOfDay(today), 'yyyy-MM-dd'));
        break;
      case 'week':
        setDateFrom(format(subDays(today, 7), 'yyyy-MM-dd'));
        setDateTo(format(today, 'yyyy-MM-dd'));
        break;
      case 'month':
        setDateFrom(format(subDays(today, 30), 'yyyy-MM-dd'));
        setDateTo(format(today, 'yyyy-MM-dd'));
        break;
      case 'year':
        setDateFrom(format(subDays(today, 365), 'yyyy-MM-dd'));
        setDateTo(format(today, 'yyyy-MM-dd'));
        break;
    }
  };

  // Colores para gráficos
  const COLORS = [
    '#6366f1',
    '#8b5cf6',
    '#ec4899',
    '#f59e0b',
    '#10b981',
    '#3b82f6',
    '#ef4444',
    '#14b8a6',
  ];

  const isLoading =
    loadingStats ||
    loadingSalesTrend ||
    loadingTopProducts ||
    loadingStorePerformance ||
    loadingCategoryData ||
    loadingPaymentMethodData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes y Análisis</h1>
          <p className="text-gray-600 mt-1">
            Análisis detallado del rendimiento de ventas
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={exportToExcel}
            leftIcon={<FileText size={20} />}
            disabled={isLoading}
          >
            Exportar Excel
          </Button>
          <Button
            onClick={exportToPDF}
            leftIcon={<Download size={20} />}
            disabled={isLoading}
          >
            Exportar PDF
          </Button>
        </div>
      </motion.div>

      {/* Filtros */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <Card.Header>
            <div className="flex items-center gap-2">
              <Filter size={20} className="text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Filtros</h3>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="space-y-4">
              {/* Presets de fechas */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDatePreset('today')}
                >
                  Hoy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDatePreset('week')}
                >
                  Última Semana
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDatePreset('month')}
                >
                  Último Mes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDatePreset('year')}
                >
                  Último Año
                </Button>
              </div>

              {/* Filtros principales */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha Desde
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha Hasta
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {user?.role === 'admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tienda
                    </label>
                    <select
                      value={selectedStore}
                      onChange={(e) => setSelectedStore(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="all">Todas las tiendas</option>
                      {stores?.map((store: any) => (
                        <option key={store._id} value={store._id}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="all">Todas las categorías</option>
                    <option value="Electrónicos">Electrónicos</option>
                    <option value="Ropa">Ropa</option>
                    <option value="Alimentos">Alimentos</option>
                    <option value="Hogar">Hogar</option>
                    <option value="Deportes">Deportes</option>
                    <option value="Juguetes">Juguetes</option>
                    <option value="Libros">Libros</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
              </div>

              {/* Período para tendencia */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agrupar tendencia por:
                </label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={period === 'daily' ? 'primary' : 'outline'}
                    onClick={() => setPeriod('daily')}
                  >
                    Día
                  </Button>
                  <Button
                    size="sm"
                    variant={period === 'weekly' ? 'primary' : 'outline'}
                    onClick={() => setPeriod('weekly')}
                  >
                    Semana
                  </Button>
                  <Button
                    size="sm"
                    variant={period === 'monthly' ? 'primary' : 'outline'}
                    onClick={() => setPeriod('monthly')}
                  >
                    Mes
                  </Button>
                  <Button
                    size="sm"
                    variant={period === 'yearly' ? 'primary' : 'outline'}
                    onClick={() => setPeriod('yearly')}
                  >
                    Año
                  </Button>
                </div>
              </div>
            </div>
          </Card.Body>
        </Card>
      </motion.div>

      {/* Estadísticas Generales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <Card.Body>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Ventas</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {stats?.totalSales || 0}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <TrendingUp size={24} className="text-blue-600" />
                </div>
              </div>
            </Card.Body>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <Card.Body>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Ingresos Totales</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-1">
                    ${(stats?.totalRevenue || 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <DollarSign size={24} className="text-emerald-600" />
                </div>
              </div>
            </Card.Body>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <Card.Body>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Productos Vendidos</p>
                  <p className="text-3xl font-bold text-purple-600 mt-1">
                    {stats?.totalProducts || 0}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Package size={24} className="text-purple-600" />
                </div>
              </div>
            </Card.Body>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <Card.Body>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Ticket Promedio</p>
                  <p className="text-3xl font-bold text-orange-600 mt-1">
                    ${(stats?.averageTicket || 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Calendar size={24} className="text-orange-600" />
                </div>
              </div>
            </Card.Body>
          </Card>
        </motion.div>
      </div>

      {/* Tendencia de Ventas */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900">
              Tendencia de Ventas
            </h3>
          </Card.Header>
          <Card.Body>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip
                    formatter={(value: any, name: string) => {
                      if (name === 'revenue') {
                        return `$${value.toLocaleString()}`;
                      }
                      return value;
                    }}
                    labelFormatter={(label) => `Fecha: ${label}`}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="sales"
                    name="Ventas"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ fill: '#6366f1' }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    name="Ingresos"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card.Body>
        </Card>
      </motion.div>

      {/* Gráficos en 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Productos */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card>
            <Card.Header>
              <h3 className="text-lg font-semibold text-gray-900">
                Top 10 Productos Más Vendidos
              </h3>
            </Card.Header>
            <Card.Body>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts || []} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip
                      formatter={(value: any, name: string) => {
                        if (name === 'revenue') {
                          return [`$${value.toLocaleString()}`, 'Ingresos'];
                        }
                        return [value, 'Cantidad'];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="quantity" fill="#6366f1" name="Cantidad" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </motion.div>

        {/* Ventas por Categoría */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card>
            <Card.Header>
              <h3 className="text-lg font-semibold text-gray-900">
                Ventas por Categoría
              </h3>
            </Card.Header>
            <Card.Body>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) =>
                        `${entry.name}: ${(entry.percent * 100).toFixed(0)}%`
                      }
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData?.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </motion.div>

        {/* Rendimiento por Tienda (solo admin) */}
        {user?.role === 'admin' && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Card>
              <Card.Header>
                <h3 className="text-lg font-semibold text-gray-900">
                  Rendimiento por Tienda
                </h3>
              </Card.Header>
              <Card.Body>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={storePerformance || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="store" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip
                        formatter={(value: any, name: string) => {
                          if (name === 'revenue') {
                            return [`$${value.toLocaleString()}`, 'Ingresos'];
                          }
                          return [value, 'Ventas'];
                        }}
                      />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="sales"
                        fill="#6366f1"
                        name="Ventas"
                      />
                      <Bar
                        yAxisId="right"
                        dataKey="revenue"
                        fill="#10b981"
                        name="Ingresos"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card.Body>
            </Card>
          </motion.div>
        )}

        {/* Ventas por Método de Pago */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.0 }}
        >
          <Card>
            <Card.Header>
              <h3 className="text-lg font-semibold text-gray-900">
                Ventas por Método de Pago
              </h3>
            </Card.Header>
            <Card.Body>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethodData || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) =>
                        `${formatPaymentMethod(entry.method)}: ${(entry.percent * 100).toFixed(0)}%`
                      }
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {paymentMethodData?.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => `$${value.toLocaleString()}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default ReportsPage;
