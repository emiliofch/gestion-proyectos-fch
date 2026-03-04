# Changelog â€” Base de Datos DeskFlow

Historial de cambios del esquema de base de datos en Supabase.
Ordenado de mÃ¡s reciente a mÃ¡s antiguo.

Ver lista detallada de scripts en [migraciones.md](./migraciones.md).

---

## [2026-03-04] - Nuevo esquema Ingreso de HH

- Se agrega migracion `supabase/migrations/20260304191000_create_ingreso_hh.sql`.
- Se crea tabla `public.ingreso_hh` con campos:
  - `user_id`
  - `proyecto_id`
  - `mes`
  - `horas`
  - `empresa`
- Restricciones:
  - `UNIQUE (user_id, proyecto_id, mes)`
  - `horas > 0 AND horas <= 170`
- Se agrega RLS por usuario/admin y aislamiento por empresa.

### Impacto DB
- Habilita registro mensual de HH por proyecto y usuario.
- Estado actual: aplicada en remoto (`20260304191000`).

---

## [2026-03-04] - Proyectos: fecha de adjudicación en esquema

- Se agrega migracion `supabase/migrations/20260304183000_add_fecha_adjudicacion_proyectos.sql`.
- La migracion incorpora `fecha_adjudicacion` en `public.proyectos`.
- Se agrega constraint de formato `mes-yy` (ej: `ene-26`), alineado con oportunidades.

### Impacto DB
- Cambio de esquema: `ALTER TABLE public.proyectos ADD COLUMN fecha_adjudicacion text`.
- Validacion de datos con `CHECK` (`proyectos_fecha_adjudicacion_chk`).
- Estado actual: aplicada en remoto (`20260304183000`).

---

## [2026-03-04] - Seed inicial de líneas (CGV/HUB_MET)

- Se agrega migracion `supabase/migrations/20260304174500_seed_lineas_base.sql`.
- Inserta lineas base para ambas empresas (`CGV` y `HUB_MET`):
  - Desarrollo de Negocios
  - Gerencia de Área
  - Hub Metropolitano
  - Proyectos Corporativos
  - Startup Lab.01
  - Venture Capital
- Usa `ON CONFLICT (linea, empresa) DO NOTHING` para evitar duplicados.

### Impacto DB
- Datos iniciales del catalogo `lineas` disponibles para dropdown de `Línea` en Proyectos.
- Estado actual: aplicada en remoto (`20260304174500`).

---

## [2026-03-04] - Catálogo de Líneas por empresa

- Se agrega migracion `supabase/migrations/20260304172000_create_lineas.sql`.
- Se crea tabla `public.lineas` para administrar listado de líneas por empresa.
- Se implementa RLS con aislamiento por empresa y politicas:
  - `SELECT` por misma empresa
  - `INSERT` por misma empresa
  - `UPDATE/DELETE` solo admin de la misma empresa
- Se agrega restriccion de unicidad `UNIQUE (linea, empresa)`.

### Impacto DB
- Nuevo catalogo para poblar dropdown de `Línea` en alta/edicion de proyectos.
- Estado actual: aplicada en remoto (`20260304172000`).

---

## [2026-03-04] - Catálogo de Centros de Costo por empresa

- Se agrega migracion `supabase/migrations/20260304164000_create_centros_costo.sql`.
- Se crea tabla `public.centros_costo` para administrar listado de CECOs por empresa.
- Se implementa RLS con aislamiento por empresa y politicas:
  - `SELECT` por misma empresa
  - `INSERT` por misma empresa
  - `UPDATE/DELETE` solo admin de la misma empresa
- Se agrega restriccion de unicidad `UNIQUE (ceco, empresa)`.

### Impacto DB
- Nuevo catalogo para poblar dropdown de `CECO` en alta/edicion de proyectos.
- Estado actual: aplicada en remoto (`20260304164000`).

---

## [2026-03-02] - Control de cambios: habilitar DELETE para admin

- Se agrega migracion `supabase/migrations/20260302152000_add_delete_policy_cambios.sql`.
- Se crea politica RLS `cambios_delete_admin_same_empresa` en `public.cambios`.
- Regla aplicada: solo usuarios admin pueden eliminar registros, y solo de su misma empresa.

### Impacto DB
- Seguridad: se mantiene aislamiento por empresa en operacion `DELETE`.
- Comportamiento: el basurero de Control de Cambios ahora puede borrar realmente (si el usuario cumple politica RLS).
- Estado actual: aplicada en remoto (`20260302152000`).

---

## [2026-03-02] - Oportunidades: fecha de adjudicacion

- Se agrega migracion versionada `supabase/migrations/20260302120000_add_fecha_adjudicacion_oportunidades.sql`.
- La migracion incorpora la columna `fecha_adjudicacion` en `public.oportunidades`.
- Se agrega constraint de formato para validar `mes-yy` en espanol abreviado:
  - `ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic`
  - ejemplo valido: `ene-26`

### Impacto DB
- Cambio de esquema: `ALTER TABLE public.oportunidades ADD COLUMN fecha_adjudicacion TEXT`.
- Validacion de datos con `CHECK` (`oportunidades_fecha_adjudicacion_chk`).
- Estado actual: aplicada en remoto (`20260302120000`).

---

## [2026-02-25] - Proceso de Costeo: tabla de persistencia (pendiente de ejecutar)

- Cambio de navegacion y flujo de UI en modulo Costeo (sin cambios de esquema).
- Se creo script SQL `crear-tabla-costeo-procesos.sql` para persistir el proceso de costeo por usuario y empresa.
- Incluye tabla `costeo_procesos` con RLS y politicas de acceso propias por `auth.uid()`.
- Esta migracion queda pendiente hasta ejecutar el script en Supabase.

### Impacto DB
- Nuevo objeto planificado: tabla `costeo_procesos` con `UNIQUE (user_id, empresa)`.
- Sin cambios efectivos hasta ejecutar la migracion.

---
- Ajuste de presentacion de matriz en frontend (sin impacto en esquema de BD).
- Se renombro la opcion de submenu a `Proceso de Costeo`.
- Se agrego matriz mensual por duracion de proyecto y seleccion por celdas (checkbox) para imputar valores de inputs.
- No se ejecutaron scripts SQL ni cambios de estructura en Supabase.

### Impacto DB
- Sin cambios en tablas, indices, funciones RPC, politicas RLS o storage.

---
## [2026-02-25] - Registro operativo (sin cambios de esquema) - Costeo Inputs

- Cambio de navegacion y flujo de UI en modulo Costeo (sin cambios de esquema).
- En esta iteracion se implemento un submenu y una vista de aplicacion para gestionar inputs de costeo.
- No se ejecutaron scripts SQL ni cambios de estructura en Supabase.

### Impacto DB
- Sin cambios en tablas, indices, funciones RPC, politicas RLS o storage.

---

## [2026-02-25] - Registro operativo (sin cambios de esquema)

- Cambio de navegacion y flujo de UI en modulo Costeo (sin cambios de esquema).
- En esta iteracion se implemento una nueva vista de aplicacion: `Sistema de Costeo`.
- No se ejecutaron scripts SQL ni cambios de estructura en Supabase.

### Impacto DB
- Sin cambios en tablas, indices, funciones RPC, politicas RLS o storage.

---

## [2026-02-23] - Registro operativo (sin cambios de esquema)

- Cambio de navegacion y flujo de UI en modulo Costeo (sin cambios de esquema).
- En esta iteracion no se ejecutaron migraciones SQL ni cambios de estructura en Supabase.
- Los cambios fueron solo de capa aplicacion (UI/tabla/filtros/ordenamiento).

### Impacto DB
- Sin cambios en tablas, indices, funciones RPC, politicas RLS o storage.

---
## [2026-02] â€” Secuencias por empresa para id_correlativo

**Script:** `agregar-id-correlativo.sql` (versiÃ³n actualizada)

### Cambios
- Se crearon dos secuencias separadas por empresa:
  - `solicitudes_oc_correlativo_cgv_seq` para empresa CGV
  - `solicitudes_oc_correlativo_hubmet_seq` para empresa HUB MET
- Se expuso la funciÃ³n `nextval_seq(seq_name TEXT)` como funciÃ³n RPC para que el frontend pueda obtener el siguiente valor sin permisos de superuser
- El campo `id_correlativo` ahora es Ãºnico **por empresa**, no global

---

## [2026-01] â€” Fix ID Correlativo en solicitudes_oc

**Scripts:** `agregar-id-correlativo.sql`, `backfill-id-correlativo.sql`

### Cambios
- Agregado campo `id_correlativo INTEGER` a tabla `solicitudes_oc`
- Creada secuencia `solicitudes_oc_correlativo_seq` para auto-incremento
- Creado Ã­ndice Ãºnico `idx_solicitudes_oc_correlativo`
- Backfill: asignados IDs correlativos a todos los registros existentes sin ID

### Motivo
Los IDs mostrados en la UI se calculaban en el frontend con `index + 1`, lo que causaba duplicados y valores no permanentes.

---

## [2025-12] â€” Campo sol_netsuite en solicitudes_oc

**Script:** `agregar-sol-netsuite.sql`

### Cambios
- Agregado campo `sol_netsuite VARCHAR(100)` a tabla `solicitudes_oc`
- Campo nullable, para registrar el nÃºmero de solicitud en NetSuite
- El admin puede editar este campo directamente desde `AdministracionOC`

---

## [2025-12] â€” Fix campo CECO

**Script:** `fix-ceco-field.sql`

### Cambios
- Ajuste en el tipo/longitud del campo `ceco` en `solicitudes_oc`
- El campo pasÃ³ de `VARCHAR(50)` a `TEXT` para soportar CECOs con jerarquÃ­a completa (ej: "Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos")

---

## [2025-12] â€” Sistema de Solicitud OC

**Script:** `setup-solicitud-oc.sql`

### Tablas creadas
- `proyectos_ceco`: Almacena CECOs asociados a proyectos (tabla auxiliar, luego reemplazada por campo directo en `proyectos`)
- `solicitudes_oc`: Tabla principal de Ã³rdenes de compra

### RLS configurado
- `solicitudes_oc`: Usuarios ven solo sus propias solicitudes; admins ven todas
- `proyectos_ceco`: Todos pueden ver; solo admins pueden gestionar
- Storage `oc-adjuntos`: Usuarios en su propia carpeta; admins en todas

---

## [2025-11] â€” ReestructuraciÃ³n completa de Proyectos

**Script:** `restructurar-proyectos.sql`

### Cambios (destructivos â€” requiriÃ³ DROP y recreaciÃ³n)
- DROP TABLE `solicitudes_oc` CASCADE
- DROP TABLE `favoritos` CASCADE
- DROP TABLE `cambios` CASCADE
- DROP TABLE `proyectos` CASCADE

### Tablas recreadas
- `proyectos`: Simplificada a (id, nombre, ceco, jefe, created_at). Eliminados campos de ingresos/gastos/HH que se movieron a `oportunidades`
- `oportunidades`: Nueva tabla que almacena los valores financieros vinculados a proyectos
- `cambios`: Recreada con campo `tipo_cambio` para distinguir entre cambios de valor y cambios de proyecto
- `favoritos`: Recreada igual que antes
- `solicitudes_oc`: Recreada con estructura actualizada

### Datos iniciales
- 43 proyectos CGV insertados con nombre y CECO

---

## [2025-11] â€” Tabla Oportunidades

**Script:** `crear-tabla-oportunidades.sql`

### Cambios
- Creada tabla `oportunidades` con campos: proyecto_id, ingresos, hh, gastos, fecha, creador, estado, observaciones
- RLS: Todos pueden ver; usuarios autenticados pueden insertar; usuarios pueden actualizar las propias; admins gestionan todo

---

## Estructura Actual de Tablas (Febrero 2026)

| Tabla | DescripciÃ³n | RLS |
|---|---|---|
| `perfiles` | Usuarios con rol y empresa | âœ… |
| `proyectos` | Proyectos base (nombre + CECO + jefe) | âœ… |
| `oportunidades` | Estimaciones financieras por proyecto | âœ… |
| `cambios` | AuditorÃ­a de cambios en oportunidades y proyectos | âœ… |
| `solicitudes_oc` | Solicitudes de Ã³rdenes de compra | âœ… |
| `favoritos` | Proyectos favoritos por usuario | âœ… |
| `sugerencias` | Sugerencias de usuarios | âœ… |
| `votos_sugerencias` | Votos en sugerencias | âœ… |
| `configuracion_emails` | Destinatarios de correo por empresa | âœ… |
| `proyectos_ceco` | (Legacy) CECOs por proyecto â€” reemplazado por campo directo | âœ… |








## [2026-02-26] - Hardening RLS por empresa/rol (pre-auditoria Sonar)

**Script:** `supabase/migrations/20260226170000_hardening_rls_empresa.sql`

### Cambios de seguridad
- Se crean funciones helper seguras:
  - `public.current_user_empresa()`
  - `public.is_current_user_admin()`
- Se agrega columna `empresa` y backfill en tablas clave:
  - `proyectos`
  - `oportunidades`
  - `cambios`
- Se reemplazan políticas abiertas (`USING true`) por políticas aisladas por empresa.
- Se fuerza RLS (`FORCE ROW LEVEL SECURITY`) en tablas críticas.
- Se refuerzan políticas en:
  - `solicitudes_oc` (usuario/admin solo misma empresa)
  - `configuracion_emails` (admin de su empresa)
  - `storage.objects` para bucket `oc-adjuntos` (admin solo archivos de su misma empresa)

### Objetivo de auditoría
- Reducir riesgos de acceso cruzado CGV/HUB_MET.
- Eliminar exposición por políticas permisivas.
- Alinear controles de acceso con hallazgos de seguridad/Hotspots.
