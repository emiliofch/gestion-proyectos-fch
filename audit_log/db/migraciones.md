# Registro de Migraciones SQL

Todos los scripts SQL del proyecto, en orden de ejecuciÃ³n.
Los scripts estÃ¡n ubicados en la raÃ­z del proyecto.

---

## Script pendiente por ejecutar

### `crear-tabla-costeo-procesos.sql`
- **Estado:** Pendiente
- **Cuando:** Febrero 2026
- **Proposito:** Crear tabla `costeo_procesos` para guardar Proceso de Costeo por `user_id + empresa`.
- **Tablas afectadas:** `costeo_procesos` (CREATE + RLS + POLICIES)

### `supabase/migrations/20260302120000_add_fecha_adjudicacion_oportunidades.sql`
- **Estado:** ✅ Ejecutado
- **Cuando:** Marzo 2026
- **Proposito:** Agregar `fecha_adjudicacion` en `oportunidades` para registrar mes de adjudicacion (`ene-26`).
- **Tablas afectadas:** `oportunidades` (ALTER TABLE ADD COLUMN + CHECK CONSTRAINT)
- **Validacion:** formato `^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)-[0-9]{2}$` o `NULL`.

### `supabase/migrations/20260302152000_add_delete_policy_cambios.sql`
- **Estado:** ✅ Ejecutado
- **Cuando:** Marzo 2026
- **Proposito:** Habilitar eliminacion real de registros en `cambios` solo para admin de la misma empresa.
- **Tablas afectadas:** `cambios` (CREATE POLICY FOR DELETE)
- **Politica:** `cambios_delete_admin_same_empresa`.

---
## Scripts ejecutados (en orden cronolÃ³gico)

### 1. `crear-tabla-oportunidades.sql`
- **Estado:** âœ… Ejecutado
- **CuÃ¡ndo:** Noviembre 2025
- **PropÃ³sito:** Crea la tabla `oportunidades` como entidad separada de proyectos
- **Tablas afectadas:** `oportunidades` (CREATE)
- **Notas:** Primer paso de la separaciÃ³n proyecto/oportunidad

---

### 2. `restructurar-proyectos.sql`
- **Estado:** âœ… Ejecutado
- **CuÃ¡ndo:** Noviembre 2025
- **PropÃ³sito:** ReestructuraciÃ³n completa del esquema. Simplifica proyectos a PROYECTO + CECO + JEFE
- **Tablas afectadas:** `proyectos`, `oportunidades`, `cambios`, `favoritos`, `solicitudes_oc` (DROP + CREATE)
- **Datos:** Inserta 43 proyectos CGV iniciales
- **âš ï¸ Destructivo:** Hace DROP de todas las tablas dependientes

---

### 3. `setup-solicitud-oc.sql`
- **Estado:** âœ… Ejecutado
- **CuÃ¡ndo:** Diciembre 2025
- **PropÃ³sito:** Crea el sistema completo de OC con tablas, Ã­ndices, RLS y polÃ­ticas de Storage
- **Tablas afectadas:** `proyectos_ceco` (CREATE), `solicitudes_oc` (CREATE), Storage `oc-adjuntos` (polÃ­ticas)
- **Notas:** El bucket `oc-adjuntos` se crea manualmente en el Dashboard de Supabase

---

### 4. `fix-ceco-field.sql`
- **Estado:** âœ… Ejecutado
- **CuÃ¡ndo:** Diciembre 2025
- **PropÃ³sito:** Corrige el tipo del campo `ceco` en `solicitudes_oc` de VARCHAR(50) a TEXT
- **Tablas afectadas:** `solicitudes_oc` (ALTER COLUMN)
- **Motivo:** Los CECOs con jerarquÃ­a completa superaban el lÃ­mite de 50 caracteres

---

### 5. `agregar-sol-netsuite.sql`
- **Estado:** âœ… Ejecutado
- **CuÃ¡ndo:** Diciembre 2025
- **PropÃ³sito:** Agrega campo `sol_netsuite` para registrar el nÃºmero de solicitud en NetSuite
- **Tablas afectadas:** `solicitudes_oc` (ALTER TABLE ADD COLUMN)
- **Notas:** Campo nullable, editable por admin desde la UI

---

### 6. `limpiar-e-inyectar-proyectos.sql`
- **Estado:** âœ… Ejecutado (cuando se necesita refrescar datos)
- **CuÃ¡ndo:** SegÃºn necesidad
- **PropÃ³sito:** Limpia y vuelve a insertar la lista de proyectos
- **Tablas afectadas:** `proyectos` (DELETE + INSERT)
- **Notas:** Script de mantenimiento, no de migraciÃ³n estructural

---

### 7. `agregar-id-correlativo.sql`
- **Estado:** âœ… Ejecutado
- **CuÃ¡ndo:** Enero 2026
- **PropÃ³sito:** Agrega campo `id_correlativo` con secuencia PostgreSQL para IDs Ãºnicos y permanentes
- **Tablas afectadas:** `solicitudes_oc` (ALTER TABLE ADD COLUMN)
- **Objetos BD creados:**
  - Columna `id_correlativo INTEGER`
  - Secuencia `solicitudes_oc_correlativo_seq`
  - Secuencia `solicitudes_oc_correlativo_cgv_seq`
  - Secuencia `solicitudes_oc_correlativo_hubmet_seq`
  - FunciÃ³n RPC `nextval_seq(seq_name TEXT)`
  - Ãndice Ãºnico `idx_solicitudes_oc_correlativo`

---

### 8. `backfill-id-correlativo.sql`
- **Estado:** âœ… Ejecutado
- **CuÃ¡ndo:** Enero 2026
- **PropÃ³sito:** Asigna `id_correlativo` a todos los registros existentes que tenÃ­an NULL
- **Tablas afectadas:** `solicitudes_oc` (UPDATE)
- **Notas:** Script one-time para migraciÃ³n de datos existentes

---

### 9. `verificar-storage-bucket.sql`
- **Estado:** âœ… Script de verificaciÃ³n (sin cambios)
- **CuÃ¡ndo:** SegÃºn necesidad
- **PropÃ³sito:** Verifica que el bucket `oc-adjuntos` y sus polÃ­ticas estÃ©n configurados
- **Notas:** Solo hace SELECT, no modifica nada

---

## Queries Ãºtiles de mantenimiento

```sql
-- Ver todas las tablas y sus polÃ­ticas RLS
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Ver todas las secuencias
SELECT sequencename, last_value
FROM pg_sequences
WHERE sequencename LIKE 'solicitudes_oc%';

-- Verificar integridad del id_correlativo
SELECT empresa, COUNT(*) as total, MIN(id_correlativo), MAX(id_correlativo)
FROM solicitudes_oc
GROUP BY empresa;

-- Ver tamaÃ±o de tablas
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;
```


### 10. `supabase/migrations/20260226170000_hardening_rls_empresa.sql`
- **Estado:** ✅ Ejecutado
- **Cuándo:** Febrero 2026
- **Propósito:** Hardening de seguridad para aislamiento por empresa y control por rol en RLS
- **Tablas afectadas:**
  - `proyectos` (ADD `empresa` + backfill + RLS endurecido)
  - `oportunidades` (ADD `empresa` + backfill + RLS endurecido)
  - `cambios` (ADD `empresa` + backfill + RLS endurecido)
  - `solicitudes_oc` (RLS por usuario/admin en misma empresa)
  - `configuracion_emails` (admin gestiona solo su empresa)
  - `storage.objects` bucket `oc-adjuntos` (admin lectura solo misma empresa)
- **Funciones creadas:**
  - `public.current_user_empresa()`
  - `public.is_current_user_admin()`
- **Impacto esperado:** disminucion de superficie de acceso no autorizado entre CGV/HUB_MET.
- **Evidencia de ejecución:**
  - `npx supabase db push --linked` aplicó `20260226170000_hardening_rls_empresa.sql`.
  - `npx supabase migration list --linked` muestra local/remoto en sync.
  - `npx supabase db push --linked --dry-run` => `Remote database is up to date`.
