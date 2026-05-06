# Plan: Limpieza Estructural de Base de Datos

Objetivo: eliminar toda la deuda técnica de la BDD. Cada cambio se hace en orden.
Estado: `[ ]` pendiente · `[x]` hecho · `[~]` en progreso

---

## Resumen de problemas

| # | Problema | Riesgo | Dificultad |
|---|----------|--------|------------|
| 1 | `colaboradores_costos` no tiene PK `id` (pero el código ya hace `.eq('id', id)`) | **Bug activo** — UPDATE/DELETE silenciosamente no funcionan | Baja |
| 2 | `horas_proyectadas.colaborador` es texto libre, sin FK | Datos huérfanos, typos invisibles | Media |
| 3 | `horas_proyectadas.proyecto` es texto libre redundante junto al FK `proyecto_id` | Doble fuente de verdad, puede divergir | Media |
| 4 | `colaboradores_costos.colaborador` es texto libre, sin FK | Igual que #2 | Media |
| 5 | `proyectos.ceco` es texto libre, sin FK a `lineas` | Renombrar una línea rompe proyectos silenciosamente | Media |
| 6 | Sin CHECK en `mes` (ni en `horas_proyectadas` ni en `colaboradores_costos`) | Cualquier string entra como mes | Baja |
| 7 | `cambios.proyecto_nombre` es texto redundante junto al FK `proyecto_id` | Denormalización — **NOTA: intencional para auditoría histórica** | — |

> **Nota sobre #7**: Los logs de auditoría deben capturar el nombre *en el momento del cambio*, no un FK vivo que puede cambiar después. `proyecto_nombre` en `cambios` es correcto tal como está. Se documenta como intencional y no se modifica.

---

## FASE 0 — Quick wins (solo SQL, sin tocar frontend)

### 0.1 — Agregar PK `id` a `colaboradores_costos` [ ]

**Por qué urgente**: el código ya hace `.eq('id', id)` en UPDATE y DELETE. Sin el campo, esas operaciones fallan silenciosamente.

```sql
-- Agregar columna id UUID con valor por defecto
ALTER TABLE colaboradores_costos
  ADD COLUMN id UUID DEFAULT gen_random_uuid();

-- Poblar los existentes (los NULL quedarán con UUID generado)
UPDATE colaboradores_costos SET id = gen_random_uuid() WHERE id IS NULL;

-- Hacer la columna NOT NULL y PK
ALTER TABLE colaboradores_costos ALTER COLUMN id SET NOT NULL;
ALTER TABLE colaboradores_costos ADD PRIMARY KEY (id);
```

**Verificar:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'colaboradores_costos' AND column_name = 'id';
```

---

### 0.2 — CHECK constraint en `mes` [ ]

Garantiza formato `xxx-YY` (ej: `ene-25`) en ambas tablas.

```sql
-- Primero verificar que los datos existentes son válidos
SELECT DISTINCT mes FROM horas_proyectadas
WHERE mes !~ '^[a-z]{3}-\d{2}$' ORDER BY mes;

SELECT DISTINCT mes FROM colaboradores_costos
WHERE mes !~ '^[a-z]{3}-\d{2}$' ORDER BY mes;

-- Si las dos queries anteriores devuelven 0 filas, aplicar constraints:
ALTER TABLE horas_proyectadas
  ADD CONSTRAINT chk_hp_mes CHECK (mes ~ '^[a-z]{3}-\d{2}$');

ALTER TABLE colaboradores_costos
  ADD CONSTRAINT chk_cc_mes CHECK (mes ~ '^[a-z]{3}-\d{2}$');
```

---

## FASE 1 — FK `colaborador_id` en `colaboradores_costos` [ ]

Agrega integridad referencial sin romper el código actual (que sigue usando el campo texto).

### 1.1 — Agregar columna y poblarla [ ]

```sql
-- Agregar columna nullable
ALTER TABLE colaboradores_costos
  ADD COLUMN colaborador_id UUID REFERENCES colaboradores(id);

-- Poblar desde el texto (join por nombre exacto)
UPDATE colaboradores_costos cc
SET colaborador_id = c.id
FROM colaboradores c
WHERE c.colaborador = cc.colaborador;

-- Ver cuántos quedaron sin match (deberían ser 0)
SELECT COUNT(*) FROM colaboradores_costos WHERE colaborador_id IS NULL;
```

### 1.2 — Hacer NOT NULL y agregar índice [ ]

Solo ejecutar si la query anterior devolvió 0.

```sql
ALTER TABLE colaboradores_costos
  ALTER COLUMN colaborador_id SET NOT NULL;

CREATE INDEX idx_cc_colaborador_id ON colaboradores_costos(colaborador_id);
```

### 1.3 — Actualizar `VistaColaboradoresCostos.jsx` (escritura) [ ]

Al insertar/actualizar, escribir también `colaborador_id`:
- En `importarExcel`: lookup `colaboradoresMap[normalize(nombre)]?.id` y agregar al objeto de insert.
- En `guardarCelda` cuando `col === 'colaborador'`: actualizar también `colaborador_id`.

### 1.4 — Mantener `colaborador` texto por ahora [ ]

Los lectores (Dashboard, VistaProyectosBase, etc.) todavía usan el texto para el map. Se elimina en Fase 3.

---

## FASE 2 — FK `colaborador_id` en `horas_proyectadas` [ ]

### 2.1 — Agregar columna y poblarla [ ]

```sql
ALTER TABLE horas_proyectadas
  ADD COLUMN colaborador_id UUID REFERENCES colaboradores(id);

UPDATE horas_proyectadas hp
SET colaborador_id = c.id
FROM colaboradores c
WHERE c.colaborador = hp.colaborador;

-- Verificar orphans
SELECT colaborador, COUNT(*) FROM horas_proyectadas
WHERE colaborador_id IS NULL
GROUP BY colaborador ORDER BY COUNT(*) DESC;
```

### 2.2 — Hacer NOT NULL [ ]

Solo si no hay orphans.

```sql
ALTER TABLE horas_proyectadas
  ALTER COLUMN colaborador_id SET NOT NULL;

CREATE INDEX idx_hp_colaborador_id ON horas_proyectadas(colaborador_id);
```

### 2.3 — Actualizar `VistaHorasProyectadas.jsx` (escritura) [ ]

- `confirmarAgregar`: agregar `colaborador_id` al insert (lookup desde `colaboradoresLista`).
- `guardarCelda` cuando `col === 'colaborador'`: actualizar también `colaborador_id`.
- `importarExcel`: agregar `colaborador_id` al objeto construido.

---

## FASE 3 — Migrar lectores al FK y eliminar columnas texto [ ]

Esta es la fase más larga. Cada lector pasa de usar `normalize(texto)` a usar `colaborador_id` / `proyecto_id` directamente.

### 3.1 — Migrar `VistaProyectosBase` a usar IDs [ ]

`cargarCostosHorasProyectadas`:
- En la query de `horas_proyectadas`, cambiar `select('proyecto, horas, colaborador, mes')` → `select('proyecto_id, horas, colaborador_id, mes')`.
- En la query de `colaboradores_costos`, ya existe `colaborador_id` → usarlo como clave del mapa en vez del texto normalizado.
- Cambiar `costos[normalizar(f.proyecto)]` → `costos[f.proyecto_id]`.
- Cambiar `costoPorProyecto[normalizar(p.nombre)]` → `costoPorProyecto[p.id]` en el render.

### 3.2 — Migrar `Dashboard.jsx` a usar IDs [ ]

Mismo patrón que 3.1: reemplazar los mapas indexados por nombre normalizado por mapas indexados por UUID.

### 3.3 — Migrar `VistaSeguimientoFinanciero.jsx` a usar IDs [ ]

Mismo patrón.

### 3.4 — Migrar `VistaHorasProyectadas.jsx` completamente [ ]

- Lecturas: filtros y display ya usan objetos cargados, verificar que no queden referencias a `.proyecto` texto.
- Costos: usar `colaborador_id` para el mapa.

### 3.5 — Eliminar columnas texto [ ]

Solo ejecutar después de verificar que NINGÚN componente lee las columnas texto.

```sql
-- Eliminar proyecto texto (ya existe proyecto_id)
ALTER TABLE horas_proyectadas DROP COLUMN proyecto;

-- Eliminar colaborador texto
ALTER TABLE horas_proyectadas DROP COLUMN colaborador;

-- Eliminar colaborador texto de costos
ALTER TABLE colaboradores_costos DROP COLUMN colaborador;
```

---

## FASE 4 — FK `linea_id` en `proyectos` [ ]

### 4.1 — Verificar unicidad en `lineas` [ ]

```sql
-- Ver si hay nombres duplicados de línea
SELECT linea, COUNT(*) FROM lineas GROUP BY linea HAVING COUNT(*) > 1;
```

### 4.2 — Agregar columna y poblarla [ ]

```sql
ALTER TABLE proyectos
  ADD COLUMN linea_id UUID REFERENCES lineas(id);

UPDATE proyectos p
SET linea_id = l.id
FROM lineas l
WHERE l.linea = p.ceco;

-- Verificar orphans
SELECT ceco, COUNT(*) FROM proyectos
WHERE linea_id IS NULL AND ceco IS NOT NULL
GROUP BY ceco;
```

### 4.3 — Actualizar escritores [ ]

- `VistaProyectosBase.jsx`: en `crearProyecto` y `guardarEdicion`, resolver `linea_id` desde el nombre seleccionado.
- `importarExcel`: incluir `linea_id` en el insert.

### 4.4 — Migrar lectores y eliminar `ceco` texto [ ]

- `VistaHorasProyectadas.jsx`: usa `proyectos.ceco` para mostrar la línea. Cambiar a `proyectos.lineas:linea_id(linea)`.
- `Dashboard.jsx`: filtra por `proyectos.ceco`. Cambiar a FK join.
- Eliminar `proyectos.ceco` texto una vez todos los lectores migren.

---

## Checklist final — antes de cerrar

- [ ] 0 columnas UUID con valor NULL no intencionado
- [ ] 0 campos texto duplicando información cubierta por FK
- [ ] Todos los INSERT/UPDATE en frontend escriben ambas columnas (texto + FK) durante la transición, y solo FK al terminar
- [ ] CHECK constraints activos en `mes`
- [ ] `colaboradores_costos` tiene PK `id`
- [ ] `horas_proyectadas` tiene FK para `proyecto_id` (NOT NULL) y `colaborador_id` (NOT NULL)
- [ ] `colaboradores_costos` tiene FK para `colaborador_id` (NOT NULL)
- [ ] `proyectos` tiene FK para `linea_id`
- [ ] `proyectos.jefe_id` FK a `colaboradores` ✅ (ya hecho)
- [ ] `proyectos.financista_id` FK a `financistas` ✅ (ya hecho)
- [ ] `horas_proyectadas.proyecto_id` FK a `proyectos` ✅ (ya hecho)
- [ ] `cambios.proyecto_nombre` documentado como intencional (auditoría histórica) ✅

---

## Orden de ejecución recomendado

```
Fase 0.1 → (bug activo, ejecutar hoy)
Fase 0.2 → (validar datos primero)
Fase 1   → (colaboradores_costos completo)
Fase 2   → (horas_proyectadas.colaborador_id)
Fase 3   → (migrar lectores — sprint largo)
Fase 4   → (proyectos.linea_id — sprint independiente)
```

Las fases 1-2 se pueden hacer sin afectar a los usuarios (agregan columnas, no eliminan).
La fase 3 requiere coordinar que todos los lectores estén actualizados antes de eliminar las columnas texto.
