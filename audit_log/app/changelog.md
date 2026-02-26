# Changelog â€” App DeskFlow

Historial de cambios de la aplicaciÃ³n (frontend + API).
Ordenado de mÃ¡s reciente a mÃ¡s antiguo.

---

## [2026-02-25] - Persistencia Supabase en Proceso de Costeo

- UI: se removio el bloque superior de resumen y se agrego contenedor `Guardar Costeo` con nombre de proyecto y listado de proyectos guardados.
- `VistaCosteoInputs` ahora carga y guarda datos en Supabase por `user_id + empresa`.
- Persistencia implementada para:
  - `inputs`
  - `duracion_meses`
  - `celdas_activas`
- Se agrego guardado automatico (debounce) y boton `Guardar` manual.
- En `App.jsx` se pasaron `user` y `perfil` a `VistaCosteoInputs`.
- Se agrego script SQL `crear-tabla-costeo-procesos.sql`.

### Archivos modificados
- `src/components/VistaCosteoInputs.jsx`
- `src/App.jsx`
- `crear-tabla-costeo-procesos.sql`

---
- Ajuste de matriz: meses como columnas e inputs como filas, con total por fila.
- Se renombro submenu `Inputs` a `Proceso de Costeo` en menu hamburguesa.
- En `VistaCosteoInputs` se agrego seccion `Duracion del proyecto` (en meses).
- Se agrego matriz dinamica de asignacion por checkbox:
  - filas: meses del proyecto
  - columnas: inputs cargados
  - celdas: check activa el valor del input para ese mes
- Se agrego columna final `Total` por fila (suma mensual de inputs seleccionados).
- Se mantuvo CRUD de inputs (agregar, editar, quitar) en la misma pagina.

### Archivos modificados
- `src/App.jsx`
- `src/components/VistaCosteoInputs.jsx`

---
## [2026-02-25] - Sistema de Costeo: submenÃº Inputs (fase 1)

- UI: se removio el bloque superior de resumen y se agrego contenedor `Guardar Costeo` con nombre de proyecto y listado de proyectos guardados.
- Se agrego nuevo submenu en menu hamburguesa:
  - `Sistema de Costeo`
  - opcion inicial: `Inputs`
- Se creo vista `VistaCosteoInputs` con tabla editable de inputs.
- Estructura de tabla implementada:
  - `item`
  - `valor`
  - `tipo` (`Gasto Operacional` o `Gasto en Recurso Humano`)
- Operaciones habilitadas en la tabla:
  - agregar
  - editar
  - quitar
- Se conecto la nueva vista a la ruta de UI `costeo-inputs` desde `App.jsx`.

### Archivos modificados
- `src/components/VistaCosteoInputs.jsx` (nuevo)
- `src/App.jsx`

---

## [2026-02-25] - Nueva vista Sistema de Costeo (macro flow v1)

- UI: se removio el bloque superior de resumen y se agrego contenedor `Guardar Costeo` con nombre de proyecto y listado de proyectos guardados.
- Se creo la nueva vista `VistaCosteo` para replicar el flujo de macros de costeo en la app web:
  - Paso 1: agregar inputs de tipo `GGOO` o `HH`
  - Paso 2: eliminar inputs existentes
  - Paso 3: generar hoja de costeo con plan mensual (12 meses)
  - Paso 4: agregar inputs extra a hoja ya generada
  - Paso 5: editar parametros de pricing (`imprevistos`, `overhead`, `margen`)
- Se implemento calculo tecnico de costos:
  - `GGOO`: costo mensual = plan * valor base
  - `HH`: costo mensual = (porcentaje mensual / 100) * valor base
- Se agrego resumen final de pricing con subtotal, recargos y precio sugerido.
- Se integro la vista al menu principal en `App.jsx` como `Sistema de Costeo`.
- Se reemplazo el placeholder previo de `Ingreso HH`.

### Archivos modificados
- `src/components/VistaCosteo.jsx` (nuevo)
- `src/App.jsx`

---

## [2026-02-23] - Tablas con encabezado fijo, filtros y ordenamiento

- UI: se removio el bloque superior de resumen y se agrego contenedor `Guardar Costeo` con nombre de proyecto y listado de proyectos guardados.
- Se aplico encabezado sticky + contenedor scrolleable en:
  - `VistaControlCambios`
  - `VistaProyectosBase`
  - `VistaColaboradores`
  - `AdministracionOC`
- Se agrego componente reutilizable `src/components/FilterableTh.jsx` para:
  - resize de columnas
  - filtro por columna
  - ordenamiento por columna
- Se mejoro el filtro a formato tipo Excel:
  - dropdown compacto
  - seleccion multiple con checkboxes
  - opcion `(Todos)` para limpiar filtro
- Se agrego ordenamiento asc/desc por encabezado en las 4 vistas anteriores.
- Se migro `VistaOportunidades` a `FilterableTh` para mantener mismo comportamiento.

### Archivos modificados
- `src/components/FilterableTh.jsx` (nuevo)
- `src/components/VistaControlCambios.jsx`
- `src/components/VistaProyectosBase.jsx`
- `src/components/VistaColaboradores.jsx`
- `src/components/AdministracionOC.jsx`
- `src/components/VistaOportunidades.jsx`

---
## [2026-02] â€” SeparaciÃ³n por empresa y correcciones

### Commits incluidos
- `ac5936a` Feat: Separar usuarios y OC por empresa (CGV / HUB MET)
- `f137023` UI: Actualizar logo a FCh50-Eslogan_blanco
- `d85293a` UI: Cambiar nombre a DeskFlow CGV y eliminar botÃ³n actualizar en AdminOC
- `91a0485` Debug: Agregar logs detallados en actualizaciÃ³n OC
- `168502c` Fix: Auto-recargar Mis Solicitudes al cambiar de vista

### Detalles
- Se separaron usuarios, solicitudes OC y destinatarios de correo por empresa (`CGV` / `HUB_MET`)
- Header muestra el nombre de empresa dinÃ¡micamente: `DeskFlow CGV` o `DeskFlow HUB MET`
- Logo actualizado a FCh50-Eslogan_blanco desde Supabase Storage
- Eliminado botÃ³n "Actualizar" manual en `AdministracionOC` (ahora recarga automÃ¡tico)
- `VistaSolicitudOC` recarga la vista "Mis Solicitudes" al cambiar entre vistas
- Logs de debug detallados en `actualizarSolicitud()` para diagnosticar problemas de RLS
- ConfiguraciÃ³n de correos obtenida desde tabla `configuracion_emails` en BD, con fallback hardcodeado

---

## [2026-01] â€” Fix ID Correlativo + DocumentaciÃ³n

> Ver detalle completo en [fix-id-correlativo.md](./fix-id-correlativo.md)

- UI: se removio el bloque superior de resumen y se agrego contenedor `Guardar Costeo` con nombre de proyecto y listado de proyectos guardados.
- Fix: `VistaSolicitudOC.jsx` â€” eliminada lÃ³gica de cÃ¡lculo manual de ID (`index + 1`)
- Fix: `VistaSolicitudOC.jsx` â€” usa `solicitud.id_correlativo` del registro insertado
- Fix: `AdministracionOC.jsx` â€” muestra `s.id_correlativo` en lugar de `index + 1`
- Fix: `api/enviar-email-oc.js` â€” usa `idCorrelativo` en subject y cuerpo del correo
- DB: `agregar-id-correlativo.sql` â€” agrega campo y secuencia PostgreSQL
- DB: `backfill-id-correlativo.sql` â€” asigna IDs retroactivos a registros existentes

---

## [2025-12] â€” Sistema de Solicitud OC

> Ver guÃ­a de instalaciÃ³n en `INSTALACION-SOLICITUD-OC.md` (eliminado del root, movido al historial)

- UI: se removio el bloque superior de resumen y se agrego contenedor `Guardar Costeo` con nombre de proyecto y listado de proyectos guardados.
- Feat: Nuevo mÃ³dulo `VistaSolicitudOC` â€” formulario completo de OC
- Feat: Upload de archivos adjuntos a Supabase Storage (bucket `oc-adjuntos`)
- Feat: EnvÃ­o de correo automÃ¡tico vÃ­a Gmail/Nodemailer (Vercel Function `/api/enviar-email-oc`)
- Feat: `AdministracionOC` â€” vista admin para gestionar solicitudes
- Feat: `GestionCecos` â€” panel admin para asignar CECOs a proyectos
- DB: `setup-solicitud-oc.sql` â€” tablas `proyectos_ceco` y `solicitudes_oc`
- DB: `agregar-sol-netsuite.sql` â€” campo `sol_netsuite` en `solicitudes_oc`

### Validaciones implementadas
- Valor < $1,500,000 â†’ mÃ­nimo 1 adjunto
- Valor â‰¥ $1,500,000 â†’ mÃ­nimo 3 adjuntos
- TamaÃ±o mÃ¡ximo por archivo: 10 MB
- Tipos permitidos: PDF, JPG, PNG, Excel

---

## [2025-11] â€” ReestructuraciÃ³n de Proyectos

- UI: se removio el bloque superior de resumen y se agrego contenedor `Guardar Costeo` con nombre de proyecto y listado de proyectos guardados.
- Refactor: Tabla `proyectos` simplificada de 4+ campos a solo PROYECTO + CECO + JEFE
- Feat: Nueva tabla `oportunidades` separada de proyectos
- Feat: `VistaProyectosBase` â€” vista independiente para gestionar proyectos base
- Feat: `VistaOportunidades` â€” vista para gestionar oportunidades con importaciÃ³n Excel
- DB: `restructurar-proyectos.sql` â€” migraciÃ³n completa con 43 proyectos CGV insertados
- DB: `crear-tabla-oportunidades.sql` â€” tabla separada de oportunidades
- DB: `fix-ceco-field.sql` â€” ajuste del campo CECO

---

## [2025-10] â€” Sistema Base

- UI: se removio el bloque superior de resumen y se agrego contenedor `Guardar Costeo` con nombre de proyecto y listado de proyectos guardados.
- Feat: Setup inicial React + Vite + Tailwind CSS
- Feat: AutenticaciÃ³n con Supabase Auth
- Feat: Dashboard principal con mÃ©tricas y grÃ¡ficos (Recharts)
- Feat: `VistaControlCambios` â€” vista de auditorÃ­a de cambios
- Feat: `VistaSugerencias` â€” sistema de sugerencias con votaciÃ³n
- Feat: `ConfiguracionUsuarios` â€” panel admin de usuarios
- Feat: Sistema de favoritos por usuario
- Feat: Exportar a Excel y PDF (jsPDF + xlsx)
- Feat: ImportaciÃ³n Excel de proyectos y oportunidades














## [2026-02-26] - Costeo: separacion de costos RH y Operacionales en Nuevo costeo

- En `VistaCosteoInputs` se separo el bloque `Costos` en dos contenedores:
  - `Costo de Recurso Humano`
  - `Costos Operacionales`
- Cada contenedor permite agregar/editar/quitar items en su propio tipo.
- La matriz de `Temporalidad de Proyecto` mantiene meses como columnas y ahora renderiza filas agrupadas:
  - primero `GASTO_RH`
  - luego `GASTO_OPERACIONAL`
- Se ajusto el calculo de totales por item para usar clave por `row.id`.

### Archivos modificados
- `src/components/VistaCosteoInputs.jsx`
- Se agrego decision obligatoria de `IVA` (Si/No) en tabla de `Costeo`:
  - se calcula `IVA ($)` con 19% sobre `Pricing (sin IVA)` cuando aplica
  - se actualiza `Pricing (+ IVA)` en base a la seleccion
  - bloqueo de guardado de costeo si IVA no esta definido
- Se persiste `ivaAplica` dentro del snapshot y metadata en Supabase.
- Exportacion Excel de costeo ahora incluye arriba la matriz completa de `Temporalidad de Proyecto` (items, tipo, meses y total).

## [2026-02-26] - Control de Cambios: refresco inmediato de cambios de valores

- Se conecto `VistaOportunidades` con callback a `App` para recargar `cambios` tras registrar auditoria en:
  - edicion de valores (ingresos/hh/gastos)
  - cambios de estado
  - eliminacion de oportunidad
- Con esto, la pestaña `Cambios de Valores` se actualiza sin necesidad de recargar manualmente la app.

### Archivos modificados
- `src/App.jsx`
- `src/components/VistaOportunidades.jsx`

## [2026-02-26] - Control de Cambios: criterio correcto para Valores vs Proyectos

- `Cambios de Valores` ahora muestra solo cambios de campos numericos: `INGRESOS`, `HH`, `GGOO`/`GASTOS`.
- `OPORTUNIDAD ELIMINADA` se mueve a la vista `Cambios de Proyectos`.
- `Estados` se mantiene exclusivo para cambios de campo `ESTADO`.

### Archivos modificados
- `src/App.jsx`
