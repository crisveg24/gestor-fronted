import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Banknote,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Minus,
  History,
  CreditCard,
  Wallet,
  ArrowUpDown,
  AlertCircle,
  Calendar,
  Store,
  Lock,
  Unlock,
} from 'lucide-react';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { formatCurrency } from '../utils/formatCurrency';

interface CashMovement {
  type: 'income' | 'expense';
  amount: number;
  description: string;
  createdAt: string;
  createdBy?: {
    _id: string;
    name: string;
  };
}

interface SalesByMethod {
  cash: number;
  card: number;
  transfer: number;
  credit: number;
  total: number;
}

interface CashRegister {
  _id: string;
  store: {
    _id: string;
    name: string;
  };
  openingAmount: number;
  closingAmount?: number;
  expectedAmount?: number;
  difference?: number;
  status: 'open' | 'closed';
  movements: CashMovement[];
  salesByMethod: SalesByMethod;
  notes?: string;
  openedBy: {
    _id: string;
    name: string;
  };
  closedBy?: {
    _id: string;
    name: string;
  };
  openedAt: string;
  closedAt?: string;
}

interface Store {
  _id: string;
  name: string;
}

export default function CashRegisterPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  
  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => {
    if (isAdmin) {
      return localStorage.getItem('cashRegister_selectedStore') || '';
    }
    return user?.store?._id || '';
  });
  
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRegister, setSelectedRegister] = useState<CashRegister | null>(null);
  
  const [openingAmount, setOpeningAmount] = useState('');
  const [movementType, setMovementType] = useState<'income' | 'expense'>('income');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDescription, setMovementDescription] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  // Guardar tienda seleccionada
  useEffect(() => {
    if (isAdmin && selectedStoreId) {
      localStorage.setItem('cashRegister_selectedStore', selectedStoreId);
    }
  }, [selectedStoreId, isAdmin]);

  // Query tiendas (solo admin)
  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ['stores'],
    queryFn: async () => {
      const response = await api.get('/stores');
      return response.data;
    },
    enabled: isAdmin,
  });

  // Query caja actual
  const { data: currentRegister, isLoading: loadingCurrent } = useQuery<CashRegister | null>({
    queryKey: ['cashRegister', 'current', selectedStoreId],
    queryFn: async () => {
      const params = selectedStoreId ? { storeId: selectedStoreId } : {};
      const response = await api.get('/cash-register/current', { params });
      return response.data;
    },
    enabled: !!selectedStoreId || !isAdmin,
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  // Query historial
  const { data: historyData } = useQuery<{ registers: CashRegister[]; pagination: unknown }>({
    queryKey: ['cashRegister', 'history', selectedStoreId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStoreId) params.append('storeId', selectedStoreId);
      params.append('limit', '10');
      const response = await api.get(`/cash-register/history?${params.toString()}`);
      return response.data;
    },
    enabled: !!selectedStoreId || !isAdmin,
  });

  // Mutación abrir caja
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
  });

  // Mutación agregar movimiento
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
  });

  // Mutación cerrar caja
  const closeMutation = useMutation({
    mutationFn: async (data: { closingAmount: number; notes?: string }) => {
      const response = await api.post('/cash-register/close', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashRegister'] });
      setShowCloseModal(false);
      setClosingAmount('');
      setClosingNotes('');
    },
  });

  const handleOpenCashRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(openingAmount);
    if (isNaN(amount) || amount < 0) return;
    
    openMutation.mutate({
      openingAmount: amount,
      ...(isAdmin && selectedStoreId ? { storeId: selectedStoreId } : {}),
    });
  };

  const handleAddMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(movementAmount);
    if (isNaN(amount) || amount <= 0 || !movementDescription.trim()) return;
    
    movementMutation.mutate({
      type: movementType,
      amount,
      description: movementDescription.trim(),
    });
  };

  const handleCloseCashRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(closingAmount);
    if (isNaN(amount) || amount < 0) return;
    
    closeMutation.mutate({
      closingAmount: amount,
      notes: closingNotes.trim() || undefined,
    });
  };

  const viewRegisterDetail = (register: CashRegister) => {
    setSelectedRegister(register);
    setShowDetailModal(true);
  };

  // Calcular totales en tiempo real
  const calculateExpected = () => {
    if (!currentRegister) return 0;
    const movementsNet = currentRegister.movements.reduce((sum, m) => {
      return sum + (m.type === 'income' ? m.amount : -m.amount);
    }, 0);
    return currentRegister.openingAmount + currentRegister.salesByMethod.cash + movementsNet;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isAdmin && !user?.store) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-yellow-800">Sin tienda asignada</h3>
          <p className="text-yellow-600 mt-2">
            Necesitas tener una tienda asignada para gestionar la caja registradora.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caja Registradora</h1>
          <p className="text-gray-600 mt-1">
            Gestión de apertura, movimientos y cierre de caja
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Selector de tienda (solo admin) */}
          {isAdmin && (
            <div className="relative">
              <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white min-w-[200px]"
              >
                <option value="">Seleccionar tienda</option>
                {stores.map((store) => (
                  <option key={store._id} value={store._id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* Botón historial */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <History className="h-4 w-4" />
            Historial
          </button>
        </div>
      </div>

      {/* Loading */}
      {loadingCurrent && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Sin tienda seleccionada (admin) */}
      {isAdmin && !selectedStoreId && !loadingCurrent && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
          <Store className="h-12 w-12 text-blue-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-blue-800">Selecciona una tienda</h3>
          <p className="text-blue-600 mt-2">
            Elige una tienda para ver o gestionar su caja registradora
          </p>
        </div>
      )}

      {/* Caja cerrada - Mostrar opción de abrir */}
      {!loadingCurrent && (selectedStoreId || !isAdmin) && !currentRegister && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-8 text-center"
        >
          <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="h-10 w-10 text-gray-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800">Caja Cerrada</h3>
          <p className="text-gray-600 mt-2 mb-6">
            No hay una caja abierta actualmente. Abre la caja para comenzar a registrar ventas.
          </p>
          <button
            onClick={() => setShowOpenModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium"
          >
            <Unlock className="h-5 w-5" />
            Abrir Caja
          </button>
        </motion.div>
      )}

      {/* Caja abierta */}
      {currentRegister && (
        <div className="space-y-6">
          {/* Estado de la caja */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <Unlock className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-green-800">Caja Abierta</h3>
                  <p className="text-sm text-green-600">
                    Abierta por {currentRegister.openedBy?.name} • {formatDate(currentRegister.openedAt)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCloseModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Lock className="h-4 w-4" />
                Cerrar Caja
              </button>
            </div>
          </motion.div>

          {/* Resumen financiero */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Monto inicial */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-sm text-gray-600">Monto Inicial</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(currentRegister.openingAmount)}
              </p>
            </motion.div>

            {/* Ventas en efectivo */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Banknote className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-sm text-gray-600">Ventas Efectivo</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                +{formatCurrency(currentRegister.salesByMethod.cash)}
              </p>
            </motion.div>

            {/* Movimientos netos */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <ArrowUpDown className="h-5 w-5 text-purple-600" />
                </div>
                <span className="text-sm text-gray-600">Movimientos</span>
              </div>
              {(() => {
                const net = currentRegister.movements.reduce((sum, m) => 
                  sum + (m.type === 'income' ? m.amount : -m.amount), 0
                );
                return (
                  <p className={`text-2xl font-bold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {net >= 0 ? '+' : ''}{formatCurrency(net)}
                  </p>
                );
              })()}
            </motion.div>

            {/* Total esperado */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm text-blue-100">Total Esperado</span>
              </div>
              <p className="text-2xl font-bold">
                {formatCurrency(calculateExpected())}
              </p>
            </motion.div>
          </div>

          {/* Ventas por método */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl border border-gray-200 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ventas del Día</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Banknote className="h-6 w-6 text-green-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Efectivo</p>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(currentRegister.salesByMethod.cash)}
                </p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <CreditCard className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Tarjeta</p>
                <p className="text-lg font-bold text-blue-600">
                  {formatCurrency(currentRegister.salesByMethod.card)}
                </p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <ArrowUpDown className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Transferencia</p>
                <p className="text-lg font-bold text-purple-600">
                  {formatCurrency(currentRegister.salesByMethod.transfer)}
                </p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <Clock className="h-6 w-6 text-amber-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Crédito</p>
                <p className="text-lg font-bold text-amber-600">
                  {formatCurrency(currentRegister.salesByMethod.credit)}
                </p>
              </div>
              <div className="text-center p-4 bg-gray-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(currentRegister.salesByMethod.total)}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Movimientos y acciones */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lista de movimientos */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white rounded-xl border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Movimientos</h3>
                <button
                  onClick={() => setShowMovementModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Agregar
                </button>
              </div>
              
              {currentRegister.movements.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ArrowUpDown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No hay movimientos registrados</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {currentRegister.movements.map((movement, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        movement.type === 'income' ? 'bg-green-50' : 'bg-red-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          movement.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {movement.type === 'income' ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{movement.description}</p>
                          <p className="text-xs text-gray-500">
                            {movement.createdBy?.name} • {formatDate(movement.createdAt)}
                          </p>
                        </div>
                      </div>
                      <span className={`font-semibold ${
                        movement.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {movement.type === 'income' ? '+' : '-'}{formatCurrency(movement.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Acciones rápidas */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white rounded-xl border border-gray-200 p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setMovementType('income');
                    setShowMovementModal(true);
                  }}
                  className="flex flex-col items-center gap-2 p-4 bg-green-50 rounded-xl hover:bg-green-100 transition-colors border border-green-200"
                >
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Plus className="h-6 w-6 text-green-600" />
                  </div>
                  <span className="text-sm font-medium text-green-700">Ingreso Extra</span>
                </button>
                
                <button
                  onClick={() => {
                    setMovementType('expense');
                    setShowMovementModal(true);
                  }}
                  className="flex flex-col items-center gap-2 p-4 bg-red-50 rounded-xl hover:bg-red-100 transition-colors border border-red-200"
                >
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <Minus className="h-6 w-6 text-red-600" />
                  </div>
                  <span className="text-sm font-medium text-red-700">Retiro/Gasto</span>
                </button>
              </div>
              
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-700">
                    <p className="font-medium">Recuerda</p>
                    <p>Registra todos los movimientos de efectivo para mantener el arqueo preciso.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* Modal Abrir Caja */}
      <AnimatePresence>
        {showOpenModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowOpenModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Unlock className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Abrir Caja</h3>
                  <p className="text-sm text-gray-600">Ingresa el monto inicial en efectivo</p>
                </div>
              </div>
              
              <form onSubmit={handleOpenCashRegister}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monto de Apertura
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="number"
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg"
                      placeholder="0"
                      min="0"
                      step="100"
                      required
                      autoFocus
                    />
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowOpenModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={openMutation.isPending}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {openMutation.isPending ? 'Abriendo...' : 'Abrir Caja'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Agregar Movimiento */}
      <AnimatePresence>
        {showMovementModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowMovementModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  movementType === 'income' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {movementType === 'income' ? (
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  ) : (
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {movementType === 'income' ? 'Registrar Ingreso' : 'Registrar Egreso'}
                  </h3>
                  <p className="text-sm text-gray-600">Agrega un movimiento de caja</p>
                </div>
              </div>
              
              <form onSubmit={handleAddMovement}>
                {/* Tipo de movimiento */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setMovementType('income')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                        movementType === 'income'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <TrendingUp className="h-4 w-4" />
                      Ingreso
                    </button>
                    <button
                      type="button"
                      onClick={() => setMovementType('expense')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                        movementType === 'expense'
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <TrendingDown className="h-4 w-4" />
                      Egreso
                    </button>
                  </div>
                </div>

                {/* Monto */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Monto</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="number"
                      value={movementAmount}
                      onChange={(e) => setMovementAmount(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                      min="1"
                      step="100"
                      required
                    />
                  </div>
                </div>

                {/* Descripción */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
                  <input
                    type="text"
                    value={movementDescription}
                    onChange={(e) => setMovementDescription(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={movementType === 'income' ? 'Ej: Cobro de factura pendiente' : 'Ej: Compra de suministros'}
                    required
                  />
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowMovementModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={movementMutation.isPending}
                    className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      movementType === 'income'
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {movementMutation.isPending ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Cerrar Caja */}
      <AnimatePresence>
        {showCloseModal && currentRegister && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCloseModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Lock className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Cerrar Caja</h3>
                  <p className="text-sm text-gray-600">Realiza el arqueo final del día</p>
                </div>
              </div>

              {/* Resumen antes de cerrar */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Monto inicial:</span>
                  <span className="font-medium">{formatCurrency(currentRegister.openingAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Ventas en efectivo:</span>
                  <span className="font-medium text-green-600">+{formatCurrency(currentRegister.salesByMethod.cash)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Movimientos netos:</span>
                  {(() => {
                    const net = currentRegister.movements.reduce((sum, m) => 
                      sum + (m.type === 'income' ? m.amount : -m.amount), 0
                    );
                    return (
                      <span className={`font-medium ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {net >= 0 ? '+' : ''}{formatCurrency(net)}
                      </span>
                    );
                  })()}
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-medium text-gray-700">Total esperado:</span>
                  <span className="font-bold text-blue-600">{formatCurrency(calculateExpected())}</span>
                </div>
              </div>
              
              <form onSubmit={handleCloseCashRegister}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monto Real en Caja
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="number"
                      value={closingAmount}
                      onChange={(e) => setClosingAmount(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-lg"
                      placeholder="Cuenta el efectivo real"
                      min="0"
                      step="100"
                      required
                      autoFocus
                    />
                  </div>
                  
                  {/* Mostrar diferencia en tiempo real */}
                  {closingAmount && (
                    <div className={`mt-2 p-3 rounded-lg ${
                      parseFloat(closingAmount) === calculateExpected()
                        ? 'bg-green-50 text-green-700'
                        : parseFloat(closingAmount) > calculateExpected()
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      <div className="flex items-center gap-2">
                        {parseFloat(closingAmount) === calculateExpected() ? (
                          <>
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-medium">Cuadre perfecto</span>
                          </>
                        ) : parseFloat(closingAmount) > calculateExpected() ? (
                          <>
                            <TrendingUp className="h-5 w-5" />
                            <span className="font-medium">
                              Sobrante: {formatCurrency(parseFloat(closingAmount) - calculateExpected())}
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-5 w-5" />
                            <span className="font-medium">
                              Faltante: {formatCurrency(calculateExpected() - parseFloat(closingAmount))}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notas (opcional)
                  </label>
                  <textarea
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Observaciones del cierre..."
                    rows={2}
                  />
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCloseModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={closeMutation.isPending}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {closeMutation.isPending ? 'Cerrando...' : 'Cerrar Caja'}
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowHistoryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <History className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Historial de Cierres</h3>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {!historyData?.registers || historyData.registers.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No hay registros anteriores</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {historyData.registers.map((register) => (
                      <div
                        key={register._id}
                        onClick={() => viewRegisterDetail(register)}
                        className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {formatDate(register.openedAt)}
                            </span>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            register.status === 'open'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {register.status === 'open' ? 'Abierta' : 'Cerrada'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Apertura:</span>
                            <p className="font-medium">{formatCurrency(register.openingAmount)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Ventas:</span>
                            <p className="font-medium text-green-600">
                              {formatCurrency(register.salesByMethod?.total || 0)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Diferencia:</span>
                            <p className={`font-medium ${
                              register.difference === 0
                                ? 'text-green-600'
                                : register.difference && register.difference > 0
                                ? 'text-blue-600'
                                : 'text-red-600'
                            }`}>
                              {register.difference !== undefined
                                ? (register.difference > 0 ? '+' : '') + formatCurrency(register.difference)
                                : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Detalle de Registro */}
      <AnimatePresence>
        {showDetailModal && selectedRegister && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDetailModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Detalle del Arqueo</h3>
                  <p className="text-sm text-gray-500">{formatDate(selectedRegister.openedAt)}</p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Información general */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <span className="text-sm text-gray-500">Monto Apertura</span>
                    <p className="text-xl font-bold text-gray-900">
                      {formatCurrency(selectedRegister.openingAmount)}
                    </p>
                  </div>
                  {selectedRegister.closingAmount !== undefined && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <span className="text-sm text-gray-500">Monto Cierre</span>
                      <p className="text-xl font-bold text-gray-900">
                        {formatCurrency(selectedRegister.closingAmount)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Ventas por método */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Ventas por Método</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <Banknote className="h-5 w-5 text-green-600 mx-auto mb-1" />
                      <span className="text-xs text-gray-500">Efectivo</span>
                      <p className="font-semibold text-green-600">
                        {formatCurrency(selectedRegister.salesByMethod?.cash || 0)}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <CreditCard className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                      <span className="text-xs text-gray-500">Tarjeta</span>
                      <p className="font-semibold text-blue-600">
                        {formatCurrency(selectedRegister.salesByMethod?.card || 0)}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                      <ArrowUpDown className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                      <span className="text-xs text-gray-500">Transfer</span>
                      <p className="font-semibold text-purple-600">
                        {formatCurrency(selectedRegister.salesByMethod?.transfer || 0)}
                      </p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 text-center">
                      <Clock className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                      <span className="text-xs text-gray-500">Crédito</span>
                      <p className="font-semibold text-amber-600">
                        {formatCurrency(selectedRegister.salesByMethod?.credit || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Resultado */}
                {selectedRegister.status === 'closed' && (
                  <div className={`p-4 rounded-lg ${
                    selectedRegister.difference === 0
                      ? 'bg-green-50 border border-green-200'
                      : selectedRegister.difference && selectedRegister.difference > 0
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-600">Resultado del Arqueo</span>
                        <div className="flex items-center gap-2 mt-1">
                          {selectedRegister.difference === 0 ? (
                            <>
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <span className="font-semibold text-green-700">Cuadre Perfecto</span>
                            </>
                          ) : selectedRegister.difference && selectedRegister.difference > 0 ? (
                            <>
                              <TrendingUp className="h-5 w-5 text-blue-600" />
                              <span className="font-semibold text-blue-700">
                                Sobrante: {formatCurrency(selectedRegister.difference)}
                              </span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-5 w-5 text-red-600" />
                              <span className="font-semibold text-red-700">
                                Faltante: {formatCurrency(Math.abs(selectedRegister.difference || 0))}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-500">Esperado vs Real</span>
                        <p className="text-sm">
                          {formatCurrency(selectedRegister.expectedAmount || 0)} vs {formatCurrency(selectedRegister.closingAmount || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Movimientos */}
                {selectedRegister.movements.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">
                      Movimientos ({selectedRegister.movements.length})
                    </h4>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {selectedRegister.movements.map((movement, index) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            movement.type === 'income' ? 'bg-green-50' : 'bg-red-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {movement.type === 'income' ? (
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-600" />
                            )}
                            <span className="text-sm">{movement.description}</span>
                          </div>
                          <span className={`font-medium ${
                            movement.type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {movement.type === 'income' ? '+' : '-'}{formatCurrency(movement.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notas */}
                {selectedRegister.notes && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Notas</h4>
                    <p className="text-gray-600 bg-gray-50 rounded-lg p-3">
                      {selectedRegister.notes}
                    </p>
                  </div>
                )}

                {/* Información de usuarios */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Abierta por:</span>
                    <p className="font-medium">{selectedRegister.openedBy?.name}</p>
                    <p className="text-xs text-gray-400">{formatDate(selectedRegister.openedAt)}</p>
                  </div>
                  {selectedRegister.closedBy && (
                    <div>
                      <span className="text-gray-500">Cerrada por:</span>
                      <p className="font-medium">{selectedRegister.closedBy?.name}</p>
                      <p className="text-xs text-gray-400">{selectedRegister.closedAt && formatDate(selectedRegister.closedAt)}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
