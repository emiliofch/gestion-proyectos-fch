-- =====================================================
-- Agregar campo id_correlativo a solicitudes_oc
-- =====================================================
-- Este script agrega el campo id_correlativo para tener
-- un ID único, permanente y correlativo a nivel de BD
-- =====================================================

-- 1. Agregar columna id_correlativo
ALTER TABLE solicitudes_oc
ADD COLUMN IF NOT EXISTS id_correlativo INTEGER;

-- 2. Crear secuencia para auto-incremento
CREATE SEQUENCE IF NOT EXISTS solicitudes_oc_correlativo_seq;

-- 3. Establecer el valor inicial de la secuencia basado en registros existentes
-- Si no hay registros, la secuencia empieza en 1
DO $$
DECLARE
  max_id INTEGER;
BEGIN
  SELECT COALESCE(MAX(id_correlativo), 0) INTO max_id FROM solicitudes_oc WHERE id_correlativo IS NOT NULL;

  IF max_id = 0 THEN
    -- No hay registros con id_correlativo, reiniciar secuencia a 1
    PERFORM setval('solicitudes_oc_correlativo_seq', 1, false);
  ELSE
    -- Hay registros, establecer secuencia al máximo + 1
    PERFORM setval('solicitudes_oc_correlativo_seq', max_id);
  END IF;
END $$;

-- 4. Establecer id_correlativo como NOT NULL con valor por defecto
-- (primero asignaremos valores a los registros existentes)
ALTER TABLE solicitudes_oc
ALTER COLUMN id_correlativo SET DEFAULT nextval('solicitudes_oc_correlativo_seq');

-- 5. Crear índice único para id_correlativo
CREATE UNIQUE INDEX IF NOT EXISTS idx_solicitudes_oc_correlativo
ON solicitudes_oc(id_correlativo);

-- 6. Verificar la estructura
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'solicitudes_oc'
AND column_name = 'id_correlativo';

-- =====================================================
-- RESULTADO ESPERADO:
-- column_name     | data_type | is_nullable | column_default
-- id_correlativo  | integer   | YES         | nextval('solicitudes_oc_correlativo_seq'::regclass)
-- =====================================================
