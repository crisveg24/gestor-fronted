import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  Shield,
  Store,
  Mail,
  Key,
  AlertCircle,
} from 'lucide-react';
import { Card, Button, Modal, toast, Table, SearchBar } from '../components/ui';
import type { Column } from '../components/ui';
import api from '../lib/axios';

// Tipos
interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  store?: {
    _id: string;
    name: string;
  };
  isActive: boolean;
  createdAt: string;
}

interface StoreOption {
  _id: string;
  name: string;
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: string;
  store?: string;
}

const UsersPage = () => {
  const queryClient = useQueryClient();

  // Estados
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    password: '',
    role: 'user',
    store: '',
  });

  const [newPassword, setNewPassword] = useState('');

  // Queries
  const { data: users, isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ['users', searchQuery, roleFilter],
    queryFn: async () => {
      const response = await api.get('/users', {
        params: {
          search: searchQuery,
          role: roleFilter !== 'all' ? roleFilter : undefined,
        },
      });
      return response.data.data || [];
    },
  });

  const { data: stores } = useQuery<StoreOption[]>({
    queryKey: ['stores-options'],
    queryFn: async () => {
      const response = await api.get('/stores', {
        params: { active: true },
      });
      return response.data.data || [];
    },
    enabled: createModalOpen || editModalOpen,
  });

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      await api.post('/users', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario creado exitosamente');
      setCreateModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear el usuario');
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<UserFormData>;
    }) => {
      await api.put(`/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario actualizado exitosamente');
      setEditModalOpen(false);
      setSelectedUser(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar el usuario');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/users/${id}/activate`, { isActive });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(
        variables.isActive
          ? 'Usuario activado exitosamente'
          : 'Usuario desactivado exitosamente'
      );
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al cambiar estado del usuario');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario eliminado exitosamente');
      setDeleteModalOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al eliminar el usuario');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      await api.patch(`/users/${id}/reset-password`, { password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Contraseña restablecida exitosamente');
      setResetPasswordModalOpen(false);
      setSelectedUser(null);
      setNewPassword('');
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || 'Error al restablecer la contraseña'
      );
    },
  });

  // Funciones
  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'user',
      store: '',
    });
  };

  const openCreateModal = () => {
    resetForm();
    setCreateModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      store: user.store?._id || '',
    });
    setEditModalOpen(true);
  };

  const openDeleteModal = (user: User) => {
    setSelectedUser(user);
    setDeleteModalOpen(true);
  };

  const openResetPasswordModal = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setResetPasswordModalOpen(true);
  };

  const handleCreate = () => {
    if (!formData.name || !formData.email || !formData.password || !formData.role) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    // Nota: Ya NO es obligatorio asignar tienda
    // Los usuarios pueden existir sin tienda y se les asigna después

    createUserMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedUser) return;

    if (!formData.name || !formData.email || !formData.role) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    // Nota: Ya NO es obligatorio asignar tienda
    // Los usuarios pueden estar sin tienda asignada

    const updateData: any = {
      name: formData.name,
      email: formData.email,
      role: formData.role,
      store: formData.store || null, // null si no tiene tienda
    };

    updateUserMutation.mutate({
      id: selectedUser._id,
      data: updateData,
    });
  };

  const handleDelete = () => {
    if (!selectedUser) return;
    deleteUserMutation.mutate(selectedUser._id);
  };

  const handleToggleActive = (user: User) => {
    toggleActiveMutation.mutate({
      id: user._id,
      isActive: !user.isActive,
    });
  };

  const handleResetPassword = () => {
    if (!selectedUser || !newPassword) {
      toast.error('Por favor ingresa una nueva contraseña');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    resetPasswordMutation.mutate({
      id: selectedUser._id,
      password: newPassword,
    });
  };

  const generatePassword = () => {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
  };

  // Roles en español
  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      user: 'Usuario',
    };
    return labels[role] || role;
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800',
      user: 'bg-gray-100 text-gray-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  // Columnas de la tabla
  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Usuario',
      sortable: true,
      render: (user) => (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Users size={20} className="text-primary-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user.name}</p>
            <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
              <Mail size={14} />
              <span>{user.email}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rol',
      render: (user) => (
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-gray-400" />
          <span
            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(
              user.role
            )}`}
          >
            {getRoleLabel(user.role)}
          </span>
        </div>
      ),
    },
    {
      key: 'store',
      header: 'Tienda',
      render: (user) =>
        user.store ? (
          <div className="flex items-center gap-2 text-gray-700">
            <Store size={16} className="text-gray-400" />
            <span>{user.store.name}</span>
          </div>
        ) : (
          <span className="text-gray-400 italic">Sin asignar</span>
        ),
    },
    {
      key: 'isActive',
      header: 'Estado',
      render: (user) => (
        <div className="flex flex-col gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full w-fit ${
              user.isActive
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {user.isActive ? (
              <>
                <UserCheck size={14} />
                Activo
              </>
            ) : (
              <>
                <UserX size={14} />
                Inactivo
              </>
            )}
          </span>
          <Button
            size="sm"
            variant={user.isActive ? 'ghost' : 'outline'}
            onClick={() => handleToggleActive(user)}
            className="text-xs"
          >
            {user.isActive ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (user) => (
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openEditModal(user)}
            leftIcon={<Edit2 size={16} />}
          >
            Editar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openResetPasswordModal(user)}
            leftIcon={<Key size={16} />}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            Restablecer Contraseña
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => openDeleteModal(user)}
            leftIcon={<Trash2 size={16} />}
          >
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  // Estadísticas
  const totalUsers = users?.length || 0;
  const activeUsers = users?.filter((u) => u.isActive).length || 0;
  const adminCount = users?.filter((u) => u.role === 'admin').length || 0;
  const regularUsers = users?.filter((u) => u.role === 'user').length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-gray-600 mt-1">Administra usuarios y permisos del sistema</p>
        </div>
        <Button onClick={openCreateModal} leftIcon={<Plus size={20} />}>
          Nuevo Usuario
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
                  <p className="text-sm text-gray-600">Total Usuarios</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{totalUsers}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users size={24} className="text-blue-600" />
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
                  <p className="text-sm text-gray-600">Usuarios Activos</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{activeUsers}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <UserCheck size={24} className="text-green-600" />
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
                  <p className="text-sm text-gray-600">Administradores</p>
                  <p className="text-3xl font-bold text-purple-600 mt-1">{adminCount}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Shield size={24} className="text-purple-600" />
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
                  <p className="text-sm text-gray-600">Usuarios Regulares</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{regularUsers}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users size={24} className="text-blue-600" />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SearchBar
                placeholder="Buscar por nombre o email..."
                onSearch={setSearchQuery}
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">Todos los roles</option>
                <option value="admin">Administradores</option>
                <option value="user">Usuarios</option>
              </select>
            </div>
          </Card.Body>
        </Card>
      </motion.div>

      {/* Tabla de Usuarios */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card>
          <Table
            columns={columns}
            data={users || []}
            isLoading={loadingUsers}
            emptyMessage="No se encontraron usuarios"
          />
        </Card>
      </motion.div>

      {/* Modal Crear Usuario */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Nuevo Usuario"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Juan Pérez"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Ej: juan@ejemplo.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="user">Usuario</option>

              <option value="admin">Administrador</option>
            </select>
          </div>

          {formData.role !== 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tienda (Opcional)
              </label>
              <select
                value={formData.store}
                onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Sin asignar (puede asignarse despu�s)</option>
                {stores?.map((store) => (
                  <option key={store._id} value={store._id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <Modal.Footer>
          <Button
            variant="ghost"
            onClick={() => setCreateModalOpen(false)}
            disabled={createUserMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            isLoading={createUserMutation.isPending}
            leftIcon={<Plus size={18} />}
          >
            Crear Usuario
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Editar Usuario */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Editar Usuario"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Juan Pérez"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Ej: juan@ejemplo.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="user">Usuario</option>

              <option value="admin">Administrador</option>
            </select>
          </div>

          {formData.role !== 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tienda (Opcional)
              </label>
              <select
                value={formData.store}
                onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Sin asignar (puede asignarse despu�s)</option>
                {stores?.map((store) => (
                  <option key={store._id} value={store._id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <Modal.Footer>
          <Button
            variant="ghost"
            onClick={() => setEditModalOpen(false)}
            disabled={updateUserMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleUpdate}
            isLoading={updateUserMutation.isPending}
            leftIcon={<Edit2 size={18} />}
          >
            Guardar Cambios
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Restablecer Contraseña */}
      <Modal
        isOpen={resetPasswordModalOpen}
        onClose={() => setResetPasswordModalOpen(false)}
        title="Restablecer Contraseña"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Establecer nueva contraseña para{' '}
            <span className="font-semibold text-gray-900">{selectedUser?.name}</span>
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nueva Contraseña <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Button variant="outline" onClick={generatePassword}>
                Generar
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex gap-2">
              <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                El usuario deberá usar esta contraseña para iniciar sesión. Asegúrate de
                compartirla de forma segura.
              </p>
            </div>
          </div>
        </div>

        <Modal.Footer>
          <Button
            variant="ghost"
            onClick={() => setResetPasswordModalOpen(false)}
            disabled={resetPasswordMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleResetPassword}
            isLoading={resetPasswordMutation.isPending}
            leftIcon={<Key size={18} />}
          >
            Restablecer
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Eliminar Usuario */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Eliminar Usuario"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle size={24} className="text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-gray-900 font-medium">
                ¿Estás seguro de eliminar este usuario?
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Esta acción no se puede deshacer. Se eliminará el usuario{' '}
                <span className="font-semibold">{selectedUser?.name}</span> y toda su
                información asociada.
              </p>
            </div>
          </div>
        </div>

        <Modal.Footer>
          <Button
            variant="ghost"
            onClick={() => setDeleteModalOpen(false)}
            disabled={deleteUserMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={deleteUserMutation.isPending}
            leftIcon={<Trash2 size={18} />}
          >
            Eliminar Usuario
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default UsersPage;
