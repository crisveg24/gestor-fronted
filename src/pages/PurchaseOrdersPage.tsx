import { useState, useEffect } from 'react';
import api from '../lib/axios';
import type { PurchaseOrder, ApiResponse, AxiosApiError } from '../types';
import { Card, Button, ResponsiveTable, Loading } from '../components/ui';
import type { Column } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get<ApiResponse<{ orders: PurchaseOrder[] }>>('/purchase-orders');
      setOrders(response.data.data.orders);
    } catch (error) {
      const axiosError = error as AxiosApiError;
      toast.error(axiosError.response?.data?.message || 'Error al cargar órdenes');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      received: 'bg-green-100 text-green-800',
      partial: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    const labels = {
      pending: 'Pendiente',
      received: 'Recibida',
      partial: 'Parcial',
      cancelled: 'Cancelada'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${badges[status as keyof typeof badges]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const handleReceive = async (orderId: string) => {
    navigate(`/purchase-orders/${orderId}/receive`);
  };

  const handleCancel = async (orderId: string) => {
    const reason = prompt('Razón de cancelación:');
    if (!reason) return;

    try {
      await api.post(`/purchase-orders/${orderId}/cancel`, { cancellationReason: reason });
      toast.success('Orden cancelada');
      fetchOrders();
    } catch (error) {
      const axiosError = error as AxiosApiError;
      toast.error(axiosError.response?.data?.message || 'Error al cancelar orden');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Órdenes de Compra</h1>
        {user?.role === 'admin' && (
          <Button onClick={() => navigate('/ordenes-compra/nueva')} className="text-sm sm:text-base">
            + <span className="hidden sm:inline">Nueva Orden</span><span className="sm:hidden">Nueva</span>
          </Button>
        )}
      </div>

      <Card>
        <ResponsiveTable
          columns={[
            { 
              key: 'orderNumber', 
              header: 'Nº Orden',
              mobileRender: (order: PurchaseOrder) => (
                <div className="font-semibold text-gray-900">
                  Orden #{order.orderNumber}
                </div>
              ),
            },
            {
              key: 'supplier',
              header: 'Proveedor',
              render: (order: PurchaseOrder) => (
                <div>
                  <div className="font-medium">
                    {typeof order.supplier === 'object' ? order.supplier.name : order.supplier}
                  </div>
                  <div className="text-sm text-gray-500">
                    {typeof order.supplier === 'object' ? order.supplier.contactName : ''}
                  </div>
                </div>
              ),
              mobileRender: (order: PurchaseOrder) => (
                <div className="text-sm text-gray-600">
                  {typeof order.supplier === 'object' ? order.supplier.name : order.supplier}
                </div>
              ),
            },
            {
              key: 'store',
              header: 'Tienda',
              hideOnMobile: true,
              render: (order: PurchaseOrder) => 
                typeof order.store === 'object' ? order.store.name : order.store
            },
            {
              key: 'items',
              header: 'Items',
              render: (order: PurchaseOrder) => order.items.length,
              mobileRender: (order: PurchaseOrder) => (
                <div className="text-sm text-gray-600">
                  Items: {order.items.length}
                </div>
              ),
            },
            {
              key: 'finalTotal',
              header: 'Total',
              render: (order: PurchaseOrder) => `$${order.finalTotal.toFixed(2)}`,
              mobileRender: (order: PurchaseOrder) => (
                <div className="text-lg font-bold text-primary-600">
                  ${order.finalTotal.toFixed(2)}
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Estado',
              render: (order: PurchaseOrder) => getStatusBadge(order.status),
              mobileRender: (order: PurchaseOrder) => (
                <div className="mt-1">
                  {getStatusBadge(order.status)}
                </div>
              ),
            },
            {
              key: 'expectedDeliveryDate',
              header: 'Fecha Esperada',
              hideOnMobile: true,
              render: (order: PurchaseOrder) => 
                order.expectedDeliveryDate 
                  ? new Date(order.expectedDeliveryDate).toLocaleDateString()
                  : 'N/A'
            },
            {
              key: 'actions',
              header: 'Acciones',
              render: (order: PurchaseOrder) => (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/purchase-orders/${order._id}`)}
                  >
                    Ver
                  </Button>
                  {order.status === 'pending' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleReceive(order._id)}
                    >
                      Recibir
                    </Button>
                  )}
                  {user?.role === 'admin' && order.status !== 'received' && order.status !== 'cancelled' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleCancel(order._id)}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              ),
              mobileRender: (order: PurchaseOrder) => (
                <div className="flex flex-col gap-2 mt-3">
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/purchase-orders/${order._id}`)}
                    className="w-full"
                  >
                    Ver Detalle
                  </Button>
                  {order.status === 'pending' && (
                    <Button
                      variant="primary"
                      onClick={() => handleReceive(order._id)}
                      className="w-full"
                    >
                      Recibir Orden
                    </Button>
                  )}
                  {user?.role === 'admin' && order.status !== 'received' && order.status !== 'cancelled' && (
                    <Button
                      variant="danger"
                      onClick={() => handleCancel(order._id)}
                      className="w-full"
                    >
                      Cancelar Orden
                    </Button>
                  )}
                </div>
              ),
            }
          ] as Column<PurchaseOrder>[]}
          data={orders}
        />
      </Card>
    </div>
  );
}
