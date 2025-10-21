import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save } from 'lucide-react';
import { Card, Button, toast } from '../components/ui';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';

// Esquema de validación
const productSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
  sku: z.string().min(3, 'El SKU debe tener al menos 3 caracteres'),
  barcode: z.string().optional().or(z.literal('')),
  category: z.string().min(1, 'La categoría es requerida'),
  price: z.number().positive('El precio debe ser mayor a 0'),
  cost: z.number().positive('El costo debe ser mayor a 0'),
  isActive: z.boolean(),
  // Campos de inventario (solo para crear) - store es requerido cuando no se está editando
  store: z.string().optional(),
  quantity: z.number().min(0).optional(),
  minStock: z.number().min(0).optional(),
  maxStock: z.number().positive().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface Store {
  _id: string;
  name: string;
}

const ProductFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [autoAssignedStore, setAutoAssignedStore] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      isActive: true,
      quantity: 0,
      minStock: 10,
      maxStock: 1000,
    },
  });

  // Query para obtener tiendas (solo para crear productos)
  const { data: stores } = useQuery<Store[]>({
    queryKey: ['stores'],
    queryFn: async () => {
      const response = await api.get('/stores');
      return response.data.data || [];
    },
    enabled: !isEditMode,
  });

  // Auto-asignar tienda si el usuario no es admin
  useEffect(() => {
    if (user && user.role !== 'admin' && user.store && !isEditMode && !autoAssignedStore) {
      setValue('store', user.store._id);
      setAutoAssignedStore(true);
    }
  }, [user, setValue, isEditMode, autoAssignedStore]);

  // Query para obtener producto (solo en modo edición)
  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const response = await api.get(`/products/${id}`);
      return response.data.data;
    },
    enabled: isEditMode,
  });

  // Llenar formulario en modo edición
  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        description: product.description,
        sku: product.sku,
        barcode: product.barcode || '',
        category: product.category,
        price: product.price,
        cost: product.cost,
        isActive: product.isActive,
      });
    }
  }, [product, reset]);

  // Mutation para crear/actualizar
  const mutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      console.log('📡 [PRODUCT] Enviando petición al backend...');
      console.log('📡 [PRODUCT] URL:', isEditMode ? `/products/${id}` : '/products/with-inventory');
      console.log('📡 [PRODUCT] Método:', isEditMode ? 'PUT' : 'POST');
      console.log('📡 [PRODUCT] Payload:', JSON.stringify(data, null, 2));

      try {
        if (isEditMode) {
          const response = await api.put(`/products/${id}`, data);
          console.log('✅ [PRODUCT] Respuesta exitosa (edición):', response.data);
          return response.data;
        } else {
          // Usar el nuevo endpoint para crear producto con inventario
          const response = await api.post('/products/with-inventory', data);
          console.log('✅ [PRODUCT] Respuesta exitosa (creación):', response.data);
          return response.data;
        }
      } catch (error: any) {
        console.error('❌ [PRODUCT] Error en la petición:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        });
        throw error;
      }
    },
    onSuccess: () => {
      console.log('✅ [PRODUCT] Operación exitosa, invalidando queries...');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(
        isEditMode ? 'Producto actualizado exitosamente' : 'Producto creado exitosamente'
      );
      navigate('/productos');
    },
    onError: (error: any) => {
      console.error('❌ [PRODUCT] Error en onError:', error);
      toast.error(error.response?.data?.message || 'Error al guardar el producto');
    },
  });

  const onSubmit = (data: ProductFormData) => {
    console.log('🛍️ [PRODUCT] ========== INICIO ENVÍO FORMULARIO ==========');
    console.log('🛍️ [PRODUCT] Datos del formulario (raw):', data);
    console.log('🛍️ [PRODUCT] Usuario actual:', { 
      role: user?.role, 
      storeId: user?.store?._id,
      storeName: user?.store?.name,
      hasStore: !!user?.store,
    });

    // NO usar modo edición para crear productos
    if (isEditMode) {
      console.log('🛍️ [PRODUCT] Modo edición - enviando sin inventario');
      mutation.mutate(data);
      return;
    }

    // Construir payload con validaciones estrictas
    const productData: any = {
      name: String(data.name).trim(),
      description: String(data.description).trim(),
      sku: String(data.sku).trim(),
      category: String(data.category).trim(),
      price: Number(data.price),
      cost: Number(data.cost),
      isActive: Boolean(data.isActive),
    };

    // Agregar barcode solo si existe
    if (data.barcode && data.barcode.trim() !== '') {
      productData.barcode = String(data.barcode).trim();
    }

    console.log('🛍️ [PRODUCT] Datos del producto procesados:', productData);

    // DETERMINAR TIENDA (CRÍTICO)
    let storeId: string | undefined;

    // Caso 1: Store viene del formulario (admin lo seleccionó)
    if (data.store && data.store.trim() !== '') {
      storeId = String(data.store).trim();
      console.log('✅ [PRODUCT] Tienda del formulario:', storeId);
    }
    // Caso 2: Usuario tiene tienda asignada (no es admin)
    else if (user && user.store && user.store._id) {
      storeId = String(user.store._id).trim();
      console.log('✅ [PRODUCT] Tienda del usuario:', storeId);
    }
    // Caso 3: No hay tienda - ERROR
    else {
      console.error('❌ [PRODUCT] No se pudo determinar la tienda');
      console.error('❌ [PRODUCT] data.store:', data.store);
      console.error('❌ [PRODUCT] user.store:', user?.store);
      toast.error('Debes seleccionar una tienda para el producto');
      return;
    }

    // Validar que storeId no sea undefined
    if (!storeId || storeId === '') {
      console.error('❌ [PRODUCT] storeId está vacío después de validaciones');
      toast.error('Error: ID de tienda inválido');
      return;
    }

    productData.store = storeId;

    // Agregar campos de inventario con defaults
    productData.quantity = Number(data.quantity !== undefined ? data.quantity : 0);
    productData.minStock = Number(data.minStock !== undefined ? data.minStock : 10);
    productData.maxStock = Number(data.maxStock !== undefined ? data.maxStock : 1000);

    console.log('🛍️ [PRODUCT] ========== DATOS FINALES ==========');
    console.log('🛍️ [PRODUCT] Payload completo:', productData);
    console.log('🛍️ [PRODUCT] Tipos de datos:', {
      name: typeof productData.name,
      description: typeof productData.description,
      sku: typeof productData.sku,
      category: typeof productData.category,
      price: typeof productData.price,
      cost: typeof productData.cost,
      store: typeof productData.store,
      quantity: typeof productData.quantity,
      minStock: typeof productData.minStock,
      maxStock: typeof productData.maxStock,
      isActive: typeof productData.isActive,
    });
    console.log('🛍️ [PRODUCT] Valores:', {
      store: productData.store,
      storeLength: productData.store?.length,
      quantity: productData.quantity,
    });
    console.log('🛍️ [PRODUCT] ========== ENVIANDO A MUTACIÓN ==========');

    mutation.mutate(productData);
  };

  // Calcular margen
  const price = watch('price');
  const cost = watch('cost');
  const margin = price && cost ? ((price - cost) / price) * 100 : 0;

  if (isEditMode && isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando producto...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={() => navigate('/productos')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Volver a productos</span>
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditMode ? 'Editar Producto' : 'Nuevo Producto'}
        </h1>
        <p className="text-gray-600 mt-1">
          {isEditMode
            ? 'Actualiza la información del producto'
            : 'Completa el formulario para agregar un nuevo producto'}
        </p>
      </motion.div>

      {/* Formulario */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <Card>
            <Card.Header>
              <h3 className="text-lg font-semibold text-gray-900">Información del Producto</h3>
            </Card.Header>
            <Card.Body className="space-y-6">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  {...register('name')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Ej: Laptop Dell Inspiron"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción *
                </label>
                <textarea
                  {...register('description')}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Describe las características del producto"
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              {/* SKU y Código de Barras */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SKU *
                  </label>
                  <input
                    type="text"
                    {...register('sku')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                    placeholder="Ej: LAPTOP-001"
                  />
                  {errors.sku && (
                    <p className="mt-1 text-sm text-red-600">{errors.sku.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Código de Barras
                  </label>
                  <input
                    type="text"
                    {...register('barcode')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                    placeholder="Ej: 1234567890123"
                  />
                  {errors.barcode && (
                    <p className="mt-1 text-sm text-red-600">{errors.barcode.message}</p>
                  )}
                </div>
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoría *
                </label>
                <select
                  {...register('category')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Selecciona una categoría</option>
                  <option value="Electrónicos">Electrónicos</option>
                  <option value="Ropa">Ropa</option>
                  <option value="Alimentos">Alimentos</option>
                  <option value="Hogar">Hogar</option>
                  <option value="Deportes">Deportes</option>
                  <option value="Juguetes">Juguetes</option>
                  <option value="Libros">Libros</option>
                  <option value="Otros">Otros</option>
                </select>
                {errors.category && (
                  <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
                )}
              </div>

              {/* Precio y Costo */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Costo *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      {...register('cost', { valueAsNumber: true })}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="0.00"
                    />
                  </div>
                  {errors.cost && (
                    <p className="mt-1 text-sm text-red-600">{errors.cost.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Precio de Venta *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      {...register('price', { valueAsNumber: true })}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="0.00"
                    />
                  </div>
                  {errors.price && (
                    <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Margen
                  </label>
                  <div className="h-10 flex items-center">
                    <span
                      className={`text-lg font-semibold ${
                        margin > 0 ? 'text-green-600' : 'text-gray-400'
                      }`}
                    >
                      {margin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Campos de Inventario (solo al crear) */}
              {!isEditMode && (
                <>
                  <div className="border-t pt-6">
                    <h4 className="text-md font-semibold text-gray-900 mb-4">Información de Inventario</h4>
                  </div>

                  {/* Tienda */}
                  {user?.role === 'admin' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tienda *
                      </label>
                      <select
                        {...register('store')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Selecciona una tienda</option>
                        {stores?.map((store) => (
                          <option key={store._id} value={store._id}>
                            {store.name}
                          </option>
                        ))}
                      </select>
                      {errors.store && (
                        <p className="mt-1 text-sm text-red-600">{errors.store.message}</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tienda
                      </label>
                      <input
                        type="text"
                        value={user?.store?.name || ''}
                        disabled
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        El producto se asignará automáticamente a tu tienda
                      </p>
                    </div>
                  )}

                  {/* Cantidad, Stock Mínimo y Máximo */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cantidad Inicial *
                      </label>
                      <input
                        type="number"
                        {...register('quantity', { valueAsNumber: true })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="0"
                      />
                      {errors.quantity && (
                        <p className="mt-1 text-sm text-red-600">{errors.quantity.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Stock Mínimo
                      </label>
                      <input
                        type="number"
                        {...register('minStock', { valueAsNumber: true })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="10"
                      />
                      {errors.minStock && (
                        <p className="mt-1 text-sm text-red-600">{errors.minStock.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Stock Máximo
                      </label>
                      <input
                        type="number"
                        {...register('maxStock', { valueAsNumber: true })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="1000"
                      />
                      {errors.maxStock && (
                        <p className="mt-1 text-sm text-red-600">{errors.maxStock.message}</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Estado */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  {...register('isActive')}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Producto activo
                </label>
              </div>
            </Card.Body>

            <Card.Footer>
              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/productos')}
                  disabled={mutation.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" isLoading={mutation.isPending}>
                  <Save size={18} />
                  {isEditMode ? 'Actualizar' : 'Crear'} Producto
                </Button>
              </div>
            </Card.Footer>
          </Card>
        </form>
      </motion.div>
    </div>
  );
};

export default ProductFormPage;
