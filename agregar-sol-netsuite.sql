-- =====================================================
-- Agregar campo sol_netsuite a solicitudes_oc
-- =====================================================
-- Este script agrega el campo sol_netsuite para almacenar
-- el número de solicitud en NetSuite
-- =====================================================

-- Agregar columna sol_netsuite si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='solicitudes_oc'
    AND column_name='sol_netsuite'
  ) THEN
    ALTER TABLE solicitudes_oc
    ADD COLUMN sol_netsuite VARCHAR(100);

    RAISE NOTICE 'Columna sol_netsuite agregada exitosamente';
  ELSE
    RAISE NOTICE 'La columna sol_netsuite ya existe';
  END IF;
END $$;

-- Verificar que la columna existe
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'solicitudes_oc'
AND column_name = 'sol_netsuite';

-- =====================================================
-- RESULTADO ESPERADO:
-- column_name  | data_type      | character_maximum_length | is_nullable
-- sol_netsuite | character varying | 100                   | YES
-- =====================================================

-- Opcional: Ver todos los campos de la tabla solicitudes_oc
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'solicitudes_oc'
ORDER BY ordinal_position;

-- =====================================================
-- FIN
-- =====================================================
