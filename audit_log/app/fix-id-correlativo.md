# Fix: ID Correlativo para Solicitudes OC

> Movido desde `FIX-ID-CORRELATIVO.md` en la raíz del proyecto (Febrero 2026)
> Estado: **APLICADO** ✅

---

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
- `agregar-id-correlativo.sql` — Agrega el campo y la secuencia
- `backfill-id-correlativo.sql` — Asigna IDs a registros existentes

### 2. Frontend (React Components)
- `src/components/VistaSolicitudOC.jsx`
  - Línea 184-190: Eliminada lógica de cálculo manual de ID
  - Línea 207: Usa `solicitud.id_correlativo` del registro insertado
  - Línea 569: Muestra `s.id_correlativo` en lugar de `index + 1`

- `src/components/AdministracionOC.jsx`
  - Línea 98: Muestra `s.id_correlativo` en lugar de `index + 1`

### 3. Backend (API)
- `api/enviar-email-oc.js`
  - Agregado logging detallado para debugging de emails
  - Retorna `emailId` de Resend para rastreo

## Pasos para Aplicar el Fix

### Paso 1: Ejecutar Script de Base de Datos
1. Abrir `agregar-id-correlativo.sql`
2. Copiar y pegar en Supabase Dashboard > SQL Editor
3. Ejecutar (Run)

### Paso 2: Ejecutar Backfill de Registros Existentes
1. Abrir `backfill-id-correlativo.sql`
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
- El header HTML debe mostrar: `Nueva Solicitud de Orden de Compra #123`

## Resultado Esperado

### Antes del Fix
```
Usuario 1 ve:
ID | Proveedor
1  | Proveedor A  ← Su única solicitud

Usuario 2 ve:
ID | Proveedor
1  | Proveedor B  ← Su única solicitud (MISMO ID!)
```

### Después del Fix
```
Usuario 1 ve:
ID | Proveedor
1  | Proveedor A  ← ID único global

Usuario 2 ve:
ID | Proveedor
2  | Proveedor B  ← ID único global

Admin ve:
ID | Proveedor     | Usuario
1  | Proveedor A   | usuario1@mail.com
2  | Proveedor B   | usuario2@mail.com
```

## Verificación de la Secuencia

```sql
SELECT currval('solicitudes_oc_correlativo_seq');
-- Debe retornar el último ID asignado
```

## Notas adicionales

- La secuencia `solicitudes_oc_correlativo_seq` es global (no por empresa)
- Para separar IDs por empresa se usó una secuencia diferente en la implementación final:
  - `solicitudes_oc_correlativo_cgv_seq` para CGV
  - `solicitudes_oc_correlativo_hubmet_seq` para HUB MET
- El campo `id_correlativo` en la BD es `INTEGER NOT NULL` con `DEFAULT nextval(...)`
