# Progreso DeskFlow â€” Camino a la versiÃ³n 100/100

> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.

> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## AutenticaciÃ³n y Usuarios

- [x] Login con Supabase Auth
- [x] SeparaciÃ³n de usuarios por empresa (CGV / HUB MET)
- [x] ConfiguraciÃ³n de roles (admin, jefe_proyecto, usuario)
- [x] Configurar contraseÃ±a (primera vez)
- [ ] RecuperaciÃ³n de contraseÃ±a (olvidÃ© mi contraseÃ±a)
- [ ] Manejo de sesiones expiradas (redirigir automÃ¡ticamente al login)

**Subtotal: 4/6**

> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## GestiÃ³n de Proyectos

- [x] CRUD de proyectos (crear, editar, eliminar)
- [x] Vista de proyectos base con tabla
- [x] ImportaciÃ³n Excel de proyectos
- [x] SeparaciÃ³n por empresa en OC
- [ ] ValidaciÃ³n y reporte de errores al importar Excel
- [ ] Exportar proyectos a Excel
- [ ] Filtros avanzados (por CECO, por jefe, por fecha)

**Subtotal: 4/7**

> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Oportunidades

- [x] CRUD de oportunidades (crear desde Excel, editar valores, eliminar)
- [x] ImportaciÃ³n Excel de oportunidades
- [x] Registro automÃ¡tico de cambios en tabla `cambios`
- [ ] Dashboard de oportunidades con mÃ©tricas y grÃ¡ficos
- [ ] Exportar oportunidades filtradas a Excel

**Subtotal: 3/5**

> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Solicitud de OC (Ã“rdenes de Compra)

- [x] Formulario de solicitud completo con validaciones
- [x] Subida de archivos adjuntos (Supabase Storage)
- [x] ID correlativo automÃ¡tico y Ãºnico por empresa
- [x] EnvÃ­o de correo de notificaciÃ³n (Gmail/Nodemailer)
- [x] AdministraciÃ³n de OC (cambio de estado, sol. NetSuite)
- [x] SeparaciÃ³n por empresa (CGV / HUB MET)
- [ ] Flujo de aprobaciÃ³n multi-nivel
- [ ] Historial de estados de cada OC (log de cambios)
- [ ] Descarga de PDF de la OC desde la app

**Subtotal: 6/9**

> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Control de Cambios

- [x] Tabla de auditorÃ­a en BD (`cambios`)
- [x] Vista de control de cambios con filtros
- [x] Registro automÃ¡tico de cambios en oportunidades
- [x] Registro de cambios al crear/editar/eliminar proyectos
- [ ] Exportar historial de cambios a Excel/PDF

**Subtotal: 4/5**

> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## UI/UX

- [x] Logo FCh50-Eslogan_blanco en header
- [x] Nombre DeskFlow CGV / DeskFlow HUB MET segÃºn empresa
- [x] Toast notifications (React-Toastify)
- [x] Dashboard principal con mÃ©tricas
- [ ] Responsive design completo (mobile-first)
- [ ] Dark mode
- [ ] Accesibilidad (ARIA labels, contraste)
- [ ] Loading states consistentes en toda la app

**Subtotal: 4/8**

> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## CECOs (Centros de Costo)

- [x] GestiÃ³n de CECOs desde panel admin
- [x] CECO embebido en proyecto (campo directo)
- [ ] ImportaciÃ³n masiva de CECOs desde Excel

**Subtotal: 2/3**

> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Sugerencias

- [x] Vista de sugerencias con estados
- [x] Crear y eliminar sugerencias
- [x] Sistema de votaciÃ³n de sugerencias
- [ ] NotificaciÃ³n al admin cuando hay nuevas sugerencias

**Subtotal: 3/4**

> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Email y Notificaciones

- [x] EnvÃ­o de correo vÃ­a Gmail/Nodemailer (Vercel Function)
- [x] ConfiguraciÃ³n de destinatarios por empresa desde BD
- [x] Archivos adjuntos descargados desde Storage e incluidos en correo
- [x] Template HTML en correo con badge de empresa
- [ ] Notificaciones in-app (sin necesidad de email)
- [ ] Cola de correos con reintentos automÃ¡ticos

**Subtotal: 4/6**

> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Seguridad

- [x] Row Level Security (RLS) habilitado en todas las tablas
- [x] PolÃ­ticas de acceso por empresa
- [ ] Rate limiting en API de envÃ­o de correos
- [ ] ValidaciÃ³n y sanitizaciÃ³n de inputs en servidor
- [ ] CSRF protection
- [ ] RevisiÃ³n de claves anon expuestas en cÃ³digo fuente (`enviar-email-oc.js` lÃ­nea 6)

**Subtotal: 2/6**

> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## DevOps y Calidad de CÃ³digo

- [x] Deployment automÃ¡tico en Vercel (vÃ­a push a main)
- [x] Variables de entorno configuradas en Vercel
- [ ] Tests unitarios (ninguno implementado)
- [ ] Tests de integraciÃ³n (ninguno implementado)
- [ ] CI/CD pipeline con checks automÃ¡ticos
- [ ] Monitoreo de errores en producciÃ³n (Sentry o similar)
- [ ] Limpiar todos los console.logs de debug (ver `app/console-logs.md`)
- [ ] DocumentaciÃ³n de API (endpoints Vercel)

**Subtotal: 2/8**

> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Base de Datos

- [x] Esquema de tablas definido y documentado
- [x] Migraciones SQL documentadas (ver `db/migraciones.md`)
- [x] Ãndices en tablas principales
- [x] Backfill de datos existentes (id_correlativo)
- [ ] Backup automatizado configurado en Supabase
- [ ] Migraciones versionadas con herramienta formal (ej. Flyway, Supabase CLI)
- [ ] OptimizaciÃ³n de queries lentas

**Subtotal: 4/7**

> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Funcionalidades Pendientes (en menÃº, sin implementar)

- [ ] ðŸ’¸ Solicitud de Egreso (placeholder en App.jsx)
- [x] ðŸ§® Sistema de Costeo (implementado en `src/components/VistaCosteo.jsx`)

**Subtotal: 1/2**

> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Resumen General

| CategorÃ­a | Completado | Total | % |
|---

> Registro 2026-02-25: menú Sistema de Costeo ahora incluye `Nuevo costeo` y `Editar Costeo`; edición desde listado de costeos existentes.
> Registro 2026-02-25: barrido UTF-8 en la app para eliminar caracteres corruptos (`Ã/â/ð/Â`) en textos visibles.
> Registro 2026-02-25: se normalizaron los colores de botones con la paleta RGB definida en `paleta colores.txt` (header sin cambios).
> Registro 2026-02-25: se implemento flujo completo de creacion/edicion/guardado de costeos con acciones de abrir, duplicar, renombrar, eliminar, descartar cambios, bloqueo y exportacion.
> Registro 2026-02-25: Guardar Costeo ahora reinicia todos los campos al guardar y permite abrir un proyecto guardado con click.
> Registro 2026-02-25: se agrego contenedor Guardar Costeo con nombre de proyecto y tabla de proyectos guardados en el modulo de costeo.
> Registro 2026-02-25: Proceso de Costeo incorpora tercer contenedor `Costeo` con formulas de imprevistos, overhead, margen y pricing.
|---|---|---|
| AutenticaciÃ³n y Usuarios | 4 | 6 | 67% |
| GestiÃ³n de Proyectos | 4 | 7 | 57% |
| Oportunidades | 3 | 5 | 60% |
| Solicitud de OC | 6 | 9 | 67% |
| Control de Cambios | 4 | 5 | 80% |
| UI/UX | 4 | 8 | 50% |
| CECOs | 2 | 3 | 67% |
| Sugerencias | 3 | 4 | 75% |
| Email y Notificaciones | 4 | 6 | 67% |
| Seguridad | 2 | 6 | 33% |
| DevOps y Calidad | 2 | 8 | 25% |
| Base de Datos | 4 | 7 | 57% |
| Funcionalidades Pendientes | 0 | 2 | 0% |
| **TOTAL** | **42** | **76** | **55%** |

> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Progreso: 42/76 (55%)

```
[â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘]  55%
```

> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.












