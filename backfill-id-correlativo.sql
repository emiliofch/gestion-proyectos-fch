-- =====================================================
-- Backfill id_correlativo para registros existentes
-- =====================================================
-- Este script asigna IDs correlativos a todos los
-- registros existentes basándose en fecha_creacion
-- =====================================================

-- Asignar IDs correlativos a registros existentes
-- Los registros se ordenan por fecha_creacion (más antiguos primero)
-- y se les asigna un número correlativo (1, 2, 3, ...)

WITH solicitudes_ordenadas AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY fecha_creacion ASC, id ASC) AS nuevo_correlativo
  FROM solicitudes_oc
  WHERE id_correlativo IS NULL
)
UPDATE solicitudes_oc
SET id_correlativo = solicitudes_ordenadas.nuevo_correlativo
FROM solicitudes_ordenadas
WHERE solicitudes_oc.id = solicitudes_ordenadas.id;

-- Actualizar la secuencia al máximo valor actual
SELECT setval('solicitudes_oc_correlativo_seq', (SELECT MAX(id_correlativo) FROM solicitudes_oc));

-- Verificar los resultados
SELECT
  id_correlativo,
  proveedor,
  valor,
  fecha_creacion,
  usuario_email
FROM solicitudes_oc
ORDER BY id_correlativo ASC;

-- Verificar que no haya duplicados
SELECT
  id_correlativo,
  COUNT(*) as cantidad
FROM solicitudes_oc
GROUP BY id_correlativo
HAVING COUNT(*) > 1;

-- =====================================================
-- RESULTADO ESPERADO:
-- - Todos los registros existentes tienen id_correlativo
-- - No hay duplicados
-- - Los IDs son correlativos: 1, 2, 3, 4...
-- - La secuencia está configurada para el siguiente número
-- =====================================================
