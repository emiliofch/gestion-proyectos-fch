-- =====================================================
-- FIX: Cambiar campo CECO de VARCHAR(50) a TEXT
-- =====================================================
-- Este script arregla el error: "value too long for type character varying(50)"
-- al cambiar el tipo de dato del campo 'ceco' en la tabla solicitudes_oc
-- =====================================================

-- Alterar la tabla solicitudes_oc para cambiar el tipo de dato de ceco
ALTER TABLE solicitudes_oc
ALTER COLUMN ceco TYPE TEXT;

-- Verificar el cambio
SELECT
  column_name,
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'solicitudes_oc'
AND column_name = 'ceco';

-- =====================================================
-- RESULTADO ESPERADO:
-- column_name | data_type | character_maximum_length
-- ceco        | text      | NULL
-- =====================================================
