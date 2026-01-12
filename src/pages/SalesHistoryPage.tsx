import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  History,
  Eye,
  Edit2,
  Printer,
  Copy,
  Calendar,
  Store,
  User,
  Package,
  DollarSign,
  AlertCircle,
  Check,
  X,
  FileSpreadsheet,
  FileText,
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Card, Button, Modal, toast, SearchBar, EmptyStateNoStore } from '../components/ui';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { printTicket } from '../utils/printTicket';
import type { AxiosApiError, Store as StoreType } from '../types';

// Tipos
interface CashRegister {
  _id: string;
  store: { _id: string; name: string };
  openedBy: { _id: string; name: string };
  closedBy?: { _id: string; name: string };
  openingAmount: number;
  closingAmount?: number;
  expectedAmount?: number;
  expectedClosingAmount?: number;
  actualClosingAmount?: number;
  difference?: number;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
  closingNotes?: string;
  salesCount?: number;
  totalSales?: number;
  movements?: Array<{
    type: 'entrada' | 'salida' | 'income' | 'expense';
    amount: number;
    reason?: string;
    description?: string;
    createdAt: string;
  }>;
  salesByMethodDetail?: {
    efectivo: { total: number; count: number };
    nequi: { total: number; count: number };
    daviplata: { total: number; count: number };
    llave_bancolombia: { total: number; count: number };
    tarjeta: { total: number; count: number };
    transferencia: { total: number; count: number };
  };
}

interface CashRegisterStats {
  totalDays: number;
  totalDifference: number;
  avgDifference: number;
  daysWithShortage: number;
  daysWithSurplus: number;
}

interface SaleItem {
  product: {
    _id: string;
    name: string;
    sku: string;
    price: number;
  };
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface Sale {
  _id: string;
  saleCode: string;
  store: {
    _id: string;
    name: string;
  };
  soldBy: {
    _id: string;
    name: string;
    email: string;
  };
  items: SaleItem[];
  total: number;
  tax: number;
  discount: number;
  finalTotal: number;
  paymentMethod: string;
  status: 'completed' | 'cancelled' | 'refunded';
  notes?: string;
  wasEdited: boolean;
  modifiedBy?: {
    name: string;
    email: string;
  };
  modifiedAt?: string;
  cancelledBy?: {
    name: string;
  };
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
}

// Helpers
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

const getPaymentBadgeColor = (method: string): string => {
  const colors: Record<string, string> = {
    efectivo: 'bg-green-100 text-green-800',
    nequi: 'bg-purple-100 text-purple-800',
    daviplata: 'bg-orange-100 text-orange-800',
    llave_bancolombia: 'bg-yellow-100 text-yellow-800',
    tarjeta: 'bg-blue-100 text-blue-800',
    transferencia: 'bg-cyan-100 text-cyan-800',
  };
  return colors[method] || 'bg-gray-100 text-gray-800';
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
      return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full flex items-center gap-1"><Check size={12} /> Completada</span>;
    case 'cancelled':
      return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full flex items-center gap-1"><X size={12} /> Cancelada</span>;
    case 'refunded':
      return <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">Devuelta</span>;
    default:
      return null;
  }
};

const SalesHistoryPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Tab activo: 'ventas' o 'cajas'
  const [activeTab, setActiveTab] = useState<'ventas' | 'cajas'>('ventas');

  // Estados de filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStore, setFilterStore] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Estados para historial de cajas
  const [cashRegisterDateFrom, setCashRegisterDateFrom] = useState('');
  const [cashRegisterDateTo, setCashRegisterDateTo] = useState('');
  const [cashRegisterStore, setCashRegisterStore] = useState('');
  const [selectedCashRegister, setSelectedCashRegister] = useState<CashRegister | null>(null);
  const [cashRegisterDetailOpen, setCashRegisterDetailOpen] = useState(false);
  
  // Estados de ordenamiento para historial de cajas
  const [cashSortField, setCashSortField] = useState<'date' | 'store' | 'sales' | 'difference' | 'opening'>('date');
  const [cashSortOrder, setCashSortOrder] = useState<'asc' | 'desc'>('desc');

  // Estados de modales
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Estados de edición
  const [editPaymentMethod, setEditPaymentMethod] = useState('');
  const [editDiscount, setEditDiscount] = useState(0);
  const [editNotes, setEditNotes] = useState('');

  // Query para tiendas (solo admins)
  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const response = await api.get('/stores');
      return response.data.data;
    },
    enabled: isAdmin,
  });

  // Query para historial de ventas
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales-history', searchQuery, filterStore, filterPaymentMethod, filterStatus, dateFrom, dateTo],
    queryFn: async () => {
      const response = await api.get('/sales', {
        params: {
          search: searchQuery || undefined,
          store: filterStore || (user?.role !== 'admin' ? user?.store?._id : undefined),
          paymentMethod: filterPaymentMethod || undefined,
          status: filterStatus || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          limit: 100,
        },
      });
      return response.data.data;
    },
    enabled: activeTab === 'ventas',
  });

  // Query para historial de cajas
  const { data: cashRegisterData, isLoading: isLoadingCashRegisters } = useQuery<{
    registers: CashRegister[];
    stats: CashRegisterStats;
  }>({
    queryKey: ['cash-register-history', cashRegisterStore, cashRegisterDateFrom, cashRegisterDateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      const storeId = cashRegisterStore || (user?.role !== 'admin' ? user?.store?._id : undefined);
      if (storeId) params.append('storeId', storeId);
      if (cashRegisterDateFrom) params.append('startDate', cashRegisterDateFrom);
      if (cashRegisterDateTo) params.append('endDate', cashRegisterDateTo);
      params.append('limit', '100');
      
      const response = await api.get(`/cash-register/history?${params.toString()}`);
      return {
        registers: response.data?.data || [],
        stats: response.data?.stats || { totalDays: 0, totalDifference: 0 }
      };
    },
    enabled: activeTab === 'cajas',
  });

  const cashRegisters = cashRegisterData?.registers || [];
  const cashStats = cashRegisterData?.stats;

  // Ordenar historial de cajas
  const sortedCashRegisters = [...cashRegisters].sort((a, b) => {
    let comparison = 0;
    
    switch (cashSortField) {
      case 'date':
        comparison = new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime();
        break;
      case 'store':
        comparison = (a.store?.name || '').localeCompare(b.store?.name || '');
        break;
      case 'sales':
        comparison = (a.totalSales || 0) - (b.totalSales || 0);
        break;
      case 'difference':
        comparison = (a.difference || 0) - (b.difference || 0);
        break;
      case 'opening':
        comparison = (a.openingAmount || 0) - (b.openingAmount || 0);
        break;
      default:
        comparison = 0;
    }
    
    return cashSortOrder === 'asc' ? comparison : -comparison;
  });

  // Función para cambiar ordenamiento
  const handleCashSort = (field: 'date' | 'store' | 'sales' | 'difference' | 'opening') => {
    if (cashSortField === field) {
      setCashSortOrder(cashSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setCashSortField(field);
      setCashSortOrder('desc');
    }
  };

  const sales: Sale[] = salesData?.sales || [];

  // Mutation para editar venta
  const editSaleMutation = useMutation({
    mutationFn: async (data: { id: string; notes?: string; paymentMethod?: string; discount?: number }) => {
      await api.put(`/sales/${data.id}/items`, {
        notes: data.notes,
        paymentMethod: data.paymentMethod,
        discount: data.discount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-history'] });
      toast.success('Venta actualizada exitosamente');
      setEditModalOpen(false);
      setDetailModalOpen(false);
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosApiError;
      toast.error(axiosError.response?.data?.message || 'Error al actualizar la venta');
    },
  });

  // Handlers
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Código ${code} copiado`);
  };

  const handleViewDetail = (sale: Sale) => {
    setSelectedSale(sale);
    setDetailModalOpen(true);
  };

  const handleEditSale = (sale: Sale) => {
    setSelectedSale(sale);
    setEditPaymentMethod(sale.paymentMethod);
    setEditDiscount(sale.discount);
    setEditNotes(sale.notes || '');
    setEditModalOpen(true);
  };

  const handlePrintTicket = (sale: Sale) => {
    const ticketData = {
      store: {
        name: sale.store.name,
        address: '',
        phone: '',
      },
      items: sale.items.map(item => ({
        product: {
          name: item.product?.name || 'Producto',
          price: item.unitPrice,
        },
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
      subtotal: sale.total,
      discount: sale.discount,
      tax: sale.tax,
      total: sale.finalTotal,
      paymentMethod: sale.paymentMethod,
      saleId: sale.saleCode,
      date: new Date(sale.createdAt),
    };

    printTicket(ticketData);
    toast.success('Imprimiendo ticket...');
  };

  const handleViewCashRegisterDetail = (register: CashRegister) => {
    setSelectedCashRegister(register);
    setCashRegisterDetailOpen(true);
  };

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '$0';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  // Exportar historial de cajas a Excel
  const exportCashRegistersToExcel = async () => {
    if (!cashRegisters || cashRegisters.length === 0) {
      toast.error('No hay registros de caja para exportar');
      return;
    }

    try {
      const XLSX = await import('xlsx');

      const excelData = cashRegisters.map((register) => ({
        'Fecha Apertura': format(new Date(register.openedAt), 'dd/MM/yyyy HH:mm', { locale: es }),
        'Fecha Cierre': register.closedAt ? format(new Date(register.closedAt), 'dd/MM/yyyy HH:mm', { locale: es }) : 'Abierta',
        'Tienda': register.store?.name || 'N/A',
        'Abierta por': register.openedBy?.name || 'N/A',
        'Cerrada por': register.closedBy?.name || 'N/A',
        'Monto Apertura': register.openingAmount,
        'Ventas Totales': register.totalSales || 0,
        '# Ventas': register.salesCount || 0,
        'Esperado': register.expectedAmount || 0,
        'Monto Cierre': register.actualClosingAmount || register.closingAmount || 0,
        'Diferencia': register.difference || 0,
        'Estado': register.status === 'open' ? 'Abierta' : 'Cerrada',
        'Notas': register.closingNotes || '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial de Cajas');

      const fileName = `historial_cajas_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success(`Reporte exportado: ${fileName}`);
    } catch (error) {
      console.error('Error al exportar:', error);
      toast.error('Error al exportar');
    }
  };

  const confirmEdit = () => {
    if (!selectedSale) return;

    editSaleMutation.mutate({
      id: selectedSale._id,
      notes: editNotes,
      paymentMethod: editPaymentMethod,
      discount: editDiscount,
    });
  };

  // Exportar a Excel
  const exportToExcel = async () => {
    if (!sales || sales.length === 0) {
      toast.error('No hay ventas para exportar');
      return;
    }

    try {
      const XLSX = await import('xlsx');

      const excelData = sales.map((sale) => ({
        'Código': sale.saleCode,
        'Fecha': format(new Date(sale.createdAt), 'dd/MM/yyyy HH:mm', { locale: es }),
        'Tienda': sale.store?.name || 'N/A',
        'Vendedor': sale.soldBy?.name || 'N/A',
        'Productos': sale.items?.length || 0,
        'Subtotal': sale.total,
        'Descuento': sale.discount,
        'IVA': sale.tax,
        'Total': sale.finalTotal,
        'Método de Pago': formatPaymentMethod(sale.paymentMethod).replace(/[^\w\s]/g, ''),
        'Estado': sale.status === 'completed' ? 'Completada' : sale.status === 'cancelled' ? 'Cancelada' : 'Devuelta',
        'Editada': sale.wasEdited ? 'Sí' : 'No',
        'Notas': sale.notes || '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial de Ventas');

      const fileName = `historial_ventas_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success(`Reporte exportado: ${fileName}`);
    } catch (error) {
      console.error('Error al exportar:', error);
      toast.error('Error al exportar');
    }
  };

  // Exportar a PDF
  const exportToPDF = async () => {
    if (!sales || sales.length === 0) {
      toast.error('No hay ventas para exportar');
      return;
    }

    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ]);

      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text('Historial de Ventas', 14, 22);

      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generado el ${format(new Date(), "dd 'de' MMMM yyyy", { locale: es })}`, 14, 30);

      const tableData = sales.map((sale) => [
        sale.saleCode || '-',
        format(new Date(sale.createdAt), 'dd/MM/yy HH:mm', { locale: es }),
        sale.store?.name || 'N/A',
        sale.soldBy?.name?.split(' ')[0] || 'N/A',
        `$${sale.finalTotal.toLocaleString()}`,
        sale.status === 'completed' ? '✓' : sale.status === 'cancelled' ? '✗' : 'D',
      ]);

      autoTable(doc, {
        head: [['Código', 'Fecha', 'Tienda', 'Vendedor', 'Total', 'Est.']],
        body: tableData,
        startY: 35,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      const fileName = `historial_ventas_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);
      toast.success(`PDF exportado: ${fileName}`);
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      toast.error('Error al exportar PDF');
    }
  };

  // Calcular resumen
  const totalVentas = sales.filter(s => s.status === 'completed').length;
  const totalIngresos = sales.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.finalTotal, 0);
  const ventasCanceladas = sales.filter(s => s.status === 'cancelled').length;
  const ventasEditadas = sales.filter(s => s.wasEdited).length;

  // Si no es admin y no tiene tienda asignada
  if (!isAdmin && !user?.store) {
    return <EmptyStateNoStore />;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 md:gap-3">
            <History className="text-primary-600" size={24} />
            Historial
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">
            Consulta ventas y registros de caja anteriores
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'ventas' ? (
            <>
              <Button variant="outline" onClick={exportToExcel} leftIcon={<FileSpreadsheet size={16} />} className="text-sm">
                Excel
              </Button>
              <Button variant="outline" onClick={exportToPDF} leftIcon={<FileText size={16} />} className="text-sm">
                PDF
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={exportCashRegistersToExcel} leftIcon={<FileSpreadsheet size={16} />} className="text-sm">
              Excel
            </Button>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex gap-2 border-b border-gray-200"
      >
        <button
          onClick={() => setActiveTab('ventas')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'ventas'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <DollarSign size={16} />
          Ventas
        </button>
        <button
          onClick={() => setActiveTab('cajas')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'cajas'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Wallet size={16} />
          Cajas Registradoras
        </button>
      </motion.div>

      {/* Contenido según tab activo */}
      {activeTab === 'ventas' ? (
        <>
          {/* Resumen rápido */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
          >
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <Card.Body className="p-3 md:p-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="p-1.5 md:p-2 bg-green-500 rounded-lg">
                    <Check className="text-white" size={16} />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-green-600">Completadas</p>
                    <p className="text-xl md:text-2xl font-bold text-green-800">{totalVentas}</p>
                  </div>
                </div>
              </Card.Body>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <Card.Body className="p-3 md:p-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="p-1.5 md:p-2 bg-blue-500 rounded-lg">
                    <DollarSign className="text-white" size={16} />
                  </div>
              <div>
                <p className="text-xs md:text-sm text-blue-600">Ingresos</p>
                <p className="text-lg md:text-2xl font-bold text-blue-800">${totalIngresos.toLocaleString()}</p>
              </div>
            </div>
          </Card.Body>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <Card.Body className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-orange-500 rounded-lg">
                <Edit2 className="text-white" size={16} />
              </div>
              <div>
                <p className="text-xs md:text-sm text-orange-600">Editadas</p>
                <p className="text-xl md:text-2xl font-bold text-orange-800">{ventasEditadas}</p>
              </div>
            </div>
          </Card.Body>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <Card.Body className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-red-500 rounded-lg">
                <X className="text-white" size={16} />
              </div>
              <div>
                <p className="text-xs md:text-sm text-red-600">Canceladas</p>
                <p className="text-xl md:text-2xl font-bold text-red-800">{ventasCanceladas}</p>
              </div>
            </div>
          </Card.Body>
        </Card>
      </motion.div>

      {/* Filtros */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <Card.Body className="p-3 md:p-6">
            {/* Búsqueda - siempre arriba */}
            <div className="mb-3">
              <SearchBar
                placeholder="Buscar por código (VTA-...)..."
                onSearch={setSearchQuery}
                defaultValue={searchQuery}
              />
            </div>

            {/* Filtros en grid responsive */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
              {/* Filtro de tienda (solo admins) */}
              {isAdmin && (
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={filterStore}
                  onChange={(e) => setFilterStore(e.target.value)}
                >
                  <option value="">🏪 Tiendas</option>
                  {stores?.map((store: StoreType) => (
                    <option key={store._id} value={store._id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Filtro de método de pago */}
              <select
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
              >
                <option value="">💳 Pagos</option>
                <option value="efectivo">💵 Efectivo</option>
                <option value="nequi">🟣 Nequi</option>
                <option value="daviplata">🟠 Daviplata</option>
                <option value="llave_bancolombia">🔑 Llave</option>
                <option value="tarjeta">💳 Tarjeta</option>
                <option value="transferencia">🏦 Transf.</option>
              </select>

              {/* Filtro de estado */}
              <select
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">📊 Estado</option>
                <option value="completed">✅ OK</option>
                <option value="cancelled">❌ Canceladas</option>
                <option value="refunded">↩️ Devueltas</option>
              </select>

              {/* Fecha desde */}
              <input
                type="date"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                title="Fecha desde"
              />

              {/* Fecha hasta */}
              <input
                type="date"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                title="Fecha hasta"
              />
            </div>

            <div className="mt-3 text-xs md:text-sm text-gray-500">
              {sales.length} venta(s) encontrada(s)
            </div>
          </Card.Body>
        </Card>
      </motion.div>

      {/* Tabla de ventas */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <Card.Body className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : sales.length === 0 ? (
              <div className="text-center py-12">
                <History className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-500">No se encontraron ventas</p>
              </div>
            ) : (
              <>
                {/* Vista Desktop - Tabla */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Código
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tienda
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Vendedor
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Productos
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Pago
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sales.map((sale) => (
                        <tr
                          key={sale._id}
                          className={`hover:bg-gray-50 transition-colors ${
                            sale.wasEdited
                              ? 'bg-orange-50 hover:bg-orange-100'
                              : sale.status === 'cancelled'
                              ? 'bg-red-50 hover:bg-red-100'
                              : ''
                          }`}
                        >
                          {/* Código */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-mono text-primary-600 bg-primary-50 px-2 py-1 rounded">
                                {sale.saleCode || 'N/A'}
                              </code>
                              <button
                                onClick={() => handleCopyCode(sale.saleCode || '')}
                                className="text-gray-400 hover:text-gray-600"
                                title="Copiar código"
                              >
                                <Copy size={14} />
                              </button>
                              {sale.wasEdited && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-orange-500 text-white rounded font-medium">
                                  EDITADA
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Fecha */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm text-gray-900">
                              <Calendar size={14} className="text-gray-400" />
                              {format(new Date(sale.createdAt), 'dd MMM yyyy', { locale: es })}
                            </div>
                            <div className="text-xs text-gray-500">
                              {format(new Date(sale.createdAt), 'HH:mm', { locale: es })}
                            </div>
                          </td>

                          {/* Tienda */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm text-gray-900">
                              <Store size={14} className="text-gray-400" />
                              {sale.store?.name || 'N/A'}
                            </div>
                          </td>

                          {/* Vendedor */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm text-gray-900">
                              <User size={14} className="text-gray-400" />
                              {sale.soldBy?.name || 'N/A'}
                            </div>
                          </td>

                          {/* Productos */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm text-gray-900">
                              <Package size={14} className="text-gray-400" />
                              {sale.items?.length || 0} productos
                            </div>
                          </td>

                          {/* Total */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">
                              ${sale.finalTotal?.toLocaleString('es-MX', { minimumFractionDigits: 2 }) || '0.00'}
                            </div>
                            {sale.discount > 0 && (
                              <div className="text-xs text-red-500">
                                -${sale.discount.toLocaleString()}
                              </div>
                            )}
                          </td>

                          {/* Método de pago */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPaymentBadgeColor(sale.paymentMethod)}`}>
                              {formatPaymentMethod(sale.paymentMethod)}
                            </span>
                          </td>

                          {/* Estado */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {getStatusBadge(sale.status)}
                          </td>

                          {/* Acciones */}
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleViewDetail(sale)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Ver detalle"
                              >
                                <Eye size={18} />
                              </button>
                              {isAdmin && sale.status === 'completed' && (
                                <button
                                  onClick={() => handleEditSale(sale)}
                                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                  title="Editar venta"
                                >
                                  <Edit2 size={18} />
                                </button>
                              )}
                              <button
                                onClick={() => handlePrintTicket(sale)}
                                className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Reimprimir ticket"
                              >
                                <Printer size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Vista Móvil/Tablet - Cards */}
                <div className="lg:hidden divide-y divide-gray-200">
                  {sales.map((sale) => (
                    <div
                      key={sale._id}
                      className={`p-4 ${
                        sale.wasEdited
                          ? 'bg-orange-50'
                          : sale.status === 'cancelled'
                          ? 'bg-red-50'
                          : 'bg-white'
                      }`}
                    >
                      {/* Header del card */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-xs font-mono text-primary-600 bg-primary-50 px-2 py-1 rounded">
                              {sale.saleCode || 'N/A'}
                            </code>
                            <button
                              onClick={() => handleCopyCode(sale.saleCode || '')}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <Copy size={12} />
                            </button>
                            {sale.wasEdited && (
                              <span className="px-1.5 py-0.5 text-[9px] bg-orange-500 text-white rounded font-medium">
                                EDITADA
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {format(new Date(sale.createdAt), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900">
                            ${sale.finalTotal?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </div>
                          {sale.discount > 0 && (
                            <div className="text-xs text-red-500">-${sale.discount.toLocaleString()}</div>
                          )}
                        </div>
                      </div>

                      {/* Info del card */}
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Store size={12} className="text-gray-400" />
                          <span className="truncate">{sale.store?.name || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <User size={12} className="text-gray-400" />
                          <span className="truncate">{sale.soldBy?.name || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <Package size={12} className="text-gray-400" />
                          <span>{sale.items?.length || 0} productos</span>
                        </div>
                        <div>
                          {getStatusBadge(sale.status)}
                        </div>
                      </div>

                      {/* Método de pago */}
                      <div className="mb-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPaymentBadgeColor(sale.paymentMethod)}`}>
                          {formatPaymentMethod(sale.paymentMethod)}
                        </span>
                      </div>

                      {/* Acciones */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetail(sale)}
                          className="flex-1 px-3 py-2 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-1"
                        >
                          <Eye size={14} /> Ver
                        </button>
                        {isAdmin && sale.status === 'completed' && (
                          <button
                            onClick={() => handleEditSale(sale)}
                            className="flex-1 px-3 py-2 text-xs text-orange-600 bg-orange-100 rounded-lg hover:bg-orange-200 flex items-center justify-center gap-1"
                          >
                            <Edit2 size={14} /> Editar
                          </button>
                        )}
                        <button
                          onClick={() => handlePrintTicket(sale)}
                          className="flex-1 px-3 py-2 text-xs text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 flex items-center justify-center gap-1"
                        >
                          <Printer size={14} /> Ticket
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card.Body>
        </Card>
      </motion.div>

      {/* Modal de Detalle */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Detalle de Venta ${selectedSale?.saleCode || ''}`}
        size="lg"
      >
        {selectedSale && (
          <div className="space-y-4">
            {/* Info general */}
            <div className={`p-4 rounded-lg ${selectedSale.wasEdited ? 'bg-orange-50 border border-orange-200' : selectedSale.status === 'cancelled' ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Código</p>
                  <p className="font-mono font-bold text-primary-600">{selectedSale.saleCode}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fecha</p>
                  <p className="font-medium">{format(new Date(selectedSale.createdAt), "dd 'de' MMMM yyyy, HH:mm", { locale: es })}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tienda</p>
                  <p className="font-medium">{selectedSale.store?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vendedor</p>
                  <p className="font-medium">{selectedSale.soldBy?.name}</p>
                </div>
              </div>

              {selectedSale.wasEdited && (
                <div className="mt-3 p-2 bg-orange-100 rounded text-sm text-orange-700">
                  ✏️ Editada por {selectedSale.modifiedBy?.name || 'Admin'} el {selectedSale.modifiedAt ? format(new Date(selectedSale.modifiedAt), "dd/MM/yyyy HH:mm", { locale: es }) : 'N/A'}
                </div>
              )}

              {selectedSale.status === 'cancelled' && (
                <div className="mt-3 p-2 bg-red-100 rounded text-sm text-red-700">
                  ❌ Cancelada por {selectedSale.cancelledBy?.name || 'Admin'}: {selectedSale.cancellationReason}
                </div>
              )}
            </div>

            {/* Productos */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Productos</h4>
              <div className="border rounded-lg divide-y">
                {selectedSale.items.map((item, index) => (
                  <div key={index} className="p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.product?.name || 'Producto eliminado'}</p>
                      <p className="text-sm text-gray-500">
                        {item.quantity} x ${item.unitPrice.toLocaleString()}
                        {item.unitPrice === 0 && <span className="ml-2 text-green-600">(Ñapa)</span>}
                      </p>
                    </div>
                    <p className="font-medium">${item.subtotal.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Totales */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>${selectedSale.total.toLocaleString()}</span>
              </div>
              {selectedSale.discount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Descuento</span>
                  <span>-${selectedSale.discount.toLocaleString()}</span>
                </div>
              )}
              {selectedSale.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span>IVA</span>
                  <span>${selectedSale.tax.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total</span>
                <span>${selectedSale.finalTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Método de pago</span>
                <span className={`px-2 py-1 rounded-full text-xs ${getPaymentBadgeColor(selectedSale.paymentMethod)}`}>
                  {formatPaymentMethod(selectedSale.paymentMethod)}
                </span>
              </div>
            </div>

            {selectedSale.notes && (
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">📝 {selectedSale.notes}</p>
              </div>
            )}
          </div>
        )}
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setDetailModalOpen(false)}>
            Cerrar
          </Button>
          <Button onClick={() => selectedSale && handlePrintTicket(selectedSale)} leftIcon={<Printer size={18} />}>
            Reimprimir Ticket
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Edición */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Editar Venta ${selectedSale?.saleCode || ''}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="text-orange-500 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium text-orange-800">Advertencia</p>
                <p className="text-sm text-orange-600">
                  Al editar esta venta se marcará con fondo naranja para indicar que fue modificada.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Método de Pago
            </label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={editPaymentMethod}
              onChange={(e) => setEditPaymentMethod(e.target.value)}
            >
              <option value="efectivo">💵 Efectivo</option>
              <option value="nequi">🟣 Nequi</option>
              <option value="daviplata">🟠 Daviplata</option>
              <option value="llave_bancolombia">🔑 Llave Bancolombia</option>
              <option value="tarjeta">💳 Tarjeta</option>
              <option value="transferencia">🏦 Transferencia</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descuento ($)
            </label>
            <input
              type="number"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={editDiscount}
              onChange={(e) => setEditDiscount(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Notas adicionales..."
            />
          </div>
        </div>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setEditModalOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={confirmEdit}
            isLoading={editSaleMutation.isPending}
            className="bg-orange-500 hover:bg-orange-600"
          >
            Guardar Cambios
          </Button>
        </Modal.Footer>
      </Modal>
        </>
      ) : (
        /* =============== TAB CAJAS REGISTRADORAS =============== */
        <>
          {/* Resumen de cajas */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
          >
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <Card.Body className="p-3 md:p-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="p-1.5 md:p-2 bg-purple-500 rounded-lg">
                    <Wallet className="text-white" size={16} />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-purple-600">Total Arqueos</p>
                    <p className="text-xl md:text-2xl font-bold text-purple-800">{cashStats?.totalDays || 0}</p>
                  </div>
                </div>
              </Card.Body>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <Card.Body className="p-3 md:p-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="p-1.5 md:p-2 bg-blue-500 rounded-lg">
                    <DollarSign className="text-white" size={16} />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-blue-600">Diferencia Total</p>
                    <p className={`text-xl md:text-2xl font-bold ${(cashStats?.totalDifference || 0) >= 0 ? 'text-blue-800' : 'text-red-600'}`}>
                      {formatCurrency(cashStats?.totalDifference || 0)}
                    </p>
                  </div>
                </div>
              </Card.Body>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <Card.Body className="p-3 md:p-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="p-1.5 md:p-2 bg-green-500 rounded-lg">
                    <TrendingUp className="text-white" size={16} />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-green-600">Días con Sobrante</p>
                    <p className="text-xl md:text-2xl font-bold text-green-800">{cashStats?.daysWithSurplus || 0}</p>
                  </div>
                </div>
              </Card.Body>
            </Card>

            <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <Card.Body className="p-3 md:p-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="p-1.5 md:p-2 bg-red-500 rounded-lg">
                    <TrendingDown className="text-white" size={16} />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-red-600">Días con Faltante</p>
                    <p className="text-xl md:text-2xl font-bold text-red-800">{cashStats?.daysWithShortage || 0}</p>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </motion.div>

          {/* Filtros de cajas */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <Card.Body className="p-3 md:p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
                  {/* Filtro de tienda (solo admins) */}
                  {isAdmin && (
                    <select
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      value={cashRegisterStore}
                      onChange={(e) => setCashRegisterStore(e.target.value)}
                    >
                      <option value="">🏪 Todas las tiendas</option>
                      {stores?.map((store: StoreType) => (
                        <option key={store._id} value={store._id}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Fecha desde */}
                  <input
                    type="date"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={cashRegisterDateFrom}
                    onChange={(e) => setCashRegisterDateFrom(e.target.value)}
                    title="Fecha desde"
                  />

                  {/* Fecha hasta */}
                  <input
                    type="date"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={cashRegisterDateTo}
                    onChange={(e) => setCashRegisterDateTo(e.target.value)}
                    title="Fecha hasta"
                  />
                </div>

                <div className="mt-3 text-xs md:text-sm text-gray-500">
                  {cashRegisters.length} registro(s) encontrado(s)
                </div>
              </Card.Body>
            </Card>
          </motion.div>

          {/* Lista de registros de caja */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <Card.Body className="p-0">
                {isLoadingCashRegisters ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : cashRegisters.length === 0 ? (
                  <div className="text-center py-12">
                    <Wallet className="mx-auto text-gray-400 mb-4" size={48} />
                    <p className="text-gray-500">No se encontraron registros de caja</p>
                  </div>
                ) : (
                  <>
                    {/* Vista Desktop - Tabla */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th 
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => handleCashSort('date')}
                            >
                              <div className="flex items-center gap-1">
                                Fecha
                                {cashSortField === 'date' ? (
                                  cashSortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                ) : (
                                  <ArrowUpDown size={14} className="text-gray-300" />
                                )}
                              </div>
                            </th>
                            <th 
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => handleCashSort('store')}
                            >
                              <div className="flex items-center gap-1">
                                Tienda
                                {cashSortField === 'store' ? (
                                  cashSortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                ) : (
                                  <ArrowUpDown size={14} className="text-gray-300" />
                                )}
                              </div>
                            </th>
                            <th 
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => handleCashSort('opening')}
                            >
                              <div className="flex items-center gap-1">
                                Apertura
                                {cashSortField === 'opening' ? (
                                  cashSortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                ) : (
                                  <ArrowUpDown size={14} className="text-gray-300" />
                                )}
                              </div>
                            </th>
                            <th 
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => handleCashSort('sales')}
                            >
                              <div className="flex items-center gap-1">
                                Ventas
                                {cashSortField === 'sales' ? (
                                  cashSortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                ) : (
                                  <ArrowUpDown size={14} className="text-gray-300" />
                                )}
                              </div>
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Esperado
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Cierre Real
                            </th>
                            <th 
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => handleCashSort('difference')}
                            >
                              <div className="flex items-center gap-1">
                                Diferencia
                                {cashSortField === 'difference' ? (
                                  cashSortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                ) : (
                                  <ArrowUpDown size={14} className="text-gray-300" />
                                )}
                              </div>
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Responsable
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {sortedCashRegisters.map((register) => (
                            <tr
                              key={register._id}
                              className={`hover:bg-gray-50 transition-colors ${
                                (register.difference || 0) < 0
                                  ? 'bg-red-50 hover:bg-red-100'
                                  : (register.difference || 0) > 0
                                  ? 'bg-blue-50 hover:bg-blue-100'
                                  : ''
                              }`}
                            >
                              {/* Fecha */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-2 text-sm text-gray-900">
                                  <Calendar size={14} className="text-gray-400" />
                                  {format(new Date(register.openedAt), 'dd MMM yyyy', { locale: es })}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                  <Clock size={10} />
                                  {format(new Date(register.openedAt), 'HH:mm', { locale: es })}
                                  {register.closedAt && ` - ${format(new Date(register.closedAt), 'HH:mm', { locale: es })}`}
                                </div>
                              </td>

                              {/* Tienda */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-2 text-sm text-gray-900">
                                  <Store size={14} className="text-gray-400" />
                                  {register.store?.name || 'N/A'}
                                </div>
                              </td>

                              {/* Monto Apertura */}
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                {formatCurrency(register.openingAmount)}
                              </td>

                              {/* Ventas */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm font-medium text-green-600">
                                  {formatCurrency(register.totalSales || 0)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {register.salesCount || 0} ventas
                                </div>
                              </td>

                              {/* Esperado */}
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                {formatCurrency(register.expectedAmount || 0)}
                              </td>

                              {/* Cierre Real */}
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                {formatCurrency(register.actualClosingAmount || register.closingAmount || 0)}
                              </td>

                              {/* Diferencia */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                                  (register.difference || 0) === 0
                                    ? 'bg-green-100 text-green-800'
                                    : (register.difference || 0) > 0
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {(register.difference || 0) > 0 ? '+' : ''}{formatCurrency(register.difference || 0)}
                                </span>
                              </td>

                              {/* Responsable */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{register.openedBy?.name || 'N/A'}</div>
                                {register.closedBy && (
                                  <div className="text-xs text-gray-500">Cerró: {register.closedBy.name}</div>
                                )}
                              </td>

                              {/* Acciones */}
                              <td className="px-4 py-3 whitespace-nowrap text-right">
                                <button
                                  onClick={() => handleViewCashRegisterDetail(register)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Ver detalle"
                                >
                                  <Eye size={18} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Vista Móvil - Cards */}
                    <div className="lg:hidden divide-y divide-gray-200">
                      {/* Selector de ordenamiento móvil */}
                      <div className="p-3 bg-gray-50 flex items-center gap-2">
                        <span className="text-xs text-gray-500">Ordenar por:</span>
                        <select
                          value={cashSortField}
                          onChange={(e) => setCashSortField(e.target.value as typeof cashSortField)}
                          className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                        >
                          <option value="date">Fecha</option>
                          <option value="store">Tienda</option>
                          <option value="sales">Ventas</option>
                          <option value="difference">Diferencia</option>
                          <option value="opening">Apertura</option>
                        </select>
                        <button
                          onClick={() => setCashSortOrder(cashSortOrder === 'asc' ? 'desc' : 'asc')}
                          className="p-1 border border-gray-300 rounded bg-white"
                        >
                          {cashSortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                        </button>
                      </div>
                      {sortedCashRegisters.map((register) => (
                        <div
                          key={register._id}
                          className={`p-4 ${
                            (register.difference || 0) < 0
                              ? 'bg-red-50'
                              : (register.difference || 0) > 0
                              ? 'bg-blue-50'
                              : 'bg-white'
                          }`}
                        >
                          {/* Header del card */}
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {format(new Date(register.openedAt), "dd MMM yyyy", { locale: es })}
                              </div>
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock size={10} />
                                {format(new Date(register.openedAt), 'HH:mm', { locale: es })}
                                {register.closedAt && ` - ${format(new Date(register.closedAt), 'HH:mm', { locale: es })}`}
                              </div>
                            </div>
                            <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                              (register.difference || 0) === 0
                                ? 'bg-green-100 text-green-800'
                                : (register.difference || 0) > 0
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {(register.difference || 0) > 0 ? '+' : ''}{formatCurrency(register.difference || 0)}
                            </span>
                          </div>

                          {/* Info del card */}
                          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                            <div>
                              <span className="text-gray-500">Tienda:</span>
                              <span className="ml-1 font-medium">{register.store?.name}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Ventas:</span>
                              <span className="ml-1 font-medium text-green-600">{formatCurrency(register.totalSales || 0)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Esperado:</span>
                              <span className="ml-1 font-medium">{formatCurrency(register.expectedAmount || 0)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Real:</span>
                              <span className="ml-1 font-medium">{formatCurrency(register.actualClosingAmount || register.closingAmount || 0)}</span>
                            </div>
                          </div>

                          {/* Acciones */}
                          <button
                            onClick={() => handleViewCashRegisterDetail(register)}
                            className="w-full px-3 py-2 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-1"
                          >
                            <Eye size={14} /> Ver Detalle
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card.Body>
            </Card>
          </motion.div>

          {/* Modal de Detalle de Caja */}
          <Modal
            isOpen={cashRegisterDetailOpen}
            onClose={() => setCashRegisterDetailOpen(false)}
            title={`Detalle de Caja - ${selectedCashRegister ? format(new Date(selectedCashRegister.openedAt), "dd 'de' MMMM yyyy", { locale: es }) : ''}`}
            size="lg"
          >
            {selectedCashRegister && (
              <div className="space-y-4">
                {/* Info general */}
                <div className={`p-4 rounded-lg ${
                  (selectedCashRegister.difference || 0) < 0
                    ? 'bg-red-50 border border-red-200'
                    : (selectedCashRegister.difference || 0) > 0
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-green-50 border border-green-200'
                }`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Tienda</p>
                      <p className="font-medium">{selectedCashRegister.store?.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Fecha</p>
                      <p className="font-medium">
                        {format(new Date(selectedCashRegister.openedAt), "EEEE dd 'de' MMMM", { locale: es })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Hora Apertura</p>
                      <p className="font-medium text-green-600">
                        🔓 {format(new Date(selectedCashRegister.openedAt), 'HH:mm', { locale: es })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Hora Cierre</p>
                      <p className="font-medium text-red-600">
                        {selectedCashRegister.closedAt 
                          ? `🔒 ${format(new Date(selectedCashRegister.closedAt), 'HH:mm', { locale: es })}` 
                          : 'Aún abierta'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Abierta por</p>
                      <p className="font-medium">{selectedCashRegister.openedBy?.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Cerrada por</p>
                      <p className="font-medium">{selectedCashRegister.closedBy?.name || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Ventas por método de pago */}
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <h4 className="font-medium text-purple-900 mb-3 flex items-center gap-2">
                    💰 Ventas por Método de Pago ({selectedCashRegister.salesCount || 0} ventas)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedCashRegister.salesByMethodDetail ? (
                      <>
                        <div className="bg-white p-3 rounded-lg border">
                          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            💵 Efectivo
                          </div>
                          <p className="font-bold text-green-600">{formatCurrency(selectedCashRegister.salesByMethodDetail.efectivo?.total || 0)}</p>
                          <p className="text-xs text-gray-400">{selectedCashRegister.salesByMethodDetail.efectivo?.count || 0} ventas</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border">
                          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            🟣 Nequi
                          </div>
                          <p className="font-bold text-purple-600">{formatCurrency(selectedCashRegister.salesByMethodDetail.nequi?.total || 0)}</p>
                          <p className="text-xs text-gray-400">{selectedCashRegister.salesByMethodDetail.nequi?.count || 0} ventas</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border">
                          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            🟠 Daviplata
                          </div>
                          <p className="font-bold text-orange-600">{formatCurrency(selectedCashRegister.salesByMethodDetail.daviplata?.total || 0)}</p>
                          <p className="text-xs text-gray-400">{selectedCashRegister.salesByMethodDetail.daviplata?.count || 0} ventas</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border">
                          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            🔑 Llave Bancolombia
                          </div>
                          <p className="font-bold text-yellow-600">{formatCurrency(selectedCashRegister.salesByMethodDetail.llave_bancolombia?.total || 0)}</p>
                          <p className="text-xs text-gray-400">{selectedCashRegister.salesByMethodDetail.llave_bancolombia?.count || 0} ventas</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border">
                          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            💳 Tarjeta
                          </div>
                          <p className="font-bold text-blue-600">{formatCurrency(selectedCashRegister.salesByMethodDetail.tarjeta?.total || 0)}</p>
                          <p className="text-xs text-gray-400">{selectedCashRegister.salesByMethodDetail.tarjeta?.count || 0} ventas</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border">
                          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            🏦 Transferencia
                          </div>
                          <p className="font-bold text-cyan-600">{formatCurrency(selectedCashRegister.salesByMethodDetail.transferencia?.total || 0)}</p>
                          <p className="text-xs text-gray-400">{selectedCashRegister.salesByMethodDetail.transferencia?.count || 0} ventas</p>
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-500 col-span-3 text-center py-4">No hay datos de ventas por método</p>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-purple-200 flex justify-between">
                    <span className="font-medium text-purple-800">Total Ventas:</span>
                    <span className="font-bold text-purple-900">{formatCurrency(selectedCashRegister.totalSales || 0)}</span>
                  </div>
                </div>

                {/* Resumen financiero de efectivo */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <h4 className="font-medium text-gray-900">💵 Cuadre de Caja (Efectivo)</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Monto de apertura</span>
                      <span className="font-medium">{formatCurrency(selectedCashRegister.openingAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">+ Ventas en efectivo</span>
                      <span className="font-medium text-green-600">+{formatCurrency(selectedCashRegister.salesByMethodDetail?.efectivo?.total || 0)}</span>
                    </div>
                    {selectedCashRegister.movements && selectedCashRegister.movements.length > 0 && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">+ Ingresos extra</span>
                          <span className="font-medium text-green-600">
                            +{formatCurrency(selectedCashRegister.movements.filter(m => m.type === 'income' || m.type === 'entrada').reduce((sum, m) => sum + m.amount, 0))}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">- Egresos</span>
                          <span className="font-medium text-red-600">
                            -{formatCurrency(selectedCashRegister.movements.filter(m => m.type === 'expense' || m.type === 'salida').reduce((sum, m) => sum + m.amount, 0))}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-gray-700 font-medium">= Monto esperado en caja</span>
                      <span className="font-bold">{formatCurrency(selectedCashRegister.expectedAmount || selectedCashRegister.expectedClosingAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Monto real contado</span>
                      <span className="font-medium">{formatCurrency(selectedCashRegister.actualClosingAmount || selectedCashRegister.closingAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2 bg-white -mx-4 px-4 py-2 rounded">
                      <span className="text-gray-700 font-bold">Diferencia</span>
                      <span className={`font-bold text-lg ${
                        (selectedCashRegister.difference || 0) === 0
                          ? 'text-green-600'
                          : (selectedCashRegister.difference || 0) > 0
                          ? 'text-blue-600'
                          : 'text-red-600'
                      }`}>
                        {(selectedCashRegister.difference || 0) > 0 ? '+ ' : ''}{formatCurrency(selectedCashRegister.difference || 0)}
                        {(selectedCashRegister.difference || 0) === 0 && ' ✓'}
                        {(selectedCashRegister.difference || 0) > 0 && ' (Sobrante)'}
                        {(selectedCashRegister.difference || 0) < 0 && ' (Faltante)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Movimientos */}
                {selectedCashRegister.movements && selectedCashRegister.movements.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">📋 Movimientos de Caja</h4>
                    <div className="border rounded-lg divide-y max-h-48 overflow-auto">
                      {selectedCashRegister.movements.map((mov, index) => (
                        <div key={index} className="p-3 flex justify-between items-center">
                          <div>
                            <p className="font-medium text-sm">{mov.reason || mov.description}</p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(mov.createdAt), 'HH:mm', { locale: es })}
                            </p>
                          </div>
                          <span className={`font-medium ${(mov.type === 'entrada' || mov.type === 'income') ? 'text-green-600' : 'text-red-600'}`}>
                            {(mov.type === 'entrada' || mov.type === 'income') ? '+' : '-'}{formatCurrency(mov.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notas */}
                {selectedCashRegister.closingNotes && (
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">📝 <strong>Notas de cierre:</strong> {selectedCashRegister.closingNotes}</p>
                  </div>
                )}
              </div>
            )}
            <Modal.Footer>
              <Button variant="ghost" onClick={() => setCashRegisterDetailOpen(false)}>
                Cerrar
              </Button>
            </Modal.Footer>
          </Modal>
        </>
      )}
    </div>
  );
};

export default SalesHistoryPage;
