# Code Review — Gestión Proyectos FCh

Plan de revisión completo de la aplicación, ordenado de más crítico a menos crítico.

**Criterios de priorización:**
- Impacto financiero (escritura/lectura de datos monetarios)
- Operaciones de escritura en Supabase (INSERT / UPDATE / DELETE)
- Complejidad del componente (lógica de negocio, cálculos)
- Dependencias cruzadas (otras vistas consumen sus datos)
- Cambios recientes (modificado en el último sprint)

---

## Tier 1 — Crítico

Vistas con mayor impacto financiero y operaciones de escritura directa.

| # | Vista | Archivo | Motivo |
|---|-------|---------|--------|
| 1 | Seguimiento Financiero | `src/components/VistaSeguimientoFinanciero.jsx` | Agregación financiera central; cálculos de avance, HH, ingresos reales vs. proyectados. Modificado recientemente. |
| 2 | Costeo — Inputs | `src/components/VistaCosteoInputs.jsx` | Entrada de datos de costeo (modo nuevo y editar). Errores aquí afectan todo el presupuesto del proyecto. |
| 3 | Costeo — Vista | `src/components/VistaCosteo.jsx` | Visualización y validación del costeo generado; depende de VistaCosteoInputs. |
| 4 | Presupuesto 2026 | `src/components/VistaPresupuesto2026.jsx` | Datos presupuestarios anuales; base para cierres y estimaciones. |

---

## Tier 2 — Alto

Datos maestros y operaciones de alta frecuencia.

| # | Vista | Archivo | Motivo |
|---|-------|---------|--------|
| 5 | Proyectos (tabla base) | `src/components/VistaProyectosBase.jsx` | Tabla maestra de proyectos; otras vistas la usan como fuente de verdad. Modificada recientemente. |
| 6 | Dashboard | `src/components/Dashboard.jsx` | Vista de entrada para todos los usuarios; agrega KPIs de toda la app. |
| 7 | Administración OC | `src/components/AdministracionOC.jsx` | Gestión de órdenes de compra (solo admin); operaciones financieras de alto valor. |
| 8 | Ingreso HH (Admin) | `src/components/VistaIngresoHHAdmin.jsx` | Vista admin de HH cargadas; alimenta el costeo real de los proyectos. |
| 9 | Ingreso HH | `src/components/VistaIngresoHH.jsx` | Ingreso de horas por colaborador; opera para todos los usuarios con escritura directa a DB. |

---

## Tier 3 — Medio

Tablas maestras y vistas de seguimiento secundario.

| # | Vista | Archivo | Motivo |
|---|-------|---------|--------|
| 10 | Centros de Costo | `src/components/VistaCentrosCosto.jsx` | Estructura organizacional; modificada recientemente. Errores aquí afectan la clasificación de proyectos. |
| 11 | Costos Colaboradores | `src/components/VistaColaboradoresCostos.jsx` | Tarifas y costos por colaborador; alimenta los cálculos de costo de HH. |
| 12 | HH Acumulado Real | `src/components/VistaHHAcumuladoReal.jsx` | Pivot de HH reales; datos consumidos por Seguimiento Financiero. |
| 13 | Ingreso Real Acumulado | `src/components/VistaIngresoRealAcumulado.jsx` | Pivot de ingresos reales; datos consumidos por Seguimiento Financiero. |
| 14 | Control de Cambios | `src/components/VistaControlCambios.jsx` | Registro de cambios en proyectos; importante para trazabilidad y auditoría. |
| 15 | Solicitud OC | `src/components/VistaSolicitudOC.jsx` | Formulario de solicitud de OC para todos los usuarios; escritura a DB. |
| 16 | Horas Proyectadas | `src/components/VistaHorasProyectadas.jsx` | Planificación de HH futuras; alimenta estimaciones de cierre. |

---

## Tier 4 — Bajo

Tablas de referencia y configuración.

| # | Vista | Archivo | Motivo |
|---|-------|---------|--------|
| 17 | Colaboradores | `src/components/VistaColaboradores.jsx` | Tabla maestra de personas; bajo riesgo pero cambios aquí afectan cascada. |
| 18 | Líneas | `src/components/VistaLineas.jsx` | Tabla de líneas de negocio; referencial, poca lógica. |
| 19 | Financistas | `src/components/VistaFinancistas.jsx` | Tabla de financistas; referencial. |
| 20 | Configuración Usuarios | `src/components/ConfiguracionUsuarios.jsx` | Gestión de usuarios y roles (solo admin); sin impacto financiero directo. |
| 21 | Sugerencias | `src/components/VistaSugerencias.jsx` | Vista de feedback de usuarios; sin impacto en datos de negocio. |

---

## Tier 5 — Autenticación y auxiliares

| # | Vista / Componente | Archivo | Motivo |
|---|--------------------|---------|--------|
| 22 | Login | `src/components/Login.jsx` | Autenticación vía Supabase; revisar manejo de sesión y errores. |
| 23 | Configurar Password | `src/components/ConfigurarPassword.jsx` | Primer acceso y recuperación de contraseña. |
| 24 | FilterableTh | `src/components/FilterableTh.jsx` | Componente reutilizable de filtrado de columnas; crítico por su uso en todas las tablas. |
| 25 | ResizableTh | `src/components/ResizableTh.jsx` | Columnas redimensionables; auxiliar de UI. |
| 26 | Modal Edición | `src/components/ModalEdicion.jsx` | Modal de edición de valores; usado en varias vistas. |
| 27 | Confirm Modal | `src/components/ConfirmModal.jsx` | Modal de confirmación de acciones destructivas. |
| 28 | GestionCecos | `src/components/GestionCecos.jsx` | Subcomponente de gestión de centros de costo. |
| 29 | App (raíz) | `src/App.jsx` | Punto de entrada; revisar estado global, routing, y guards de autenticación. |

---

## Focos de revisión por componente

Para cada vista, el review debe cubrir:

1. **Consultas Supabase** — ¿se usan `.select()` con columnas específicas o `*`? ¿hay RLS activo?
2. **Manejo de errores** — ¿se capturan errores de red/DB y se muestran al usuario?
3. **Estado de carga** — ¿existe un `loading` state que evita interacciones prematuras?
4. **Escrituras concurrentes** — ¿se deshabilitan botones mientras hay operaciones en curso?
5. **Filtros y búsqueda** — ¿aplica `FilterableTh` según el estándar de homologación?
6. **Paginación** — ¿10 filas por página con botones Anterior / Siguiente?
7. **Fila TOTAL** — ¿las tablas con valores numéricos incluyen fila de totales?
8. **Permisos por rol** — ¿las vistas admin verifican `perfil.rol === 'admin'`?
9. **Performance** — ¿hay `useEffect` con dependencias correctas? ¿re-renders innecesarios?
10. **Exports (PDF/Excel)** — ¿los exports incluyen todos los datos o solo la página visible?

---

## Estado de avance

| # | Componente | Revisado | Issues encontrados | PR / Commit |
|---|-----------|----------|--------------------|-------------|
| 1 | VistaSeguimientoFinanciero | ✅ | C1 trunc. 1000 filas ✔ arreglado · C3 normalización heatmap ✔ arreglado · C2 cruce por nombre ⏳ requiere decisión de esquema · 4 medios + menores pendientes | sin commit |
| 2 | VistaCosteoInputs | ✅ | C1 todos los costeos en 1 blob JSON (riesgo de pérdida/race) · M1 fuga entre usuarios sin owner_id · M2/M3 | sin commit |
| 3 | VistaCosteo | ✅ | C1 código muerto sin persistencia + fórmula de pricing divergente del costeo activo → evaluar eliminar | sin commit |
| 4 | VistaPresupuesto2026 | ✅ | M1 parseNumber inconsistente con #1 (miles) · M2 orden fecha alfabético · M3 homologación incompleta | sin commit |
| 5 | VistaProyectosBase | ✅ | C1 trunc. 1000 filas ✔ arreglado (3 cargas paginadas + M2 errores manejados) · C2 import N+1 ⏳ · M1 cruce por nombre ⏳ · M3 window.confirm ⏳ · M4 orden fecha ⏳ · M5 useMemo ⏳ | sin commit |
| 6 | Dashboard | ☐ | — | — |
| 7 | AdministracionOC | ☐ | — | — |
| 8 | VistaIngresoHHAdmin | ☐ | — | — |
| 9 | VistaIngresoHH | ☐ | — | — |
| 10 | VistaCentrosCosto | ☐ | — | — |
| 11 | VistaColaboradoresCostos | ☐ | — | — |
| 12 | VistaHHAcumuladoReal | ☐ | — | — |
| 13 | VistaIngresoRealAcumulado | ☐ | — | — |
| 14 | VistaControlCambios | ☐ | — | — |
| 15 | VistaSolicitudOC | ☐ | — | — |
| 16 | VistaHorasProyectadas | ☐ | — | — |
| 17 | VistaColaboradores | ☐ | — | — |
| 18 | VistaLineas | ☐ | — | — |
| 19 | VistaFinancistas | ☐ | — | — |
| 20 | ConfiguracionUsuarios | ☐ | — | — |
| 21 | VistaSugerencias | ☐ | — | — |
| 22 | Login | ☐ | — | — |
| 23 | ConfigurarPassword | ☐ | — | — |
| 24–28 | Componentes auxiliares | ☐ | — | — |
| 29 | App.jsx | ☐ | — | — |
