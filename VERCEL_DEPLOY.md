# 🔧 Pasos para Actualizar Variable de Entorno en Vercel

## ✅ Cambios Realizados en el Código

- ✅ Actualizado `.env.example` con nueva URL: `https://api.vrmajo.xyz/api`
- ✅ Actualizado `src/lib/axios.ts` con nueva URL de fallback
- ✅ Commit: `e02c7d7 - fix: Actualizar URL del backend a api.vrmajo.xyz`
- ✅ Push a GitHub: main branch

## 🚀 Acción Manual Requerida en Vercel

### Opción 1: Actualizar Variable de Entorno (Recomendado)

1. **Ir a Vercel Dashboard**
   - https://vercel.com/dashboard
   - Seleccionar el proyecto del frontend (gestor-fronted o vrmajo.xyz)

2. **Settings → Environment Variables**
   - Click en "Settings" en el menú superior
   - Click en "Environment Variables" en el menú lateral

3. **Editar VITE_API_URL**
   - Buscar la variable `VITE_API_URL`
   - Click en el botón de editar (lápiz) o los tres puntos → Edit
   - Cambiar el valor de:
     ```
     https://gestor-glwn.onrender.com/api
     ```
     A:
     ```
     https://api.vrmajo.xyz/api
     ```
   - Guardar los cambios

4. **Redeploy el Proyecto**
   - Ir a "Deployments"
   - Click en el deployment más reciente
   - Click en los tres puntos → "Redeploy"
   - Seleccionar "Use existing Build Cache" (opcional, más rápido)
   - Click en "Redeploy"

5. **Esperar el Deploy**
   - Vercel construirá y desplegará automáticamente
   - Toma aproximadamente 1-2 minutos
   - Verás "Ready" cuando esté completo

### Opción 2: Trigger Deploy Automático (Más Simple)

Si Vercel está conectado a GitHub, el push que acabamos de hacer debería:
- ✅ Detectar automáticamente el cambio
- ✅ Iniciar un nuevo build
- ✅ Usar las variables de entorno configuradas

**Solo necesitas actualizar la variable de entorno** si no se configuró correctamente antes.

---

## 🔍 Verificar que Funcionó

Después del deploy, abre:
- https://vrmajo.xyz
- Abrir DevTools (F12) → Console
- Buscar mensajes de error o conexión
- Debería conectarse a `https://api.vrmajo.xyz/api`

Si ves errores de CORS o conexión:
1. Verificar que el backend en Render tenga configurado el CORS para vrmajo.xyz
2. Ver archivo `DIAGNOSTICO.md` para más detalles

---

## 📊 Estado Actual del Backend

✅ **Backend en Render**: https://api.vrmajo.xyz
- Estado: **Live** ✅
- Última deploy: Noviembre 10, 2025 a las 1:53 PM
- Commit: `2d94a1c - feat: Agregar script de seed para producción`

✅ **Base de Datos MongoDB Atlas**: Poblada con datos de prueba
- 4 tiendas
- 3 usuarios (admin + 2 usuarios normales)
- 5 productos
- 20 items de inventario
- 2 proveedores

✅ **Credenciales de Prueba**:
```
Admin: admin@tienda.com / Admin123!
Usuario: carlos@tienda.com / User123!
Usuario: maria@tienda.com / User123!
```

---

## 🎯 Próximos Pasos (Después del Redeploy)

1. ✅ Abrir https://vrmajo.xyz
2. ✅ Login con admin@tienda.com / Admin123!
3. ✅ Verificar que Dashboard cargue con datos
4. ✅ Navegar a todas las páginas:
   - Productos
   - Inventario
   - Ventas
   - Proveedores
   - Órdenes de Compra
5. ✅ Probar crear un producto nuevo
6. ✅ Probar crear una venta
7. ✅ Logout y login con usuario normal (carlos@tienda.com)
8. ✅ Verificar restricciones de acceso

---

## ⚠️ Si el Frontend No Se Conecta

1. Verificar en Vercel que la variable `VITE_API_URL` sea `https://api.vrmajo.xyz/api`
2. Verificar en Render que CORS incluya `vrmajo.xyz`:
   - Environment Variables → `CORS_ORIGIN`
   - Debe incluir: `https://vrmajo.xyz,https://www.vrmajo.xyz`
3. Si no funciona, hacer un Manual Deploy en Vercel
