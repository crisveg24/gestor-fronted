import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Package,
  Plus,
  DollarSign,
  User,
  Phone,
  MapPin,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, Button, Modal, toast, SearchBar } from '../components/ui';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AxiosApiError } from '../types';

// Tipos
interface CreditItem {
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

interface CreditPayment {
  _id: string;
  amount: number;
  paymentMethod: string;
  date: string;
  receivedBy: {
    name: string;
  };
  notes?: string;
}

interface Credit {
  _id: string;
  type: 'fiado' | 'apartado';
  status: 'pending' | 'partial' | 'completed' | 'cancelled' | 'overdue';
  store: {
    _id: string;
    name: string;
  };
  customerName: string;
  customerPhone?: string;
  customerDocument?: string;
  customerAddress?: string;
  items: CreditItem[];
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  payments: CreditPayment[];
  dueDate?: string;
  completedDate?: string;
  createdBy: {
    name: string;
  };
  notes?: string;
  createdAt: string;
}

interface Store {
  _id: string;
  name: string;
}

interface Product {
  _id: string;
  name: string;
  sku: string;
  price: number;
  stock?: number;
}

interface CreditSummary {
  summary: {
    fiados: { count: number; totalAmount: number; pendingAmount: number };
    apartados: { count: number; totalAmount: number; pendingAmount: number };
  };
  pendingCredits: Credit[];
  overdueCredits: Credit[];
  overdueCount: number;
}

const CreditsPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Estados
  const [activeTab, setActiveTab] = useState<'fiados' | 'apartados' | 'todos'>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [page, setPage] = useState(1);

  // Modal de crear
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creditType, setCreditType] = useState<'fiado' | 'apartado'>('fiado');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerDocument, setCustomerDocument] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Array<{ product: Product; quantity: number; unitPrice: number }>>([]);
  const [productSearch, setProductSearch] = useState('');
  const [initialPayment, setInitialPayment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // Modal de detalle
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<Credit | null>(null);
  const [expandedPayments, setExpandedPayments] = useState(false);

  // Modal de pago
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Recordar última tienda
  useEffect(() => {
    const lastStore = localStorage.getItem('lastUsedStore');
    if (lastStore && isAdmin) {
      setSelectedStore(lastStore);
    }
  }, [isAdmin]);

  // Query tiendas
  const { data: stores } = useQuery<Store[]>({
    queryKey: ['stores'],
    queryFn: async () => {
      const response = await api.get('/stores');
      return response.data.data;
    },
    enabled: isAdmin,
  });

  // Query resumen
  const { data: summary } = useQuery<CreditSummary>({
    queryKey: ['credits-summary', selectedStore],
    queryFn: async () => {
      const response = await api.get('/credits/summary', {
        params: { store: selectedStore || undefined }
      });
      return response.data.data;
    },
  });

  // Query créditos
  const { data: creditsData, isLoading } = useQuery({
    queryKey: ['credits', activeTab, statusFilter, searchTerm, selectedStore, page],
    queryFn: async () => {
      const response = await api.get('/credits', {
        params: {
          type: activeTab !== 'todos' ? activeTab : undefined,
          status: statusFilter || undefined,
          search: searchTerm || undefined,
          store: selectedStore || undefined,
          page,
          limit: 20,
        }
      });
      return response.data.data;
    },
  });

  // Query productos para búsqueda
  const { data: products } = useQuery<Product[]>({
    queryKey: ['products-search', productSearch, selectedStore],
    queryFn: async () => {
      const storeId = selectedStore || user?.store?._id;
      const response = await api.get('/inventory', {
        params: { 
          search: productSearch,
          store: storeId,
          limit: 10
        }
      });
      return response.data.data.map((inv: any) => ({
        _id: inv.product._id,
        name: inv.product.name,
        sku: inv.product.sku,
        price: inv.product.price,
        stock: inv.quantity
      }));
    },
    enabled: productSearch.length >= 2,
  });

  // Mutation crear crédito
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/credits', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      queryClient.invalidateQueries({ queryKey: ['credits-summary'] });
      toast.success(`${creditType === 'fiado' ? 'Fiado' : 'Apartado'} creado exitosamente`);
      resetCreateForm();
      setCreateModalOpen(false);
    },
    onError: (error: AxiosApiError) => {
      toast.error(error.response?.data?.message || 'Error al crear');
    },
  });

  // Mutation agregar pago
  const paymentMutation = useMutation({
    mutationFn: async ({ creditId, data }: { creditId: string; data: any }) => {
      const response = await api.post(`/credits/${creditId}/payment`, data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      queryClient.invalidateQueries({ queryKey: ['credits-summary'] });
      toast.success(data.message);
      setPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentNotes('');
      // Actualizar crédito seleccionado
      if (data.data) {
        setSelectedCredit(data.data);
      }
    },
    onError: (error: AxiosApiError) => {
      toast.error(error.response?.data?.message || 'Error al registrar pago');
    },
  });

  // Mutation cancelar crédito
  const cancelMutation = useMutation({
    mutationFn: async ({ creditId, reason }: { creditId: string; reason: string }) => {
      const response = await api.put(`/credits/${creditId}/cancel`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      queryClient.invalidateQueries({ queryKey: ['credits-summary'] });
      toast.success('Crédito cancelado');
      setDetailModalOpen(false);
    },
    onError: (error: AxiosApiError) => {
      toast.error(error.response?.data?.message || 'Error al cancelar');
    },
  });

  const resetCreateForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setCustomerDocument('');
    setCustomerAddress('');
    setSelectedProducts([]);
    setProductSearch('');
    setInitialPayment('');
    setPaymentMethod('efectivo');
    setDueDate('');
    setNotes('');
  };

  const handleAddProduct = (product: Product) => {
    const existing = selectedProducts.find(p => p.product._id === product._id);
    if (existing) {
      setSelectedProducts(selectedProducts.map(p =>
        p.product._id === product._id
          ? { ...p, quantity: p.quantity + 1 }
          : p
      ));
    } else {
      setSelectedProducts([...selectedProducts, {
        product,
        quantity: 1,
        unitPrice: product.price
      }]);
    }
    setProductSearch('');
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.product._id !== productId));
  };

  const handleCreateCredit = () => {
    if (!customerName.trim()) {
      toast.error('Ingresa el nombre del cliente');
      return;
    }
    if (selectedProducts.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }

    const storeId = selectedStore || user?.store?._id;
    if (!storeId) {
      toast.error('Selecciona una tienda');
      return;
    }

    createMutation.mutate({
      type: creditType,
      store: storeId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      customerDocument: customerDocument.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      items: selectedProducts.map(p => ({
        product: p.product._id,
        quantity: p.quantity,
        unitPrice: p.unitPrice
      })),
      initialPayment: parseFloat(initialPayment) || 0,
      paymentMethod,
      dueDate: dueDate || undefined,
      notes: notes.trim() || undefined
    });
  };

  const handleAddPayment = () => {
    if (!selectedCredit) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }

    paymentMutation.mutate({
      creditId: selectedCredit._id,
      data: {
        amount,
        paymentMethod,
        notes: paymentNotes.trim() || undefined
      }
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: <Clock size={14} />, label: 'Pendiente' },
      partial: { color: 'bg-blue-100 text-blue-800', icon: <DollarSign size={14} />, label: 'Pago parcial' },
      completed: { color: 'bg-green-100 text-green-800', icon: <CheckCircle size={14} />, label: 'Pagado' },
      cancelled: { color: 'bg-gray-100 text-gray-800', icon: <XCircle size={14} />, label: 'Cancelado' },
      overdue: { color: 'bg-red-100 text-red-800', icon: <AlertTriangle size={14} />, label: 'Vencido' },
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.icon}
        {badge.label}
      </span>
    );
  };

  const totalSelected = selectedProducts.reduce((sum, p) => sum + (p.quantity * p.unitPrice), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fiados y Apartados</h1>
          <p className="text-gray-600">Gestiona créditos y productos apartados</p>
        </div>
        <Button
          onClick={() => setCreateModalOpen(true)}
          leftIcon={<Plus size={18} />}
        >
          Nuevo Crédito
        </Button>
      </div>

      {/* Selector de tienda (admin) */}
      {isAdmin && stores && (
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-700">Tienda:</label>
            <select
              value={selectedStore}
              onChange={(e) => {
                setSelectedStore(e.target.value);
                localStorage.setItem('lastUsedStore', e.target.value);
              }}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todas las tiendas</option>
              {stores.map((store) => (
                <option key={store._id} value={store._id}>{store.name}</option>
              ))}
            </select>
          </div>
        </Card>
      )}

      {/* Resumen */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-200 rounded-full">
                <CreditCard className="text-orange-700" size={24} />
              </div>
              <div>
                <p className="text-sm text-orange-700 font-medium">Fiados Pendientes</p>
                <p className="text-2xl font-bold text-orange-900">
                  ${summary.summary.fiados.pendingAmount.toLocaleString('es-CO')}
                </p>
                <p className="text-xs text-orange-600">{summary.summary.fiados.count} créditos</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-200 rounded-full">
                <Package className="text-purple-700" size={24} />
              </div>
              <div>
                <p className="text-sm text-purple-700 font-medium">Apartados Pendientes</p>
                <p className="text-2xl font-bold text-purple-900">
                  ${summary.summary.apartados.pendingAmount.toLocaleString('es-CO')}
                </p>
                <p className="text-xs text-purple-600">{summary.summary.apartados.count} apartados</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-200 rounded-full">
                <DollarSign className="text-green-700" size={24} />
              </div>
              <div>
                <p className="text-sm text-green-700 font-medium">Total por Cobrar</p>
                <p className="text-2xl font-bold text-green-900">
                  ${(summary.summary.fiados.pendingAmount + summary.summary.apartados.pendingAmount).toLocaleString('es-CO')}
                </p>
              </div>
            </div>
          </Card>

          {summary.overdueCount > 0 && (
            <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-200 rounded-full">
                  <AlertTriangle className="text-red-700" size={24} />
                </div>
                <div>
                  <p className="text-sm text-red-700 font-medium">Vencidos</p>
                  <p className="text-2xl font-bold text-red-900">{summary.overdueCount}</p>
                  <p className="text-xs text-red-600">requieren atención</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {[
              { key: 'todos', label: 'Todos' },
              { key: 'fiados', label: 'Fiados' },
              { key: 'apartados', label: 'Apartados' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="partial">Pago parcial</option>
            <option value="completed">Pagado</option>
            <option value="cancelled">Cancelado</option>
          </select>

          {/* Search */}
          <div className="flex-1">
            <SearchBar
              onSearch={setSearchTerm}
              placeholder="Buscar por cliente, teléfono o documento..."
              defaultValue={searchTerm}
            />
          </div>
        </div>
      </Card>

      {/* Lista de créditos */}
      <Card>
        <Card.Body className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : creditsData?.credits?.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {creditsData.credits.map((credit: Credit) => (
                <motion.div
                  key={credit._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedCredit(credit);
                    setDetailModalOpen(true);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${
                        credit.type === 'fiado' ? 'bg-orange-100' : 'bg-purple-100'
                      }`}>
                        {credit.type === 'fiado' ? (
                          <CreditCard className="text-orange-600" size={20} />
                        ) : (
                          <Package className="text-purple-600" size={20} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{credit.customerName}</h3>
                          {getStatusBadge(credit.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          {credit.customerPhone && (
                            <span className="flex items-center gap-1">
                              <Phone size={14} />
                              {credit.customerPhone}
                            </span>
                          )}
                          <span>{credit.store.name}</span>
                          <span>{format(new Date(credit.createdAt), 'dd MMM yyyy', { locale: es })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        ${credit.totalAmount.toLocaleString('es-CO')}
                      </p>
                      {credit.remainingAmount > 0 && (
                        <p className="text-sm text-red-600">
                          Pendiente: ${credit.remainingAmount.toLocaleString('es-CO')}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CreditCard className="mx-auto text-gray-300" size={48} />
              <p className="mt-4 text-gray-500">No hay créditos registrados</p>
            </div>
          )}
        </Card.Body>

        {/* Paginación */}
        {creditsData?.pages > 1 && (
          <Card.Footer className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Anterior
            </Button>
            <span className="px-4 py-2 text-sm text-gray-600">
              Página {page} de {creditsData.pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= creditsData.pages}
              onClick={() => setPage(p => p + 1)}
            >
              Siguiente
            </Button>
          </Card.Footer>
        )}
      </Card>

      {/* Modal Crear Crédito */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          resetCreateForm();
        }}
        title={`Nuevo ${creditType === 'fiado' ? 'Fiado' : 'Apartado'}`}
        size="xl"
      >
        <div className="space-y-6">
          {/* Tipo de crédito */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setCreditType('fiado')}
              className={`flex-1 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                creditType === 'fiado'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <CreditCard className="inline mr-2" size={18} />
              Fiado
              <p className="text-xs mt-1 opacity-75">El cliente se lleva el producto</p>
            </button>
            <button
              onClick={() => setCreditType('apartado')}
              className={`flex-1 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                creditType === 'apartado'
                  ? 'bg-purple-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Package className="inline mr-2" size={18} />
              Apartado
              <p className="text-xs mt-1 opacity-75">El producto se reserva hasta pagar</p>
            </button>
          </div>

          {/* Datos del cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="inline mr-1" size={16} />
                Nombre del cliente *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Juan Pérez"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="inline mr-1" size={16} />
                Teléfono
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="300 123 4567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cédula/Documento
              </label>
              <input
                type="text"
                value={customerDocument}
                onChange={(e) => setCustomerDocument(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="1234567890"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin className="inline mr-1" size={16} />
                Dirección
              </label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Calle 123 #45-67"
              />
            </div>
          </div>

          {/* Buscar productos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Agregar productos *
            </label>
            <div className="relative">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Buscar por nombre o SKU..."
              />
              {products && products.length > 0 && productSearch && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                  {products.map((product) => (
                    <div
                      key={product._id}
                      onClick={() => handleAddProduct(product)}
                      className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    >
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">${product.price.toLocaleString('es-CO')}</p>
                          <p className="text-xs text-gray-500">Stock: {product.stock}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Productos seleccionados */}
          {selectedProducts.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Cantidad</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Precio</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Subtotal</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedProducts.map((item) => (
                    <tr key={item.product._id}>
                      <td className="px-4 py-2">
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-xs text-gray-500">{item.product.sku}</p>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const qty = parseInt(e.target.value) || 1;
                            setSelectedProducts(selectedProducts.map(p =>
                              p.product._id === item.product._id
                                ? { ...p, quantity: qty }
                                : p
                            ));
                          }}
                          className="w-16 px-2 py-1 border rounded text-center"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        ${item.unitPrice.toLocaleString('es-CO')}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        ${(item.quantity * item.unitPrice).toLocaleString('es-CO')}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleRemoveProduct(item.product._id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <XCircle size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right font-semibold">Total:</td>
                    <td className="px-4 py-3 text-right text-lg font-bold">
                      ${totalSelected.toLocaleString('es-CO')}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Pago inicial y fecha */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <DollarSign className="inline mr-1" size={16} />
                Pago inicial
              </label>
              <input
                type="number"
                value={initialPayment}
                onChange={(e) => setInitialPayment(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Método de pago
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="efectivo">💵 Efectivo</option>
                <option value="nequi">🟣 Nequi</option>
                <option value="daviplata">🟠 Daviplata</option>
                <option value="transferencia">🏦 Transferencia</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="inline mr-1" size={16} />
                Fecha límite
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas adicionales
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Observaciones..."
            />
          </div>
        </div>

        <Modal.Footer>
          <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreateCredit}
            isLoading={createMutation.isPending}
            className={creditType === 'fiado' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-purple-500 hover:bg-purple-600'}
          >
            Crear {creditType === 'fiado' ? 'Fiado' : 'Apartado'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Detalle */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={selectedCredit ? `${selectedCredit.type === 'fiado' ? 'Fiado' : 'Apartado'} - ${selectedCredit.customerName}` : ''}
        size="xl"
      >
        {selectedCredit && (
          <div className="space-y-6">
            {/* Estado y resumen */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                {getStatusBadge(selectedCredit.status)}
                <p className="text-sm text-gray-600 mt-2">
                  Creado el {format(new Date(selectedCredit.createdAt), "dd 'de' MMMM, yyyy", { locale: es })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold">${selectedCredit.totalAmount.toLocaleString('es-CO')}</p>
                {selectedCredit.remainingAmount > 0 && (
                  <p className="text-sm text-red-600">
                    Pendiente: ${selectedCredit.remainingAmount.toLocaleString('es-CO')}
                  </p>
                )}
              </div>
            </div>

            {/* Datos del cliente */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Cliente</p>
                <p className="font-medium">{selectedCredit.customerName}</p>
              </div>
              {selectedCredit.customerPhone && (
                <div>
                  <p className="text-sm text-gray-600">Teléfono</p>
                  <p className="font-medium">{selectedCredit.customerPhone}</p>
                </div>
              )}
              {selectedCredit.customerDocument && (
                <div>
                  <p className="text-sm text-gray-600">Documento</p>
                  <p className="font-medium">{selectedCredit.customerDocument}</p>
                </div>
              )}
              {selectedCredit.customerAddress && (
                <div>
                  <p className="text-sm text-gray-600">Dirección</p>
                  <p className="font-medium">{selectedCredit.customerAddress}</p>
                </div>
              )}
            </div>

            {/* Productos */}
            <div>
              <h4 className="font-semibold mb-2">Productos</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Producto</th>
                      <th className="px-3 py-2 text-center">Cant.</th>
                      <th className="px-3 py-2 text-right">Precio</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedCredit.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">{item.product.name}</td>
                        <td className="px-3 py-2 text-center">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">${item.unitPrice.toLocaleString('es-CO')}</td>
                        <td className="px-3 py-2 text-right font-medium">${item.subtotal.toLocaleString('es-CO')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Historial de pagos */}
            {selectedCredit.payments.length > 0 && (
              <div>
                <button
                  onClick={() => setExpandedPayments(!expandedPayments)}
                  className="flex items-center gap-2 font-semibold text-gray-900 hover:text-primary-600"
                >
                  Historial de pagos ({selectedCredit.payments.length})
                  {expandedPayments ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                <AnimatePresence>
                  {expandedPayments && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-2 space-y-2 overflow-hidden"
                    >
                      {selectedCredit.payments.map((payment) => (
                        <div key={payment._id} className="flex justify-between p-3 bg-green-50 rounded-lg">
                          <div>
                            <p className="font-medium text-green-800">
                              +${payment.amount.toLocaleString('es-CO')}
                            </p>
                            <p className="text-sm text-green-600">
                              {format(new Date(payment.date), 'dd MMM yyyy HH:mm', { locale: es })}
                              {' • '}{payment.receivedBy.name}
                            </p>
                          </div>
                          <span className="text-sm text-green-700">{payment.paymentMethod}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Barra de progreso */}
            {selectedCredit.status !== 'cancelled' && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Pagado: ${selectedCredit.paidAmount.toLocaleString('es-CO')}</span>
                  <span>{Math.round((selectedCredit.paidAmount / selectedCredit.totalAmount) * 100)}%</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${(selectedCredit.paidAmount / selectedCredit.totalAmount) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <Modal.Footer>
          {selectedCredit && selectedCredit.status !== 'completed' && selectedCredit.status !== 'cancelled' && (
            <>
              <Button
                variant="primary"
                onClick={() => {
                  setPaymentModalOpen(true);
                  setPaymentAmount(selectedCredit.remainingAmount.toString());
                }}
                leftIcon={<DollarSign size={18} />}
              >
                Registrar Pago
              </Button>
              {isAdmin && (
                <Button
                  variant="danger"
                  onClick={() => {
                    const reason = prompt('Razón de cancelación:');
                    if (reason !== null) {
                      cancelMutation.mutate({ creditId: selectedCredit._id, reason });
                    }
                  }}
                >
                  Cancelar Crédito
                </Button>
              )}
            </>
          )}
          <Button variant="ghost" onClick={() => setDetailModalOpen(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Pago */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Registrar Pago"
      >
        <div className="space-y-4">
          {selectedCredit && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Saldo pendiente</p>
              <p className="text-2xl font-bold text-red-600">
                ${selectedCredit.remainingAmount.toLocaleString('es-CO')}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto a pagar *
            </label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="0"
              min="1"
              max={selectedCredit?.remainingAmount}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Método de pago
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="efectivo">💵 Efectivo</option>
              <option value="nequi">🟣 Nequi</option>
              <option value="daviplata">🟠 Daviplata</option>
              <option value="transferencia">🏦 Transferencia</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <input
              type="text"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Opcional..."
            />
          </div>
        </div>

        <Modal.Footer>
          <Button variant="ghost" onClick={() => setPaymentModalOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleAddPayment}
            isLoading={paymentMutation.isPending}
          >
            Confirmar Pago
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CreditsPage;
