import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Store,
  Plus,
  Edit2,
  Trash2,
  TrendingUp,
  Package,
  DollarSign,
  MapPin,
  Phone,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Card, Button, Modal, toast, Table, SearchBar } from '../components/ui';
import type { Column } from '../components/ui';
import api from '../lib/axios';

// Tipos
interface Store {
  _id: string;
  name: string;
  address: string;
  phone: string;
  manager?: {
    _id: string;
    name: string;
    email: string;
  };
  isActive: boolean;
  stats?: {
    totalProducts: number;
    totalSales: number;
    totalRevenue: number;
  };
  createdAt: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface StoreFormData {
  name: string;
  address: string;
  phone: string;
  manager?: string;
}

const StoresPage = () => {
  const queryClient = useQueryClient();

  // Estados
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  // Form states
  const [formData, setFormData] = useState<StoreFormData>({
    name: '',
    address: '',
    phone: '',
    manager: '',
  });

  // Queries
  const { data: stores, isLoading: loadingStores } = useQuery<Store[]>({
    queryKey: ['stores', searchQuery],
    queryFn: async () => {
      const response = await api.get('/stores', {
        params: { search: searchQuery },
      });
      return response.data.data.stores;
    },
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ['users-managers'],
    queryFn: async () => {
      const response = await api.get('/users', {
        params: { role: 'manager' },
      });
      return response.data.data.users;
    },
    enabled: createModalOpen || editModalOpen,
  });

  // Mutations
  const createStoreMutation = useMutation({
    mutationFn: async (data: StoreFormData) => {
      await api.post('/stores', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Tienda creada exitosamente');
      setCreateModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear la tienda');
    },
  });

  const updateStoreMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<StoreFormData>;
    }) => {
      await api.put(`/stores/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success('Tienda actualizada exitosamente');
      setEditModalOpen(false);
      setSelectedStore(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar la tienda');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/stores/${id}/toggle`, { isActive });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success(
        variables.isActive ? 'Tienda activada exitosamente' : 'Tienda desactivada exitosamente'
      );
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al cambiar estado de la tienda');
    },
  });

  const deleteStoreMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/stores/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success('Tienda eliminada exitosamente');
      setDeleteModalOpen(false);
      setSelectedStore(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al eliminar la tienda');
    },
  });

  // Funciones
  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      phone: '',
      manager: '',
    });
  };

  const openCreateModal = () => {
    resetForm();
    setCreateModalOpen(true);
  };

  const openEditModal = (store: Store) => {
    setSelectedStore(store);
    setFormData({
      name: store.name,
      address: store.address,
      phone: store.phone,
      manager: store.manager?._id || '',
    });
    setEditModalOpen(true);
  };

  const openDeleteModal = (store: Store) => {
    setSelectedStore(store);
    setDeleteModalOpen(true);
  };

  const handleCreate = () => {
    if (!formData.name || !formData.address || !formData.phone) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    createStoreMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedStore) return;

    if (!formData.name || !formData.address || !formData.phone) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    updateStoreMutation.mutate({
      id: selectedStore._id,
      data: formData,
    });
  };

  const handleDelete = () => {
    if (!selectedStore) return;
    deleteStoreMutation.mutate(selectedStore._id);
  };

  const handleToggleActive = (store: Store) => {
    toggleActiveMutation.mutate({
      id: store._id,
      isActive: !store.isActive,
    });
  };

  // Columnas de la tabla
  const columns: Column<Store>[] = [
    {
      key: 'name',
      header: 'Tienda',
      sortable: true,
      render: (store) => (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Store size={20} className="text-primary-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{store.name}</p>
            <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
              <MapPin size={14} />
              <span className="line-clamp-1">{store.address}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Teléfono',
      render: (store) => (
        <div className="flex items-center gap-2 text-gray-700">
          <Phone size={16} className="text-gray-400" />
          <span>{store.phone}</span>
        </div>
      ),
    },
    {
      key: 'manager',
      header: 'Gerente',
      render: (store) =>
        store.manager ? (
          <div>
            <p className="font-medium text-gray-900">{store.manager.name}</p>
            <p className="text-sm text-gray-500">{store.manager.email}</p>
          </div>
        ) : (
          <span className="text-gray-400 italic">Sin asignar</span>
        ),
    },
    {
      key: 'stats',
      header: 'Estadísticas',
      render: (store) =>
        store.stats ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Package size={14} className="text-blue-600" />
              <span className="text-gray-700">
                {store.stats.totalProducts} productos
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp size={14} className="text-green-600" />
              <span className="text-gray-700">{store.stats.totalSales} ventas</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign size={14} className="text-emerald-600" />
              <span className="text-gray-700">
                ${store.stats.totalRevenue.toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-gray-400 italic">Sin datos</span>
        ),
    },
    {
      key: 'isActive',
      header: 'Estado',
      render: (store) => (
        <div className="flex flex-col gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full w-fit ${
              store.isActive
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {store.isActive ? (
              <>
                <CheckCircle size={14} />
                Activa
              </>
            ) : (
              <>
                <XCircle size={14} />
                Inactiva
              </>
            )}
          </span>
          <Button
            size="sm"
            variant={store.isActive ? 'ghost' : 'outline'}
            onClick={() => handleToggleActive(store)}
            className="text-xs"
          >
            {store.isActive ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (store) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openEditModal(store)}
            leftIcon={<Edit2 size={16} />}
          >
            Editar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => openDeleteModal(store)}
            leftIcon={<Trash2 size={16} />}
          >
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  // Estadísticas generales
  const totalStores = stores?.length || 0;
  const activeStores = stores?.filter((s) => s.isActive).length || 0;
  const inactiveStores = totalStores - activeStores;
  const totalRevenue =
    stores?.reduce((sum, store) => sum + (store.stats?.totalRevenue || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Tiendas</h1>
          <p className="text-gray-600 mt-1">
            Administra todas las tiendas del sistema
          </p>
        </div>
        <Button onClick={openCreateModal} leftIcon={<Plus size={20} />}>
          Nueva Tienda
        </Button>
      </motion.div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <Card.Body>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Tiendas</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {totalStores}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Store size={24} className="text-blue-600" />
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
          <Card>
            <Card.Body>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Tiendas Activas</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    {activeStores}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle size={24} className="text-green-600" />
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
                  <p className="text-sm text-gray-600">Tiendas Inactivas</p>
                  <p className="text-3xl font-bold text-red-600 mt-1">
                    {inactiveStores}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <XCircle size={24} className="text-red-600" />
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
                  <p className="text-sm text-gray-600">Ingresos Totales</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-1">
                    ${totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <DollarSign size={24} className="text-emerald-600" />
                </div>
              </div>
            </Card.Body>
          </Card>
        </motion.div>
      </div>

      {/* Búsqueda */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card>
          <Card.Body>
            <SearchBar
              placeholder="Buscar por nombre, dirección o gerente..."
              onSearch={setSearchQuery}
            />
          </Card.Body>
        </Card>
      </motion.div>

      {/* Tabla de Tiendas */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card>
          <Table
            columns={columns}
            data={stores || []}
            isLoading={loadingStores}
            emptyMessage="No se encontraron tiendas"
          />
        </Card>
      </motion.div>

      {/* Modal Crear Tienda */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Nueva Tienda"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Tienda Centro"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dirección <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Ej: Av. Principal #123, Col. Centro"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Ej: 555-1234"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gerente (Opcional)
            </label>
            <select
              value={formData.manager}
              onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Sin asignar</option>
              {users?.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.name} - {user.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Modal.Footer>
          <Button
            variant="ghost"
            onClick={() => setCreateModalOpen(false)}
            disabled={createStoreMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            isLoading={createStoreMutation.isPending}
            leftIcon={<Plus size={18} />}
          >
            Crear Tienda
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Editar Tienda */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Editar Tienda"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Tienda Centro"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dirección <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Ej: Av. Principal #123, Col. Centro"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Ej: 555-1234"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gerente (Opcional)
            </label>
            <select
              value={formData.manager}
              onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Sin asignar</option>
              {users?.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.name} - {user.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Modal.Footer>
          <Button
            variant="ghost"
            onClick={() => setEditModalOpen(false)}
            disabled={updateStoreMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleUpdate}
            isLoading={updateStoreMutation.isPending}
            leftIcon={<Edit2 size={18} />}
          >
            Guardar Cambios
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Eliminar Tienda */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Eliminar Tienda"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle size={24} className="text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-gray-900 font-medium">
                ¿Estás seguro de eliminar esta tienda?
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Esta acción no se puede deshacer. Se eliminará la tienda{' '}
                <span className="font-semibold">{selectedStore?.name}</span> y toda su
                información asociada.
              </p>
            </div>
          </div>
        </div>

        <Modal.Footer>
          <Button
            variant="ghost"
            onClick={() => setDeleteModalOpen(false)}
            disabled={deleteStoreMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={deleteStoreMutation.isPending}
            leftIcon={<Trash2 size={18} />}
          >
            Eliminar Tienda
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default StoresPage;
