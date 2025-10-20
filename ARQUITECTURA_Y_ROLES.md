# 📋 RECOMENDACIONES Y ARQUITECTURA DEL SISTEMA

## 🏢 **ROLES Y PERMISOS - Definición Detallada**

### 1. **Administrador** 🛡️
**Descripción:** Dueño o gerente general del negocio con acceso total.

**Características:**
- ✅ **NO requiere tienda asignada** (ve TODAS las tiendas)
- ✅ Acceso completo al sistema
- ✅ Puede ver datos consolidados de todas las tiendas

**Permisos:**
- ✅ Dashboard consolidado (todas las tiendas)
- ✅ CRUD completo de Productos (todas las tiendas)
- ✅ CRUD completo de Inventario (todas las tiendas)
- ✅ CRUD completo de Ventas (puede ver todas)
- ✅ CRUD completo de Tiendas ⭐
- ✅ CRUD completo de Usuarios ⭐
- ✅ Reportes consolidados (todas las tiendas) ⭐
- ✅ Transferencias entre tiendas ⭐

---

### 2. **Gerente** 👔
**Descripción:** Encargado de una tienda específica, supervisa operaciones.

**Características:**
- ⚠️ **Requiere tienda asignada**
- ⚠️ Solo ve datos de SU tienda
- ⚠️ Puede reasignarse a otra tienda (por admin)

**Permisos:**
- ✅ Dashboard de su tienda
- ✅ Ver/Crear/Editar Productos de su tienda
- ✅ Gestionar Inventario de su tienda (ajustes, ver movimientos)
- ✅ Registrar Ventas en su tienda
- ✅ Ver Reportes de su tienda
- ❌ NO puede crear tiendas
- ❌ NO puede crear usuarios
- ❌ NO puede ver otras tiendas
- ❌ NO puede hacer transferencias entre tiendas

---

### 3. **Usuario/Vendedor** 👤
**Descripción:** Vendedor o cajero que opera en una tienda.

**Características:**
- ⚠️ **Requiere tienda asignada (pero puede estar SIN tienda temporalmente)**
- ⚠️ Solo ve datos de SU tienda
- ⚠️ Puede reasignarse diariamente según turnos
- 🆕 **Si NO tiene tienda asignada:** Ve pantalla vacía con mensaje "Sin tienda asignada"

**Permisos:**
- ✅ Dashboard básico de su tienda (solo estadísticas de lectura)
- ✅ Ver Productos de su tienda (solo lectura)
- ✅ Registrar Ventas en su tienda ⭐
- ✅ Ver Inventario de su tienda (solo lectura)
- ❌ NO puede crear/editar productos
- ❌ NO puede ajustar inventario
- ❌ NO puede ver reportes completos
- ❌ NO puede crear usuarios ni tiendas

---

## 🔄 **FLUJO DE ASIGNACIÓN DE TIENDAS**

### **Escenario Real:**
> "Hoy Camilo trabaja en la tienda de Zapatos, pero mañana le toca en la tienda de Ropa Norte"

### **Implementación:**

1. **Crear Usuario SIN tienda:**
   ```
   Nombre: Camilo
   Email: camilo@empresa.com
   Rol: Usuario
   Tienda: [Sin asignar] ← NUEVO: Ahora es opcional
   ```

2. **Admin asigna tienda del día:**
   - Admin va a "Gestión de Usuarios"
   - Edita a Camilo
   - Selecciona "Tienda Zapatos"
   - Guarda

3. **Al día siguiente, reasignar:**
   - Admin edita a Camilo nuevamente
   - Cambia tienda a "Ropa Norte"
   - Guarda

4. **Si Camilo inicia sesión SIN tienda asignada:**
   - Ve mensaje: "⚠️ No tienes una tienda asignada. Contacta a tu administrador."
   - No puede registrar ventas ni ver inventario
   - Solo ve su perfil

---

## 📦 **REGISTRO DE PRODUCTOS - Arquitectura Recomendada**

### **Opción A: Productos Globales + Inventario por Tienda (RECOMENDADA)**

#### **Cómo funciona:**
1. **Producto es ÚNICO en el sistema:**
   - SKU: "ZAP-001"
   - Nombre: "Zapato Deportivo Nike Air"
   - Categoría: "Calzado"
   - Precio: $1,500
   - Costo: $800

2. **Inventario es POR TIENDA:**
   ```
   Producto: ZAP-001
   ├── Tienda Zapatos Centro: 50 unidades
   ├── Tienda Zapatos Norte: 30 unidades
   └── Tienda Ropa Norte: 0 unidades (no vende zapatos)
   ```

#### **Ventajas:**
- ✅ Un solo catálogo de productos
- ✅ Precios consistentes en todas las tiendas
- ✅ Fácil hacer transferencias entre tiendas
- ✅ Reportes consolidados más simples
- ✅ Si cambia el precio, cambia en todas las tiendas

#### **Flujo de Registro:**
1. Admin/Gerente va a "Productos" → "Nuevo Producto"
2. Llena: Nombre, SKU, Precio, Costo, Categoría
3. El producto se crea **GLOBALMENTE**
4. Admin va a "Inventario" → Selecciona tienda
5. Busca el producto → Agrega stock inicial (ej: 100 unidades)

---

### **Opción B: Productos POR TIENDA (No recomendada)**

#### **Cómo funciona:**
- Cada tienda tiene su propio catálogo de productos
- El mismo producto existe múltiples veces con diferentes IDs

#### **Desventajas:**
- ❌ Duplicación de datos
- ❌ Precios pueden variar entre tiendas (inconsistencia)
- ❌ Difícil hacer transferencias
- ❌ Reportes consolidados complejos

---

## 💰 **REGISTRO DE VENTAS - Flujo Recomendado**

### **Escenario:**
> Usuario "Camilo" está asignado a "Tienda Zapatos", quiere registrar una venta

### **Flujo Paso a Paso:**

1. **Camilo inicia sesión:**
   - Sistema detecta: `user.store = "Tienda Zapatos"`
   - Solo ve productos e inventario de esa tienda

2. **Va a "Ventas" → "Nueva Venta":**
   - **Búsqueda de productos:**
     - Sistema filtra automáticamente por `store = user.store`
     - Solo muestra productos con stock > 0 en su tienda
     - Ejemplo: "Zapato Nike Air (50 disponibles)"

3. **Agrega productos al carrito:**
   ```
   Producto: Zapato Nike Air
   Cantidad: 2
   Precio unitario: $1,500
   Subtotal: $3,000
   ```

4. **Calcula totales:**
   ```
   Subtotal: $3,000
   Descuento: $200 (opcional)
   Subtotal con descuento: $2,800
   IVA (16%): $448
   Total: $3,248
   ```

5. **Selecciona método de pago:**
   - Efectivo
   - Tarjeta
   - Transferencia

6. **Confirma venta:**
   - Sistema registra venta vinculada a:
     - Usuario: Camilo
     - Tienda: Zapatos
     - Productos vendidos
     - Total
     - Método de pago
   - **Descuenta automáticamente del inventario**
   - Genera movimiento en historial de inventario

### **Importante:**
- ✅ El descuento de inventario debe ser **AUTOMÁTICO**
- ✅ Debe registrar quién vendió (user_id)
- ✅ Debe registrar en qué tienda (store_id)
- ✅ Debe generar movimiento de inventario tipo "salida"

---

## 🔄 **TRANSFERENCIAS ENTRE TIENDAS - Flujo**

### **Escenario:**
> Admin quiere transferir 20 unidades de "Zapato Nike Air" de Tienda Centro a Tienda Norte

### **Flujo:**

1. **Admin va a "Inventario":**
   - Selecciona "Tienda Centro"
   - Busca "Zapato Nike Air"
   - Ve: Stock actual = 50

2. **Click en "Transferir":**
   ```
   Origen: Tienda Centro (50 disponibles)
   Destino: [Selector] → Tienda Norte
   Cantidad: 20
   ```

3. **Confirma transferencia:**
   - Sistema valida: 20 ≤ 50 ✅
   - **Descuenta 20 de Tienda Centro** (50 → 30)
   - **Suma 20 a Tienda Norte** (30 → 50)
   - Registra 2 movimientos:
     - Tienda Centro: Tipo "salida", Motivo "Transferencia a Tienda Norte"
     - Tienda Norte: Tipo "entrada", Motivo "Transferencia desde Tienda Centro"

---

## 🚫 **RESTRICCIONES POR ROL**

### **Usuario SIN tienda asignada:**
```javascript
if (!user.store) {
  return (
    <div className="flex items-center justify-center h-screen">
      <Card>
        <AlertTriangle size={48} className="text-orange-500 mx-auto mb-4" />
        <h2>Sin Tienda Asignada</h2>
        <p>No tienes una tienda asignada actualmente.</p>
        <p>Contacta a tu administrador para que te asigne a una tienda.</p>
      </Card>
    </div>
  );
}
```

### **Gerente intentando ver otra tienda:**
```javascript
// En todas las queries, agregar filtro automático
const { data: products } = useQuery({
  queryKey: ['products'],
  queryFn: async () => {
    const params = user.role !== 'admin' 
      ? { store: user.store._id }  // ← Filtro automático
      : {};
    const response = await api.get('/products', { params });
    return response.data;
  },
});
```

---

## 📊 **REPORTES - Visibilidad por Rol**

### **Admin:**
- ✅ Ve reportes de TODAS las tiendas
- ✅ Puede filtrar por tienda específica
- ✅ Ve comparativas entre tiendas

### **Gerente/Usuario:**
- ⚠️ Solo ve reportes de SU tienda
- ⚠️ Filtro de tienda deshabilitado (pre-seleccionado)

---

## ✅ **CAMBIOS IMPLEMENTADOS HOY**

1. ✅ Usuario puede crearse SIN tienda asignada
2. ✅ Campo "Tienda" cambió de REQUERIDO a OPCIONAL
3. ✅ Mensaje de ayuda: "Puedes dejar sin tienda y asignarla después según el turno del día"
4. ✅ Validaciones de backend deben actualizarse para aceptar `store: null`

---

## 🔧 **PENDIENTES DEL BACKEND**

### **1. Endpoint de Crear Tienda:**
- Verificar que reciba correctamente:
  - name (string, required)
  - address (string, required)
  - phone (string, required)
  - manager (ObjectId, optional)

### **2. Endpoint de Crear Usuario:**
- Actualizar validación para aceptar `store: null`
- Solo requerir tienda si el rol !== 'admin'

### **3. Endpoints de Productos:**
- Agregar filtro automático por tienda según rol del usuario
- Si role === 'admin': sin filtro
- Si role !== 'admin': filtrar por user.store

### **4. Endpoint de Ventas:**
- Auto-detectar tienda del usuario logueado
- Descontar automáticamente del inventario
- Crear movimiento de inventario tipo "salida"

### **5. Endpoint de Transferencias:**
- Validar que solo admin pueda transferir
- Validar que cantidad ≤ stock disponible
- Actualizar ambos inventarios en transacción atómica
- Crear 2 movimientos (salida + entrada)

---

## 📞 **SIGUIENTE PASO**

¿Quieres que continue con alguno de estos puntos?

1. ✅ Hacer commit de los cambios actuales
2. 🔍 Revisar error de crear tiendas
3. 🚫 Implementar pantalla para usuarios sin tienda
4. 📦 Ajustar flujo de registro de productos
5. 💰 Ajustar flujo de registro de ventas
