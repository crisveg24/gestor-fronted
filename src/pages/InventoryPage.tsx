import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Package, 
  AlertTriangle, 
  Plus, 
  Minus, 
  ArrowLeftRight, 
  History,
  TrendingUp,
  TrendingDown,
  Filter,
} from 'lucide-react';
import { Card, SearchBar, ResponsiveTable, Button, Modal, toast, EmptyStateNoStore } from '../components/ui';
import type { Column } from '../components/ui';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AxiosApiError } from '../types';
import logger from '../utils/logger';

// Tipos
interface InventoryItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    sku: string;
    category: string;
  };
  store: {
    _id: string;
    name: string;
  };
  quantity: number;
  minStock: number;
  maxStock: number;
  lastUpdated: string;
}

interface StockMovement {
  _id: string;
  product: {
    name: string;
    sku: string;
  };
  store: {
    name: string;
  };
  type: 'entrada' | 'salida' | 'ajuste' | 'transferencia';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  createdBy: {
    name: string;
  };
  createdAt: string;
}

interface Store {
  _id: string;
  name: string;
}

const InventoryPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Estados - DEBEN estar antes de cualquier return condicional (reglas de React hooks)
  const [selectedStore, setSelectedStore] = useState<string>(user?.store?._id || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [transferToStore, setTransferToStore] = useState('');
  const [transferQuantity, setTransferQuantity] = useState(0);

  logger.log('[INVENTORY PAGE] Inicializando página');
  logger.log('[INVENTORY PAGE] Usuario:', { 
    role: user?.role, 
    hasStore: !!user?.store,
    storeId: user?.store?._id 
  });

  // Queries - DEBEN estar antes del return condicional
  const { data: stores } = useQuery<Store[]>({
    queryKey: ['stores'],
    queryFn: async () => {
      const response = await api.get('/stores');
      // Backend devuelve: { success: true, data: [...stores] } - array directo
      return response.data.data || [];
    },
    enabled: isAdmin,
  });

  const { data: inventory, isLoading } = useQuery<InventoryItem[]>({
    queryKey: ['inventory', selectedStore, searchQuery, filterLowStock],
    queryFn: async () => {
      logger.log('[INVENTORY] Obteniendo inventario...');
      logger.log('[INVENTORY] Tienda seleccionada:', selectedStore);
      logger.log('[INVENTORY] Usuario:', { role: user?.role, store: user?.store?._id });
      
      const response = await api.get('/inventory', {
        params: {
          store: selectedStore,  // Enviar 'all' si está seleccionado
          search: searchQuery || undefined,
          lowStock: filterLowStock || undefined,
        },
      });
      
      logger.log('[INVENTORY] Inventario obtenido:', response.data.data?.length, 'items');
      return response.data.data;
    },
  });

  const { data: movements } = useQuery<StockMovement[]>({
    queryKey: ['stock-movements', selectedItem?._id],
    queryFn: async () => {
      const response = await api.get(`/inventory/${selectedItem?._id}/movements`);
      return response.data.data;
    },
    enabled: !!selectedItem && historyModalOpen,
  });

  // Mutations - DEBEN estar antes del return condicional
  const adjustMutation = useMutation({
    mutationFn: async (data: { inventoryId: string; quantity: number; reason: string }) => {
      await api.post(`/inventory/${data.inventoryId}/adjust`, {
        quantity: data.quantity,
        reason: data.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-low-stock'] });
      toast.success('Stock ajustado exitosamente');
      setAdjustModalOpen(false);
      setSelectedItem(null);
      setAdjustQuantity(0);
      setAdjustReason('');
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosApiError;
      toast.error(axiosError.response?.data?.message || 'Error al ajustar el stock');
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (data: { 
      inventoryId: string; 
      toStoreId: string; 
      quantity: number;
    }) => {
      await api.post(`/inventory/${data.inventoryId}/transfer`, {
        toStore: data.toStoreId,
        quantity: data.quantity,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Transferencia realizada exitosamente');
      setTransferModalOpen(false);
      setSelectedItem(null);
      setTransferToStore('');
      setTransferQuantity(0);
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosApiError;
      toast.error(axiosError.response?.data?.message || 'Error al realizar la transferencia');
    },
  });

  // ✅ Verificar si el usuario tiene tienda asignada (DESPUÉS de todos los hooks)
  if (user && !isAdmin && !user.store) {
    logger.log('[INVENTORY PAGE] Usuario sin tienda asignada, mostrando EmptyStateNoStore');
    return <EmptyStateNoStore />;
  }

  // Handlers
  const handleAdjustStock = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustQuantity(0);
    setAdjustReason('');
    setAdjustModalOpen(true);
  };

  const handleTransferStock = (item: InventoryItem) => {
    setSelectedItem(item);
    setTransferToStore('');
    setTransferQuantity(0);
    setTransferModalOpen(true);
  };

  const handleViewHistory = (item: InventoryItem) => {
    setSelectedItem(item);
    setHistoryModalOpen(true);
  };

  const confirmAdjust = () => {
    if (!selectedItem || adjustQuantity === 0 || !adjustReason.trim()) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    adjustMutation.mutate({
      inventoryId: selectedItem._id,
      quantity: adjustQuantity,
      reason: adjustReason,
    });
  };

  const confirmTransfer = () => {
    if (!selectedItem || !transferToStore || transferQuantity <= 0) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    if (transferQuantity > selectedItem.quantity) {
      toast.error('No hay suficiente stock para transferir');
      return;
    }

    transferMutation.mutate({
      inventoryId: selectedItem._id,
      toStoreId: transferToStore,
      quantity: transferQuantity,
    });
  };

  // Columnas de la tabla
  const columns: Column<InventoryItem>[] = [
    {
      key: 'product',
      header: 'Producto',
      sortable: true,
      render: (item) => (
        <div>
          <p className="font-medium text-gray-900">{item.product?.name || 'Sin nombre'}</p>
          <p className="text-sm text-gray-500">{item.product?.sku || 'Sin SKU'}</p>
          <p className="text-xs text-gray-400">{item.product?.category || 'Sin categoría'}</p>
        </div>
      ),
      mobileRender: (item) => (
        <div>
          <p className="font-semibold text-gray-900">{item.product?.name || 'Sin nombre'}</p>
          <p className="text-sm text-gray-600 mt-0.5">SKU: {item.product?.sku || 'N/A'}</p>
          <p className="text-xs text-gray-500 mt-0.5">{item.product?.category || 'Sin categoría'}</p>
        </div>
      ),
    },
    {
      key: 'store',
      header: 'Tienda',
      hideOnMobile: !isAdmin, // Solo mostrar en admin, en mobile ocupa mucho espacio
      render: (item) => (
        <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
          {item.store?.name || 'Sin tienda'}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: 'Stock Actual',
      sortable: true,
      render: (item) => {
        const isLowStock = item.quantity <= item.minStock;
        const isOverStock = item.quantity >= item.maxStock;
        
        return (
          <div className="text-center">
            <p
              className={`text-2xl font-bold ${
                isLowStock
                  ? 'text-red-600'
                  : isOverStock
                  ? 'text-orange-600'
                  : 'text-green-600'
              }`}
            >
              {item.quantity}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Min: {item.minStock} | Max: {item.maxStock}
            </p>
          </div>
        );
      },
      mobileRender: (item) => {
        const isLowStock = item.quantity <= item.minStock;
        const isOverStock = item.quantity >= item.maxStock;
        
        return (
          <div className="flex items-center gap-2">
            <span
              className={`text-xl font-bold ${
                isLowStock
                  ? 'text-red-600'
                  : isOverStock
                  ? 'text-orange-600'
                  : 'text-green-600'
              }`}
            >
              {item.quantity}
            </span>
            <span className="text-sm text-gray-500">
              (Min: {item.minStock})
            </span>
          </div>
        );
      },
      className: 'text-center',
    },
    {
      key: 'status',
      header: 'Estado',
      render: (item) => {
        const isLowStock = item.quantity <= item.minStock;
        const isOverStock = item.quantity >= item.maxStock;
        
        if (isLowStock) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
              <AlertTriangle size={14} />
              Stock Bajo
            </span>
          );
        }
        
        if (isOverStock) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full">
              <AlertTriangle size={14} />
              Sobre Stock
            </span>
          );
        }
        
        return (
          <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
            Normal
          </span>
        );
      },
      mobileRender: (item) => {
        const isLowStock = item.quantity <= item.minStock;
        const isOverStock = item.quantity >= item.maxStock;
        
        if (isLowStock) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
              <AlertTriangle size={14} />
              Stock Bajo
            </span>
          );
        }
        
        if (isOverStock) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full">
              <AlertTriangle size={14} />
              Sobre Stock
            </span>
          );
        }
        
        return (
          <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
            Normal
          </span>
        );
      },
    },
    {
      key: 'lastUpdated',
      header: 'Última Actualización',
      hideOnMobile: true,
      render: (item) => {
        try {
          if (!item.lastUpdated) {
            return <span className="text-sm text-gray-400">No disponible</span>;
          }
          const date = new Date(item.lastUpdated);
          if (isNaN(date.getTime())) {
            return <span className="text-sm text-gray-400">Fecha inválida</span>;
          }
          return (
            <span className="text-sm text-gray-600">
              {format(date, "dd MMM yyyy 'a las' HH:mm", { locale: es })}
            </span>
          );
        } catch {
          return <span className="text-sm text-gray-400">Error en fecha</span>;
        }
      },
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (item) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAdjustStock(item)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Ajustar stock"
          >
            <Plus size={18} />
          </button>
          {isAdmin && (
            <button
              onClick={() => handleTransferStock(item)}
              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
              title="Transferir a otra tienda"
            >
              <ArrowLeftRight size={18} />
            </button>
          )}
          <button
            onClick={() => handleViewHistory(item)}
            className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition-colors"
            title="Ver historial"
          >
            <History size={18} />
          </button>
        </div>
      ),
      mobileRender: (item) => (
        <div className="flex flex-col gap-2 mt-3">
          <button
            onClick={() => handleAdjustStock(item)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            Ajustar Stock
          </button>
          {isAdmin && (
            <button
              onClick={() => handleTransferStock(item)}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeftRight size={18} />
              Transferir
            </button>
          )}
          <button
            onClick={() => handleViewHistory(item)}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <History size={18} />
            Ver Historial
          </button>
        </div>
      ),
    },
  ];

  // Estadísticas
  const lowStockCount = inventory?.filter(item => item.quantity <= item.minStock).length || 0;
  const overStockCount = inventory?.filter(item => item.quantity >= item.maxStock).length || 0;
  const normalStockCount = inventory?.filter(
    item => item.quantity > item.minStock && item.quantity < item.maxStock
  ).length || 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Gestión de Inventario</h1>
        <p className="text-gray-600 text-sm sm:text-base">
          Control de stock por tienda
        </p>
      </motion.div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card hover>
            <Card.Body className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">Total Items</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mt-0.5 sm:mt-1">
                    {inventory?.length || 0}
                  </p>
                </div>
                <div className="bg-blue-500 p-2 sm:p-3 rounded-lg flex-shrink-0">
                  <Package className="text-white" size={20} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card hover>
            <Card.Body className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">Stock Normal</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600 mt-0.5 sm:mt-1">
                    {normalStockCount}
                  </p>
                </div>
                <div className="bg-green-500 p-2 sm:p-3 rounded-lg flex-shrink-0">
                  <TrendingUp className="text-white" size={20} />
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
          <Card hover>
            <Card.Body className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">Stock Bajo</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600 mt-0.5 sm:mt-1">
                    {lowStockCount}
                  </p>
                </div>
                <div className="bg-red-500 p-2 sm:p-3 rounded-lg flex-shrink-0">
                  <AlertTriangle className="text-white" size={20} />
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
          <Card hover>
            <Card.Body className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">Sobre Stock</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-600 mt-0.5 sm:mt-1">
                    {overStockCount}
                  </p>
                </div>
                <div className="bg-orange-500 p-2 sm:p-3 rounded-lg flex-shrink-0">
                  <TrendingDown className="text-white" size={20} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </motion.div>
      </div>

      {/* Filtros */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card>
          <Card.Body>
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="w-full">
                <SearchBar
                  placeholder="Buscar producto..."
                  onSearch={setSearchQuery}
                />
              </div>

              {isAdmin && stores && (
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-gray-600 mb-1">
                    Filtrar por Tienda
                  </label>
                  <select
                    value={selectedStore}
                    onChange={(e) => {
                      logger.log('[INVENTORY] Tienda seleccionada:', e.target.value);
                      setSelectedStore(e.target.value);
                    }}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-auto sm:min-w-[180px]"
                  >
                    <option value="all">📋 Todas las tiendas</option>
                    {stores.map((store) => (
                      <option key={store._id} value={store._id}>
                        🏪 {store.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {!isAdmin && user?.store && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-xs sm:text-sm font-medium text-blue-700 truncate">
                    🏪 {user.store.name}
                  </span>
                </div>
              )}

              <button
                onClick={() => setFilterLowStock(!filterLowStock)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm ${
                  filterLowStock
                    ? 'bg-red-50 border-red-500 text-red-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                }`}
              >
                <Filter size={16} />
                <span className="hidden sm:inline">Solo Stock Bajo</span>
                <span className="sm:hidden">Bajo</span>
              </button>
            </div>
          </Card.Body>
        </Card>
      </motion.div>

      {/* Tabla de inventario */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card>
          <ResponsiveTable
            columns={columns}
            data={inventory || []}
            isLoading={isLoading}
            emptyMessage="No se encontraron productos en el inventario"
          />
        </Card>
      </motion.div>

      {/* Modal de Ajuste de Stock */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title="Ajustar Stock"
        size="md"
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Producto</p>
              <p className="font-semibold text-gray-900">{selectedItem.product?.name || 'Sin nombre'}</p>
              <p className="text-sm text-gray-600 mt-2">Stock Actual</p>
              <p className="text-2xl font-bold text-primary-600">{selectedItem.quantity}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad a Ajustar
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAdjustQuantity(Math.max(adjustQuantity - 1, -selectedItem.quantity))}
                  className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                >
                  <Minus size={20} />
                </button>
                <input
                  type="number"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(Number(e.target.value))}
                  className="flex-1 text-center text-xl font-bold px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={() => setAdjustQuantity(adjustQuantity + 1)}
                  className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                >
                  <Plus size={20} />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Nuevo stock: <span className="font-semibold">{selectedItem.quantity + adjustQuantity}</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo del Ajuste *
              </label>
              <select
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Selecciona un motivo</option>
                <option value="Recepción de mercancía">Recepción de mercancía</option>
                <option value="Corrección de inventario">Corrección de inventario</option>
                <option value="Producto dañado">Producto dañado</option>
                <option value="Producto vencido">Producto vencido</option>
                <option value="Devolución de cliente">Devolución de cliente</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
          </div>
        )}
        <Modal.Footer>
          <Button
            variant="ghost"
            onClick={() => setAdjustModalOpen(false)}
            disabled={adjustMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={confirmAdjust}
            isLoading={adjustMutation.isPending}
            disabled={adjustQuantity === 0 || !adjustReason}
          >
            Confirmar Ajuste
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Transferencia */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Transferir Stock entre Tiendas"
        size="md"
      >
        {selectedItem && stores && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Producto</p>
              <p className="font-semibold text-gray-900">{selectedItem.product?.name || 'Sin nombre'}</p>
              <p className="text-sm text-gray-600 mt-2">Tienda Origen</p>
              <p className="font-medium text-gray-900">{selectedItem.store?.name || 'Sin tienda'}</p>
              <p className="text-sm text-gray-600 mt-2">Stock Disponible</p>
              <p className="text-xl font-bold text-primary-600">{selectedItem.quantity}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tienda Destino *
              </label>
              <select
                value={transferToStore}
                onChange={(e) => setTransferToStore(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Selecciona una tienda</option>
                {stores
                  .filter((store) => store._id !== selectedItem.store?._id)
                  .map((store) => (
                    <option key={store._id} value={store._id}>
                      {store.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad a Transferir *
              </label>
              <input
                type="number"
                min="1"
                max={selectedItem.quantity}
                value={transferQuantity}
                onChange={(e) => setTransferQuantity(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0"
              />
              {transferQuantity > selectedItem.quantity && (
                <p className="text-sm text-red-600 mt-1">
                  No hay suficiente stock disponible
                </p>
              )}
            </div>
          </div>
        )}
        <Modal.Footer>
          <Button
            variant="ghost"
            onClick={() => setTransferModalOpen(false)}
            disabled={transferMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={confirmTransfer}
            isLoading={transferMutation.isPending}
            disabled={!transferToStore || transferQuantity <= 0}
          >
            Confirmar Transferencia
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Historial */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Historial de Movimientos"
        size="lg"
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Producto</p>
              <p className="font-semibold text-gray-900">{selectedItem.product?.name || 'Sin nombre'}</p>
              <p className="text-sm text-gray-500">{selectedItem.product?.sku || 'Sin SKU'}</p>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {movements && movements.length > 0 ? (
                movements.map((movement) => (
                  <motion.div
                    key={movement._id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              movement.type === 'entrada'
                                ? 'bg-green-100 text-green-800'
                                : movement.type === 'salida'
                                ? 'bg-red-100 text-red-800'
                                : movement.type === 'transferencia'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {movement.type.toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-600">
                            {(() => {
                              try {
                                if (!movement.createdAt) return 'Fecha no disponible';
                                const date = new Date(movement.createdAt);
                                if (isNaN(date.getTime())) return 'Fecha inválida';
                                return format(date, "dd MMM yyyy 'a las' HH:mm", { locale: es });
                              } catch {
                                return 'Error en fecha';
                              }
                            })()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Cantidad:</span>{' '}
                          <span
                            className={
                              movement.quantity > 0 ? 'text-green-600' : 'text-red-600'
                            }
                          >
                            {movement.quantity > 0 ? '+' : ''}
                            {movement.quantity}
                          </span>
                        </p>
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Stock:</span> {movement.previousStock} →{' '}
                          {movement.newStock}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">{movement.reason}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Por: {movement.createdBy?.name || 'Usuario desconocido'}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <History size={48} className="mx-auto mb-2 text-gray-300" />
                  <p>No hay movimientos registrados</p>
                </div>
              )}
            </div>
          </div>
        )}
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setHistoryModalOpen(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default InventoryPage;
