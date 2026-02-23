-- ====================================================
-- Migración: Agregar jefe_id a proyectos con FK a colaboradores
-- Fecha: Febrero 2026
-- ====================================================

ALTER TABLE proyectos
ADD COLUMN IF NOT EXISTS jefe_id UUID REFERENCES colaboradores(id) ON DELETE SET NULL;

-- Verificar resultado
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'proyectos'
ORDER BY ordinal_position;
