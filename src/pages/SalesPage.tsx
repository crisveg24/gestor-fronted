import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  Plus,
  Trash2,
  DollarSign,
  Receipt,
  Search,
  X,
  AlertTriangle,
} from 'lucide-react';
import { Card, Button, Modal, toast, Table, SearchBar, EmptyStateNoStore } from '../components/ui';
import type { Column } from '../components/ui';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Función helper para formatear métodos de pago
const formatPaymentMethod = (method: string): string => {
  const methods: Record<string, string> = {
    efectivo: '💵 Efectivo',
    nequi: '🟣 Nequi',
    daviplata: '🟠 Daviplata',
    llave_bancolombia: '🔑 Llave Bancolombia',
    tarjeta: '💳 Tarjeta',
    transferencia: '🏦 Transferencia',
  };
  return methods[method] || method;
};

// Tipos
interface Product {
  _id: string;
  name: string;
  sku: string;
  price: number;
  category: string;
  stock?: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  price: number;
  subtotal: number;
}

interface Sale {
  _id: string;
  products: Array<{
    product: {
      name: string;
      sku: string;
    };
    quantity: number;
    price: number;
  }>;
  store: {
    name: string;
  };
  user: {
    name: string;
  };
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  createdAt: string;
}

const SalesPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Verificar si el usuario tiene tienda asignada (solo para no-admins)
  if (user && !isAdmin && !user.store) {
    return <EmptyStateNoStore />;
  }

  // Estados del carrito
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  
  // Estados de IVA
  const [includeIVA, setIncludeIVA] = useState(false);
  const [ivaPercentage, setIvaPercentage] = useState(16);
  
  // Estado para tienda seleccionada (solo admins)
  const [selectedStore, setSelectedStore] = useState<string>(
    isAdmin ? '' : (typeof user?.store === 'string' ? user.store : user?.store?._id || '')
  );
  
  // Estados de ñapa (regalos)
  const [freebies, setFreebies] = useState<CartItem[]>([]);
  const [showFreebieModal, setShowFreebieModal] = useState(false);
  const [freebieSearch, setFreebieSearch] = useState('');
  const [selectedFreebie, setSelectedFreebie] = useState<Product | null>(null);
  const [freebieQuantity, setFreebieQuantity] = useState(1);
  
  // Estados del historial
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Estados del corte de caja
  const [cutModalOpen, setCutModalOpen] = useState(false);
  const [cashCounted, setCashCounted] = useState('');
  const [cutObservations, setCutObservations] = useState('');

  // Query para obtener tiendas (solo admins)
  const { data: stores, isLoading: loadingStores, error: storesError } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      console.log('🏪 [STORES] Obteniendo tiendas...');
      const response = await api.get('/stores');
      console.log('✅ [STORES] Respuesta completa:', response.data);
      return response.data.data; // data es el array directo
    },
    enabled: isAdmin,
    retry: 2,
  });

  // Log de debug
  console.log('👤 [SALES] Estado actual:', {
    isAdmin,
    hasStores: !!stores,
    storesCount: stores?.length,
    loadingStores,
    storesError,
    selectedStore,
    userStore: user?.store
  });

  // Query para buscar productos
  const { data: products, isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ['products-search', searchProduct],
    queryFn: async () => {
      if (searchProduct.length < 2) return [];
      
      console.log('🔍 [SALES] Buscando productos:', searchProduct);
      
      const response = await api.get('/products', {
        params: {
          search: searchProduct,
          limit: 10,
          isActive: true, // Cambiar de 'active' a 'isActive'
        },
      });
      
      console.log('✅ [SALES] Productos encontrados:', response.data);
      console.log('📦 [SALES] Cantidad:', response.data.data?.products?.length || 0);
      
      return response.data.data.products || [];
    },
    enabled: searchProduct.length >= 2,
  });

  // Query para buscar productos para ñapas (usa el mismo endpoint)
  const { data: freebieProducts, isLoading: loadingFreebieProducts } = useQuery<Product[]>({
    queryKey: ['freebie-products-search', freebieSearch],
    queryFn: async () => {
      if (freebieSearch.length < 2) return [];
      
      console.log('🎁 [FREEBIES] Buscando productos:', freebieSearch);
      
      const response = await api.get('/products', {
        params: {
          search: freebieSearch,
          limit: 10,
          isActive: true,
        },
      });
      
      console.log('✅ [FREEBIES] Productos encontrados:', response.data.data?.products?.length || 0);
      
      return response.data.data.products || [];
    },
    enabled: freebieSearch.length >= 2 && showFreebieModal,
  });

  // Query para historial de ventas
  const { data: sales, isLoading: loadingSales } = useQuery<Sale[]>({
    queryKey: ['sales', historySearch, dateFrom, dateTo],
    queryFn: async () => {
      const response = await api.get('/sales', {
        params: {
          search: historySearch,
          dateFrom,
          dateTo,
          store: user?.role !== 'admin' ? user?.store?._id : undefined,
        },
      });
      return response.data.data.sales;
    },
    enabled: showHistory,
  });

  // Query para datos de corte de caja
  const { data: dailyCutData, isLoading: loadingDailyCut, refetch: refetchDailyCut } = useQuery({
    queryKey: ['daily-cut', user?.store?._id],
    queryFn: async () => {
      const response = await api.get('/sales/daily-cut', {
        params: {
          storeId: user?.store?._id
        }
      });
      return response.data.data;
    },
    enabled: false, // Solo se ejecuta manualmente cuando se abre el modal
  });

  // Mutation para crear venta
  const createSaleMutation = useMutation({
    mutationFn: async (data: {
      store: string;
      items: Array<{ product: string; quantity: number; unitPrice: number }>;
      discount: number;
      tax: number;
      paymentMethod: string;
      notes?: string;
    }) => {
      console.log('💰 [SALES] Enviando venta:', data);
      await api.post('/sales', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Venta registrada exitosamente');
      clearCart();
    },
    onError: (error: any) => {
      console.error('❌ [SALES] Error al crear venta:', error.response?.data);
      toast.error(error.response?.data?.message || 'Error al registrar la venta');
    },
  });

  // Cálculos
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const discountAmount =
    discountType === 'percentage'
      ? (subtotal * discountValue) / 100
      : discountValue;
  const taxAmount = includeIVA ? (subtotal - discountAmount) * (ivaPercentage / 100) : 0;
  const total = subtotal - discountAmount + taxAmount;

  // Funciones del carrito
  const addToCart = () => {
    if (!selectedProduct || quantity <= 0) {
      toast.error('Selecciona un producto y cantidad válida');
      return;
    }

    // Verificar si el producto ya está en el carrito
    const existingItem = cart.find((item) => item.product._id === selectedProduct._id);
    
    if (existingItem) {
      // Actualizar cantidad
      setCart(
        cart.map((item) =>
          item.product._id === selectedProduct._id
            ? {
                ...item,
                quantity: item.quantity + quantity,
                subtotal: (item.quantity + quantity) * item.price,
              }
            : item
        )
      );
    } else {
      // Agregar nuevo item
      setCart([
        ...cart,
        {
          product: selectedProduct,
          quantity,
          price: selectedProduct.price,
          subtotal: selectedProduct.price * quantity,
        },
      ]);
    }

    // Limpiar selección
    setSelectedProduct(null);
    setSearchProduct('');
    setQuantity(1);
    toast.success('Producto agregado al carrito');
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product._id !== productId));
    toast.success('Producto eliminado del carrito');
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(
      cart.map((item) =>
        item.product._id === productId
          ? {
              ...item,
              quantity: newQuantity,
              subtotal: newQuantity * item.price,
            }
          : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    setFreebies([]);
    setDiscountValue(0);
    setPaymentMethod('efectivo');
  };

  // Funciones para ñapas (regalos)
  const addFreebie = () => {
    if (!selectedFreebie || freebieQuantity <= 0) {
      toast.error('Selecciona un producto y cantidad válida');
      return;
    }

    // Verificar si el producto ya está en las ñapas
    const existingFreebie = freebies.find((item) => item.product._id === selectedFreebie._id);
    
    if (existingFreebie) {
      // Actualizar cantidad
      setFreebies(
        freebies.map((item) =>
          item.product._id === selectedFreebie._id
            ? {
                ...item,
                quantity: item.quantity + freebieQuantity,
                subtotal: 0, // Las ñapas son gratis
              }
            : item
        )
      );
    } else {
      // Agregar nuevo item
      setFreebies([
        ...freebies,
        {
          product: selectedFreebie,
          quantity: freebieQuantity,
          price: 0, // Precio 0 para ñapas
          subtotal: 0,
        },
      ]);
    }

    // Limpiar selección
    setSelectedFreebie(null);
    setFreebieSearch('');
    setFreebieQuantity(1);
    setShowFreebieModal(false);
    toast.success('Ñapa agregada 🎁');
  };

  const removeFreebie = (productId: string) => {
    setFreebies(freebies.filter((item) => item.product._id !== productId));
    toast.success('Ñapa eliminada');
  };

  const processSale = () => {
    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    // Validar tienda seleccionada
    const storeToUse = isAdmin ? selectedStore : (typeof user?.store === 'string' ? user.store : user?.store?._id);
    
    if (!storeToUse) {
      toast.error(isAdmin ? 'Debes seleccionar una tienda' : 'No tienes una tienda asignada');
      return;
    }

    console.log('💰 [SALES] Procesando venta...');
    console.log('💰 [SALES] Tienda:', storeToUse);
    console.log('💰 [SALES] Carrito:', cart.length, 'items');
    console.log('💰 [SALES] Ñapas:', freebies.length, 'items');

    // Combinar productos del carrito y ñapas
    const allItems = [
      ...cart.map((item) => ({
        product: item.product._id,
        quantity: item.quantity,
        unitPrice: item.price,
      })),
      ...freebies.map((item) => ({
        product: item.product._id,
        quantity: item.quantity,
        unitPrice: 0, // Precio 0 para ñapas
      })),
    ];

    const saleData = {
      store: storeToUse,
      items: allItems,
      discount: discountAmount,
      tax: taxAmount,
      paymentMethod,
      notes: freebies.length > 0 ? `Incluye ${freebies.length} ñapa(s)` : undefined,
    };

    console.log('💰 [SALES] Datos de venta:', saleData);

    createSaleMutation.mutate(saleData);
  };

  // Columnas del historial
  const salesColumns: Column<Sale>[] = [
    {
      key: 'createdAt',
      header: 'Fecha',
      sortable: true,
      render: (sale) => (
        <div>
          <p className="font-medium text-gray-900">
            {format(new Date(sale.createdAt), 'dd MMM yyyy', { locale: es })}
          </p>
          <p className="text-sm text-gray-500">
            {format(new Date(sale.createdAt), 'HH:mm', { locale: es })}
          </p>
        </div>
      ),
    },
    {
      key: 'store',
      header: 'Tienda',
      render: (sale) => (
        <span className="text-sm text-gray-700">{sale.store.name}</span>
      ),
    },
    {
      key: 'products',
      header: 'Productos',
      render: (sale) => (
        <span className="text-sm text-gray-700">
          {sale.products.length} {sale.products.length === 1 ? 'producto' : 'productos'}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      render: (sale) => (
        <span className="font-semibold text-gray-900">
          ${sale.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'paymentMethod',
      header: 'Pago',
      render: (sale) => (
        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
          {formatPaymentMethod(sale.paymentMethod)}
        </span>
      ),
    },
    {
      key: 'user',
      header: 'Vendedor',
      render: (sale) => (
        <span className="text-sm text-gray-600">{sale.user.name}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (sale) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setSelectedSale(sale);
            setDetailModalOpen(true);
          }}
        >
          Ver Detalle
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Registro de Ventas</h1>
          <p className="text-gray-600 mt-1">
            {showHistory ? 'Historial de ventas' : 'Crear nueva venta'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setCutModalOpen(true);
              refetchDailyCut();
            }}
            variant="outline"
            leftIcon={<DollarSign size={20} />}
          >
            Corte de Caja
          </Button>
          <Button
            onClick={() => setShowHistory(!showHistory)}
            variant={showHistory ? 'primary' : 'outline'}
            leftIcon={showHistory ? <ShoppingCart size={20} /> : <Receipt size={20} />}
          >
            {showHistory ? 'Nueva Venta' : 'Ver Historial'}
          </Button>
        </div>
      </motion.div>

      {!showHistory ? (
        /* Formulario de Nueva Venta */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel Izquierdo - Búsqueda y Selección */}
          <div className="lg:col-span-2 space-y-6">
            {/* Búsqueda de Productos */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <Card.Header>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Buscar Productos
                  </h3>
                </Card.Header>
                <Card.Body className="space-y-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      placeholder="Buscar por nombre, SKU o categoría..."
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={20}
                    />
                  </div>

                  {/* Resultados de búsqueda */}
                  <AnimatePresence>
                    {searchProduct.length >= 2 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2 max-h-60 overflow-y-auto"
                      >
                        {loadingProducts ? (
                          <p className="text-center text-gray-500 py-4">Buscando...</p>
                        ) : products && products.length > 0 ? (
                          products.map((product) => (
                            <motion.button
                              key={product._id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              onClick={() => {
                                setSelectedProduct(product);
                                setSearchProduct('');
                              }}
                              className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-primary-50 hover:border-primary-500 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">
                                    {product.name}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {product.sku} • {product.category}
                                  </p>
                                </div>
                                <div className="text-right ml-4">
                                  <p className="font-semibold text-primary-600">
                                    ${product.price.toLocaleString()}
                                  </p>
                                  {product.stock !== undefined && (
                                    <p className="text-xs text-gray-500">
                                      Stock: {product.stock}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </motion.button>
                          ))
                        ) : (
                          <p className="text-center text-gray-500 py-4">
                            No se encontraron productos
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Producto Seleccionado */}
                  {selectedProduct && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-primary-50 border-2 border-primary-500 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {selectedProduct.name}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {selectedProduct.sku} • {selectedProduct.category}
                          </p>
                          <p className="text-xl font-bold text-primary-600 mt-2">
                            ${selectedProduct.price.toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedProduct(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X size={20} />
                        </button>
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cantidad
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <Button
                          onClick={addToCart}
                          className="mt-6"
                          leftIcon={<Plus size={18} />}
                        >
                          Agregar al Carrito
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </Card.Body>
              </Card>
            </motion.div>

            {/* Carrito de Compras */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <Card.Header>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Carrito de Compras
                    </h3>
                    {cart.length > 0 && (
                      <span className="bg-primary-100 text-primary-800 px-2 py-1 rounded-full text-sm font-medium">
                        {cart.length} {cart.length === 1 ? 'producto' : 'productos'}
                      </span>
                    )}
                  </div>
                </Card.Header>
                <Card.Body>
                  {cart.length === 0 ? (
                    <div className="text-center py-12">
                      <ShoppingCart size={48} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-gray-500">El carrito está vacío</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Busca y agrega productos para comenzar
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <AnimatePresence>
                        {cart.map((item) => (
                          <motion.div
                            key={item.product._id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                {item.product.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                ${item.price.toLocaleString()} c/u
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateQuantity(item.product._id, Number(e.target.value))
                                }
                                className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                              <p className="font-semibold text-gray-900 min-w-[80px] text-right">
                                ${item.subtotal.toLocaleString()}
                              </p>
                              <button
                                onClick={() => removeFromCart(item.product._id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </motion.div>

            {/* Ñapas (Regalos) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card>
                <Card.Header>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🎁</span>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Ñapas (Gratis)
                      </h3>
                    </div>
                    {freebies.length > 0 && (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm font-medium">
                        {freebies.length} {freebies.length === 1 ? 'ñapa' : 'ñapas'}
                      </span>
                    )}
                  </div>
                </Card.Header>
                <Card.Body>
                  {freebies.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-gray-500 text-sm">Sin ñapas agregadas</p>
                      <Button
                        onClick={() => setShowFreebieModal(true)}
                        variant="outline"
                        size="sm"
                        className="mt-2"
                      >
                        Agregar Ñapa
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <AnimatePresence>
                        {freebies.map((item) => (
                          <motion.div
                            key={item.product._id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex items-center gap-3 p-3 border border-green-200 bg-green-50 rounded-lg"
                          >
                            <span className="text-xl">🎁</span>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 text-sm">
                                {item.product.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                Cantidad: {item.quantity}
                              </p>
                            </div>
                            <button
                              onClick={() => removeFreebie(item.product._id)}
                              className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      <Button
                        onClick={() => setShowFreebieModal(true)}
                        variant="outline"
                        size="sm"
                        fullWidth
                      >
                        + Agregar Más Ñapas
                      </Button>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </motion.div>
          </div>

          {/* Panel Derecho - Resumen y Pago */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <Card.Header>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Resumen de Venta
                  </h3>
                </Card.Header>
                <Card.Body className="space-y-4">
                  {/* Selector de Tienda (solo para admins) */}
                  {isAdmin && (
                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <label className="block text-sm font-semibold text-indigo-900 mb-2">
                        🏪 Tienda de la Venta *
                      </label>
                      {stores ? (
                        <>
                          <select
                            value={selectedStore}
                            onChange={(e) => setSelectedStore(e.target.value)}
                            className="w-full px-3 py-2 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            required
                          >
                            <option value="">⚠️ Selecciona una tienda</option>
                            {stores.map((store: any) => (
                              <option key={store._id} value={store._id}>
                                🏬 {store.name}
                              </option>
                            ))}
                          </select>
                          {!selectedStore && cart.length > 0 && (
                            <p className="text-xs text-red-700 mt-2 font-medium">
                              ⚠️ Debes seleccionar una tienda para procesar la venta
                            </p>
                          )}
                          {selectedStore && (
                            <p className="text-xs text-indigo-700 mt-2 font-medium">
                              ✅ Venta se registrará en: {stores.find((s: any) => s._id === selectedStore)?.name}
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-700">⏳ Cargando tiendas...</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tienda asignada (usuarios normales) */}
                  {!isAdmin && user?.store && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <span className="font-semibold">🏪 Tienda:</span> {typeof user.store === 'string' ? user.store : user.store.name}
                      </p>
                    </div>
                  )}

                  {/* Descuento */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descuento
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value as any)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="percentage">%</option>
                        <option value="fixed">$</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(Number(e.target.value))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Método de Pago */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Método de Pago
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="efectivo">💵 Efectivo</option>
                      <option value="nequi">🟣 Nequi</option>
                      <option value="daviplata">🟠 Daviplata</option>
                      <option value="llave_bancolombia">🔑 Llave Bancolombia</option>
                      <option value="tarjeta">💳 Tarjeta</option>
                      <option value="transferencia">🏦 Transferencia</option>
                    </select>
                  </div>

                  {/* IVA Opcional */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="includeIVA"
                        checked={includeIVA}
                        onChange={(e) => setIncludeIVA(e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="includeIVA" className="text-sm font-medium text-gray-700">
                        📊 Incluir IVA
                      </label>
                    </div>
                    
                    {includeIVA && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Porcentaje de IVA
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={ivaPercentage}
                            onChange={(e) => setIvaPercentage(Number(e.target.value))}
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <span className="text-gray-700">%</span>
                          <span className="text-sm text-gray-500">
                            (${((subtotal - discountAmount) * (ivaPercentage / 100)).toLocaleString('es-MX', { minimumFractionDigits: 2 })})
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Totales */}
                  <div className="pt-4 border-t border-gray-200 space-y-2">
                    <div className="flex justify-between text-gray-700">
                      <span>Subtotal:</span>
                      <span>${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Descuento:</span>
                        <span>-${discountAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {includeIVA && taxAmount > 0 && (
                      <div className="flex justify-between text-gray-700">
                        <span>IVA ({ivaPercentage}%):</span>
                        <span>${taxAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
                      <span>Total:</span>
                      <span>${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Botones de Acción */}
                  <div className="space-y-2 pt-4">
                    <Button
                      onClick={processSale}
                      fullWidth
                      isLoading={createSaleMutation.isPending}
                      disabled={cart.length === 0}
                      leftIcon={<DollarSign size={20} />}
                    >
                      Procesar Venta
                    </Button>
                    <Button
                      onClick={clearCart}
                      fullWidth
                      variant="outline"
                      disabled={cart.length === 0}
                    >
                      Limpiar Carrito
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </motion.div>
          </div>
        </div>
      ) : (
        /* Historial de Ventas */
        <div className="space-y-6">
          {/* Filtros */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <Card.Body>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <SearchBar
                      placeholder="Buscar por producto, tienda o vendedor..."
                      onSearch={setHistorySearch}
                    />
                  </div>
                  <div>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Desde"
                    />
                  </div>
                  <div>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Hasta"
                    />
                  </div>
                </div>
              </Card.Body>
            </Card>
          </motion.div>

          {/* Tabla de Ventas */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <Table
                columns={salesColumns}
                data={sales || []}
                isLoading={loadingSales}
                emptyMessage="No se encontraron ventas"
              />
            </Card>
          </motion.div>
        </div>
      )}

      {/* Modal de Detalle de Venta */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="Detalle de Venta"
        size="lg"
      >
        {selectedSale && (
          <div className="space-y-4">
            {/* Información General */}
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Fecha</p>
                <p className="font-medium text-gray-900">
                  {format(new Date(selectedSale.createdAt), "dd MMMM yyyy 'a las' HH:mm", {
                    locale: es,
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Tienda</p>
                <p className="font-medium text-gray-900">{selectedSale.store.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Vendedor</p>
                <p className="font-medium text-gray-900">{selectedSale.user.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Método de Pago</p>
                <p className="font-medium text-gray-900">
                  {formatPaymentMethod(selectedSale.paymentMethod)}
                </p>
              </div>
            </div>

            {/* Productos */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Productos</h4>
              <div className="space-y-2">
                {selectedSale.products.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.product.name}</p>
                      <p className="text-sm text-gray-500">{item.product.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        {item.quantity} x ${item.price.toLocaleString()}
                      </p>
                      <p className="font-semibold text-gray-900">
                        ${(item.quantity * item.price).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totales */}
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-gray-700">
                <span>Subtotal:</span>
                <span>
                  ${selectedSale.subtotal.toLocaleString('es-MX', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              {selectedSale.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Descuento:</span>
                  <span>
                    -$
                    {selectedSale.discount.toLocaleString('es-MX', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-gray-700">
                <span>IVA:</span>
                <span>
                  ${selectedSale.tax.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total:</span>
                <span>
                  ${selectedSale.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setDetailModalOpen(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Corte de Caja */}
      <Modal
        isOpen={cutModalOpen}
        onClose={() => {
          setCutModalOpen(false);
          setCashCounted('');
          setCutObservations('');
        }}
        title="💰 Corte de Caja del Día"
        size="xl"
      >
        {loadingDailyCut ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : dailyCutData ? (
          <div className="space-y-6">
            {/* Información de cabecera */}
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Fecha</p>
                <p className="font-medium text-gray-900">
                  {format(new Date(dailyCutData.date), "dd 'de' MMMM, yyyy", { locale: es })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Tienda</p>
                <p className="font-medium text-gray-900">{dailyCutData.store.name}</p>
              </div>
            </div>

            {/* Resumen de ventas */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-gray-600 font-medium mb-2">Total Venta del Día</p>
              <p className="text-4xl font-bold text-gray-900">
                ${dailyCutData.summary.totalRevenue.toLocaleString('es-CO', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {dailyCutData.summary.totalSales} {dailyCutData.summary.totalSales === 1 ? 'venta' : 'ventas'}
              </p>
            </div>

            {/* Desglose por método de pago */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Desglose por Método de Pago</h4>
              <div className="space-y-2">
                {dailyCutData.paymentMethods.map((pm: any) => (
                  <div
                    key={pm.method}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{
                        pm.method === 'efectivo' ? '💵' :
                        pm.method === 'nequi' ? '🟣' :
                        pm.method === 'daviplata' ? '🟠' :
                        pm.method === 'llave_bancolombia' ? '🔑' :
                        pm.method === 'tarjeta' ? '💳' :
                        pm.method === 'transferencia' ? '🏦' : '💰'
                      }</span>
                      <div>
                        <p className="font-medium text-gray-900">
                          {formatPaymentMethod(pm.method)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {pm.count} {pm.count === 1 ? 'transacción' : 'transacciones'}
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      ${pm.total.toLocaleString('es-CO', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Efectivo a contar */}
            <div className="border-t border-gray-200 pt-4">
              <h4 className="font-semibold text-gray-900 mb-3">Efectivo Contado</h4>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={20} className="text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      Efectivo según sistema:
                    </p>
                    <p className="text-2xl font-bold text-yellow-900 mt-1">
                      ${(dailyCutData.paymentMethods.find((pm: any) => pm.method === 'efectivo')?.total || 0).toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Efectivo Contado (ingresa el monto que contaste físicamente)
                </label>
                <input
                  type="number"
                  value={cashCounted}
                  onChange={(e) => setCashCounted(e.target.value)}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0"
                />
              </div>

              {/* Diferencia */}
              {cashCounted && (
                <div className="mt-4 p-4 rounded-lg border-2" style={{
                  backgroundColor: Number(cashCounted) === (dailyCutData.paymentMethods.find((pm: any) => pm.method === 'efectivo')?.total || 0) ? '#f0fdf4' :
                    Number(cashCounted) > (dailyCutData.paymentMethods.find((pm: any) => pm.method === 'efectivo')?.total || 0) ? '#fef3c7' : '#fee2e2',
                  borderColor: Number(cashCounted) === (dailyCutData.paymentMethods.find((pm: any) => pm.method === 'efectivo')?.total || 0) ? '#22c55e' :
                    Number(cashCounted) > (dailyCutData.paymentMethods.find((pm: any) => pm.method === 'efectivo')?.total || 0) ? '#f59e0b' : '#ef4444'
                }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{
                        color: Number(cashCounted) === (dailyCutData.paymentMethods.find((pm: any) => pm.method === 'efectivo')?.total || 0) ? '#16a34a' :
                          Number(cashCounted) > (dailyCutData.paymentMethods.find((pm: any) => pm.method === 'efectivo')?.total || 0) ? '#d97706' : '#dc2626'
                      }}>
                        {Number(cashCounted) === (dailyCutData.paymentMethods.find((pm: any) => pm.method === 'efectivo')?.total || 0) ? '✅ Exacto' :
                          Number(cashCounted) > (dailyCutData.paymentMethods.find((pm: any) => pm.method === 'efectivo')?.total || 0) ? '⚠️ Sobrante' : '❌ Faltante'}
                      </p>
                      <p className="text-2xl font-bold" style={{
                        color: Number(cashCounted) === (dailyCutData.paymentMethods.find((pm: any) => pm.method === 'efectivo')?.total || 0) ? '#16a34a' :
                          Number(cashCounted) > (dailyCutData.paymentMethods.find((pm: any) => pm.method === 'efectivo')?.total || 0) ? '#d97706' : '#dc2626'
                      }}>
                        {Number(cashCounted) > (dailyCutData.paymentMethods.find((pm: any) => pm.method === 'efectivo')?.total || 0) ? '+' : ''}
                        ${(Number(cashCounted) - (dailyCutData.paymentMethods.find((pm: any) => pm.method === 'efectivo')?.total || 0)).toLocaleString('es-CO')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones
              </label>
              <textarea
                value={cutObservations}
                onChange={(e) => setCutObservations(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ej: Sobrante guardado en sobre sellado para verificación..."
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <DollarSign size={48} className="mx-auto mb-2 text-gray-300" />
            <p>No hay datos disponibles para el corte de caja</p>
          </div>
        )}

        <Modal.Footer>
          <Button
            variant="ghost"
            onClick={() => {
              setCutModalOpen(false);
              setCashCounted('');
              setCutObservations('');
            }}
          >
            Cerrar
          </Button>
          <Button
            onClick={() => {
              toast.success('Funcionalidad de PDF en desarrollo');
              // TODO: Implementar generación de PDF
            }}
            leftIcon={<Receipt size={18} />}
          >
            Descargar PDF
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal para Agregar Ñapas */}
      <Modal
        isOpen={showFreebieModal}
        onClose={() => {
          setShowFreebieModal(false);
          setSelectedFreebie(null);
          setFreebieSearch('');
          setFreebieQuantity(1);
        }}
        title="Agregar Ñapa (Regalo) 🎁"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Selecciona un producto para agregar como ñapa. <strong>Las ñapas son gratis</strong> y no afectan el total de la venta.
          </p>

          {/* Búsqueda de Producto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar Producto
            </label>
            <input
              type="text"
              value={freebieSearch}
              onChange={(e) => setFreebieSearch(e.target.value)}
              placeholder="Buscar por nombre o SKU..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
          </div>

          {/* Lista de Productos */}
          {freebieSearch.length >= 2 && (
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
              {loadingFreebieProducts ? (
                <div className="p-4 text-center text-gray-500">Buscando...</div>
              ) : freebieProducts && freebieProducts.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {freebieProducts.map((product) => (
                    <button
                      key={product._id}
                      onClick={() => {
                        setSelectedFreebie(product);
                        setFreebieSearch('');
                      }}
                      className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">
                        SKU: {product.sku} | ${product.price.toLocaleString()}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  No se encontraron productos
                </div>
              )}
            </div>
          )}

          {/* Producto Seleccionado */}
          {selectedFreebie && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{selectedFreebie.name}</p>
                  <p className="text-sm text-gray-500">SKU: {selectedFreebie.sku}</p>
                </div>
                <button
                  onClick={() => setSelectedFreebie(null)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
                  value={freebieQuantity}
                  onChange={(e) => setFreebieQuantity(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {/* Ñapas Más Comunes (Sugerencias) */}
          {!selectedFreebie && freebieSearch.length < 2 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Ñapas Más Comunes:
              </p>
              <div className="text-sm text-gray-500 space-y-1">
                <p>• Bolsas</p>
                <p>• Muestras gratis</p>
                <p>• Productos de promoción</p>
                <p className="text-xs italic mt-2">
                  Escribe en el buscador para encontrar productos...
                </p>
              </div>
            </div>
          )}
        </div>

        <Modal.Footer>
          <Button
            variant="outline"
            onClick={() => {
              setShowFreebieModal(false);
              setSelectedFreebie(null);
              setFreebieSearch('');
              setFreebieQuantity(1);
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={addFreebie}
            disabled={!selectedFreebie || freebieQuantity <= 0}
            className="bg-green-600 hover:bg-green-700"
          >
            Agregar Ñapa 🎁
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default SalesPage;
