# Fix: ID Correlativo para Solicitudes OC

## Problema Identificado

El ID mostrado en las tablas de solicitudes OC usaba `index + 1` del array filtrado, lo que causaba:
- **IDs duplicados**: Diferentes usuarios veían el mismo ID para diferentes solicitudes
- **IDs no permanentes**: El ID cambiaba según los filtros aplicados
- **IDs no únicos**: No había garantía de unicidad a nivel de base de datos

## Solución Implementada

Se agregó un campo `id_correlativo` a nivel de base de datos que es:
- ✅ **Único**: Generado por una secuencia de PostgreSQL
- ✅ **Permanente**: Guardado en la base de datos, no calculado
- ✅ **Correlativo**: 1, 2, 3, 4... sin saltos ni duplicados
- ✅ **Automático**: Se asigna automáticamente al crear una solicitud

## Archivos Modificados

### 1. Base de Datos (SQL Scripts)
- [agregar-id-correlativo.sql](agregar-id-correlativo.sql) - Agrega el campo y la secuencia
- [backfill-id-correlativo.sql](backfill-id-correlativo.sql) - Asigna IDs a registros existentes

### 2. Frontend (React Components)
- [src/components/VistaSolicitudOC.jsx](src/components/VistaSolicitudOC.jsx)
  - Línea 184-190: Eliminada lógica de cálculo manual de ID
  - Línea 207: Usa `solicitud.id_correlativo` del registro insertado
  - Línea 569: Muestra `s.id_correlativo` en lugar de `index + 1`

- [src/components/AdministracionOC.jsx](src/components/AdministracionOC.jsx)
  - Línea 98: Muestra `s.id_correlativo` en lugar de `index + 1`

### 3. Backend (API)
- [api/enviar-email-oc.js](api/enviar-email-oc.js)
  - Agregado logging detallado para debugging de emails
  - Retorna `emailId` de Resend para rastreo

## Pasos para Aplicar el Fix

### Paso 1: Ejecutar Script de Base de Datos
```bash
# En Supabase Dashboard > SQL Editor, ejecutar:
```
1. Abrir [agregar-id-correlativo.sql](agregar-id-correlativo.sql)
2. Copiar y pegar en SQL Editor
3. Ejecutar (Run)

### Paso 2: Ejecutar Backfill de Registros Existentes
```bash
# En Supabase Dashboard > SQL Editor, ejecutar:
```
1. Abrir [backfill-id-correlativo.sql](backfill-id-correlativo.sql)
2. Copiar y pegar en SQL Editor
3. Ejecutar (Run)

### Paso 3: Verificar en Base de Datos
```sql
-- Verificar que todos los registros tienen id_correlativo
SELECT id_correlativo, proveedor, usuario_email, fecha_creacion
FROM solicitudes_oc
ORDER BY id_correlativo ASC;

-- Debe mostrar: 1, 2, 3, 4... sin duplicados ni nulos
```

### Paso 4: Deploy del Frontend y Backend
Los cambios en código ya están aplicados. Solo necesitas hacer deploy:

```bash
# Si usas git
git add .
git commit -m "Fix: Agregar id_correlativo único a solicitudes OC"
git push

# Vercel hará deploy automático
```

## Verificación Post-Deploy

### 1. Verificar IDs Existentes
- Ir a "Mis Solicitudes" o "Administración de OC"
- Verificar que los IDs mostrados son: 1, 2, 3, 4...
- Verificar que no cambian al filtrar o recargar

### 2. Crear Nueva Solicitud
- Crear una nueva solicitud OC
- Verificar que el correo tiene el ID correcto en el subject
- Verificar que la tabla muestra el ID correcto

### 3. Verificar Correo
- El subject debe incluir: `Nueva Solicitud OC #123 - Proveedor...`
- El header HTML debe mostrar: `🧾 Nueva Solicitud de Orden de Compra #123`

## Investigación de Problema de Emails

### Logs Agregados
El archivo [api/enviar-email-oc.js](api/enviar-email-oc.js) ahora incluye:
- Log del remitente y destinatarios
- Log del ID del correo retornado por Resend
- Log de attachments procesados

### Cómo Verificar Envío
1. Abrir Console del navegador al enviar solicitud
2. Buscar logs que incluyan:
   - `📧 Preparando envío de correo...`
   - `✅ Correo enviado exitosamente`
   - `ID del correo: re_xxxxxx`

3. Con el ID del correo, verificar en [Resend Dashboard](https://resend.com/emails):
   - Estado del correo (Delivered, Bounced, etc.)
   - Razón si no fue entregado

### Posibles Causas de No Entrega
1. **Carpeta de Spam**: Verificar carpeta de spam/junk
2. **Dominio no verificado**: En Resend, verificar que el dominio está configurado
3. **Email bloqueado**: Algunos proveedores bloquean emails con muchos adjuntos
4. **Límite de Resend**: Verificar que no se alcanzó el límite del plan gratuito (100/día)

## Resultado Esperado

### Antes del Fix
```
Usuario 1 ve:
ID | Proveedor
1  | Proveedor A  <- Su única solicitud

Usuario 2 ve:
ID | Proveedor
1  | Proveedor B  <- Su única solicitud (MISMO ID!)
```

### Después del Fix
```
Usuario 1 ve:
ID | Proveedor
1  | Proveedor A  <- ID único global

Usuario 2 ve:
ID | Proveedor
2  | Proveedor B  <- ID único global

Admin ve:
ID | Proveedor     | Usuario
1  | Proveedor A   | usuario1@mail.com
2  | Proveedor B   | usuario2@mail.com
```

## Próximos Registros

Cuando se cree la solicitud #3, #4, #5..., automáticamente:
1. La secuencia genera el siguiente número
2. Se guarda en `id_correlativo` durante el INSERT
3. Se usa para el correo
4. Se muestra en las tablas

**No se requiere ningún cambio adicional.**

## Contacto y Soporte

Si hay problemas después de aplicar el fix:
1. Verificar logs de Supabase SQL
2. Verificar logs de consola del navegador
3. Verificar Resend Dashboard para status de emails
4. Verificar que la secuencia está configurada correctamente:
   ```sql
   SELECT currval('solicitudes_oc_correlativo_seq');
   -- Debe retornar el último ID asignado
   ```
