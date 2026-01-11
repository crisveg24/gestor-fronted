import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftRight,
  Plus,
  Search,
  Package,
  Store,
  Truck,
  Check,
  X,
  Clock,
  ChevronDown,
  Eye,
  Send,
  PackageCheck,
  Ban,
  Trash2,
} from 'lucide-react';
import { Card, Loading, Button } from '../components/ui';
import { toast } from '../components/ui';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Tipos
interface StoreOption {
  _id: string;
  name: string;
}

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
  barcode?: string;
}

interface TransferItem {
  product: ProductOption;
  quantity: number;
  receivedQuantity?: number;
  notes?: string;
}

interface Transfer {
  _id: string;
  transferNumber: string;
  fromStore: StoreOption;
  toStore: StoreOption;
  items: TransferItem[];
  status: 'pending' | 'in_transit' | 'received' | 'cancelled';
  notes?: string;
  createdBy: { name: string };
  sentBy?: { name: string };
  receivedBy?: { name: string };
  cancelledBy?: { name: string };
  createdAt: string;
  sentAt?: string;
  receivedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

interface TransferSummary {
  pending: number;
  inTransit: number;
  received: number;
  cancelled: number;
  total: number;
}

interface InventoryItem {
  _id: string;
  product: ProductOption;
  quantity: number;
  store: StoreOption;
}

// Constante para localStorage
const TRANSFER_STORE_KEY = 'gestor_transfer_store';

const statusConfig = {
  pending: { label: 'Pendiente', color: 'warning', icon: Clock },
  in_transit: { label: 'En Tránsito', color: 'info', icon: Truck },
  received: { label: 'Recibida', color: 'success', icon: Check },
  cancelled: { label: 'Cancelada', color: 'danger', icon: X },
};

const TransfersPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Estados
  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TRANSFER_STORE_KEY) || '';
    }
    return '';
  });
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

  // Form para crear transferencia
  const [fromStoreId, setFromStoreId] = useState('');
  const [toStoreId, setToStoreId] = useState('');
  const [transferItems, setTransferItems] = useState<Array<{
    productId: string;
    productName: string;
    quantity: number;
    maxQuantity: number;
  }>>([]);
  const [transferNotes, setTransferNotes] = useState('');
  const [productSearch, setProductSearch] = useState('');

  // Guardar tienda en localStorage
  useEffect(() => {
    if (selectedStoreId) {
      localStorage.setItem(TRANSFER_STORE_KEY, selectedStoreId);
    }
  }, [selectedStoreId]);

  // Queries
  const { data: stores } = useQuery<StoreOption[]>({
    queryKey: ['stores-list'],
    queryFn: async () => {
      const response = await api.get('/stores');
      return response.data.data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: summary } = useQuery<TransferSummary>({
    queryKey: ['transfers-summary', selectedStoreId],
    queryFn: async () => {
      const params = selectedStoreId ? { storeId: selectedStoreId } : {};
      const response = await api.get('/transfers/summary', { params });
      return response.data.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: transfers, isLoading } = useQuery<Transfer[]>({
    queryKey: ['transfers', selectedStoreId, statusFilter],
    queryFn: async () => {
      const params: any = {};
      if (selectedStoreId) {
        params.fromStore = selectedStoreId;
        // También incluir las que son destino
      }
      if (statusFilter) {
        params.status = statusFilter;
      }
      const response = await api.get('/transfers', { params });
      return response.data.data || [];
    },
    staleTime: 1 * 60 * 1000,
  });

  // Inventario de tienda origen para crear transferencia
  const { data: inventoryItems } = useQuery<InventoryItem[]>({
    queryKey: ['inventory-for-transfer', fromStoreId, productSearch],
    queryFn: async () => {
      if (!fromStoreId) return [];
      const params: any = { store: fromStoreId };
      if (productSearch) {
        params.search = productSearch;
      }
      const response = await api.get('/inventory', { params });
      return response.data.data || [];
    },
    enabled: !!fromStoreId && showCreateModal,
    staleTime: 1 * 60 * 1000,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/transfers', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Transferencia creada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfers-summary'] });
      setShowCreateModal(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear transferencia');
    }
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.put(`/transfers/${id}/send`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Transferencia enviada. Inventario descontado de tienda origen.');
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfers-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al enviar transferencia');
    }
  });

  const receiveMutation = useMutation({
    mutationFn: async ({ id, receivedItems }: { id: string; receivedItems?: any[] }) => {
      const response = await api.put(`/transfers/${id}/receive`, { receivedItems });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Transferencia recibida. Inventario agregado a tienda destino.');
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfers-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setShowReceiveModal(false);
      setSelectedTransfer(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al recibir transferencia');
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await api.put(`/transfers/${id}/cancel`, { reason });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Transferencia cancelada');
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfers-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al cancelar');
    }
  });

  // Helpers
  const resetForm = () => {
    setFromStoreId('');
    setToStoreId('');
    setTransferItems([]);
    setTransferNotes('');
    setProductSearch('');
  };

  const addProductToTransfer = (item: InventoryItem) => {
    if (transferItems.find(i => i.productId === item.product._id)) {
      toast.error('Este producto ya está en la lista');
      return;
    }
    setTransferItems([...transferItems, {
      productId: item.product._id,
      productName: `${item.product.name} (${item.product.sku})`,
      quantity: 1,
      maxQuantity: item.quantity
    }]);
  };

  const updateItemQuantity = (productId: string, quantity: number) => {
    setTransferItems(transferItems.map(item => 
      item.productId === productId 
        ? { ...item, quantity: Math.min(quantity, item.maxQuantity) }
        : item
    ));
  };

  const removeItemFromTransfer = (productId: string) => {
    setTransferItems(transferItems.filter(i => i.productId !== productId));
  };

  const handleCreateTransfer = () => {
    if (!fromStoreId || !toStoreId) {
      toast.error('Selecciona tienda origen y destino');
      return;
    }
    if (fromStoreId === toStoreId) {
      toast.error('La tienda origen y destino no pueden ser la misma');
      return;
    }
    if (transferItems.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }

    createMutation.mutate({
      fromStore: fromStoreId,
      toStore: toStoreId,
      items: transferItems.map(i => ({
        product: i.productId,
        quantity: i.quantity
      })),
      notes: transferNotes
    });
  };

  const handleSendTransfer = (transfer: Transfer) => {
    if (window.confirm(`¿Enviar transferencia ${transfer.transferNumber}?\n\nEl inventario se descontará de ${transfer.fromStore.name}.`)) {
      sendMutation.mutate(transfer._id);
    }
  };

  const handleReceiveTransfer = (transfer: Transfer) => {
    setSelectedTransfer(transfer);
    setShowReceiveModal(true);
  };

  const handleConfirmReceive = () => {
    if (!selectedTransfer) return;
    receiveMutation.mutate({ id: selectedTransfer._id });
  };

  const handleCancelTransfer = (transfer: Transfer) => {
    const reason = window.prompt('Motivo de cancelación (opcional):');
    if (reason !== null) {
      cancelMutation.mutate({ id: transfer._id, reason });
    }
  };

  const openDetail = (transfer: Transfer) => {
    setSelectedTransfer(transfer);
    setShowDetailModal(true);
  };

  // Filtrar transferencias por búsqueda
  const filteredTransfers = transfers?.filter(t => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      t.transferNumber.toLowerCase().includes(search) ||
      t.fromStore.name.toLowerCase().includes(search) ||
      t.toStore.name.toLowerCase().includes(search)
    );
  });

  if (isLoading) {
    return <Loading fullScreen text="Cargando transferencias..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ArrowLeftRight className="text-primary-600" />
            Transferencias
          </h1>
          <p className="text-gray-600 mt-1">Mover productos entre tiendas</p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button
              variant="primary"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={18} />
              Nueva Transferencia
            </Button>
          )}
        </div>
      </motion.div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <Card.Body className="text-center">
              <Clock className="mx-auto text-yellow-500 mb-2" size={24} />
              <p className="text-2xl font-bold text-yellow-600">{summary.pending}</p>
              <p className="text-sm text-gray-500">Pendientes</p>
            </Card.Body>
          </Card>
          <Card>
            <Card.Body className="text-center">
              <Truck className="mx-auto text-blue-500 mb-2" size={24} />
              <p className="text-2xl font-bold text-blue-600">{summary.inTransit}</p>
              <p className="text-sm text-gray-500">En Tránsito</p>
            </Card.Body>
          </Card>
          <Card>
            <Card.Body className="text-center">
              <Check className="mx-auto text-green-500 mb-2" size={24} />
              <p className="text-2xl font-bold text-green-600">{summary.received}</p>
              <p className="text-sm text-gray-500">Recibidas</p>
            </Card.Body>
          </Card>
          <Card>
            <Card.Body className="text-center">
              <Package className="mx-auto text-gray-500 mb-2" size={24} />
              <p className="text-2xl font-bold text-gray-600">{summary.total}</p>
              <p className="text-sm text-gray-500">Total</p>
            </Card.Body>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <Card.Body>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por número o tienda..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {isAdmin && stores && (
              <div className="relative">
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-lg pl-4 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Todas las tiendas</option>
                  {stores.map((store) => (
                    <option key={store._id} value={store._id}>
                      {store.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            )}

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg pl-4 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Todos los estados</option>
                <option value="pending">Pendientes</option>
                <option value="in_transit">En Tránsito</option>
                <option value="received">Recibidas</option>
                <option value="cancelled">Canceladas</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Transfers List */}
      <div className="space-y-4">
        {filteredTransfers && filteredTransfers.length > 0 ? (
          filteredTransfers.map((transfer) => {
            const config = statusConfig[transfer.status];
            const StatusIcon = config.icon;
            const canSend = transfer.status === 'pending' && 
              (isAdmin || (typeof user?.store === 'string' && user?.store === transfer.fromStore._id));
            const canReceive = transfer.status === 'in_transit' && 
              (isAdmin || (typeof user?.store === 'string' && user?.store === transfer.toStore._id));
            const canCancel = ['pending', 'in_transit'].includes(transfer.status) && isAdmin;

            return (
              <motion.div
                key={transfer._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card hover>
                  <Card.Body>
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Info principal */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono font-semibold text-lg">
                            {transfer.transferNumber}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${config.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' : config.color === 'blue' ? 'bg-blue-100 text-blue-700' : config.color === 'green' ? 'bg-green-100 text-green-700' : config.color === 'red' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                            <StatusIcon size={14} className="mr-1" />
                            {config.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-gray-600">
                          <Store size={16} />
                          <span className="font-medium">{transfer.fromStore.name}</span>
                          <ArrowLeftRight size={16} className="text-primary-500" />
                          <Store size={16} />
                          <span className="font-medium">{transfer.toStore.name}</span>
                        </div>

                        <div className="mt-2 text-sm text-gray-500">
                          <span>{transfer.items.length} producto(s)</span>
                          <span className="mx-2">•</span>
                          <span>Creada: {format(new Date(transfer.createdAt), 'dd MMM yyyy HH:mm', { locale: es })}</span>
                          {transfer.sentAt && (
                            <>
                              <span className="mx-2">•</span>
                              <span>Enviada: {format(new Date(transfer.sentAt), 'dd MMM HH:mm', { locale: es })}</span>
                            </>
                          )}
                          {transfer.receivedAt && (
                            <>
                              <span className="mx-2">•</span>
                              <span>Recibida: {format(new Date(transfer.receivedAt), 'dd MMM HH:mm', { locale: es })}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDetail(transfer)}
                        >
                          <Eye size={16} />
                          Ver
                        </Button>

                        {canSend && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleSendTransfer(transfer)}
                            isLoading={sendMutation.isPending}
                          >
                            <Send size={16} />
                            Enviar
                          </Button>
                        )}

                        {canReceive && (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleReceiveTransfer(transfer)}
                          >
                            <PackageCheck size={16} />
                            Recibir
                          </Button>
                        )}

                        {canCancel && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleCancelTransfer(transfer)}
                            isLoading={cancelMutation.isPending}
                          >
                            <Ban size={16} />
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </motion.div>
            );
          })
        ) : (
          <Card>
            <Card.Body className="text-center py-12">
              <ArrowLeftRight size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No hay transferencias</p>
              {isAdmin && (
                <Button
                  variant="primary"
                  className="mt-4"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus size={18} />
                  Crear Primera Transferencia
                </Button>
              )}
            </Card.Body>
          </Card>
        )}
      </div>

      {/* Modal Crear Transferencia */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold">Nueva Transferencia</h2>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                {/* Tiendas */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tienda Origen
                    </label>
                    <select
                      value={fromStoreId}
                      onChange={(e) => {
                        setFromStoreId(e.target.value);
                        setTransferItems([]);
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="">Seleccionar...</option>
                      {stores?.map((store) => (
                        <option key={store._id} value={store._id} disabled={store._id === toStoreId}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tienda Destino
                    </label>
                    <select
                      value={toStoreId}
                      onChange={(e) => setToStoreId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="">Seleccionar...</option>
                      {stores?.map((store) => (
                        <option key={store._id} value={store._id} disabled={store._id === fromStoreId}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Búsqueda de productos */}
                {fromStoreId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Agregar Productos
                    </label>
                    <div className="relative">
                      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={productSearch}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProductSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    {/* Lista de productos disponibles */}
                    {inventoryItems && inventoryItems.length > 0 && (
                      <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                        {inventoryItems.map((item) => (
                          <div
                            key={item._id}
                            className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-0"
                            onClick={() => addProductToTransfer(item)}
                          >
                            <div>
                              <p className="text-sm font-medium">{item.product.name}</p>
                              <p className="text-xs text-gray-500">{item.product.sku}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{item.quantity} disponibles</p>
                              <button className="text-xs text-primary-600">+ Agregar</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Productos a transferir */}
                {transferItems.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Productos a Transferir ({transferItems.length})
                    </label>
                    <div className="border rounded-lg divide-y">
                      {transferItems.map((item) => (
                        <div key={item.productId} className="flex items-center gap-3 p-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{item.productName}</p>
                            <p className="text-xs text-gray-500">Máx: {item.maxQuantity}</p>
                          </div>
                          <input
                            type="number"
                            min={1}
                            max={item.maxQuantity}
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(item.productId, parseInt(e.target.value) || 1)}
                            className="w-20 border rounded px-2 py-1 text-center"
                          />
                          <button
                            onClick={() => removeItemFromTransfer(item.productId)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas (opcional)
                  </label>
                  <textarea
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    rows={2}
                    placeholder="Observaciones sobre la transferencia..."
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCreateTransfer}
                  isLoading={createMutation.isPending}
                  disabled={!fromStoreId || !toStoreId || transferItems.length === 0}
                >
                  Crear Transferencia
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Detalle */}
      <AnimatePresence>
        {showDetailModal && selectedTransfer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDetailModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">{selectedTransfer.transferNumber}</h2>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusConfig[selectedTransfer.status].color === 'yellow' ? 'bg-yellow-100 text-yellow-700' : statusConfig[selectedTransfer.status].color === 'blue' ? 'bg-blue-100 text-blue-700' : statusConfig[selectedTransfer.status].color === 'green' ? 'bg-green-100 text-green-700' : statusConfig[selectedTransfer.status].color === 'red' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                    {statusConfig[selectedTransfer.status].label}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Origen</p>
                    <p className="font-medium">{selectedTransfer.fromStore.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Destino</p>
                    <p className="font-medium">{selectedTransfer.toStore.name}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-2">Productos</p>
                  <div className="border rounded-lg divide-y">
                    {selectedTransfer.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3">
                        <div>
                          <p className="font-medium">{item.product.name}</p>
                          <p className="text-xs text-gray-500">{item.product.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{item.quantity} unid.</p>
                          {item.receivedQuantity !== undefined && (
                            <p className="text-xs text-gray-500">
                              Recibido: {item.receivedQuantity}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedTransfer.notes && (
                  <div>
                    <p className="text-sm text-gray-500">Notas</p>
                    <p className="text-gray-700">{selectedTransfer.notes}</p>
                  </div>
                )}

                <div className="text-sm text-gray-500 space-y-1">
                  <p>Creada por: {selectedTransfer.createdBy.name}</p>
                  <p>Fecha: {format(new Date(selectedTransfer.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                  {selectedTransfer.sentBy && (
                    <p>Enviada por: {selectedTransfer.sentBy.name}</p>
                  )}
                  {selectedTransfer.receivedBy && (
                    <p>Recibida por: {selectedTransfer.receivedBy.name}</p>
                  )}
                  {selectedTransfer.cancellationReason && (
                    <p className="text-red-600">Motivo cancelación: {selectedTransfer.cancellationReason}</p>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end">
                <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                  Cerrar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Recibir */}
      <AnimatePresence>
        {showReceiveModal && selectedTransfer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowReceiveModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold">Confirmar Recepción</h2>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-gray-600">
                  ¿Confirmas que recibiste todos los productos de la transferencia{' '}
                  <strong>{selectedTransfer.transferNumber}</strong>?
                </p>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Productos:</p>
                  {selectedTransfer.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.product.name}</span>
                      <span className="font-medium">{item.quantity} unid.</span>
                    </div>
                  ))}
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700">
                    <Check size={16} className="inline mr-1" />
                    El inventario se agregará automáticamente a tu tienda.
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowReceiveModal(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="success"
                  onClick={handleConfirmReceive}
                  isLoading={receiveMutation.isPending}
                >
                  <PackageCheck size={18} />
                  Confirmar Recepción
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TransfersPage;
