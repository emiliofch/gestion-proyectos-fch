-- =====================================================
-- Crear tabla oportunidades
-- =====================================================
-- Esta tabla almacena oportunidades vinculadas a proyectos
-- existentes. No se pueden crear oportunidades para proyectos
-- que no existan en la tabla 'proyectos'.
-- =====================================================

-- 1. Crear tabla oportunidades
CREATE TABLE IF NOT EXISTS oportunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  proyecto_nombre VARCHAR(255) NOT NULL,
  jefe_proyecto VARCHAR(255),
  ingresos DECIMAL(15,2) DEFAULT 0,
  hh DECIMAL(15,2) DEFAULT 0,
  gastos DECIMAL(15,2) DEFAULT 0,
  creador VARCHAR(255),
  fecha TIMESTAMP DEFAULT NOW()
);

-- 2. Crear índices
CREATE INDEX IF NOT EXISTS idx_oportunidades_proyecto ON oportunidades(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_fecha ON oportunidades(fecha DESC);

-- 3. Habilitar RLS
ALTER TABLE oportunidades ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS - todos pueden ver y crear
CREATE POLICY "Users can view all oportunidades" ON oportunidades
  FOR SELECT USING (true);

CREATE POLICY "Users can insert oportunidades" ON oportunidades
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update oportunidades" ON oportunidades
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete oportunidades" ON oportunidades
  FOR DELETE USING (true);

-- =====================================================
-- RESULTADO ESPERADO:
-- Tabla 'oportunidades' creada con FK a 'proyectos'
-- No se pueden insertar oportunidades sin proyecto válido
-- =====================================================
