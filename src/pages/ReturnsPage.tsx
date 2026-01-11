import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeftRight,
  DollarSign,
  Plus,
  Minus,
  FileText,
  Store,
  Filter,
  ChevronRight,
  RefreshCw,
  CreditCard,
} from 'lucide-react';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { formatCurrency } from '../utils/formatCurrency';
import { toast } from '../components/ui';

interface ReturnItem {
  product: {
    _id: string;
    name: string;
    sku?: string;
    price?: number;
  };
  quantity: number;
  price: number;
  reason: string;
}

interface ExchangeItem {
  product: {
    _id: string;
    name: string;
    sku?: string;
    price?: number;
  };
  quantity: number;
  price: number;
}

interface Return {
  _id: string;
  returnNumber: string;
  originalSale: {
    _id: string;
    saleNumber?: string;
    total?: number;
  };
  store: {
    _id: string;
    name: string;
  };
  customer?: {
    name?: string;
    phone?: string;
  };
  items: ReturnItem[];
  exchangeItems?: ExchangeItem[];
  returnType: 'refund' | 'exchange' | 'store_credit';
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  totalRefund: number;
  priceDifference: number;
  reason: string;
  notes?: string;
  processedBy: {
    _id: string;
    name: string;
  };
  approvedBy?: {
    _id: string;
    name: string;
  };
  createdAt: string;
  approvedAt?: string;
  completedAt?: string;
}

interface SaleItem {
  product: {
    _id: string;
    name: string;
    sku?: string;
    price?: number;
  };
  quantity: number;
  unitPrice: number;
  returnedQuantity?: number;
  availableToReturn?: number;
}

interface Sale {
  _id: string;
  saleNumber?: string;
  total: number;
  items: SaleItem[];
  store: {
    _id: string;
    name: string;
  };
  createdAt: string;
}

interface Store {
  _id: string;
  name: string;
}

const statusConfig = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { label: 'Aprobada', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  completed: { label: 'Completada', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Rechazada', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const returnTypeConfig = {
  refund: { label: 'Reembolso', color: 'bg-green-50 text-green-700', icon: DollarSign },
  exchange: { label: 'Cambio', color: 'bg-blue-50 text-blue-700', icon: ArrowLeftRight },
  store_credit: { label: 'Crédito Tienda', color: 'bg-purple-50 text-purple-700', icon: CreditCard },
};

export default function ReturnsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  
  // Create return state
  const [saleSearch, setSaleSearch] = useState('');
  const [foundSale, setFoundSale] = useState<Sale | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, { quantity: number; reason: string }>>({});
  const [returnType, setReturnType] = useState<'refund' | 'exchange' | 'store_credit'>('refund');
  const [generalReason, setGeneralReason] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Query tiendas
  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ['stores'],
    queryFn: async () => {
      const response = await api.get('/stores');
      return response.data?.data || response.data || [];
    },
    enabled: isAdmin,
  });

  // Query devoluciones
  const { data: returnsData, isLoading } = useQuery<{ returns: Return[]; pagination: unknown }>({
    queryKey: ['returns', selectedStoreId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStoreId) params.append('storeId', selectedStoreId);
      if (statusFilter) params.append('status', statusFilter);
      params.append('limit', '50');
      const response = await api.get(`/returns?${params.toString()}`);
      return response.data;
    },
  });

  // Query resumen
  const { data: summary } = useQuery<{
    byStatus: Array<{ _id: string; count: number; totalAmount: number }>;
    byType: Array<{ _id: string; count: number; totalAmount: number }>;
    monthly: { count: number; totalRefund: number };
  }>({
    queryKey: ['returns', 'summary', selectedStoreId],
    queryFn: async () => {
      const params = selectedStoreId ? `?storeId=${selectedStoreId}` : '';
      const response = await api.get(`/returns/summary${params}`);
      return response.data;
    },
  });

  // Buscar venta
  const searchSaleMutation = useMutation({
    mutationFn: async (saleNumber: string) => {
      const response = await api.get(`/returns/search-sale?saleNumber=${saleNumber}`);
      return response.data;
    },
    onSuccess: (data) => {
      setFoundSale(data.sale);
      setSelectedItems({});
      if (data.previousReturns > 0) {
        toast.success(`Venta encontrada. Tiene ${data.previousReturns} devolución(es) previa(s)`);
      }
    },
    onError: () => {
      toast.error('Venta no encontrada');
      setFoundSale(null);
    },
  });

  // Crear devolución
  const createMutation = useMutation({
    mutationFn: async (data: unknown) => {
      const response = await api.post('/returns', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      toast.success('Devolución creada correctamente');
      resetCreateModal();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Error al crear devolución');
    },
  });

  // Aprobar devolución
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/returns/${id}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      toast.success('Devolución aprobada');
      setShowDetailModal(false);
    },
  });

  // Completar devolución
  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/returns/${id}/complete`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      toast.success('Devolución completada - Inventario actualizado');
      setShowDetailModal(false);
    },
  });

  // Rechazar devolución
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await api.post(`/returns/${id}/reject`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      toast.success('Devolución rechazada');
      setShowDetailModal(false);
    },
  });

  const handleSearchSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (saleSearch.trim()) {
      searchSaleMutation.mutate(saleSearch.trim());
    }
  };

  const toggleItemSelection = (productId: string, _available: number) => {
    setSelectedItems(prev => {
      if (prev[productId]) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [productId]: { quantity: 1, reason: '' }
      };
    });
  };

  const updateItemQuantity = (productId: string, quantity: number, max: number) => {
    if (quantity < 1 || quantity > max) return;
    setSelectedItems(prev => ({
      ...prev,
      [productId]: { ...prev[productId], quantity }
    }));
  };

  const updateItemReason = (productId: string, reason: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [productId]: { ...prev[productId], reason }
    }));
  };

  const calculateTotal = () => {
    if (!foundSale) return 0;
    let total = 0;
    for (const [productId, data] of Object.entries(selectedItems)) {
      const item = foundSale.items.find(i => i.product._id === productId);
      if (item) {
        total += item.unitPrice * data.quantity;
      }
    }
    return total;
  };

  const handleCreateReturn = () => {
    if (!foundSale || Object.keys(selectedItems).length === 0 || !generalReason) {
      toast.error('Completa todos los campos requeridos');
      return;
    }

    // Validar razones individuales
    for (const [_productId, data] of Object.entries(selectedItems)) {
      if (!data.reason.trim()) {
        toast.error('Todas las razones de devolución son requeridas');
        return;
      }
    }

    const items = Object.entries(selectedItems).map(([productId, data]) => ({
      productId,
      quantity: data.quantity,
      reason: data.reason,
    }));

    createMutation.mutate({
      originalSaleId: foundSale._id,
      items,
      returnType,
      reason: generalReason,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
    });
  };

  const resetCreateModal = () => {
    setShowCreateModal(false);
    setSaleSearch('');
    setFoundSale(null);
    setSelectedItems({});
    setReturnType('refund');
    setGeneralReason('');
    setCustomerName('');
    setCustomerPhone('');
  };

  const viewDetail = (ret: Return) => {
    setSelectedReturn(ret);
    setShowDetailModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusCount = (status: string) => {
    return summary?.byStatus.find(s => s._id === status)?.count || 0;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devoluciones y Cambios</h1>
          <p className="text-gray-600 mt-1">
            Gestión de devoluciones, cambios y reembolsos
          </p>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <RotateCcw className="h-5 w-5" />
          Nueva Devolución
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-700">{getStatusCount('pending')}</p>
              <p className="text-sm text-yellow-600">Pendientes</p>
            </div>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-blue-50 border border-blue-200 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-700">{getStatusCount('approved')}</p>
              <p className="text-sm text-blue-600">Aprobadas</p>
            </div>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-green-50 border border-green-200 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-700">{getStatusCount('completed')}</p>
              <p className="text-sm text-green-600">Completadas</p>
            </div>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-purple-50 border border-purple-200 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-2xl font-bold text-purple-700">
                {formatCurrency(summary?.monthly.totalRefund || 0)}
              </p>
              <p className="text-sm text-purple-600">Este mes</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4">
        {isAdmin && (
          <div className="relative">
            <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
            >
              <option value="">Todas las tiendas</option>
              {stores.map((store) => (
                <option key={store._id} value={store._id}>{store.name}</option>
              ))}
            </select>
          </div>
        )}
        
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobadas</option>
            <option value="completed">Completadas</option>
            <option value="rejected">Rechazadas</option>
          </select>
        </div>
      </div>

      {/* Lista de devoluciones */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : !returnsData?.returns || returnsData.returns.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <RotateCcw className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No hay devoluciones registradas</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {returnsData.returns.map((ret) => {
              const statusConf = statusConfig[ret.status];
              const typeConf = returnTypeConfig[ret.returnType];
              const StatusIcon = statusConf.icon;
              
              return (
                <motion.div
                  key={ret._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => viewDetail(ret)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusConf.color}`}>
                        <StatusIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{ret.returnNumber}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${typeConf.color}`}>{typeConf.label}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${typeConf.color}`}>
                            {typeConf.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>Venta: {ret.originalSale?.saleNumber || 'N/A'}</span>
                          <span>•</span>
                          <span>{ret.items.length} producto(s)</span>
                          <span>•</span>
                          <span>{formatDate(ret.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{formatCurrency(ret.totalRefund)}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusConf.color}`}>
                          {statusConf.label}
                        </span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Crear Devolución */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={resetCreateModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Nueva Devolución</h3>
                <button onClick={resetCreateModal} className="text-gray-400 hover:text-gray-600">
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Buscar venta */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buscar Venta Original
                  </label>
                  <form onSubmit={handleSearchSale} className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={saleSearch}
                        onChange={(e) => setSaleSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Número de venta (ej: V-240115-001)"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={searchSaleMutation.isPending}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {searchSaleMutation.isPending ? (
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      ) : (
                        'Buscar'
                      )}
                    </button>
                  </form>
                </div>

                {/* Venta encontrada */}
                {foundSale && (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-blue-900">
                            Venta: {foundSale.saleNumber || foundSale._id}
                          </p>
                          <p className="text-sm text-blue-700">
                            Total: {formatCurrency(foundSale.total)} • {formatDate(foundSale.createdAt)}
                          </p>
                        </div>
                        <FileText className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>

                    {/* Productos */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Seleccionar Productos a Devolver
                      </label>
                      <div className="space-y-3">
                        {foundSale.items.map((item) => {
                          const available = item.availableToReturn ?? item.quantity;
                          const isSelected = !!selectedItems[item.product._id];
                          
                          if (available <= 0) {
                            return (
                              <div
                                key={item.product._id}
                                className="p-3 border rounded-lg bg-gray-50 opacity-50"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-500">{item.product.name}</span>
                                  <span className="text-xs text-red-500">Ya devuelto</span>
                                </div>
                              </div>
                            );
                          }
                          
                          return (
                            <div
                              key={item.product._id}
                              className={`p-3 border rounded-lg transition-colors ${
                                isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleItemSelection(item.product._id, available)}
                                  className="mt-1 h-4 w-4 text-blue-600 rounded"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{item.product.name}</span>
                                    <span className="text-gray-600">{formatCurrency(item.unitPrice)}</span>
                                  </div>
                                  <p className="text-sm text-gray-500">
                                    Disponible: {available} de {item.quantity}
                                  </p>
                                  
                                  {isSelected && (
                                    <div className="mt-3 space-y-2">
                                      <div className="flex items-center gap-2">
                                        <label className="text-sm text-gray-600">Cantidad:</label>
                                        <button
                                          type="button"
                                          onClick={() => updateItemQuantity(item.product._id, selectedItems[item.product._id].quantity - 1, available)}
                                          className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-100"
                                        >
                                          <Minus className="h-4 w-4" />
                                        </button>
                                        <span className="w-12 text-center font-medium">
                                          {selectedItems[item.product._id].quantity}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => updateItemQuantity(item.product._id, selectedItems[item.product._id].quantity + 1, available)}
                                          className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-100"
                                        >
                                          <Plus className="h-4 w-4" />
                                        </button>
                                      </div>
                                      <input
                                        type="text"
                                        value={selectedItems[item.product._id].reason}
                                        onChange={(e) => updateItemReason(item.product._id, e.target.value)}
                                        className="w-full px-3 py-2 text-sm border rounded-lg"
                                        placeholder="Razón de devolución de este producto"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tipo de devolución */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de Devolución
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {(['refund', 'exchange', 'store_credit'] as const).map((type) => {
                          const conf = returnTypeConfig[type];
                          const Icon = conf.icon;
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setReturnType(type)}
                              className={`p-3 rounded-lg border-2 transition-colors ${
                                returnType === type
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <Icon className={`h-5 w-5 mx-auto mb-1 ${returnType === type ? 'text-blue-600' : 'text-gray-400'}`} />
                              <span className="text-sm">{conf.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Razón general */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Razón General de Devolución *
                      </label>
                      <textarea
                        value={generalReason}
                        onChange={(e) => setGeneralReason(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="Describe el motivo de la devolución"
                      />
                    </div>

                    {/* Datos del cliente (opcional) */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nombre Cliente (opcional)
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="Nombre del cliente"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Teléfono (opcional)
                        </label>
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="Teléfono"
                        />
                      </div>
                    </div>

                    {/* Total */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total a devolver:</span>
                        <span className="text-2xl font-bold text-gray-900">
                          {formatCurrency(calculateTotal())}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              {foundSale && (
                <div className="p-6 border-t flex gap-3">
                  <button
                    type="button"
                    onClick={resetCreateModal}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateReturn}
                    disabled={createMutation.isPending || Object.keys(selectedItems).length === 0}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createMutation.isPending ? 'Creando...' : 'Crear Devolución'}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Detalle */}
      <AnimatePresence>
        {showDetailModal && selectedReturn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDetailModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selectedReturn.returnNumber}</h3>
                    <p className="text-sm text-gray-500">
                      Venta original: {selectedReturn.originalSale?.saleNumber || 'N/A'}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${statusConfig[selectedReturn.status].color}`}>
                    {statusConfig[selectedReturn.status].label}
                  </span>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Información */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <span className="text-sm text-gray-500">Tipo</span>
                    <p className="font-medium">{returnTypeConfig[selectedReturn.returnType].label}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <span className="text-sm text-gray-500">Total Devolución</span>
                    <p className="font-medium text-lg">{formatCurrency(selectedReturn.totalRefund)}</p>
                  </div>
                </div>

                {/* Productos */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Productos a Devolver</h4>
                  <div className="space-y-2">
                    {selectedReturn.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{item.product?.name}</p>
                          <p className="text-sm text-gray-500">
                            Cantidad: {item.quantity} • Razón: {item.reason}
                          </p>
                        </div>
                        <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Razón general */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Razón General</h4>
                  <p className="text-gray-600 bg-gray-50 rounded-lg p-3">{selectedReturn.reason}</p>
                </div>

                {/* Notas */}
                {selectedReturn.notes && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Notas</h4>
                    <p className="text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
                      {selectedReturn.notes}
                    </p>
                  </div>
                )}

                {/* Timeline */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Historial</h4>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="w-2 h-2 mt-2 rounded-full bg-blue-500"></div>
                      <div>
                        <p className="text-sm">Creada por {selectedReturn.processedBy?.name}</p>
                        <p className="text-xs text-gray-500">{formatDate(selectedReturn.createdAt)}</p>
                      </div>
                    </div>
                    {selectedReturn.approvedBy && selectedReturn.approvedAt && (
                      <div className="flex gap-3">
                        <div className="w-2 h-2 mt-2 rounded-full bg-green-500"></div>
                        <div>
                          <p className="text-sm">Aprobada por {selectedReturn.approvedBy?.name}</p>
                          <p className="text-xs text-gray-500">{formatDate(selectedReturn.approvedAt)}</p>
                        </div>
                      </div>
                    )}
                    {selectedReturn.completedAt && (
                      <div className="flex gap-3">
                        <div className="w-2 h-2 mt-2 rounded-full bg-green-500"></div>
                        <div>
                          <p className="text-sm">Completada</p>
                          <p className="text-xs text-gray-500">{formatDate(selectedReturn.completedAt)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Acciones */}
              {(selectedReturn.status === 'pending' || selectedReturn.status === 'approved') && isAdmin && (
                <div className="p-6 border-t flex gap-3">
                  {selectedReturn.status === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          const reason = prompt('Razón del rechazo:');
                          if (reason) {
                            rejectMutation.mutate({ id: selectedReturn._id, reason });
                          }
                        }}
                        className="flex-1 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
                      >
                        Rechazar
                      </button>
                      <button
                        onClick={() => approveMutation.mutate(selectedReturn._id)}
                        disabled={approveMutation.isPending}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {approveMutation.isPending ? 'Aprobando...' : 'Aprobar'}
                      </button>
                    </>
                  )}
                  {selectedReturn.status === 'approved' && (
                    <button
                      onClick={() => completeMutation.mutate(selectedReturn._id)}
                      disabled={completeMutation.isPending}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {completeMutation.isPending ? 'Procesando...' : 'Completar y Actualizar Inventario'}
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
