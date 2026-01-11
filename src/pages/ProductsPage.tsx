import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Eye, AlertCircle, Printer, Power, PowerOff } from 'lucide-react';
import { Card, SearchBar, ResponsiveTable, Pagination, Button, Modal, toast, EmptyStateNoStore } from '../components/ui';
import type { Column } from '../components/ui';
import api from '../lib/axios';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ProductLabelPrint } from '../components/ProductLabelPrint';

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
  success: boolean;
  count: number;
  total: number;
  page: number;
  pages: number;
  products: Product[];
}

const ProductsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Estados - DEBEN estar antes de cualquier return condicional (reglas de React hooks)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [productToPrint, setProductToPrint] = useState<Product | null>(null);
  const [printQuantity, setPrintQuantity] = useState(1);

  // Query para obtener productos - DEBE estar antes del return condicional
  const { data, isLoading, error } = useQuery<ProductsResponse>({
    queryKey: ['products', currentPage, itemsPerPage, searchQuery, sortKey, sortDirection, categoryFilter, statusFilter],
    queryFn: async () => {
      const response = await api.get('/products', {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: searchQuery,
          sortBy: sortKey,
          sortOrder: sortDirection,
          category: categoryFilter || undefined,
          isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
        },
      });
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  // Mutation para eliminar producto permanentemente
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Producto eliminado permanentemente');
      setDeleteModalOpen(false);
      setProductToDelete(null);
    },
    onError: () => {
      toast.error('Error al eliminar el producto');
    },
  });

  // Mutation para activar/desactivar producto
  const toggleStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.patch(`/products/${id}/toggle-status`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(data.message || 'Estado actualizado');
    },
    onError: () => {
      toast.error('Error al cambiar estado del producto');
    },
  });

  // ✅ Verificar si el usuario tiene tienda asignada (DESPUÉS de todos los hooks)
  if (user && user.role !== 'admin' && !user.store) {
    return <EmptyStateNoStore />;
  }

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
      hideOnMobile: true, // Oculto en móvil
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
      mobileRender: (product) => (
        <div>
          <p className="font-semibold text-gray-900">{product.name}</p>
          <p className="text-xs text-gray-500">{product.sku}</p>
        </div>
      ),
    },
    {
      key: 'barcode',
      header: 'Código de Barras',
      hideOnMobile: true, // Oculto en móvil
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
      mobileRender: (product) => (
        <div>
          <p className="font-semibold text-gray-900">${product.price.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Costo: ${product.cost.toLocaleString()}</p>
        </div>
      ),
      className: 'text-right',
    },
    {
      key: 'margin',
      header: 'Margen',
      hideOnMobile: true, // Oculto en móvil
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
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/productos/${product._id}`)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Ver detalles"
          >
            <Eye size={18} />
          </button>
          <button
            onClick={() => navigate(`/productos/editar/${product._id}`)}
            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors"
            title="Editar"
          >
            <Edit2 size={18} />
          </button>
          <button
            onClick={() => {
              setProductToPrint(product);
              setPrintQuantity(1);
              setPrintModalOpen(true);
            }}
            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
            title="Imprimir etiqueta"
          >
            <Printer size={18} />
          </button>
          <button
            onClick={() => toggleStatusMutation.mutate(product._id)}
            className={`p-1.5 rounded transition-colors ${
              product.isActive 
                ? 'text-orange-600 hover:bg-orange-50' 
                : 'text-green-600 hover:bg-green-50'
            }`}
            title={product.isActive ? 'Desactivar' : 'Activar'}
          >
            {product.isActive ? <PowerOff size={18} /> : <Power size={18} />}
          </button>
          <button
            onClick={() => handleDelete(product)}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Eliminar permanentemente"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ),
      mobileRender: (product) => (
        <div className="flex flex-col gap-2 w-full">
          {/* Primera fila: Ver, Editar, Imprimir */}
          <div className="flex gap-1">
            <button
              onClick={() => navigate(`/productos/${product._id}`)}
              className="flex-1 px-2 py-2 text-xs text-blue-600 bg-blue-50 rounded hover:bg-blue-100 flex items-center justify-center gap-1"
            >
              <Eye size={14} /> Ver
            </button>
            <button
              onClick={() => navigate(`/productos/editar/${product._id}`)}
              className="flex-1 px-2 py-2 text-xs text-amber-600 bg-amber-50 rounded hover:bg-amber-100 flex items-center justify-center gap-1"
            >
              <Edit2 size={14} /> Editar
            </button>
            <button
              onClick={() => {
                setProductToPrint(product);
                setPrintQuantity(1);
                setPrintModalOpen(true);
              }}
              className="flex-1 px-2 py-2 text-xs text-purple-600 bg-purple-50 rounded hover:bg-purple-100 flex items-center justify-center gap-1"
            >
              <Printer size={14} /> Imprimir
            </button>
          </div>
          {/* Segunda fila: Activar/Desactivar, Eliminar */}
          <div className="flex gap-1">
            <button
              onClick={() => toggleStatusMutation.mutate(product._id)}
              className={`flex-1 px-2 py-2 text-xs rounded flex items-center justify-center gap-1 ${
                product.isActive 
                  ? 'text-orange-600 bg-orange-50 hover:bg-orange-100' 
                  : 'text-green-600 bg-green-50 hover:bg-green-100'
              }`}
            >
              {product.isActive ? <><PowerOff size={14} /> Desactivar</> : <><Power size={14} /> Activar</>}
            </button>
            <button
              onClick={() => handleDelete(product)}
              className="flex-1 px-2 py-2 text-xs text-red-600 bg-red-50 rounded hover:bg-red-100 flex items-center justify-center gap-1"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
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
            {data?.total || 0} productos en total
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
              {/* ✅ Filtro de categoría */}
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">Todas las categorías</option>
                <option value="Zapatos">Zapatos</option>
                <option value="Electrónica">Electrónica</option>
                <option value="Audio">Audio</option>
                <option value="Accesorios">Accesorios</option>
              </select>
              {/* ✅ Filtro de estado */}
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'all' | 'active' | 'inactive');
                  setCurrentPage(1);
                }}
              >
                <option value="all">Todos los estados</option>
                <option value="active">✅ Activos</option>
                <option value="inactive">❌ Inactivos</option>
              </select>
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
          <ResponsiveTable
            columns={columns}
            data={data?.products || []}
            onSort={handleSort}
            sortKey={sortKey}
            sortDirection={sortDirection}
            isLoading={isLoading}
            emptyMessage="No se encontraron productos"
          />
          {data && data.total > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={data.pages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={data.total}
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
        title="⚠️ Eliminar Permanentemente"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="text-red-600" size={20} />
            </div>
            <div>
              <p className="text-gray-900 font-medium">
                ¿Estás seguro de que deseas ELIMINAR PERMANENTEMENTE este producto?
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>{productToDelete?.name}</strong>
              </p>
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 font-medium">⚠️ Esta acción eliminará:</p>
                <ul className="text-sm text-red-600 mt-1 list-disc list-inside">
                  <li>El producto de la base de datos</li>
                  <li>Todo su inventario asociado</li>
                  <li>Su historial de precios</li>
                </ul>
                <p className="text-sm text-red-700 font-bold mt-2">
                  Esta acción NO se puede deshacer.
                </p>
              </div>
              <p className="text-sm text-gray-500 mt-3">
                💡 Si solo deseas ocultar el producto, usa el botón "Desactivar" en su lugar.
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
            🗑️ Eliminar Permanentemente
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Impresión de Etiquetas */}
      <Modal
        isOpen={printModalOpen}
        onClose={() => {
          setPrintModalOpen(false);
          setProductToPrint(null);
        }}
        title="Imprimir Etiquetas"
        size="lg"
      >
        <div className="space-y-4">
          {productToPrint && (
            <>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium text-gray-900">{productToPrint.name}</p>
                <p className="text-sm text-gray-600">SKU: {productToPrint.sku}</p>
                <p className="text-sm text-gray-600">Precio: Q{productToPrint.price.toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad de etiquetas
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={printQuantity}
                  onChange={(e) => setPrintQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <ProductLabelPrint
                products={[{
                  name: productToPrint.name,
                  sku: productToPrint.sku,
                  barcode: productToPrint.barcode,
                  price: productToPrint.price,
                  quantity: printQuantity,
                }]}
                onClose={() => {
                  setPrintModalOpen(false);
                  setProductToPrint(null);
                }}
              />
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ProductsPage;
