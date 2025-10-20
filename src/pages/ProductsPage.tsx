import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Eye, AlertCircle } from 'lucide-react';
import { Card, SearchBar, Table, Pagination, Button, Modal, toast, EmptyStateNoStore } from '../components/ui';
import type { Column } from '../components/ui';
import api from '../lib/axios';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

// Tipos
interface Product {
  _id: string;
  name: string;
  description: string;
  sku: string;
  barcode?: string;
  category: string;
  price: number;
  cost: number;
  isActive: boolean;
  createdAt: string;
}

interface ProductsResponse {
  products: Product[];
  totalPages: number;
  currentPage: number;
  totalProducts: number;
}

const ProductsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Verificar si el usuario tiene tienda asignada
  if (user && user.role !== 'admin' && !user.store) {
    return <EmptyStateNoStore />;
  }

  // Estados
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Query para obtener productos
  const { data, isLoading, error } = useQuery<ProductsResponse>({
    queryKey: ['products', currentPage, itemsPerPage, searchQuery, sortKey, sortDirection],
    queryFn: async () => {
      const response = await api.get('/products', {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: searchQuery,
          sortBy: sortKey,
          sortOrder: sortDirection,
        },
      });
      return response.data.data;
    },
  });

  // Mutation para eliminar producto
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Producto eliminado exitosamente');
      setDeleteModalOpen(false);
      setProductToDelete(null);
    },
    onError: () => {
      toast.error('Error al eliminar el producto');
    },
  });

  // Handlers
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleSort = (key: string, direction: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDirection(direction);
  };

  const handleDelete = (product: Product) => {
    setProductToDelete(product);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (productToDelete) {
      deleteMutation.mutate(productToDelete._id);
    }
  };

  // Columnas de la tabla
  const columns: Column<Product>[] = [
    {
      key: 'sku',
      header: 'SKU',
      sortable: true,
      render: (product) => (
        <span className="font-mono text-sm font-medium">{product.sku}</span>
      ),
    },
    {
      key: 'name',
      header: 'Nombre',
      sortable: true,
      render: (product) => (
        <div>
          <p className="font-medium text-gray-900">{product.name}</p>
          <p className="text-sm text-gray-500">{product.category}</p>
        </div>
      ),
    },
    {
      key: 'barcode',
      header: 'Código de Barras',
      render: (product) => (
        <span className="font-mono text-sm">{product.barcode || '-'}</span>
      ),
    },
    {
      key: 'price',
      header: 'Precio',
      sortable: true,
      render: (product) => (
        <div className="text-right">
          <p className="font-semibold text-gray-900">
            ${product.price.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">
            Costo: ${product.cost.toLocaleString()}
          </p>
        </div>
      ),
      className: 'text-right',
    },
    {
      key: 'margin',
      header: 'Margen',
      render: (product) => {
        const margin = ((product.price - product.cost) / product.price) * 100;
        return (
          <span
            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              margin > 30
                ? 'bg-green-100 text-green-800'
                : margin > 15
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {margin.toFixed(1)}%
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Estado',
      render: (product) => (
        <span
          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            product.isActive
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {product.isActive ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (product) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/productos/${product._id}`)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Ver detalles"
          >
            <Eye size={18} />
          </button>
          <button
            onClick={() => navigate(`/productos/editar/${product._id}`)}
            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
            title="Editar"
          >
            <Edit2 size={18} />
          </button>
          <button
            onClick={() => handleDelete(product)}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Eliminar"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <Card.Body className="text-center">
            <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Error al cargar productos
            </h3>
            <p className="text-gray-600">
              No se pudieron cargar los productos. Por favor, intenta de nuevo.
            </p>
            <Button
              className="mt-4"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['products'] })}
            >
              Reintentar
            </Button>
          </Card.Body>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-600 mt-1">
            {data?.totalProducts || 0} productos en total
          </p>
        </div>
        <Button
          onClick={() => navigate('/productos/nuevo')}
          leftIcon={<Plus size={20} />}
        >
          Nuevo Producto
        </Button>
      </motion.div>

      {/* Filtros y búsqueda */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <Card.Body>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <SearchBar
                  placeholder="Buscar por nombre, SKU o código de barras..."
                  onSearch={handleSearch}
                  defaultValue={searchQuery}
                />
              </div>
              <div className="flex gap-2">
                <select
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={sortKey}
                  onChange={(e) => handleSort(e.target.value, sortDirection)}
                >
                  <option value="name">Ordenar por Nombre</option>
                  <option value="price">Ordenar por Precio</option>
                  <option value="sku">Ordenar por SKU</option>
                  <option value="createdAt">Ordenar por Fecha</option>
                </select>
                <button
                  onClick={() => handleSort(sortKey, sortDirection === 'asc' ? 'desc' : 'asc')}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </Card.Body>
        </Card>
      </motion.div>

      {/* Tabla de productos */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <Table
            columns={columns}
            data={data?.products || []}
            onSort={handleSort}
            sortKey={sortKey}
            sortDirection={sortDirection}
            isLoading={isLoading}
            emptyMessage="No se encontraron productos"
          />
          {data && data.totalProducts > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={data.totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={data.totalProducts}
              onItemsPerPageChange={(value) => {
                setItemsPerPage(value);
                setCurrentPage(1);
              }}
            />
          )}
        </Card>
      </motion.div>

      {/* Modal de confirmación de eliminación */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirmar Eliminación"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="text-red-600" size={20} />
            </div>
            <div>
              <p className="text-gray-900 font-medium">
                ¿Estás seguro de que deseas eliminar este producto?
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>{productToDelete?.name}</strong>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Esta acción no se puede deshacer.
              </p>
            </div>
          </div>
        </div>
        <Modal.Footer>
          <Button
            variant="ghost"
            onClick={() => setDeleteModalOpen(false)}
            disabled={deleteMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={confirmDelete}
            isLoading={deleteMutation.isPending}
          >
            Eliminar Producto
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ProductsPage;
