# DeskFlow â€” GestiÃ³n de Proyectos FCh

## QuÃ© es este proyecto
AplicaciÃ³n interna de FundaciÃ³n Chile para gestionar proyectos, oportunidades y Ã³rdenes de compra (OC).
Hay dos empresas separadas que usan la misma app: **CGV** (Chileglobal Ventures) y **HUB MET** (Hub Metropolitano).

## Stack
- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage)
- **Deploy**: Vercel (con serverless function en `/api/enviar-email-oc.js`)
- **Email**: Gmail via Nodemailer
- **Extras**: jsPDF, xlsx, Recharts, React-Toastify

## Archivos clave
- `src/App.jsx` â€” controlador principal, navegaciÃ³n, lÃ³gica de proyectos
- `src/components/` â€” todos los componentes de vistas
- `api/enviar-email-oc.js` â€” funciÃ³n Vercel para envÃ­o de correos
- `src/supabaseClient.js` â€” cliente Supabase

## AuditorÃ­a y progreso
- `audit_log/PROGRESO.md` â€” checklist de avance hacia versiÃ³n 100/100 (**leer siempre al inicio**)
- `audit_log/app/changelog.md` â€” historial de cambios de la app
- `audit_log/db/changelog.md` â€” historial de cambios de base de datos
- `audit_log/db/migraciones.md` â€” scripts SQL ejecutados y su propÃ³sito
- `audit_log/app/console-logs.md` â€” inventario de console.logs pendientes de limpiar

## Reglas importantes
- **No hacer commits automÃ¡ticos** â€” siempre preguntar antes
- **No eliminar archivos SQL** de la raÃ­z sin confirmaciÃ³n
- Cuando se complete un Ã­tem del checklist, actualizar `audit_log/PROGRESO.md`
- Los `console.error` se mantienen; los `console.log` de debug se eliminan

## Contexto de empresas
- Usuarios, solicitudes OC y correos estÃ¡n separados por campo `empresa` en BD
- `CGV` â†’ secuencia `solicitudes_oc_correlativo_cgv_seq`
- `HUB_MET` â†’ secuencia `solicitudes_oc_correlativo_hubmet_seq`
- Destinatarios de correo configurados en tabla `configuracion_emails` en Supabase

## Estado actual
Ver progreso detallado en `audit_log/PROGRESO.md`.
Resumen: **42/76 Ã­tems completados (55%)**.
Prioridades pendientes: seguridad, tests, mÃ³dulos Solicitud Egreso e Ingreso HH.

## Pushes de GitHub

- Nunca incluir coautoría de Claude en commits o PRs.
- Si aparece una coautoría no deseada, corregir autoría antes de publicar.

## Auditoría SonarQube

usarÃ¡n sonarqube para auditar el cÃ³digo de este proyecto, debes verificar que el cÃ³digo pase esa inspecciÃ³n

- SonarQube es una prioridad permanente: antes de cerrar una tarea, verificar impacto en seguridad, bugs, mantenibilidad y cobertura.
- Documento de trabajo obligatorio: `audit_log/PLAN_AUDITORIA_SONARQUBE.md` (leer al inicio de cada sesión técnica).


puedes agregar algo al agents.md para que a futuro, cada cambio que pida, esté pensado para pasar una auditoria de sonarqube