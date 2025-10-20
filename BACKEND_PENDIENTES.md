# 🔧 PENDIENTES DEL BACKEND - Guía de Implementación

## 📋 ÍNDICE
1. [Métodos de Pago](#métodos-de-pago)
2. [Usuarios sin Tienda](#usuarios-sin-tienda)
3. [Filtros Automáticos por Tienda](#filtros-automáticos)
4. [Descuento Automático de Inventario](#descuento-inventario)
5. [Endpoints de Estadísticas](#endpoints-estadísticas)
6. [Arquitectura de Productos e Inventario](#arquitectura-productos)

---

## 💳 MÉTODOS DE PAGO

### Actualización del Modelo de Ventas

**Archivo:** `api_store/models/sale_model.py`

```python
from mongoengine import Document, StringField, ListField, EmbeddedDocument, EmbeddedDocumentField, FloatField, DateTimeField, ReferenceField
from datetime import datetime

class SaleProduct(EmbeddedDocument):
    product = ReferenceField('Product', required=True)
    quantity = IntField(required=True, min_value=1)
    price = FloatField(required=True, min_value=0)

class Sale(Document):
    products = ListField(EmbeddedDocumentField(SaleProduct), required=True)
    store = ReferenceField('Store', required=True)
    user = ReferenceField('User', required=True)
    subtotal = FloatField(required=True, min_value=0)
    discount = FloatField(default=0, min_value=0)
    tax = FloatField(required=True, min_value=0)
    total = FloatField(required=True, min_value=0)
    
    # ✨ NUEVO: Campo de método de pago
    paymentMethod = StringField(
        required=True,
        choices=[
            'efectivo',
            'nequi',
            'daviplata',
            'llave_bancolombia',
            'tarjeta',
            'transferencia'
        ],
        default='efectivo'
    )
    
    createdAt = DateTimeField(default=datetime.utcnow)
    updatedAt = DateTimeField(default=datetime.utcnow)
    
    meta = {
        'collection': 'sales',
        'ordering': ['-createdAt']
    }
```

### Validación en el Controller

**Archivo:** `api_store/controllers/sale_controller.py`

```python
from flask import request, jsonify
from utils.auth_decorators import token_required, role_required

@sale_bp.route('/sales', methods=['POST'])
@token_required
def create_sale(current_user):
    """Crear nueva venta"""
    try:
        data = request.get_json()
        
        # Validar campos requeridos
        required_fields = ['products', 'subtotal', 'tax', 'total']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'message': f'Campo {field} requerido'}), 400
        
        # ✨ NUEVO: Validar método de pago
        payment_method = data.get('paymentMethod', 'efectivo')
        valid_methods = ['efectivo', 'nequi', 'daviplata', 'llave_bancolombia', 'tarjeta', 'transferencia']
        
        if payment_method not in valid_methods:
            return jsonify({
                'success': False, 
                'message': f'Método de pago inválido. Opciones: {", ".join(valid_methods)}'
            }), 400
        
        # Detectar tienda del usuario
        store_id = current_user.store.id if current_user.role != 'admin' else data.get('store')
        if not store_id:
            return jsonify({'success': False, 'message': 'Tienda no especificada'}), 400
        
        # Crear venta con el método de pago
        sale_data = {
            'products': data['products'],
            'store': store_id,
            'user': current_user.id,
            'subtotal': data['subtotal'],
            'discount': data.get('discount', 0),
            'tax': data['tax'],
            'total': data['total'],
            'paymentMethod': payment_method  # ✨ NUEVO
        }
        
        # Llamar al servicio para crear venta
        sale = SaleService.create_sale(sale_data)
        
        return jsonify({
            'success': True,
            'message': 'Venta registrada exitosamente',
            'data': {'sale': sale.to_dict()}
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
```

---

## 👤 USUARIOS SIN TIENDA

### Actualización del Modelo de Usuario

**Archivo:** `api_store/models/user_model.py`

```python
class User(Document):
    name = StringField(required=True)
    email = StringField(required=True, unique=True)
    password = StringField(required=True)
    role = StringField(
        required=True,
        choices=['admin', 'manager', 'user'],
        default='user'
    )
    
    # ✨ ACTUALIZADO: Tienda ahora es opcional
    store = ReferenceField('Store', required=False, default=None)  # ← Cambio aquí
    
    active = BooleanField(default=True)
    createdAt = DateTimeField(default=datetime.utcnow)
    updatedAt = DateTimeField(default=datetime.utcnow)
```

### Validación en el Controller

**Archivo:** `api_store/controllers/user_controller.py`

```python
@user_bp.route('/users', methods=['POST'])
@token_required
@role_required(['admin'])
def create_user(current_user):
    """Crear nuevo usuario"""
    try:
        data = request.get_json()
        
        # Validar campos requeridos
        required_fields = ['name', 'email', 'password', 'role']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'message': f'Campo {field} requerido'}), 400
        
        # ✨ ACTUALIZADO: Validar que solo admin puede tener store null
        if data['role'] != 'admin' and not data.get('store'):
            # ⚠️ IMPORTANTE: Ahora permitimos null, pero damos advertencia
            print(f"⚠️ Usuario {data['email']} creado sin tienda asignada")
        
        # Si no es admin y tiene tienda, validar que existe
        if data.get('store'):
            store = Store.objects(id=data['store'], active=True).first()
            if not store:
                return jsonify({'success': False, 'message': 'Tienda no encontrada'}), 404
        
        # Crear usuario (store puede ser None)
        user_data = {
            'name': data['name'],
            'email': data['email'],
            'password': hash_password(data['password']),
            'role': data['role'],
            'store': data.get('store'),  # ✨ Puede ser None ahora
            'active': data.get('active', True)
        }
        
        user = UserService.create_user(user_data)
        
        return jsonify({
            'success': True,
            'message': 'Usuario creado exitosamente',
            'data': {'user': user.to_dict()}
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@user_bp.route('/users/<user_id>/assign-store', methods=['PATCH'])
@token_required
@role_required(['admin', 'manager'])
def assign_store(current_user, user_id):
    """✨ NUEVO: Asignar/cambiar tienda de un usuario"""
    try:
        data = request.get_json()
        store_id = data.get('storeId')
        
        if not store_id:
            return jsonify({'success': False, 'message': 'storeId requerido'}), 400
        
        user = User.objects(id=user_id).first()
        if not user:
            return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404
        
        store = Store.objects(id=store_id, active=True).first()
        if not store:
            return jsonify({'success': False, 'message': 'Tienda no encontrada'}), 404
        
        # Actualizar tienda del usuario
        user.update(store=store, updatedAt=datetime.utcnow())
        user.reload()
        
        return jsonify({
            'success': True,
            'message': f'Usuario asignado a {store.name} exitosamente',
            'data': {'user': user.to_dict()}
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
```

---

## 🔍 FILTROS AUTOMÁTICOS POR TIENDA

### Middleware de Filtrado

**Archivo:** `api_store/utils/auth_decorators.py`

```python
def store_filter(f):
    """
    Decorador que agrega automáticamente filtro por tienda
    si el usuario no es admin
    """
    @wraps(f)
    def decorated_function(current_user, *args, **kwargs):
        # Si no es admin, agregar store_id a kwargs
        if current_user.role != 'admin':
            if not current_user.store:
                return jsonify({
                    'success': False,
                    'message': 'No tienes una tienda asignada. Contacta al administrador.'
                }), 403
            
            kwargs['store_filter'] = current_user.store.id
        else:
            kwargs['store_filter'] = None
        
        return f(current_user, *args, **kwargs)
    
    return decorated_function
```

### Ejemplo de Uso en Products Controller

**Archivo:** `api_store/controllers/product_controller.py`

```python
@product_bp.route('/products', methods=['GET'])
@token_required
@store_filter  # ✨ NUEVO: Filtro automático
def get_products(current_user, store_filter=None):
    """Obtener lista de productos"""
    try:
        # Construir query base
        query = {'active': True}
        
        # ✨ Aplicar filtro de tienda si no es admin
        if store_filter:
            query['store'] = store_filter
        
        # Obtener parámetros de búsqueda
        search = request.args.get('search', '')
        category = request.args.get('category', '')
        
        if search:
            query['$or'] = [
                {'name': {'$regex': search, '$options': 'i'}},
                {'sku': {'$regex': search, '$options': 'i'}}
            ]
        
        if category:
            query['category'] = category
        
        products = Product.objects(**query)
        
        return jsonify({
            'success': True,
            'data': {
                'products': [p.to_dict() for p in products]
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
```

---

## 📉 DESCUENTO AUTOMÁTICO DE INVENTARIO

### Service de Ventas con Descuento Automático

**Archivo:** `api_store/services/sale_service.py`

```python
from datetime import datetime
from models.sale_model import Sale
from models.inventory_model import Inventory, InventoryMovement

class SaleService:
    
    @staticmethod
    def create_sale(sale_data):
        """Crear venta y descontar automáticamente del inventario"""
        
        # 1. Crear la venta
        sale = Sale(**sale_data)
        sale.save()
        
        try:
            # 2. ✨ Descontar del inventario por cada producto
            for item in sale_data['products']:
                product_id = item['product']
                quantity = item['quantity']
                store_id = sale_data['store']
                
                # Buscar inventario del producto en la tienda
                inventory = Inventory.objects(
                    product=product_id,
                    store=store_id
                ).first()
                
                if not inventory:
                    raise Exception(f'Inventario no encontrado para producto {product_id} en tienda {store_id}')
                
                if inventory.currentStock < quantity:
                    raise Exception(f'Stock insuficiente para {inventory.product.name}. Disponible: {inventory.currentStock}, Solicitado: {quantity}')
                
                # Descontar del stock
                new_stock = inventory.currentStock - quantity
                inventory.update(
                    currentStock=new_stock,
                    updatedAt=datetime.utcnow()
                )
                
                # Crear movimiento de inventario
                movement = InventoryMovement(
                    inventory=inventory,
                    type='salida',
                    quantity=quantity,
                    previousStock=inventory.currentStock,
                    newStock=new_stock,
                    reason=f'Venta #{sale.id}',
                    user=sale.user,
                    createdAt=datetime.utcnow()
                )
                movement.save()
            
            return sale
            
        except Exception as e:
            # Si falla, eliminar la venta creada
            sale.delete()
            raise e
```

---

## 📊 ENDPOINTS DE ESTADÍSTICAS

### Dashboard Stats - Payment Methods

**Archivo:** `api_store/controllers/dashboard_controller.py`

```python
@dashboard_bp.route('/dashboard/payment-methods', methods=['GET'])
@token_required
@store_filter
def get_payment_methods_stats(current_user, store_filter=None):
    """✨ NUEVO: Estadísticas por método de pago del día actual"""
    try:
        from datetime import datetime, timedelta
        
        # Obtener inicio y fin del día actual
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        # Query base
        match_query = {
            'createdAt': {
                '$gte': today_start,
                '$lt': today_end
            }
        }
        
        # Filtrar por tienda si no es admin
        if store_filter:
            match_query['store'] = ObjectId(store_filter)
        
        # Agregación por método de pago
        pipeline = [
            {'$match': match_query},
            {
                '$group': {
                    '_id': '$paymentMethod',
                    'total': {'$sum': '$total'},
                    'count': {'$sum': 1}
                }
            },
            {
                '$project': {
                    'method': '$_id',
                    'total': 1,
                    'count': 1,
                    '_id': 0
                }
            }
        ]
        
        results = list(Sale.objects.aggregate(pipeline))
        
        # Calcular porcentajes
        grand_total = sum(r['total'] for r in results)
        
        for r in results:
            r['percentage'] = (r['total'] / grand_total * 100) if grand_total > 0 else 0
        
        # Asegurar que todos los métodos estén presentes (incluso con $0)
        all_methods = ['efectivo', 'nequi', 'daviplata', 'llave_bancolombia', 'tarjeta', 'transferencia']
        existing_methods = {r['method'] for r in results}
        
        for method in all_methods:
            if method not in existing_methods:
                results.append({
                    'method': method,
                    'total': 0,
                    'count': 0,
                    'percentage': 0
                })
        
        # Ordenar por total descendente
        results.sort(key=lambda x: x['total'], reverse=True)
        
        return jsonify({
            'success': True,
            'data': results
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
```

---

## 🏗️ ARQUITECTURA DE PRODUCTOS E INVENTARIO

### Modelo Recomendado: Productos Globales + Inventario por Tienda

#### Modelo de Producto (Global)

**Archivo:** `api_store/models/product_model.py`

```python
class Product(Document):
    """
    Producto GLOBAL - existe UNA sola vez en el sistema
    No tiene relación directa con tiendas
    """
    name = StringField(required=True)
    description = StringField()
    sku = StringField(required=True, unique=True)
    barcode = StringField()
    category = StringField(required=True)
    price = FloatField(required=True, min_value=0)
    cost = FloatField(required=True, min_value=0)
    image = StringField()
    active = BooleanField(default=True)
    createdAt = DateTimeField(default=datetime.utcnow)
    updatedAt = DateTimeField(default=datetime.utcnow)
    
    meta = {
        'collection': 'products',
        'ordering': ['name']
    }
```

#### Modelo de Inventario (Por Tienda)

**Archivo:** `api_store/models/inventory_model.py`

```python
class Inventory(Document):
    """
    Inventario POR TIENDA
    Relaciona un producto con una tienda y su stock
    """
    product = ReferenceField('Product', required=True)
    store = ReferenceField('Store', required=True)
    currentStock = IntField(required=True, default=0, min_value=0)
    minStock = IntField(default=10, min_value=0)
    maxStock = IntField(default=100, min_value=0)
    lastRestockDate = DateTimeField()
    createdAt = DateTimeField(default=datetime.utcnow)
    updatedAt = DateTimeField(default=datetime.utcnow)
    
    meta = {
        'collection': 'inventory',
        'indexes': [
            {'fields': ['product', 'store'], 'unique': True}  # Un producto por tienda
        ]
    }

class InventoryMovement(Document):
    """Historial de movimientos de inventario"""
    inventory = ReferenceField('Inventory', required=True)
    type = StringField(required=True, choices=['entrada', 'salida', 'ajuste', 'transferencia'])
    quantity = IntField(required=True)
    previousStock = IntField(required=True)
    newStock = IntField(required=True)
    reason = StringField(required=True)
    user = ReferenceField('User', required=True)
    relatedTransfer = ReferenceField('InventoryTransfer')  # Si es transferencia
    createdAt = DateTimeField(default=datetime.utcnow)
    
    meta = {
        'collection': 'inventory_movements',
        'ordering': ['-createdAt']
    }
```

### Flujo de Creación de Producto

1. **Admin crea producto global:**
   ```python
   POST /products
   {
       "name": "Zapato Nike Air",
       "sku": "ZAP-001",
       "category": "Calzado",
       "price": 150000,
       "cost": 80000
   }
   ```

2. **Sistema crea inventario para cada tienda existente:**
   ```python
   # Automáticamente después de crear producto
   for store in Store.objects(active=True):
       Inventory(
           product=new_product,
           store=store,
           currentStock=0,  # Inicia en 0
           minStock=10,
           maxStock=100
       ).save()
   ```

3. **Gerente ajusta stock inicial:**
   ```python
   PATCH /inventory/{inventory_id}/adjust
   {
       "quantity": 50,
       "type": "entrada",
       "reason": "Stock inicial"
   }
   ```

### Ventajas de esta Arquitectura

✅ **Producto existe UNA sola vez** → No duplicación  
✅ **Cambiar precio afecta todas las tiendas** → Consistencia  
✅ **Transferencias entre tiendas simples** → Solo mover stock  
✅ **Reportes consolidados fáciles** → Un solo catálogo  
✅ **Escalable** → Agregar nuevas tiendas sin duplicar productos

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Fase 1: Métodos de Pago (Urgente)
- [ ] Actualizar modelo `Sale` con campo `paymentMethod`
- [ ] Validar métodos de pago en controller
- [ ] Crear endpoint `/dashboard/payment-methods`
- [ ] Migrar ventas existentes (agregar `paymentMethod: 'efectivo'`)

### Fase 2: Usuarios sin Tienda
- [ ] Actualizar modelo `User` (store opcional)
- [ ] Actualizar validaciones en user controller
- [ ] Crear endpoint `/users/<id>/assign-store`
- [ ] Migrar usuarios existentes

### Fase 3: Filtros Automáticos
- [ ] Crear decorador `@store_filter`
- [ ] Aplicar en productos, inventario, ventas
- [ ] Validar que usuario sin tienda reciba error 403

### Fase 4: Descuento Automático
- [ ] Implementar descuento en `SaleService.create_sale()`
- [ ] Crear movimientos de inventario automáticos
- [ ] Validar stock disponible antes de vender
- [ ] Rollback de venta si falla descuento

### Fase 5: Arquitectura de Inventario
- [ ] Verificar modelo `Product` (sin referencia a tienda)
- [ ] Verificar modelo `Inventory` (producto + tienda)
- [ ] Crear inventarios automáticamente al crear producto
- [ ] Implementar transferencias entre tiendas

---

## 🚨 IMPORTANTE

1. **Hacer backup de la base de datos antes de cualquier cambio**
2. **Probar en ambiente de desarrollo primero**
3. **Migrar datos existentes con scripts cuidadosos**
4. **Comunicar cambios al equipo**

---

## 📞 SOPORTE

Si tienes dudas sobre la implementación, revisa:
- `ARQUITECTURA_Y_ROLES.md` - Explicación de roles y flujos
- `README.md` - Documentación general del proyecto
