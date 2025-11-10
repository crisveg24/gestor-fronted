import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import type { Supplier, ApiResponse } from '../types';
import { Card, Button, ResponsiveTable, Modal, SearchBar, Loading } from '../components/ui';
import type { Column } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function SuppliersPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Colombia',
    taxId: '',
    categories: '',
    paymentTerms: 'Contado',
    website: '',
    notes: '',
    rating: 5
  });

  useEffect(() => {
    fetchSuppliers();
  }, [searchTerm]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const params = searchTerm ? { search: searchTerm } : {};
      const response = await api.get<ApiResponse<{ suppliers: Supplier[] }>>('/suppliers', { params });
      setSuppliers(response.data.data.suppliers);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        categories: formData.categories.split(',').map(c => c.trim()).filter(c => c)
      };

      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier._id}`, payload);
        toast.success('Proveedor actualizado');
      } else {
        await api.post('/suppliers', payload);
        toast.success('Proveedor creado');
      }
      
      setShowModal(false);
      resetForm();
      fetchSuppliers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al guardar proveedor');
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactName: supplier.contactName,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address || '',
      city: supplier.city || '',
      country: supplier.country || 'Colombia',
      taxId: supplier.taxId || '',
      categories: supplier.categories.join(', '),
      paymentTerms: supplier.paymentTerms || 'Contado',
      website: supplier.website || '',
      notes: supplier.notes || '',
      rating: supplier.rating || 5
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de desactivar este proveedor?')) return;
    
    try {
      await api.delete(`/suppliers/${id}`);
      toast.success('Proveedor desactivado');
      fetchSuppliers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al desactivar proveedor');
    }
  };

  const resetForm = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: 'Colombia',
      taxId: '',
      categories: '',
      paymentTerms: 'Contado',
      website: '',
      notes: '',
      rating: 5
    });
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Proveedores</h1>
        {user?.role === 'admin' && (
          <Button onClick={() => { resetForm(); setShowModal(true); }}>
            + Nuevo Proveedor
          </Button>
        )}
      </div>

      <Card>
        <div className="mb-4">
          <SearchBar
            onSearch={setSearchTerm}
            placeholder="Buscar por nombre, contacto o email..."
          />
        </div>

        <ResponsiveTable
          columns={[
            {
              key: 'name',
              header: 'Proveedor',
              render: (supplier: Supplier) => (
                <div>
                  <div className="font-medium">{supplier.name}</div>
                  <div className="text-sm text-gray-500">{supplier.city}</div>
                </div>
              ),
              mobileRender: (supplier: Supplier) => (
                <div>
                  <div className="font-semibold text-gray-900">{supplier.name}</div>
                  <div className="text-xs text-gray-500">{supplier.contactName}</div>
                </div>
              )
            },
            { 
              key: 'contactName', 
              header: 'Contacto',
              hideOnMobile: true
            },
            {
              key: 'email',
              header: 'Email',
              hideOnMobile: true,
              render: (supplier: Supplier) => (
                <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline">
                  {supplier.email}
                </a>
              )
            },
            {
              key: 'phone',
              header: 'Teléfono',
              render: (supplier: Supplier) => (
                <a href={`tel:${supplier.phone}`} className="text-blue-600 hover:underline">
                  {supplier.phone}
                </a>
              )
            },
            {
              key: 'categories',
              header: 'Categorías',
              hideOnMobile: true,
              render: (supplier: Supplier) => (
                <div className="flex flex-wrap gap-1">
                  {supplier.categories.slice(0, 2).map((cat: string) => (
                    <span key={cat} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                      {cat}
                    </span>
                  ))}
                  {supplier.categories.length > 2 && (
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                      +{supplier.categories.length - 2}
                    </span>
                  )}
                </div>
              )
            },
            {
              key: 'rating',
              header: 'Calificación',
              hideOnMobile: true,
              render: (supplier: Supplier) => (
                <div className="flex items-center">
                  {supplier.rating ? (
                    <>
                      <span className="text-yellow-500">★</span>
                      <span className="ml-1">{supplier.rating}/5</span>
                    </>
                  ) : (
                    <span className="text-gray-400">Sin calificar</span>
                  )}
                </div>
              )
            },
            {
              key: 'actions',
              header: 'Acciones',
              render: (supplier: Supplier) => (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/purchase-orders/new?supplier=${supplier._id}`)}
                  >
                    Crear Orden
                  </Button>
                  {user?.role === 'admin' && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => handleEdit(supplier)}>
                        Editar
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(supplier._id)}>
                        Desactivar
                      </Button>
                    </>
                  )}
                </div>
              ),
              mobileRender: (supplier: Supplier) => (
                <div className="flex flex-col gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/purchase-orders/new?supplier=${supplier._id}`)}
                    className="w-full"
                  >
                    Crear Orden
                  </Button>
                  {user?.role === 'admin' && (
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => handleEdit(supplier)} className="flex-1">
                        Editar
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(supplier._id)} className="flex-1">
                        Desactivar
                      </Button>
                    </div>
                  )}
                </div>
              )
            }
          ] as Column<Supplier>[]}
          data={suppliers}
        />
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        title={editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de la Empresa *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Contacto *
              </label>
              <input
                type="text"
                required
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NIT/RUT</label>
              <input
                type="text"
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categorías (separadas por coma)
            </label>
            <input
              type="text"
              value={formData.categories}
              onChange={(e) => setFormData({ ...formData, categories: e.target.value })}
              placeholder="Electrónica, Computadoras, Accesorios"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Términos de Pago
              </label>
              <input
                type="text"
                value={formData.paymentTerms}
                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Calificación (1-5)
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sitio Web</label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button type="submit">
              {editingSupplier ? 'Actualizar' : 'Crear'} Proveedor
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
