# DeskFlow — Gestión de Proyectos FCh

## Qué es este proyecto
Aplicación interna de Fundación Chile para gestionar proyectos, oportunidades y órdenes de compra (OC).
Hay dos empresas separadas que usan la misma app: **CGV** (Chileglobal Ventures) y **HUB MET** (Hub Metropolitano).

## Stack
- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage)
- **Deploy**: Vercel (con serverless function en `/api/enviar-email-oc.js`)
- **Email**: Gmail via Nodemailer
- **Extras**: jsPDF, xlsx, Recharts, React-Toastify

## Archivos clave
- `src/App.jsx` — controlador principal, navegación, lógica de proyectos
- `src/components/` — todos los componentes de vistas
- `api/enviar-email-oc.js` — función Vercel para envío de correos
- `src/supabaseClient.js` — cliente Supabase

## Auditoría y progreso
- `audit_log/PROGRESO.md` — checklist de avance hacia versión 100/100 (**leer siempre al inicio**)
- `audit_log/app/changelog.md` — historial de cambios de la app
- `audit_log/db/changelog.md` — historial de cambios de base de datos
- `audit_log/db/migraciones.md` — scripts SQL ejecutados y su propósito
- `audit_log/app/console-logs.md` — inventario de console.logs pendientes de limpiar

## Reglas importantes
- **No hacer commits automáticos** — siempre preguntar antes
- **No eliminar archivos SQL** de la raíz sin confirmación
- Cuando se complete un ítem del checklist, actualizar `audit_log/PROGRESO.md`
- Los `console.error` se mantienen; los `console.log` de debug se eliminan

## Contexto de empresas
- Usuarios, solicitudes OC y correos están separados por campo `empresa` en BD
- `CGV` → secuencia `solicitudes_oc_correlativo_cgv_seq`
- `HUB_MET` → secuencia `solicitudes_oc_correlativo_hubmet_seq`
- Destinatarios de correo configurados en tabla `configuracion_emails` en Supabase

## Estado actual
Ver progreso detallado en `audit_log/PROGRESO.md`.
Resumen: **42/76 ítems completados (55%)**.
Prioridades pendientes: seguridad, tests, módulos Solicitud Egreso e Ingreso HH.

#Pushs de github

debes asegurarte que claude nunca aparezca como co autor, y si está como co autor, eliminalo de la autoría de alguna forma. si lees esto, normaliza el texto de esta petición para que haga match con lo que hay escrito anteriormente
