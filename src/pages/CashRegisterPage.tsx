import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Banknote,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Plus,
  Minus,
  History,
  CreditCard,
  Wallet,
  ArrowUpDown,
  AlertCircle,
  Lock,
  Unlock,
  ShoppingCart,
  Search,
  Trash2,
  Receipt,
  Package,
  Percent,
  Clock,
  Printer,
} from 'lucide-react';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { formatCurrency } from '../utils/formatCurrency';
import { BarcodeScanner } from '../components/BarcodeScanner';

// ==================== INTERFACES ====================
interface CashMovement {
  type: 'income' | 'expense';
  amount: number;
  description: string;
  createdAt: string;
  createdBy?: { _id: string; name: string };
}

interface SalesByMethod {
  efectivo: number;
  nequi: number;
  daviplata: number;
  llave_bancolombia: number;
  tarjeta: number;
  transferencia: number;
}

interface CashRegister {
  _id: string;
  store: { _id: string; name: string };
  openingAmount: number;
  closingAmount?: number;
  expectedAmount?: number;
  difference?: number;
  status: 'open' | 'closed';
  movements: CashMovement[];
  salesByMethod: SalesByMethod;
  calculatedTotals?: {
    openingAmount: number;
    salesEfectivo: number;
    otherIncome: number;
    expenses: number;
    expectedAmount: number;
    totalSalesAllMethods: number;
  };
  notes?: string;
  openedBy: { _id: string; name: string };
  closedBy?: { _id: string; name: string };
  openedAt: string;
  closedAt?: string;
}

interface StoreOption {
  _id: string;
  name: string;
}

interface Product {
  _id: string;
  name: string;
  sku: string;
  price: number;
  barcode?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface InventoryItem {
  product: Product;
  quantity: number;
}

// ==================== COMPONENTE PRINCIPAL ====================
export default function CashRegisterPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Estado de tienda
  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => {
    if (isAdmin) return localStorage.getItem('cashRegister_selectedStore') || '';
    return user?.store?._id || '';
  });

  // Estados de caja
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [movementType, setMovementType] = useState<'income' | 'expense'>('income');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDescription, setMovementDescription] = useState('');

  // Estados de POS (punto de venta)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [showScanner, setShowScanner] = useState(false);
  const [amountReceived, setAmountReceived] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [recentProducts, setRecentProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('pos_recent_products');
    return saved ? JSON.parse(saved) : [];
  });
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  // Guardar tienda seleccionada
  useEffect(() => {
    if (isAdmin && selectedStoreId) {
      localStorage.setItem('cashRegister_selectedStore', selectedStoreId);
    }
  }, [selectedStoreId, isAdmin]);

  // ==================== QUERIES ====================
  const { data: stores = [] } = useQuery<StoreOption[]>({
    queryKey: ['stores'],
    queryFn: async () => {
      const response = await api.get('/stores');
      return response.data?.data || response.data || [];
    },
    enabled: isAdmin,
  });

  const { data: currentRegister, isLoading: loadingCurrent } = useQuery<CashRegister | null>({
    queryKey: ['cashRegister', 'current', selectedStoreId],
    queryFn: async () => {
      const params = selectedStoreId ? { storeId: selectedStoreId } : {};
      const response = await api.get('/cash-register/current', { params });
      return response.data?.data || null;
    },
    enabled: !!selectedStoreId || !isAdmin,
    refetchInterval: 30000,
  });

  const { data: historyData } = useQuery<{ registers: CashRegister[] }>({
    queryKey: ['cashRegister', 'history', selectedStoreId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStoreId) params.append('storeId', selectedStoreId);
      params.append('limit', '10');
      const response = await api.get(`/cash-register/history?${params.toString()}`);
      // El backend devuelve { data: [...] }, convertimos a { registers: [...] }
      const registers = response.data?.data || [];
      return { registers };
    },
    enabled: !!selectedStoreId || !isAdmin,
  });

  const { data: searchResults = [], isLoading: loadingSearch } = useQuery<Product[]>({
    queryKey: ['products-pos', searchProduct],
    queryFn: async () => {
      if (searchProduct.length < 2) return [];
      console.log('🔍 [POS] Buscando productos:', searchProduct);
      const response = await api.get('/products', {
        params: { search: searchProduct, limit: 10, isActive: true }
      });
      console.log('✅ [POS] Respuesta:', response.data);
      const products = response.data?.data?.products || response.data?.products || [];
      console.log('📦 [POS] Productos:', products.length);
      return products;
    },
    enabled: searchProduct.length >= 2,
    staleTime: 60 * 1000,
  });

  const { data: inventory = [] } = useQuery<InventoryItem[]>({
    queryKey: ['inventory-pos', selectedStoreId],
    queryFn: async () => {
      if (!selectedStoreId) return [];
      const response = await api.get(`/inventory/${selectedStoreId}`);
      return response.data?.data || [];
    },
    enabled: !!selectedStoreId,
  });

  // ==================== MUTATIONS ====================
  const openMutation = useMutation({
    mutationFn: async (data: { openingAmount: number; storeId?: string }) => {
      const response = await api.post('/cash-register/open', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashRegister'] });
      setShowOpenModal(false);
      setOpeningAmount('');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Error al abrir caja');
    }
  });

  const closeMutation = useMutation({
    mutationFn: async (data: { actualClosingAmount: number; closingNotes?: string; storeId?: string }) => {
      const response = await api.post('/cash-register/close', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashRegister'] });
      setShowCloseModal(false);
      setClosingAmount('');
      setClosingNotes('');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Error al cerrar caja');
    }
  });

  const movementMutation = useMutation({
    mutationFn: async (data: { type: string; amount: number; description: string }) => {
      const response = await api.post('/cash-register/movement', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashRegister'] });
      setShowMovementModal(false);
      setMovementAmount('');
      setMovementDescription('');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Error al registrar movimiento');
    }
  });

  const saleMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/sales', data);
      return response.data;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['cashRegister'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-pos'] });
      
      // Guardar datos de la venta para el ticket
      setLastSale({
        ...response.data,
        items: cart,
        subtotal: cartSubtotal,
        discountAmount,
        total: cartTotal,
        paymentMethod,
        amountReceived: parseFloat(amountReceived) || cartTotal,
        change: change > 0 ? change : 0,
        date: new Date(),
      });
      setShowTicketModal(true);
      
      setCart([]);
      setAmountReceived('');
      setDiscount('');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Error al registrar venta');
    }
  });

  // ==================== HELPERS ====================
  const getStock = (productId: string): number => {
    const item = inventory.find(i => i.product._id === productId);
    return item?.quantity || 0;
  };

  const addToCart = (product: Product) => {
    const stock = getStock(product._id);
    const existing = cart.find(item => item.product._id === product._id);
    const currentQty = existing?.quantity || 0;
    
    if (currentQty >= stock) {
      alert(`Stock insuficiente (disponible: ${stock})`);
      return;
    }

    if (existing) {
      setCart(cart.map(item =>
        item.product._id === product._id
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unitPrice }
          : item
      ));
    } else {
      setCart([...cart, {
        product,
        quantity: 1,
        unitPrice: product.price,
        subtotal: product.price
      }]);
      // Guardar en productos recientes
      setRecentProducts(prev => {
        const filtered = prev.filter(p => p._id !== product._id);
        const updated = [product, ...filtered].slice(0, 8);
        localStorage.setItem('pos_recent_products', JSON.stringify(updated));
        return updated;
      });
    }
    setSearchProduct('');
    searchInputRef.current?.focus();
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product._id !== productId) return item;
      const newQty = item.quantity + delta;
      if (newQty < 1) return item;
      const stock = getStock(productId);
      if (newQty > stock) {
        alert(`Stock máximo: ${stock}`);
        return item;
      }
      return { ...item, quantity: newQty, subtotal: newQty * item.unitPrice };
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product._id !== productId));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  
  // Calcular descuento
  const discountValue = parseFloat(discount) || 0;
  const discountAmount = discountType === 'percentage' 
    ? (cartSubtotal * discountValue / 100) 
    : discountValue;
  const cartTotal = Math.max(0, cartSubtotal - discountAmount);
  
  const change = paymentMethod === 'efectivo' && amountReceived 
    ? parseFloat(amountReceived) - cartTotal 
    : 0;

  const handleSale = () => {
    if (!currentRegister || currentRegister.status !== 'open') {
      alert('Debes abrir la caja primero');
      return;
    }
    if (cart.length === 0) {
      alert('El carrito está vacío');
      return;
    }
    if (paymentMethod === 'efectivo' && parseFloat(amountReceived || '0') < cartTotal) {
      alert('Monto recibido insuficiente');
      return;
    }

    saleMutation.mutate({
      store: selectedStoreId,
      items: cart.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      })),
      discount: discountAmount,
      tax: 0,
      paymentMethod,
      notes: discount ? `Descuento: ${discountType === 'percentage' ? discountValue + '%' : formatCurrency(discountValue)}` : ''
    });
    
    // Limpiar descuento después de venta
    setDiscount('');
  };

  const handleBarcodeScanned = async (barcode: string) => {
    try {
      const response = await api.get('/products/by-barcode/' + barcode, {
        params: { storeId: selectedStoreId }
      });
      if (response.data?.data) {
        addToCart(response.data.data);
        setShowScanner(false);
      }
    } catch {
      alert('Producto no encontrado');
    }
  };

  const formatTime = (date: string) => new Date(date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (date: string) => new Date(date).toLocaleDateString('es-CO');

  const totalSales = currentRegister?.calculatedTotals?.totalSalesAllMethods || 
    Object.values(currentRegister?.salesByMethod || {}).reduce((a, b) => a + b, 0);

  // Colores por método de pago
  const paymentColors: Record<string, { bg: string; border: string; text: string }> = {
    efectivo: { bg: 'bg-green-50/80', border: 'border-green-200', text: 'text-green-700' },
    nequi: { bg: 'bg-purple-50/80', border: 'border-purple-200', text: 'text-purple-700' },
    daviplata: { bg: 'bg-red-50/80', border: 'border-red-200', text: 'text-red-700' },
    tarjeta: { bg: 'bg-blue-900/10', border: 'border-blue-800', text: 'text-blue-900' },
    transferencia: { bg: 'bg-blue-50/80', border: 'border-blue-200', text: 'text-blue-700' },
    llave_bancolombia: { bg: 'bg-yellow-50/80', border: 'border-yellow-300', text: 'text-yellow-700' },
  };
  const currentPaymentColor = paymentColors[paymentMethod] || paymentColors.efectivo;

  // Función para imprimir ticket
  const printTicket = () => {
    if (!lastSale) return;
    
    const saleCode = lastSale._id?.slice(-8).toUpperCase() || lastSale.saleNumber || 'N/A';
    const storeName = currentRegister?.store?.name || 'Tienda';
    
    const ticketContent = `
      <html>
      <head>
        <title>Ticket de Venta</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 10px; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .line { border-top: 1px dashed #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; }
          .item { margin: 4px 0; }
          h2 { margin: 5px 0; font-size: 16px; }
          .code { font-size: 14px; letter-spacing: 2px; }
        </style>
      </head>
      <body>
        <div class="center">
          <h2>${storeName}</h2>
          <p>================================</p>
          <p class="bold code">Código: ${saleCode}</p>
          <p>${new Date(lastSale.date).toLocaleString('es-CO')}</p>
        </div>
        <div class="line"></div>
        ${lastSale.items.map((item: CartItem) => `
          <div class="item">
            <div>${item.product.name}</div>
            <div class="row">
              <span>${item.quantity} x ${formatCurrency(item.unitPrice)}</span>
              <span>${formatCurrency(item.subtotal)}</span>
            </div>
          </div>
        `).join('')}
        <div class="line"></div>
        <div class="row"><span>Subtotal:</span><span>${formatCurrency(lastSale.subtotal)}</span></div>
        ${lastSale.discountAmount > 0 ? `<div class="row"><span>Descuento:</span><span>-${formatCurrency(lastSale.discountAmount)}</span></div>` : ''}
        <div class="row bold"><span>TOTAL:</span><span>${formatCurrency(lastSale.total)}</span></div>
        <div class="line"></div>
        <div class="row"><span>Método:</span><span>${lastSale.paymentMethod.toUpperCase()}</span></div>
        ${lastSale.paymentMethod === 'efectivo' ? `
          <div class="row"><span>Recibido:</span><span>${formatCurrency(lastSale.amountReceived)}</span></div>
          <div class="row bold"><span>Cambio:</span><span>${formatCurrency(lastSale.change)}</span></div>
        ` : ''}
        <div class="line"></div>
        <div class="center">
          <p>¡Gracias por su compra!</p>
          <p>Vuelva pronto</p>
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank', 'width=320,height=600');
    if (printWindow) {
      printWindow.document.write(ticketContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  // ==================== RENDER ====================
  if (!isAdmin && !user?.store) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-yellow-800">Sin tienda asignada</h3>
          <p className="text-yellow-600">Contacta al administrador para asignarte una tienda.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Banknote className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Punto de Venta</h1>
              <p className="text-sm text-gray-500">
                {currentRegister?.store?.name || stores.find(s => s._id === selectedStoreId)?.name || 'Selecciona tienda'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isAdmin && (
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Seleccionar tienda</option>
                {stores.map(store => (
                  <option key={store._id} value={store._id}>{store.name}</option>
                ))}
              </select>
            )}
            
            <button
              onClick={() => setShowHistoryModal(true)}
              className="p-2 hover:bg-gray-100 rounded-lg"
              title="Historial"
            >
              <History className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Panel Izquierdo - Estado de Caja */}
        <div className="w-80 bg-white border-r flex flex-col">
          {loadingCurrent ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary-600 border-t-transparent rounded-full" />
            </div>
          ) : !currentRegister ? (
            // Caja cerrada - Botón para abrir
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Lock className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Caja Cerrada</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                Abre la caja para comenzar a registrar ventas
              </p>
              <button 
                onClick={() => setShowOpenModal(true)} 
                className="w-full px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <Unlock className="h-4 w-4" />
                Abrir Caja
              </button>
            </div>
          ) : (
            // Caja abierta - Mostrar estado
            <>
              <div className="p-4 border-b bg-green-50">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Caja Abierta</span>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  Desde {formatTime(currentRegister.openedAt)} por {currentRegister.openedBy?.name}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Resumen */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Apertura:</span>
                    <span className="font-medium">{formatCurrency(currentRegister.openingAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Ventas efectivo:</span>
                    <span className="font-medium text-green-600">+{formatCurrency(currentRegister.salesByMethod?.efectivo || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total ventas:</span>
                    <span className="font-medium">{formatCurrency(totalSales)}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between">
                    <span className="font-medium text-gray-700">Esperado en caja:</span>
                    <span className="font-bold text-lg">
                      {formatCurrency(currentRegister.calculatedTotals?.expectedAmount || currentRegister.openingAmount + (currentRegister.salesByMethod?.efectivo || 0))}
                    </span>
                  </div>
                </div>

                {/* Ventas por método */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="text-xs font-medium text-gray-500 mb-2">VENTAS POR MÉTODO</h4>
                  <div className="space-y-2">
                    {[
                      { key: 'efectivo', label: 'Efectivo', icon: Banknote, color: 'text-green-600' },
                      { key: 'nequi', label: 'Nequi', icon: Wallet, color: 'text-purple-600' },
                      { key: 'daviplata', label: 'Daviplata', icon: Wallet, color: 'text-orange-600' },
                      { key: 'tarjeta', label: 'Tarjeta', icon: CreditCard, color: 'text-blue-600' },
                      { key: 'transferencia', label: 'Transferencia', icon: ArrowUpDown, color: 'text-gray-600' },
                    ].map(({ key, label, icon: Icon, color }) => {
                      const value = currentRegister.salesByMethod?.[key as keyof SalesByMethod] || 0;
                      if (value === 0) return null;
                      return (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${color}`} />
                            <span>{label}</span>
                          </div>
                          <span className="font-medium">{formatCurrency(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Movimientos recientes */}
                {currentRegister.movements?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-2">MOVIMIENTOS</h4>
                    <div className="space-y-2">
                      {currentRegister.movements.slice(-5).reverse().map((mov, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm bg-gray-50 rounded p-2">
                          <div className="flex items-center gap-2">
                            {mov.type === 'income' ? (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-gray-600 truncate max-w-[120px]">{mov.description}</span>
                          </div>
                          <span className={mov.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                            {mov.type === 'income' ? '+' : '-'}{formatCurrency(mov.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Acciones de caja */}
              <div className="p-4 border-t space-y-2">
                <button
                  onClick={() => setShowMovementModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  Registrar Movimiento
                </button>
                <button
                  onClick={() => setShowCloseModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium"
                >
                  <Lock className="h-4 w-4" />
                  Cerrar Caja
                </button>
              </div>
            </>
          )}
        </div>

        {/* Panel Central - POS */}
        <div className="flex-1 flex flex-col">
          {/* Barra de búsqueda */}
          <div className="p-4 bg-white border-b">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                  placeholder="Buscar producto por nombre o SKU..."
                  className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  disabled={!currentRegister || currentRegister.status !== 'open'}
                />
                
                {/* Dropdown de resultados */}
                {searchProduct.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-64 overflow-auto">
                    {loadingSearch ? (
                      <div className="p-4 text-center text-gray-500">
                        <div className="animate-spin h-5 w-5 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-2" />
                        Buscando...
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map(product => {
                        const stock = getStock(product._id);
                        return (
                          <div
                            key={product._id}
                            onClick={() => stock > 0 && addToCart(product)}
                            className={`p-3 flex justify-between items-center border-b last:border-0 ${
                              stock > 0 ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                            }`}
                          >
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatCurrency(product.price)}</p>
                              <p className={`text-xs ${stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Stock: {stock}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        No se encontraron productos
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <button
                onClick={() => setShowScanner(true)}
                disabled={!currentRegister || currentRegister.status !== 'open'}
                className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                title="Escanear código"
              >
                <Package className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Carrito */}
          <div className="flex-1 overflow-auto p-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col">
                {/* Productos recientes */}
                {recentProducts.length > 0 && currentRegister?.status === 'open' && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">Productos recientes</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {recentProducts.map(product => {
                        const stock = getStock(product._id);
                        return (
                          <button
                            key={product._id}
                            onClick={() => stock > 0 && addToCart(product)}
                            disabled={stock === 0}
                            className={`p-3 rounded-lg border text-left transition-colors ${
                              stock > 0 
                                ? 'hover:bg-primary-50 hover:border-primary-300' 
                                : 'opacity-50 cursor-not-allowed'
                            }`}
                          >
                            <p className="font-medium text-sm truncate">{product.name}</p>
                            <p className="text-primary-600 font-bold">{formatCurrency(product.price)}</p>
                            <p className={`text-xs ${stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              Stock: {stock}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                  <ShoppingCart className="h-16 w-16 mb-4" />
                  <p className="text-lg">Carrito vacío</p>
                  <p className="text-sm">Busca productos para agregarlos</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map(item => (
                  <motion.div
                    key={item.product._id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-lg border p-3 flex items-center gap-4"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-sm text-gray-500">{formatCurrency(item.unitPrice)} c/u</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.product._id, -1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product._id, 1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="w-24 text-right">
                      <p className="font-bold">{formatCurrency(item.subtotal)}</p>
                    </div>
                    
                    <button
                      onClick={() => removeFromCart(item.product._id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Panel de pago */}
          <div className={`border-t p-4 transition-colors duration-300 ${cart.length > 0 ? currentPaymentColor.bg : 'bg-white'}`}>
            <div className="flex gap-4">
              {/* Método de pago y descuento */}
              <div className="flex-1 space-y-3">
                {/* Descuento */}
                {cart.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <DollarSign className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 ${discountType === 'percentage' ? 'hidden' : ''}`} />
                      <Percent className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 ${discountType === 'fixed' ? 'hidden' : ''}`} />
                      <input
                        type="number"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        placeholder={discountType === 'fixed' ? 'Descuento en pesos' : 'Descuento %'}
                        className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-white/80"
                      />
                    </div>
                    <div className="flex border rounded-lg overflow-hidden">
                      <button
                        onClick={() => setDiscountType('fixed')}
                        className={`px-3 py-2 text-sm font-medium ${
                          discountType === 'fixed' ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        <DollarSign className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDiscountType('percentage')}
                        className={`px-3 py-2 text-sm font-medium ${
                          discountType === 'percentage' ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        <Percent className="h-4 w-4" />
                      </button>
                    </div>
                    {discountAmount > 0 && (
                      <span className="text-sm text-red-600 font-medium">
                        -{formatCurrency(discountAmount)}
                      </span>
                    )}
                  </div>
                )}
                
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">MÉTODO DE PAGO</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'efectivo', label: 'Efectivo', icon: Banknote },
                      { value: 'nequi', label: 'Nequi', icon: Wallet },
                      { value: 'daviplata', label: 'Daviplata', icon: Wallet },
                      { value: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
                      { value: 'transferencia', label: 'Transfer.', icon: ArrowUpDown },
                      { value: 'llave_bancolombia', label: 'Llave', icon: CreditCard },
                    ].map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setPaymentMethod(value)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-colors ${
                          paymentMethod === value
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-xs font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {paymentMethod === 'efectivo' && cart.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <input
                        type="number"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value)}
                        placeholder="Monto recibido"
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    {change > 0 && (
                      <div className="text-right bg-green-50 px-3 py-2 rounded-lg">
                        <p className="text-xs text-green-600">Cambio:</p>
                        <p className="font-bold text-green-700 text-lg">{formatCurrency(change)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Total y botón */}
              <div className="w-64 flex flex-col justify-between">
                <div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-gray-500 mb-1">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(cartSubtotal)}</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-red-600 mb-1">
                      <span>Descuento:</span>
                      <span>-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  <p className="text-xs font-medium text-gray-500">TOTAL A PAGAR</p>
                  <p className="text-4xl font-bold text-gray-900">{formatCurrency(cartTotal)}</p>
                  <p className="text-sm text-gray-500">{cart.length} producto(s)</p>
                </div>
                
                <button
                  onClick={handleSale}
                  disabled={cart.length === 0 || saleMutation.isPending || !currentRegister}
                  className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2"
                >
                  {saleMutation.isPending ? (
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Receipt className="h-6 w-6" />
                      Cobrar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== MODALES ==================== */}
      
      {/* Modal Abrir Caja */}
      <AnimatePresence>
        {showOpenModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowOpenModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">Abrir Caja</h2>
              <form onSubmit={(e) => { e.preventDefault(); openMutation.mutate({ openingAmount: parseFloat(openingAmount) || 0, storeId: selectedStoreId }); }}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monto inicial en caja
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="number"
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border rounded-lg text-lg"
                      placeholder="0"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowOpenModal(false)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={openMutation.isPending}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    {openMutation.isPending ? (
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Unlock className="h-4 w-4" />
                    )}
                    Abrir Caja
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Cerrar Caja */}
      <AnimatePresence>
        {showCloseModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCloseModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">Cerrar Caja</h2>
              <form onSubmit={(e) => { e.preventDefault(); closeMutation.mutate({ actualClosingAmount: parseFloat(closingAmount) || 0, closingNotes: closingNotes, storeId: selectedStoreId || undefined }); }}>
                <div className="space-y-4">
                  {currentRegister && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Monto inicial:</span>
                        <span className="font-medium">{formatCurrency(currentRegister.openingAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Ventas efectivo:</span>
                        <span className="font-medium text-green-600">+{formatCurrency(currentRegister.salesByMethod?.efectivo || 0)}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-medium">
                        <span>Esperado en caja:</span>
                        <span className="text-lg">{formatCurrency(currentRegister.calculatedTotals?.expectedAmount || 0)}</span>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monto contado en caja
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="number"
                        value={closingAmount}
                        onChange={(e) => setClosingAmount(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border rounded-lg text-lg"
                        placeholder="0"
                        autoFocus
                      />
                    </div>
                    
                    {closingAmount && currentRegister && (
                      <div className={`mt-2 p-3 rounded-lg ${
                        parseFloat(closingAmount) === (currentRegister.calculatedTotals?.expectedAmount || 0)
                          ? 'bg-green-50 text-green-700'
                          : parseFloat(closingAmount) > (currentRegister.calculatedTotals?.expectedAmount || 0)
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        <div className="flex items-center gap-2">
                          {parseFloat(closingAmount) === (currentRegister.calculatedTotals?.expectedAmount || 0) ? (
                            <><CheckCircle className="h-5 w-5" /> Cuadre perfecto</>
                          ) : (
                            <>
                              <AlertCircle className="h-5 w-5" />
                              Diferencia: {formatCurrency(parseFloat(closingAmount) - (currentRegister.calculatedTotals?.expectedAmount || 0))}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Observaciones (opcional)
                    </label>
                    <textarea
                      value={closingNotes}
                      onChange={(e) => setClosingNotes(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg"
                      rows={2}
                      placeholder="Notas sobre el cierre..."
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCloseModal(false)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={closeMutation.isPending}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    {closeMutation.isPending ? (
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    Cerrar Caja
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Movimiento */}
      <AnimatePresence>
        {showMovementModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowMovementModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">Registrar Movimiento</h2>
              <form onSubmit={(e) => { e.preventDefault(); movementMutation.mutate({ type: movementType, amount: parseFloat(movementAmount) || 0, description: movementDescription }); }}>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMovementType('income')}
                      className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${
                        movementType === 'income' ? 'bg-green-100 text-green-700 ring-2 ring-green-500' : 'bg-gray-100'
                      }`}
                    >
                      <TrendingUp className="h-5 w-5" />
                      Ingreso
                    </button>
                    <button
                      type="button"
                      onClick={() => setMovementType('expense')}
                      className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${
                        movementType === 'expense' ? 'bg-red-100 text-red-700 ring-2 ring-red-500' : 'bg-gray-100'
                      }`}
                    >
                      <TrendingDown className="h-5 w-5" />
                      Egreso
                    </button>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                    <input
                      type="number"
                      value={movementAmount}
                      onChange={(e) => setMovementAmount(e.target.value)}
                      className="w-full px-4 py-3 border rounded-lg"
                      placeholder="0"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                    <input
                      type="text"
                      value={movementDescription}
                      onChange={(e) => setMovementDescription(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg"
                      placeholder="Ej: Pago a proveedor, cambio de billetes..."
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end mt-6">
                  <button
                    type="button"
                    onClick={() => setShowMovementModal(false)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={movementMutation.isPending}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {movementMutation.isPending ? (
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      'Registrar'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Historial */}
      <AnimatePresence>
        {showHistoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowHistoryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Historial de Cajas</h2>
                <button onClick={() => setShowHistoryModal(false)} className="p-1 hover:bg-gray-100 rounded">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3 max-h-[60vh] overflow-auto">
                {historyData?.registers?.map((register) => (
                  <div key={register._id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{formatDate(register.openedAt)}</p>
                        <p className="text-sm text-gray-500">{register.store?.name}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        register.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {register.status === 'open' ? 'Abierta' : 'Cerrada'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Apertura:</span>
                        <p className="font-medium">{formatCurrency(register.openingAmount)}</p>
                      </div>
                      {register.closingAmount !== undefined && (
                        <div>
                          <span className="text-gray-500">Cierre:</span>
                          <p className="font-medium">{formatCurrency(register.closingAmount)}</p>
                        </div>
                      )}
                      {register.difference !== undefined && (
                        <div>
                          <span className="text-gray-500">Diferencia:</span>
                          <p className={`font-medium ${register.difference === 0 ? 'text-green-600' : register.difference > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {formatCurrency(register.difference)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {(!historyData?.registers || historyData.registers.length === 0) && (
                  <p className="text-center text-gray-500 py-8">No hay historial</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scanner Modal */}
      <BarcodeScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScanned}
        title="Escanear Código de Producto"
      />

      {/* Modal Ticket de Venta */}
      <AnimatePresence>
        {showTicketModal && lastSale && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => { setShowTicketModal(false); searchInputRef.current?.focus(); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header con check */}
              <div className="bg-green-500 text-white p-6 text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                </div>
                <h2 className="text-xl font-bold">¡Venta Exitosa!</h2>
                <p className="text-green-100 text-sm mt-1">
                  Código: <span className="font-mono font-bold">{lastSale._id?.slice(-8).toUpperCase() || 'N/A'}</span>
                </p>
              </div>

              {/* Resumen */}
              <div className="p-4 space-y-3">
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  {lastSale.items.slice(0, 3).map((item: CartItem, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600">{item.quantity}x {item.product.name}</span>
                      <span>{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                  {lastSale.items.length > 3 && (
                    <p className="text-xs text-gray-500">...y {lastSale.items.length - 3} productos más</p>
                  )}
                </div>

                {lastSale.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Descuento:</span>
                    <span>-{formatCurrency(lastSale.discountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(lastSale.total)}</span>
                </div>

                {lastSale.paymentMethod === 'efectivo' && lastSale.change > 0 && (
                  <div className="flex justify-between text-green-600 font-medium bg-green-50 p-2 rounded">
                    <span>Cambio:</span>
                    <span>{formatCurrency(lastSale.change)}</span>
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="p-4 border-t flex gap-2">
                <button
                  onClick={() => { setShowTicketModal(false); searchInputRef.current?.focus(); }}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cerrar
                </button>
                <button
                  onClick={printTicket}
                  className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  <Printer className="h-5 w-5" />
                  Imprimir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
