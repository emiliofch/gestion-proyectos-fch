# Progreso DeskFlow — Camino a la versión 100/100

> Registro 2026-03-05 (SonarQube): suite de tests en verde (26/26), cobertura actual 54.35% statements (coverage/lcov.info), CI de calidad creado en .github/workflows/ci.yml y workflow SonarQube creado en .github/workflows/sonarqube.yml (requiere SONAR_TOKEN y SONAR_HOST_URL para escaneo real).

> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar crear-tabla-costeo-procesos.sql.
## Autenticación y Usuarios

- [x] Login con Supabase Auth
- [x] Separación de usuarios por empresa (CGV / HUB MET)
- [x] Configuración de roles (admin, jefe_proyecto, usuario)
- [x] Configurar contraseña (primera vez)
- [ ] Recuperación de contraseña (olvidé mi contraseña)
- [ ] Manejo de sesiones expiradas (redirigir automáticamente al login)

**Subtotal: 4/6**

> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Gestión de Proyectos

- [x] CRUD de proyectos (crear, editar, eliminar)
- [x] Vista de proyectos base con tabla
- [x] Importación Excel de proyectos
- [x] Separación por empresa en OC
- [ ] Validación y reporte de errores al importar Excel
- [ ] Exportar proyectos a Excel
- [ ] Filtros avanzados (por CECO, por jefe, por fecha)

**Subtotal: 4/7**

> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Oportunidades

- [x] CRUD de oportunidades (crear desde Excel, editar valores, eliminar)
- [x] Importación Excel de oportunidades
- [x] Registro automático de cambios en tabla `cambios`
- [ ] Dashboard de oportunidades con métricas y gráficos
- [ ] Exportar oportunidades filtradas a Excel

**Subtotal: 3/5**

> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Solicitud de OC (Órdenes de Compra)

- [x] Formulario de solicitud completo con validaciones
- [x] Subida de archivos adjuntos (Supabase Storage)
- [x] ID correlativo automático y único por empresa
- [x] Envío de correo de notificación (Gmail/Nodemailer)
- [x] Administración de OC (cambio de estado, sol. NetSuite)
- [x] Separación por empresa (CGV / HUB MET)
- [ ] Flujo de aprobación multi-nivel
- [ ] Historial de estados de cada OC (log de cambios)
- [ ] Descarga de PDF de la OC desde la app

**Subtotal: 6/9**

> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Control de Cambios

- [x] Tabla de auditoría en BD (`cambios`)
- [x] Vista de control de cambios con filtros
- [x] Registro automático de cambios en oportunidades
- [x] Registro de cambios al crear/editar/eliminar proyectos
- [ ] Exportar historial de cambios a Excel/PDF

**Subtotal: 4/5**

> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## UI/UX

- [x] Logo FCh50-Eslogan_blanco en header
- [x] Nombre DeskFlow CGV / DeskFlow HUB MET según empresa
- [x] Toast notifications (React-Toastify)
- [x] Dashboard principal con métricas
- [ ] Responsive design completo (mobile-first)
- [ ] Dark mode
- [ ] Accesibilidad (ARIA labels, contraste)
- [ ] Loading states consistentes en toda la app

**Subtotal: 4/8**

> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## CECOs (Centros de Costo)

- [x] Gestión de CECOs desde panel admin
- [x] CECO embebido en proyecto (campo directo)
- [ ] Importación masiva de CECOs desde Excel

**Subtotal: 2/3**

> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Sugerencias

- [x] Vista de sugerencias con estados
- [x] Crear y eliminar sugerencias
- [x] Sistema de votación de sugerencias
- [ ] Notificación al admin cuando hay nuevas sugerencias

**Subtotal: 3/4**

> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Email y Notificaciones

- [x] Envío de correo vía Gmail/Nodemailer (Vercel Function)
- [x] Configuración de destinatarios por empresa desde BD
- [x] Archivos adjuntos descargados desde Storage e incluidos en correo
- [x] Template HTML en correo con badge de empresa
- [ ] Notificaciones in-app (sin necesidad de email)
- [ ] Cola de correos con reintentos automáticos

**Subtotal: 4/6**

> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Seguridad

- [x] Row Level Security (RLS) habilitado en todas las tablas
- [x] Políticas de acceso por empresa
- [ ] Rate limiting en API de envío de correos
- [ ] Validación y sanitización de inputs en servidor
- [ ] CSRF protection
- [ ] Revisión de claves anon expuestas en código fuente (`enviar-email-oc.js` línea 6)

**Subtotal: 2/6**

> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## DevOps y Calidad de Código

- [x] Deployment automático en Vercel (vía push a main)
- [x] Variables de entorno configuradas en Vercel
- [ ] Tests unitarios (ninguno implementado)
- [ ] Tests de integración (ninguno implementado)
- [ ] CI/CD pipeline con checks automáticos
- [ ] Monitoreo de errores en producción (Sentry o similar)
- [ ] Limpiar todos los console.logs de debug (ver `app/console-logs.md`)
- [ ] Documentación de API (endpoints Vercel)

**Subtotal: 2/8**

> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Base de Datos

- [x] Esquema de tablas definido y documentado
- [x] Migraciones SQL documentadas (ver `db/migraciones.md`)
- [x] Índices en tablas principales
- [x] Backfill de datos existentes (id_correlativo)
- [ ] Backup automatizado configurado en Supabase
- [ ] Migraciones versionadas con herramienta formal (ej. Flyway, Supabase CLI)
- [ ] Optimización de queries lentas

**Subtotal: 4/7**

> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Funcionalidades Pendientes (en menú, sin implementar)

- [ ] 💸 Solicitud de Egreso (placeholder en App.jsx)
- [x] 🧮 Sistema de Costeo (implementado en `src/components/VistaCosteo.jsx`)

**Subtotal: 1/2**

> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Resumen General

| Categoría | Completado | Total | % |
|---

> Registro 2026-02-25: men� Sistema de Costeo ahora incluye `Nuevo costeo` y `Editar Costeo`; edici�n desde listado de costeos existentes.
> Registro 2026-02-25: barrido UTF-8 en la app para eliminar caracteres corruptos (`�/�/�/�`) en textos visibles.
> Registro 2026-02-25: se normalizaron los colores de botones con la paleta RGB definida en `paleta colores.txt` (header sin cambios).
> Registro 2026-02-25: se implemento flujo completo de creacion/edicion/guardado de costeos con acciones de abrir, duplicar, renombrar, eliminar, descartar cambios, bloqueo y exportacion.
> Registro 2026-02-25: Guardar Costeo ahora reinicia todos los campos al guardar y permite abrir un proyecto guardado con click.
> Registro 2026-02-25: se agrego contenedor Guardar Costeo con nombre de proyecto y tabla de proyectos guardados en el modulo de costeo.
> Registro 2026-02-25: Proceso de Costeo incorpora tercer contenedor `Costeo` con formulas de imprevistos, overhead, margen y pricing.
|---|---|---|
| Autenticación y Usuarios | 4 | 6 | 67% |
| Gestión de Proyectos | 4 | 7 | 57% |
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

> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
## Progreso: 42/76 (55%)

```
[██████████████████████░░░░░░░░░░░░░░░░░░]  55%
```

> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.
> Registro 2026-03-05 (SonarQube): suite de tests en verde (`26/26`), cobertura actual `54.35%` statements (`coverage/lcov.info`), CI de calidad creado en `.github/workflows/ci.yml` y workflow SonarQube creado en `.github/workflows/sonarqube.yml` (requiere `SONAR_TOKEN` y `SONAR_HOST_URL` para escaneo real).`r`n`r`n> Registro 2026-02-25: Proceso de Costeo ahora persiste en Supabase (inputs, duracion y matriz por usuario/empresa). Requiere ejecutar `crear-tabla-costeo-procesos.sql`.















> Registro 2026-03-05 (cierre SonarQube): auditoria interna cerrada en modo **audit-ready** para tercero. El codigo queda preparado para evaluacion, y la corrida oficial de SonarQube + validacion de Quality Gate quedan a cargo del equipo auditor externo.
