# Audit Log - DeskFlow (Gestión de Proyectos FCh)

Este directorio centraliza toda la información de auditoría, debugging y seguimiento de progreso del proyecto.

## Estructura

```
audit_log/
├── README.md                    ← Este archivo
├── PROGRESO.md                  ← Checklist general de avance hacia versión 100/100
├── app/                         ← Logs y auditoría de la aplicación (frontend + API)
│   ├── changelog.md             ← Historial de cambios de la app
│   ├── debug-email.md           ← Guía de debugging para emails
│   ├── fix-id-correlativo.md    ← Documentación del fix de ID correlativo
│   └── console-logs.md          ← Inventario de console.logs (pendientes de limpiar)
└── db/
    ├── changelog.md             ← Historial de cambios de la base de datos
    ├── migraciones.md           ← Registro de scripts SQL ejecutados
    └── tabla-cambios.md         ← Documentación de la tabla de auditoría `cambios`
```

## Propósito

Mantener un registro ordenado y centralizado de:
- **App**: Cambios en componentes, APIs, debugging, fixes aplicados
- **DB**: Migraciones SQL, cambios de esquema, políticas RLS, índices

El objetivo es avanzar hacia una **versión 100/100** revisando cada aspecto del sistema.
Ver progreso actual en [PROGRESO.md](./PROGRESO.md).
