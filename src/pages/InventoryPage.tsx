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
import { Card, SearchBar, Table, Button, Modal, toast, EmptyStateNoStore } from '../components/ui';
import type { Column } from '../components/ui';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

  // Verificar si el usuario tiene tienda asignada
  if (user && !isAdmin && !user.store) {
    return <EmptyStateNoStore />;
  }

  // Estados
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

  // Queries
  const { data: stores } = useQuery<Store[]>({
    queryKey: ['stores'],
    queryFn: async () => {
      const response = await api.get('/stores');
      return response.data.data.stores;
    },
    enabled: isAdmin,
  });

  const { data: inventory, isLoading } = useQuery<InventoryItem[]>({
    queryKey: ['inventory', selectedStore, searchQuery, filterLowStock],
    queryFn: async () => {
      const response = await api.get('/inventory', {
        params: {
          store: selectedStore !== 'all' ? selectedStore : undefined,
          search: searchQuery,
          lowStock: filterLowStock,
        },
      });
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

  // Mutations
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
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al ajustar el stock');
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
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al realizar la transferencia');
    },
  });

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
          <p className="font-medium text-gray-900">{item.product.name}</p>
          <p className="text-sm text-gray-500">{item.product.sku}</p>
          <p className="text-xs text-gray-400">{item.product.category}</p>
        </div>
      ),
    },
    {
      key: 'store',
      header: 'Tienda',
      render: (item) => (
        <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
          {item.store.name}
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
    },
    {
      key: 'lastUpdated',
      header: 'Última Actualización',
      render: (item) => (
        <span className="text-sm text-gray-600">
          {format(new Date(item.lastUpdated), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
        </span>
      ),
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
    },
  ];

  // Estadísticas
  const lowStockCount = inventory?.filter(item => item.quantity <= item.minStock).length || 0;
  const overStockCount = inventory?.filter(item => item.quantity >= item.maxStock).length || 0;
  const normalStockCount = inventory?.filter(
    item => item.quantity > item.minStock && item.quantity < item.maxStock
  ).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Inventario</h1>
        <p className="text-gray-600 mt-1">
          Control de stock por tienda y movimientos de inventario
        </p>
      </motion.div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card hover>
            <Card.Body>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Total Items</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {inventory?.length || 0}
                  </p>
                </div>
                <div className="bg-blue-500 p-3 rounded-lg">
                  <Package className="text-white" size={24} />
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
            <Card.Body>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Stock Normal</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {normalStockCount}
                  </p>
                </div>
                <div className="bg-green-500 p-3 rounded-lg">
                  <TrendingUp className="text-white" size={24} />
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
            <Card.Body>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Stock Bajo</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">
                    {lowStockCount}
                  </p>
                </div>
                <div className="bg-red-500 p-3 rounded-lg">
                  <AlertTriangle className="text-white" size={24} />
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
            <Card.Body>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Sobre Stock</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">
                    {overStockCount}
                  </p>
                </div>
                <div className="bg-orange-500 p-3 rounded-lg">
                  <TrendingDown className="text-white" size={24} />
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
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <SearchBar
                  placeholder="Buscar por producto, SKU o categoría..."
                  onSearch={setSearchQuery}
                />
              </div>

              {isAdmin && stores && (
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">Todas las tiendas</option>
                  {stores.map((store) => (
                    <option key={store._id} value={store._id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => setFilterLowStock(!filterLowStock)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  filterLowStock
                    ? 'bg-red-50 border-red-500 text-red-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter size={18} />
                <span>Solo Stock Bajo</span>
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
          <Table
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
              <p className="font-semibold text-gray-900">{selectedItem.product.name}</p>
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
              <p className="font-semibold text-gray-900">{selectedItem.product.name}</p>
              <p className="text-sm text-gray-600 mt-2">Tienda Origen</p>
              <p className="font-medium text-gray-900">{selectedItem.store.name}</p>
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
                  .filter((store) => store._id !== selectedItem.store._id)
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
              <p className="font-semibold text-gray-900">{selectedItem.product.name}</p>
              <p className="text-sm text-gray-500">{selectedItem.product.sku}</p>
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
                            {format(new Date(movement.createdAt), "dd MMM yyyy 'a las' HH:mm", {
                              locale: es,
                            })}
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
                          Por: {movement.createdBy.name}
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
