# Tabla `cambios` — Auditoría de la Aplicación

La tabla `cambios` es el registro central de auditoría de DeskFlow.
Registra automáticamente cada modificación realizada en proyectos y oportunidades.

---

## Esquema

```sql
CREATE TABLE cambios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidad_id  UUID REFERENCES oportunidades(id) ON DELETE CASCADE,
  proyecto_id     UUID REFERENCES proyectos(id) ON DELETE CASCADE,
  campo           VARCHAR(100),         -- Nombre del campo modificado
  valor_anterior  TEXT,                 -- Valor antes del cambio
  valor_nuevo     TEXT,                 -- Valor después del cambio
  usuario         VARCHAR(255),         -- Email del usuario que hizo el cambio
  motivo          TEXT,                 -- Motivo ingresado por el usuario
  tipo_cambio     VARCHAR(50),          -- 'valor', 'oportunidad', 'proyecto'
  proyecto_nombre VARCHAR(255),         -- Nombre del proyecto (desnormalizado para queries rápidas)
  fecha           TIMESTAMP DEFAULT NOW()
);
```

## Índices

```sql
CREATE INDEX idx_cambios_oportunidad ON cambios(oportunidad_id);
CREATE INDEX idx_cambios_proyecto    ON cambios(proyecto_id);
CREATE INDEX idx_cambios_fecha       ON cambios(fecha DESC);
```

## Políticas RLS

| Política | Tipo | Regla |
|---|---|---|
| "Users can view cambios" | SELECT | `USING (true)` — todos pueden ver |
| "Authenticated users can insert cambios" | INSERT | `WITH CHECK (auth.uid() IS NOT NULL)` |

> No hay UPDATE ni DELETE permitido para usuarios normales. Solo el sistema inserta.

---

## Tipos de Cambio (`tipo_cambio`)

| Valor | Cuándo se usa | Campos relevantes |
|---|---|---|
| `'valor'` | Cambio en ingresos/gastos/HH de un proyecto | `campo`, `valor_anterior`, `valor_nuevo`, `motivo` |
| `'oportunidad'` | Creación o modificación de una oportunidad | `campo`, `valor_anterior`, `valor_nuevo`, `motivo` |
| `'proyecto'` | Creación, edición o eliminación de un proyecto | `campo` puede ser 'PROYECTO CREADO', 'NOMBRE', 'CECO', 'JEFE', 'PROYECTO ELIMINADO' |

---

## Campos especiales en `campo`

| Valor | Significa |
|---|---|
| `'PROYECTO CREADO'` | Se creó un nuevo proyecto |
| `'PROYECTO ELIMINADO'` | Se eliminó un proyecto |
| `'OPORTUNIDAD CREADA'` | Se importó una oportunidad desde Excel |
| `'INGRESOS'` | Se modificaron los ingresos de una oportunidad |
| `'HH'` | Se modificaron las horas-hombre |
| `'GGOO'` o `'GASTOS'` | Se modificaron los gastos |
| `'NOMBRE'` | Se cambió el nombre del proyecto |
| `'CECO'` | Se cambió el centro de costo |
| `'JEFE'` | Se cambió el jefe de proyecto |

---

## Cómo se usa en la app

### Inserción automática (desde el código)

Cada vez que el usuario modifica un valor, el código hace un INSERT en `cambios`:

```javascript
// Ejemplo: edición de oportunidad (VistaOportunidades.jsx)
await supabase.from('cambios').insert({
  proyecto_id: oportunidad.proyecto_id,
  campo: campo.toUpperCase(),
  valor_anterior: valorAnterior?.toString() || '0',
  valor_nuevo: valorNuevo.toString(),
  usuario: user?.email || 'sistema',
  motivo: motivoCambio,
  tipo_cambio: 'oportunidad',
  proyecto_nombre: oportunidad.proyectos?.nombre
})
```

### Vista en la UI

El componente `VistaControlCambios.jsx` muestra este historial al usuario:
- Modo "Cambios de Valores": filtra por `tipo_cambio = 'valor'` o `'oportunidad'`
- Modo "Cambios de Proyectos": filtra por `tipo_cambio = 'proyecto'`

---

## Queries de Auditoría Útiles

```sql
-- Últimos 50 cambios
SELECT
  c.fecha,
  c.usuario,
  c.proyecto_nombre,
  c.campo,
  c.valor_anterior,
  c.valor_nuevo,
  c.motivo,
  c.tipo_cambio
FROM cambios c
ORDER BY c.fecha DESC
LIMIT 50;

-- Cambios por usuario
SELECT usuario, COUNT(*) as total_cambios
FROM cambios
GROUP BY usuario
ORDER BY total_cambios DESC;

-- Cambios en las últimas 24 horas
SELECT *
FROM cambios
WHERE fecha > NOW() - INTERVAL '24 hours'
ORDER BY fecha DESC;

-- Historial completo de un proyecto
SELECT *
FROM cambios
WHERE proyecto_nombre ILIKE '%3751%'
ORDER BY fecha DESC;

-- Proyectos más modificados
SELECT proyecto_nombre, COUNT(*) as cambios
FROM cambios
WHERE tipo_cambio IN ('valor', 'oportunidad')
GROUP BY proyecto_nombre
ORDER BY cambios DESC
LIMIT 20;
```

---

## Notas de mantenimiento

- El campo `proyecto_nombre` está desnormalizado por conveniencia (no hay JOIN necesario para mostrar el nombre)
- Si un proyecto se elimina, los cambios relacionados también se eliminan (`ON DELETE CASCADE`)
- No existe actualmente mecanismo para exportar el historial de cambios (pendiente en PROGRESO.md)
