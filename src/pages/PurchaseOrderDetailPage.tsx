import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import { Card, Button, Loading } from '../components/ui';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { ArrowLeft, Package, Truck, Calendar, FileText, User, DollarSign, X, CheckCircle, AlertCircle } from 'lucide-react';
import type { PurchaseOrder, AxiosApiError, Product } from '../types';

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Query para obtener la orden
  const { data: order, isLoading, error } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: async () => {
      const response = await api.get(`/purchase-orders/${id}`);
      return response.data.data as PurchaseOrder;
    },
    enabled: !!id,
  });

  // Mutation para cancelar orden
  const cancelMutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await api.post(`/purchase-orders/${id}/cancel`, { cancellationReason: reason });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Orden cancelada');
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosApiError;
      toast.error(axiosError.response?.data?.message || 'Error al cancelar la orden');
    },
  });

  const handleCancel = () => {
    const reason = prompt('¿Razón de la cancelación?');
    if (reason) {
      cancelMutation.mutate(reason);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pendiente', icon: AlertCircle },
      received: { color: 'bg-green-100 text-green-800', label: 'Recibida', icon: CheckCircle },
      partial: { color: 'bg-blue-100 text-blue-800', label: 'Parcial', icon: Package },
      cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelada', icon: X },
    };
    const cfg = config[status as keyof typeof config] || config.pending;
    const Icon = cfg.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full ${cfg.color}`}>
        <Icon size={16} />
        {cfg.label}
      </span>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const config = {
      pending: { color: 'bg-orange-100 text-orange-800', label: 'Pendiente de pago' },
      partial: { color: 'bg-blue-100 text-blue-800', label: 'Pago parcial' },
      paid: { color: 'bg-green-100 text-green-800', label: 'Pagado' },
    };
    const cfg = config[status as keyof typeof config] || config.pending;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${cfg.color}`}>
        {cfg.label}
      </span>
    );
  };

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
            <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">Orden no encontrada</h3>
            <p className="mt-1 text-sm text-gray-500">La orden de compra que buscas no existe o no tienes permisos para verla.</p>
          </div>
        </Card>
      </div>
    );
  }

  const supplier = typeof order.supplier === 'object' ? order.supplier : null;
  const store = typeof order.store === 'object' ? order.store : null;
  const createdBy = typeof order.createdBy === 'object' ? order.createdBy : null;
  const receivedBy = typeof order.receivedBy === 'object' ? order.receivedBy : null;
  const cancelledBy = typeof order.cancelledBy === 'object' ? order.cancelledBy : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={() => navigate('/ordenes-compra')}>
            <ArrowLeft size={16} className="mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Orden #{order.orderNumber}
            </h1>
            <p className="text-sm text-gray-500">
              Creada el {new Date(order.createdAt).toLocaleDateString('es-ES', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {getStatusBadge(order.status)}
          {getPaymentStatusBadge(order.paymentStatus)}
        </div>
      </div>

      {/* Acciones */}
      {order.status === 'pending' && (
        <div className="flex gap-2">
          <Button 
            variant="primary" 
            onClick={() => navigate(`/purchase-orders/${order._id}/receive`)}
          >
            <Package size={16} className="mr-2" />
            Recibir Mercancía
          </Button>
          {isAdmin && (
            <Button 
              variant="danger" 
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              <X size={16} className="mr-2" />
              Cancelar Orden
            </Button>
          )}
        </div>
      )}

      {order.status === 'partial' && (
        <div className="flex gap-2">
          <Button 
            variant="primary" 
            onClick={() => navigate(`/purchase-orders/${order._id}/receive`)}
          >
            <Package size={16} className="mr-2" />
            Recibir Restante
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Productos */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package size={20} />
              Productos ({order.items.length})
            </h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Producto
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Ordenado
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Recibido
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Costo Unit.
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {order.items.map((item, index) => {
                    const product = typeof item.product === 'object' ? item.product as Product : null;
                    const progress = (item.quantityReceived / item.quantityOrdered) * 100;
                    
                    return (
                      <tr key={index}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {product?.name || 'Producto eliminado'}
                          </div>
                          {product && (
                            <div className="text-sm text-gray-500">
                              SKU: {product.sku}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.quantityOrdered}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={item.quantityReceived === item.quantityOrdered ? 'text-green-600 font-medium' : 'text-gray-600'}>
                              {item.quantityReceived}
                            </span>
                            <div className="w-16 bg-gray-200 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          ${item.unitCost.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          ${item.subtotal.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Notas */}
          {order.notes && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FileText size={20} />
                Notas
              </h3>
              <p className="text-gray-600 whitespace-pre-wrap">{order.notes}</p>
            </Card>
          )}

          {/* Información de cancelación */}
          {order.status === 'cancelled' && (
            <Card className="border-red-200 bg-red-50">
              <h3 className="text-lg font-semibold text-red-800 mb-2 flex items-center gap-2">
                <X size={20} />
                Orden Cancelada
              </h3>
              <div className="text-sm text-red-700 space-y-1">
                <p><strong>Razón:</strong> {order.cancellationReason || 'No especificada'}</p>
                {cancelledBy && <p><strong>Cancelado por:</strong> {cancelledBy.name}</p>}
                {order.cancelledAt && (
                  <p><strong>Fecha:</strong> {new Date(order.cancelledAt).toLocaleString('es-ES')}</p>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Resumen financiero */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign size={20} />
              Resumen
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">${order.totalCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Impuestos</span>
                <span className="font-medium">${order.tax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Envío</span>
                <span className="font-medium">${order.shippingCost.toLocaleString()}</span>
              </div>
              <hr />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary-600">${order.finalTotal.toLocaleString()}</span>
              </div>
            </div>
          </Card>

          {/* Proveedor */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Truck size={20} />
              Proveedor
            </h3>
            {supplier ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium text-gray-900">{supplier.name}</p>
                {supplier.contactName && (
                  <p className="text-gray-600">Contacto: {supplier.contactName}</p>
                )}
                {supplier.email && (
                  <p className="text-gray-600">
                    <a href={`mailto:${supplier.email}`} className="text-primary-600 hover:underline">
                      {supplier.email}
                    </a>
                  </p>
                )}
                {supplier.phone && (
                  <p className="text-gray-600">Tel: {supplier.phone}</p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Proveedor no disponible</p>
            )}
          </Card>

          {/* Tienda destino */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package size={20} />
              Tienda Destino
            </h3>
            {store ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium text-gray-900">{store.name}</p>
                {store.address && <p className="text-gray-600">{store.address}</p>}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Tienda no disponible</p>
            )}
          </Card>

          {/* Fechas */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar size={20} />
              Fechas
            </h3>
            <div className="space-y-2 text-sm">
              {order.expectedDeliveryDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Entrega esperada</span>
                  <span className="font-medium">
                    {new Date(order.expectedDeliveryDate).toLocaleDateString('es-ES')}
                  </span>
                </div>
              )}
              {order.receivedDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Fecha recibida</span>
                  <span className="font-medium text-green-600">
                    {new Date(order.receivedDate).toLocaleDateString('es-ES')}
                  </span>
                </div>
              )}
              {order.invoiceNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Nº Factura</span>
                  <span className="font-medium">{order.invoiceNumber}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Tracking */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User size={20} />
              Información
            </h3>
            <div className="space-y-2 text-sm">
              {createdBy && (
                <div>
                  <span className="text-gray-500">Creado por:</span>
                  <p className="font-medium">{createdBy.name}</p>
                </div>
              )}
              {receivedBy && (
                <div className="mt-2">
                  <span className="text-gray-500">Recibido por:</span>
                  <p className="font-medium">{receivedBy.name}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
