import { useState, useEffect } from 'react';
import api from '../lib/axios';
import type { PurchaseOrder, ApiResponse } from '../types';
import { Card, Button, Table, Loading } from '../components/ui';
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
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al cargar órdenes');
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
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al cancelar orden');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Órdenes de Compra</h1>
        {user?.role === 'admin' && (
          <Button onClick={() => navigate('/purchase-orders/new')}>
            + Nueva Orden
          </Button>
        )}
      </div>

      <Card>
        <Table
          columns={[
            { key: 'orderNumber', header: 'Nº Orden' },
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
              )
            },
            {
              key: 'store',
              header: 'Tienda',
              render: (order: PurchaseOrder) => 
                typeof order.store === 'object' ? order.store.name : order.store
            },
            {
              key: 'items',
              header: 'Items',
              render: (order: PurchaseOrder) => order.items.length
            },
            {
              key: 'finalTotal',
              header: 'Total',
              render: (order: PurchaseOrder) => `$${order.finalTotal.toFixed(2)}`
            },
            {
              key: 'status',
              header: 'Estado',
              render: (order: PurchaseOrder) => getStatusBadge(order.status)
            },
            {
              key: 'expectedDeliveryDate',
              header: 'Fecha Esperada',
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
              )
            }
          ]}
          data={orders}
        />
      </Card>
    </div>
  );
}
