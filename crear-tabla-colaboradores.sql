-- ====================================================
-- Migración: Crear tabla colaboradores
-- Fecha: Febrero 2026
-- ====================================================

CREATE TABLE IF NOT EXISTS colaboradores (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador VARCHAR(255) NOT NULL,
  rut         VARCHAR(50)
);

-- Verificar resultado
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'colaboradores'
ORDER BY ordinal_position;
