-- ====================================================
-- Migración: Agregar campos estado, tipo, rendible, ceco_codigo a proyectos
-- Fecha: Febrero 2026
-- ====================================================

ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS estado      VARCHAR(50);
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS tipo        VARCHAR(100);
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS rendible    BOOLEAN;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS ceco_codigo VARCHAR(100);

-- Verificar resultado
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'proyectos'
ORDER BY ordinal_position;
