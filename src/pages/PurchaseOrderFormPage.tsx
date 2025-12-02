import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../lib/axios';
import { Card, Button, Loading } from '../components/ui';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { Plus, Trash2, Search } from 'lucide-react';
import type { AxiosApiError, CreatePurchaseOrderDto } from '../types';

interface Supplier {
  _id: string;
  name: string;
  email: string;
  phone: string;
}

interface Product {
  _id: string;
  name: string;
  sku: string;
  cost: number;
  stock?: number;
}

interface OrderItem {
  product: string;
  productData?: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface Store {
  _id: string;
  name: string;
}

export default function PurchaseOrderFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const supplierId = searchParams.get('supplier');
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Estados
  const [selectedSupplier, setSelectedSupplier] = useState(supplierId || '');
  const [selectedStore, setSelectedStore] = useState(user?.store?._id || '');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);

  // Queries
  const { data: suppliers, isLoading: loadingSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const response = await api.get('/suppliers');
      return response.data.data.suppliers;
    },
  });

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const response = await api.get('/stores');
      return response.data.data;
    },
    enabled: isAdmin,
  });

  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ['products-search', searchProduct],
    queryFn: async () => {
      const response = await api.get(`/products?search=${searchProduct}`);
      return response.data.data.products;
    },
    enabled: showProductSearch && searchProduct.length > 0,
  });

  // Mutation para crear orden
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: CreatePurchaseOrderDto) => {
      const response = await api.post('/purchase-orders', orderData);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Orden de compra creada exitosamente');
      navigate('/ordenes-compra');
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosApiError;
      toast.error(axiosError.response?.data?.message || 'Error al crear la orden');
    },
  });

  // Agregar producto al listado
  const addProduct = (product: Product) => {
    const existingItem = items.find(item => item.product === product._id);
    
    if (existingItem) {
      toast.error('Este producto ya está en la orden');
      return;
    }

    const newItem: OrderItem = {
      product: product._id,
      productData: product,
      quantity: 1,
      unitPrice: product.cost || 0,
      subtotal: product.cost || 0,
    };

    setItems([...items, newItem]);
    setSearchProduct('');
    setShowProductSearch(false);
    toast.success(`${product.name} agregado`);
  };

  // Actualizar cantidad
  const updateQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return;
    
    const newItems = [...items];
    newItems[index].quantity = quantity;
    newItems[index].subtotal = quantity * newItems[index].unitPrice;
    setItems(newItems);
  };

  // Actualizar precio
  const updatePrice = (index: number, price: number) => {
    if (price < 0) return;
    
    const newItems = [...items];
    newItems[index].unitPrice = price;
    newItems[index].subtotal = newItems[index].quantity * price;
    setItems(newItems);
  };

  // Eliminar producto
  const removeProduct = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Calcular totales
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const tax = subtotal * 0.19; // IVA 19%
  const total = subtotal + tax;

  // Enviar orden
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSupplier) {
      toast.error('Selecciona un proveedor');
      return;
    }

    if (!selectedStore) {
      toast.error('Selecciona una tienda');
      return;
    }

    if (items.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }

    const orderData = {
      supplier: selectedSupplier,
      store: selectedStore,
      items: items.map(item => ({
        product: item.product,
        quantityOrdered: item.quantity,
        unitCost: item.unitPrice,
      })),
      tax,
      shippingCost: 0,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      notes: notes || undefined,
    };

    createOrderMutation.mutate(orderData);
  };

  if (loadingSuppliers) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Nueva Orden de Compra</h1>
          <p className="text-gray-600 mt-1">Crea una orden de compra para tu tienda</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/ordenes-compra')}>
          Cancelar
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información General */}
        <Card>
          <Card.Header>
            <h2 className="text-xl font-semibold">Información General</h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Proveedor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proveedor *
                </label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">Selecciona un proveedor</option>
                  {suppliers?.map((supplier: Supplier) => (
                    <option key={supplier._id} value={supplier._id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tienda */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tienda de Destino *
                </label>
                {isAdmin ? (
                  <select
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="">Selecciona una tienda</option>
                    {stores?.map((store: Store) => (
                      <option key={store._id} value={store._id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={user?.store?.name || ''}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                )}
              </div>

              {/* Fecha Esperada */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha Esperada de Entrega
                </label>
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={1}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* Productos */}
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Productos</h2>
              <Button
                type="button"
                variant="primary"
                leftIcon={<Plus size={18} />}
                onClick={() => setShowProductSearch(!showProductSearch)}
              >
                Agregar Producto
              </Button>
            </div>
          </Card.Header>
          <Card.Body>
            {/* Búsqueda de productos */}
            {showProductSearch && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    value={searchProduct}
                    onChange={(e) => setSearchProduct(e.target.value)}
                    placeholder="Buscar producto por nombre o SKU..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                </div>

                {/* Resultados de búsqueda */}
                {loadingProducts && (
                  <div className="mt-2 text-center text-gray-500">Buscando...</div>
                )}
                
                {products && products.length > 0 && (
                  <div className="mt-2 max-h-60 overflow-y-auto space-y-2">
                    {products.map((product: Product) => (
                      <div
                        key={product._id}
                        onClick={() => addProduct(product)}
                        className="p-3 bg-white border border-gray-200 rounded-lg hover:bg-primary-50 hover:border-primary-300 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{product.name}</p>
                            <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Costo</p>
                            <p className="font-semibold text-gray-900">
                              ${product.cost?.toLocaleString() || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {products && products.length === 0 && searchProduct && (
                  <div className="mt-2 text-center text-gray-500">
                    No se encontraron productos
                  </div>
                )}
              </div>
            )}

            {/* Lista de productos agregados */}
            {items.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No hay productos agregados</p>
                <p className="text-sm mt-1">Haz clic en "Agregar Producto" para comenzar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg"
                  >
                    {/* Info del producto */}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.productData?.name}</p>
                      <p className="text-sm text-gray-500">SKU: {item.productData?.sku}</p>
                    </div>

                    {/* Cantidad */}
                    <div className="w-32">
                      <label className="block text-xs text-gray-600 mb-1">Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(index, Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    {/* Precio Unitario */}
                    <div className="w-32">
                      <label className="block text-xs text-gray-600 mb-1">Precio Unit.</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updatePrice(index, Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    {/* Subtotal */}
                    <div className="w-32 text-right">
                      <label className="block text-xs text-gray-600 mb-1">Subtotal</label>
                      <p className="font-semibold text-gray-900">
                        ${item.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* Eliminar */}
                    <button
                      type="button"
                      onClick={() => removeProduct(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Totales */}
        {items.length > 0 && (
          <Card>
            <Card.Body>
              <div className="space-y-3">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal:</span>
                  <span className="font-semibold">
                    ${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>IVA (19%):</span>
                  <span className="font-semibold">
                    ${tax.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-xl font-bold text-gray-900 pt-3 border-t border-gray-200">
                  <span>Total:</span>
                  <span>${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </Card.Body>
          </Card>
        )}

        {/* Botones */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/ordenes-compra')}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={createOrderMutation.isPending}
            disabled={items.length === 0}
          >
            Crear Orden de Compra
          </Button>
        </div>
      </form>
    </div>
  );
}
