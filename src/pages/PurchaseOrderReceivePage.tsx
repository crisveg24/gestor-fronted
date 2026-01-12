import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import { Card, Button, Loading } from '../components/ui';
import toast from 'react-hot-toast';
import { ArrowLeft, Package, Check, AlertTriangle, Minus, Plus } from 'lucide-react';
import type { PurchaseOrder, AxiosApiError, Product, ReceivePurchaseOrderDto } from '../types';

interface ReceiveItem {
  productId: string;
  productName: string;
  sku: string;
  quantityOrdered: number;
  quantityPreviouslyReceived: number;
  quantityToReceive: number;
  maxQuantity: number;
}

export default function PurchaseOrderReceivePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Query para obtener la orden
  const { data: order, isLoading, error } = useQuery({
    queryKey: ['purchase-order-receive', id],
    queryFn: async () => {
      const response = await api.get(`/purchase-orders/${id}`);
      return response.data.data as PurchaseOrder;
    },
    enabled: !!id,
  });

  // Inicializar items cuando llega la orden
  if (order && !initialized) {
    const items: ReceiveItem[] = order.items.map((item) => {
      const product = typeof item.product === 'object' ? item.product as Product : null;
      const remaining = item.quantityOrdered - item.quantityReceived;
      
      return {
        productId: product?._id || (typeof item.product === 'string' ? item.product : ''),
        productName: product?.name || 'Producto desconocido',
        sku: product?.sku || '',
        quantityOrdered: item.quantityOrdered,
        quantityPreviouslyReceived: item.quantityReceived,
        quantityToReceive: remaining, // Por defecto recibir todo lo que falta
        maxQuantity: remaining,
      };
    });
    setReceiveItems(items);
    setInitialized(true);
  }

  // Mutation para recibir mercancía
  const receiveMutation = useMutation({
    mutationFn: async (data: ReceivePurchaseOrderDto) => {
      const response = await api.post(`/purchase-orders/${id}/receive`, data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Mercancía recibida exitosamente');
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      navigate(`/purchase-orders/${id}`);
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosApiError;
      toast.error(axiosError.response?.data?.message || 'Error al recibir mercancía');
    },
  });

  const updateQuantity = (index: number, delta: number) => {
    const newItems = [...receiveItems];
    const item = newItems[index];
    const newQuantity = item.quantityToReceive + delta;
    
    if (newQuantity >= 0 && newQuantity <= item.maxQuantity) {
      item.quantityToReceive = newQuantity;
      setReceiveItems(newItems);
    }
  };

  const setQuantity = (index: number, value: number) => {
    const newItems = [...receiveItems];
    const item = newItems[index];
    
    if (value >= 0 && value <= item.maxQuantity) {
      item.quantityToReceive = value;
      setReceiveItems(newItems);
    }
  };

  const handleReceiveAll = () => {
    const newItems = receiveItems.map(item => ({
      ...item,
      quantityToReceive: item.maxQuantity,
    }));
    setReceiveItems(newItems);
  };

  const handleReceiveNone = () => {
    const newItems = receiveItems.map(item => ({
      ...item,
      quantityToReceive: 0,
    }));
    setReceiveItems(newItems);
  };

  const handleSubmit = () => {
    // Filtrar solo items con cantidad > 0
    const itemsToReceive = receiveItems
      .filter(item => item.quantityToReceive > 0)
      .map(item => ({
        productId: item.productId,
        quantityReceived: item.quantityPreviouslyReceived + item.quantityToReceive,
      }));

    if (itemsToReceive.length === 0) {
      toast.error('Debe recibir al menos un producto');
      return;
    }

    receiveMutation.mutate({ items: itemsToReceive });
  };

  const totalItemsToReceive = receiveItems.reduce((sum, item) => sum + item.quantityToReceive, 0);
  const totalItemsRemaining = receiveItems.reduce((sum, item) => sum + item.maxQuantity, 0);
  const isPartialReceive = totalItemsToReceive < totalItemsRemaining;

  if (isLoading) return <Loading />;

  if (error || !order) {
    return (
      <div className="space-y-6">
        <Button variant="secondary" onClick={() => navigate('/ordenes-compra')}>
          <ArrowLeft size={16} className="mr-2" />
          Volver
        </Button>
        <Card>
          <div className="text-center py-8">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">Orden no encontrada</h3>
          </div>
        </Card>
      </div>
    );
  }

  if (order.status === 'cancelled') {
    return (
      <div className="space-y-6">
        <Button variant="secondary" onClick={() => navigate('/ordenes-compra')}>
          <ArrowLeft size={16} className="mr-2" />
          Volver
        </Button>
        <Card className="border-red-200 bg-red-50">
          <div className="text-center py-8">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-lg font-medium text-red-800">Orden Cancelada</h3>
            <p className="mt-1 text-sm text-red-600">No se puede recibir mercancía de una orden cancelada.</p>
          </div>
        </Card>
      </div>
    );
  }

  if (order.status === 'received') {
    return (
      <div className="space-y-6">
        <Button variant="secondary" onClick={() => navigate(`/purchase-orders/${id}`)}>
          <ArrowLeft size={16} className="mr-2" />
          Volver a la orden
        </Button>
        <Card className="border-green-200 bg-green-50">
          <div className="text-center py-8">
            <Check className="mx-auto h-12 w-12 text-green-500" />
            <h3 className="mt-2 text-lg font-medium text-green-800">Orden Completada</h3>
            <p className="mt-1 text-sm text-green-600">Toda la mercancía de esta orden ya fue recibida.</p>
          </div>
        </Card>
      </div>
    );
  }

  const supplier = typeof order.supplier === 'object' ? order.supplier : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={() => navigate(`/purchase-orders/${id}`)}>
            <ArrowLeft size={16} className="mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Recibir Mercancía
            </h1>
            <p className="text-sm text-gray-500">
              Orden #{order.orderNumber} - {supplier?.name || 'Proveedor'}
            </p>
          </div>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={handleReceiveAll}>
          Recibir Todo
        </Button>
        <Button variant="secondary" size="sm" onClick={handleReceiveNone}>
          Limpiar
        </Button>
      </div>

      {/* Lista de productos */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Package size={20} />
          Productos a Recibir
        </h3>

        <div className="space-y-4">
          {receiveItems.map((item, index) => (
            <div 
              key={item.productId} 
              className={`p-4 rounded-lg border ${
                item.quantityToReceive > 0 
                  ? 'border-primary-200 bg-primary-50' 
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{item.productName}</h4>
                  <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                  <div className="mt-1 text-sm">
                    <span className="text-gray-600">
                      Ordenado: <strong>{item.quantityOrdered}</strong>
                    </span>
                    {item.quantityPreviouslyReceived > 0 && (
                      <span className="ml-3 text-blue-600">
                        Ya recibido: <strong>{item.quantityPreviouslyReceived}</strong>
                      </span>
                    )}
                    <span className="ml-3 text-orange-600">
                      Pendiente: <strong>{item.maxQuantity}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Recibir:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateQuantity(index, -1)}
                      disabled={item.quantityToReceive <= 0}
                      className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Minus size={16} />
                    </button>
                    
                    <input
                      type="number"
                      value={item.quantityToReceive}
                      onChange={(e) => setQuantity(index, parseInt(e.target.value) || 0)}
                      min={0}
                      max={item.maxQuantity}
                      className="w-20 text-center px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                    
                    <button
                      type="button"
                      onClick={() => updateQuantity(index, 1)}
                      disabled={item.quantityToReceive >= item.maxQuantity}
                      className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  
                  <span className="text-sm text-gray-500">
                    / {item.maxQuantity}
                  </span>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-primary-500 transition-all duration-200"
                    style={{ width: `${(item.quantityToReceive / item.maxQuantity) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Resumen y confirmación */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-900">Resumen de Recepción</h3>
            <p className="text-sm text-gray-600">
              Recibirás <strong className="text-primary-600">{totalItemsToReceive}</strong> unidades de {totalItemsRemaining} pendientes
            </p>
            {isPartialReceive && totalItemsToReceive > 0 && (
              <p className="text-sm text-orange-600 flex items-center gap-1 mt-1">
                <AlertTriangle size={14} />
                Recepción parcial - La orden quedará en estado "Parcial"
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button 
              variant="secondary" 
              onClick={() => navigate(`/purchase-orders/${id}`)}
            >
              Cancelar
            </Button>
            <Button 
              variant="primary" 
              onClick={handleSubmit}
              disabled={totalItemsToReceive === 0 || receiveMutation.isPending}
            >
              {receiveMutation.isPending ? (
                'Procesando...'
              ) : (
                <>
                  <Check size={16} className="mr-2" />
                  Confirmar Recepción
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
