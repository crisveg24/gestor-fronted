# 💰 CORTE DE CAJA DIARIO - Procedimiento

## 📋 ¿Qué es el Corte de Caja?

El **corte de caja** es el proceso de cierre diario donde se:
1. Cuentan las ventas del día
2. Se verifica el efectivo físico
3. Se registran los pagos digitales
4. Se compara con lo registrado en el sistema
5. Se detectan diferencias (faltantes o sobrantes)

---

## 🕐 ¿CUÁNDO SE HACE?

**Al final del turno o día:**
- Tiendas 24/7: Al final de cada turno (mañana, tarde, noche)
- Tiendas regulares: Al cerrar (generalmente 7-8 PM)
- Fines de semana: Domingo en la noche para resumen semanal

---

## 👥 ¿QUIÉN LO HACE?

1. **Vendedor/Cajero:** Cuenta el efectivo y organiza comprobantes
2. **Gerente:** Supervisa, verifica y firma el corte
3. **Admin:** Revisa cortes de todas las tiendas desde el sistema

---

## 📝 PROCEDIMIENTO PASO A PASO

### 1️⃣ Generar Reporte del Sistema

**En la aplicación:**
1. Ir a **Dashboard** → **Métodos de Pago**
2. Verificar que muestre las ventas del día actual
3. Anotar los totales:

```
Total del Día: $354,000
├── 💵 Efectivo: $252,800
├── 🟣 Nequi: $58,000
├── 🟠 Daviplata: $30,000
├── 🔑 Llave Bancolombia: $13,200
├── 💳 Tarjeta: $0
└── 🏦 Transferencia: $0
```

### 2️⃣ Contar Efectivo Físico

**Procedimiento:**
1. Sacar TODO el efectivo de la caja registradora
2. Separar billetes y monedas
3. Contar dos veces para verificar
4. Anotar el total contado: **$_______**

**Formato de conteo:**
```
BILLETES:
50,000 x ___ = _______
20,000 x ___ = _______
10,000 x ___ = _______
 5,000 x ___ = _______
 2,000 x ___ = _______
 1,000 x ___ = _______

MONEDAS:
  500 x ___ = _______
  200 x ___ = _______
  100 x ___ = _______
   50 x ___ = _______

TOTAL EFECTIVO: $_______
```

### 3️⃣ Verificar Pagos Digitales

**Para cada método digital:**

#### 🟣 Nequi
1. Abrir app Nequi
2. Ir a "Movimientos" → Filtrar por "Hoy"
3. Sumar todas las entradas del día
4. **Verificar:** ¿Coincide con $58,000? ✅ ❌

#### 🟠 Daviplata
1. Abrir app Daviplata
2. Ver historial del día
3. Sumar todos los ingresos
4. **Verificar:** ¿Coincide con $30,000? ✅ ❌

#### 🔑 Llave Bancolombia
1. Revisar notificaciones de Llave
2. O revisar en app Bancolombia → Transferencias recibidas
3. **Verificar:** ¿Coincide con $13,200? ✅ ❌

#### 💳 Tarjeta (Datafono)
1. Imprimir "Cierre de Lote" del datafono
2. Verificar total del día
3. **Guardar el comprobante**

#### 🏦 Transferencias Bancarias
1. Revisar extracto bancario del día
2. Identificar transferencias recibidas
3. Verificar que coincidan

### 4️⃣ Comparar con el Sistema

**Llenar formato de corte:**

```
═══════════════════════════════════════
      CORTE DE CAJA DIARIO
═══════════════════════════════════════
Fecha: ___/___/_____
Tienda: _________________
Cajero: _________________
Turno: Mañana | Tarde | Noche

───────────────────────────────────────
VENTAS SEGÚN SISTEMA:
───────────────────────────────────────
💵 Efectivo:         $ 252,800
🟣 Nequi:             $  58,000
🟠 Daviplata:         $  30,000
🔑 Llave Bancolombia: $  13,200
💳 Tarjeta:           $       0
🏦 Transferencia:     $       0
                     ──────────
TOTAL SISTEMA:       $ 354,000

───────────────────────────────────────
EFECTIVO CONTADO:
───────────────────────────────────────
Total en Caja:       $ _______

Diferencia:          $ _______
Estado: Exacto | Sobrante | Faltante

───────────────────────────────────────
PAGOS DIGITALES VERIFICADOS:
───────────────────────────────────────
🟣 Nequi:             $ _______ ✅ ❌
🟠 Daviplata:         $ _______ ✅ ❌
🔑 Llave Bancolombia: $ _______ ✅ ❌

───────────────────────────────────────
OBSERVACIONES:
───────────────────────────────────────
_______________________________________
_______________________________________
_______________________________________

───────────────────────────────────────
FIRMAS:
───────────────────────────────────────
Cajero: _______________  Hora: _____
Gerente: ______________  Hora: _____
═══════════════════════════════════════
```

### 5️⃣ Resolver Diferencias

#### Si HAY SOBRANTE (+):
```
Ejemplo: Sistema $252,800 | Contado $253,000 = +$200

Posibles causas:
- Cliente pagó de más y no pidió cambio
- Error al registrar descuento
- Venta no registrada correctamente

Acción:
- Revisar ventas una por una
- Si no se encuentra, registrar como "Ingreso adicional"
- Guardar el sobrante por si reclaman
```

#### Si HAY FALTANTE (-):
```
Ejemplo: Sistema $252,800 | Contado $252,500 = -$300

Posibles causas:
- Error al dar cambio (diste de más)
- Venta no registrada
- Efectivo tomado sin autorización

Acción:
- Revisar todas las transacciones del día
- Verificar tickets impresos vs sistema
- Si no se encuentra: El cajero debe reponer
- Reportar al gerente/admin
```

---

## 📊 FUNCIONALIDAD EN EL SISTEMA (A IMPLEMENTAR)

### Botón "Corte de Caja" en la Página de Ventas

**Ubicación:** Página de Ventas → Botón en la esquina superior derecha

**Al hacer click:**

1. **Mostrar Modal con:**
   ```
   ┌─────────────────────────────────────┐
   │   📊 CORTE DE CAJA DEL DÍA          │
   ├─────────────────────────────────────┤
   │                                     │
   │  Fecha: 20 Oct 2025                 │
   │  Tienda: Ropa Norte                 │
   │  Vendedor: Camilo Pérez             │
   │                                     │
   │  ─────────────────────────────────  │
   │  VENTAS DEL DÍA:                    │
   │  ─────────────────────────────────  │
   │                                     │
   │  💵 Efectivo:         $252,800      │
   │  🟣 Nequi:             $58,000      │
   │  🟠 Daviplata:         $30,000      │
   │  🔑 Llave Bancolombia: $13,200      │
   │  💳 Tarjeta:           $0           │
   │  🏦 Transferencia:     $0           │
   │  ─────────────────────────────────  │
   │  TOTAL:              $354,000       │
   │                                     │
   │  ─────────────────────────────────  │
   │  EFECTIVO CONTADO:                  │
   │  ─────────────────────────────────  │
   │                                     │
   │  [_____________] ← Ingresar monto   │
   │                                     │
   │  Diferencia: $______ (calculado)    │
   │                                     │
   │  Observaciones:                     │
   │  [________________________]         │
   │  [________________________]         │
   │                                     │
   │  [Descargar PDF]  [Cerrar]          │
   └─────────────────────────────────────┘
   ```

2. **Calcular diferencia automáticamente:**
   - Si ingreso $253,000 y sistema dice $252,800
   - Mostrar: `✅ Sobrante: +$200`
   - Si ingreso $252,500
   - Mostrar: `⚠️ Faltante: -$300`

3. **Generar PDF con:**
   - Encabezado de la tienda
   - Fecha y hora del corte
   - Desglose por método de pago
   - Efectivo contado vs sistema
   - Diferencia (si hay)
   - Observaciones
   - Espacio para firmas

---

## 🖨️ FORMATO DEL PDF

```
═══════════════════════════════════════════════
            CORTE DE CAJA DIARIO
═══════════════════════════════════════════════

Tienda: Ropa Norte
Dirección: Calle 123 #45-67
Teléfono: 300 123 4567

─────────────────────────────────────────────
Fecha: 20 de Octubre de 2025
Hora: 8:30 PM
Cajero: Camilo Pérez
Supervisor: María González
─────────────────────────────────────────────

VENTAS REGISTRADAS EN SISTEMA:

Método de Pago              Sistema
────────────────────────────────────
💵 Efectivo              $ 252,800
🟣 Nequi                 $  58,000
🟠 Daviplata             $  30,000
🔑 Llave Bancolombia     $  13,200
💳 Tarjeta               $       0
🏦 Transferencia         $       0
────────────────────────────────────
TOTAL                    $ 354,000
────────────────────────────────────

─────────────────────────────────────────────

EFECTIVO FÍSICO CONTADO:

Denominación    Cantidad    Subtotal
───────────────────────────────────────
$50,000            3       $ 150,000
$20,000            4       $  80,000
$10,000            2       $  20,000
$5,000             0       $       0
$2,000             1       $   2,000
$1,000             0       $       0
$500              10       $   5,000
$200               0       $       0
$100               0       $       0
───────────────────────────────────────
TOTAL CONTADO            $ 257,000
───────────────────────────────────────

─────────────────────────────────────────────

RESUMEN:

Efectivo según Sistema:    $ 252,800
Efectivo Contado:          $ 257,000
                           ─────────
DIFERENCIA:                $  +4,200 ✅
Estado: SOBRANTE

─────────────────────────────────────────────

OBSERVACIONES:
Se encontró sobrante de $4,200. Se revisaron
las ventas y no se encontró el origen. Efectivo
guardado en sobre sellado para verificación
posterior.

─────────────────────────────────────────────

FIRMAS:

_________________          _________________
Cajero                     Supervisor

Fecha: __/__/____          Fecha: __/__/____

═══════════════════════════════════════════════
```

---

## 🔐 SEGURIDAD

### Recomendaciones:

1. **Nunca dejar caja abierta sin supervisión**
2. **Dos personas deben contar el efectivo** (cajero + gerente)
3. **Guardar comprobantes físicos** (tickets de datafono, capturas de Nequi, etc.)
4. **Hacer corte ANTES de depositar** (nunca mezclar días)
5. **Sobres de seguridad** para guardar efectivo antes de llevar al banco
6. **Cámara de seguridad** en el área de caja

### Manejo de Efectivo:

```
Si el total es GRANDE (>$500,000):
- Hacer corte parcial a medio día
- Guardar en caja fuerte
- O depositar inmediatamente

Si el total es PEQUEÑO (<$100,000):
- Se puede dejar para el día siguiente
- Guardado en caja registradora con llave
```

---

## 📱 IMPLEMENTACIÓN EN EL FRONTEND

### Página: **SalesPage.tsx**

**Agregar botón:**

```tsx
<Button
  onClick={() => setShowCutModal(true)}
  variant="outline"
  leftIcon={<DollarSign size={20} />}
>
  Corte de Caja
</Button>
```

**Modal Component:**

```tsx
<Modal
  isOpen={showCutModal}
  onClose={() => setShowCutModal(false)}
  title="Corte de Caja del Día"
  size="lg"
>
  {/* Resumen de ventas por método de pago */}
  {/* Input para efectivo contado */}
  {/* Cálculo automático de diferencia */}
  {/* Textarea para observaciones */}
  {/* Botón para generar PDF */}
</Modal>
```

---

## 🔧 BACKEND NECESARIO

### Endpoint: `GET /sales/daily-cut`

**Parámetros:**
- `date`: Fecha del corte (default: hoy)
- `store`: ID de la tienda

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "date": "2025-10-20",
    "store": {
      "_id": "...",
      "name": "Ropa Norte"
    },
    "paymentMethods": [
      {
        "method": "efectivo",
        "total": 252800,
        "count": 15,
        "transactions": [...]
      },
      {
        "method": "nequi",
        "total": 58000,
        "count": 3,
        "transactions": [...]
      }
    ],
    "totalSales": 354000,
    "totalTransactions": 23
  }
}
```

### Endpoint: `POST /sales/register-cut`

**Body:**
```json
{
  "date": "2025-10-20",
  "store": "store_id",
  "cashCounted": 257000,
  "systemCash": 252800,
  "difference": 4200,
  "observations": "Sobrante, verificar mañana",
  "user": "user_id"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Corte de caja registrado",
  "data": {
    "cutId": "...",
    "pdfUrl": "https://.../cuts/20251020.pdf"
  }
}
```

---

## ✅ CHECKLIST DIARIO

```
[ ] 1. Verificar que todas las ventas están registradas
[ ] 2. Imprimir "Reporte del Día" desde el Dashboard
[ ] 3. Contar efectivo físico (dos veces)
[ ] 4. Verificar Nequi, Daviplata, Llave
[ ] 5. Imprimir cierre de datafono
[ ] 6. Completar formato de corte de caja
[ ] 7. Firmas de cajero y supervisor
[ ] 8. Guardar efectivo en sobre sellado
[ ] 9. Depositar al día siguiente (si es mucho)
[ ] 10. Archivar formato físico
```

---

## 📞 ¿QUÉ HACER SI...?

### ❓ Falta mucho dinero (-$50,000 o más)
1. **NO PÁNICO** - Revisar todo de nuevo
2. Verificar que todas las ventas se registraron
3. Revisar si alguien sacó dinero autorizado (gastos, cambio)
4. Llamar al gerente INMEDIATAMENTE
5. No salir hasta resolver

### ❓ Sobra mucho dinero (+$50,000 o más)
1. Verificar que no se duplicaron ventas
2. Revisar si alguien depositó efectivo de otro día
3. Guardar el sobrante separado
4. Reportar al gerente
5. Esperar reclamos de clientes

### ❓ No coincide Nequi/Daviplata
1. Verificar que el filtro de fecha esté correcto
2. Revisar si hay transacciones pendientes (tardan ~5 min)
3. Captura de pantalla del historial
4. Reportar diferencia en observaciones

### ❓ No tengo datafono/impresora
1. Anotar manualmente todas las ventas
2. Tomar foto del efectivo contado
3. Guardar en sobre sellado con fecha y firma
4. Reportar problema técnico al admin

---

## 📈 MEJORES PRÁCTICAS

1. **Hacerlo TODOS LOS DÍAS** - No acumular
2. **Misma hora siempre** - Crear rutina
3. **Ambiente tranquilo** - Sin clientes ni distracciones
4. **Testigos** - Siempre dos personas
5. **Documentar TODO** - Fotos, capturas, tickets
6. **Guardar evidencias** - Por si hay reclamos después

---

Este procedimiento asegura control financiero y transparencia en el manejo del efectivo. 💰✅
