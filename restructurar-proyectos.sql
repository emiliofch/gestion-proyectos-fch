-- =====================================================
-- REESTRUCTURAR TABLA PROYECTOS - VERSIÓN SIMPLE
-- =====================================================
-- Nueva estructura: solo PROYECTO y CENTRO DE COSTO
-- =====================================================

-- Paso 1: Eliminar tablas dependientes y recrearlas después
DROP TABLE IF EXISTS solicitudes_oc CASCADE;
DROP TABLE IF EXISTS favoritos CASCADE;
DROP TABLE IF EXISTS cambios CASCADE;

-- Paso 2: Eliminar tabla proyectos actual
DROP TABLE IF EXISTS proyectos CASCADE;

-- Paso 3: Crear nueva tabla proyectos simplificada
CREATE TABLE proyectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  ceco TEXT NOT NULL,
  jefe VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_proyectos_nombre ON proyectos(nombre);
CREATE INDEX idx_proyectos_ceco ON proyectos(ceco);
CREATE INDEX idx_proyectos_jefe ON proyectos(jefe);

-- RLS
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view proyectos" ON proyectos
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage proyectos" ON proyectos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol = 'admin'
    )
  );

-- Paso 4: Insertar proyectos con sus centros de costo
INSERT INTO proyectos (nombre, ceco) VALUES
  ('1598.N.F50 PROYECTOS POR ADJUDICAR', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('1742.N.F00.ACELERADORA', 'Chileglobal Ventures : Venture Capital : Aceleradora'),
  ('2710.N.F00.CHILE GLOBAL ANGELS', 'Chileglobal Ventures : Venture Capital : Chileglobal Angels'),
  ('2792.N.F99.INGRESO PAGO INVER. INNOVADORAS A FCH', 'Chileglobal Ventures : Venture Capital : Inversiones Innovadoras'),
  ('2827.N.F00.GERENCIA CHILEGLOBAL VENTURES', 'Chileglobal Ventures : Gerencia De Área : Gerencia de Área'),
  ('3257.N.F50 Bhp Donor Advise Fund', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3458.N.F30 Hackamine', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3510.N.F99 INICIATIVA DE INVERSION SOSTENIBLE-ANGLO', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3551.N.F99 RIO TINTO BHP', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3560.N.F99 Desafio Vitacura', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3571.N.F00 START UP CAMPUS', 'Chileglobal Ventures : Startup Lab.01 : Startup Lab.01'),
  ('3623.N.F99 Desafio Expomin', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3639.N.F00 DESARROLLO DE NEGOCIO', 'Chileglobal Ventures : Desarrollo De Negocios : Desarrollo De Negocios'),
  ('3666.N.F00.POTENCIAL DESCARBONIZACION', 'Chileglobal Ventures : Venture Capital : Aceleradora'),
  ('3667.N.F00 ESCALAMIENTO 2023', 'Chileglobal Ventures : Venture Capital : Aceleradora'),
  ('3723.N.F50 INNOVACLARO 2024', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3751.N.F06 Green Hub', 'Chileglobal Ventures : Desarrollo De Negocios : Desarrollo De Negocios'),
  ('3752.N.F99 Caja Los Andes 2024', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3762.N.F50 CGA FUND', 'Chileglobal Ventures : Venture Capital : Chileglobal Angels'),
  ('3765.N.F99 Ccu Impacta 2024-25', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3766.N.F99 Scale Bci 2025', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3767.N.F50 Administración Corporate', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3794.N.F50 Prospección Corporate', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3818.N.F99 Aceleradora SQM', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3819.N.F99 CVC Abastible', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3821.N.F99 CVC Coopeuch', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3822.N.F99 BHP TAD Expomin', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3773.N.F00 Hub M', 'Proyectos Especiales : HUB Metropolitano : HUB Metropolitano'),
  ('3829.N.F99 BHP TAD Open Calls', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3867.N.F99 AXIS CVC-E.D.C', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3830.N.F99 TECLA 8', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3820.N.F99 Scouting Abastible', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3666.R.F01 POTENCIAL DESCARBONIZACION', 'Chileglobal Ventures : Venture Capital : Aceleradora'),
  ('3872.N.F00 StartupLab.01BID', 'Chileglobal Ventures : Startup Lab.01 : Startup Lab.01'),
  ('3928.N.F99 COOPEUCH CVC.C1', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('1598.N.F00 PROYECTOS POR ADJUDICAR', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3882.N.F30 Innovación Melón', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3771.N.F00 NEMa Corfo', 'Proyectos Especiales : Núcleo Tecnológico para el Desarrollo de Nuevas Energías en el Norte Grande (NEMa)'),
  ('3908.N.F50 Innpacta 26-27', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3763.N.F99 Escalamiento 2025', 'Chileglobal Ventures : Venture Capital : Aceleradora'),
  ('3886.N.F00 Potencia 2026 - 2028', 'Chileglobal Ventures : Venture Capital : Aceleradora'),
  ('3879.N.F30 Propuesta Innpacta 2025-2026', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos'),
  ('3877.N.F30 Apoyo Pyme Abastible', 'Chileglobal Ventures : Proyectos Corporativos : Proyectos Corporativos');

-- Paso 5: Crear tabla oportunidades
CREATE TABLE oportunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE CASCADE NOT NULL,
  ingresos DECIMAL(15,2) DEFAULT 0,
  hh DECIMAL(15,2) DEFAULT 0,
  gastos DECIMAL(15,2) DEFAULT 0,
  fecha TIMESTAMP DEFAULT NOW(),
  creador VARCHAR(255),
  estado VARCHAR(50) DEFAULT 'abierta',
  observaciones TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_oportunidades_proyecto ON oportunidades(proyecto_id);
CREATE INDEX idx_oportunidades_estado ON oportunidades(estado);
CREATE INDEX idx_oportunidades_fecha ON oportunidades(fecha DESC);
CREATE INDEX idx_oportunidades_creador ON oportunidades(creador);

-- RLS
ALTER TABLE oportunidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view oportunidades" ON oportunidades
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert oportunidades" ON oportunidades
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own oportunidades" ON oportunidades
  FOR UPDATE USING (
    creador = (SELECT email FROM perfiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can manage all oportunidades" ON oportunidades
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol = 'admin'
    )
  );

-- Paso 6: Recrear tabla cambios (ahora rastrea cambios en oportunidades)
CREATE TABLE cambios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidad_id UUID REFERENCES oportunidades(id) ON DELETE CASCADE,
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE CASCADE,
  campo VARCHAR(100),
  valor_anterior TEXT,
  valor_nuevo TEXT,
  usuario VARCHAR(255),
  motivo TEXT,
  tipo_cambio VARCHAR(50),
  proyecto_nombre VARCHAR(255),
  fecha TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cambios_oportunidad ON cambios(oportunidad_id);
CREATE INDEX idx_cambios_proyecto ON cambios(proyecto_id);
CREATE INDEX idx_cambios_fecha ON cambios(fecha DESC);

ALTER TABLE cambios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cambios" ON cambios
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert cambios" ON cambios
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Paso 7: Recrear tabla favoritos
CREATE TABLE favoritos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, proyecto_id)
);

CREATE INDEX idx_favoritos_user ON favoritos(user_id);
CREATE INDEX idx_favoritos_proyecto ON favoritos(proyecto_id);

ALTER TABLE favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own favoritos" ON favoritos
  FOR ALL USING (auth.uid() = user_id);

-- Paso 8: Recrear tabla solicitudes_oc
CREATE TABLE solicitudes_oc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(50) NOT NULL,
  proveedor VARCHAR(255) NOT NULL,
  rut VARCHAR(20) NOT NULL,
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE SET NULL,
  proyecto_nombre VARCHAR(255),
  subproyecto VARCHAR(255),
  ceco TEXT,
  glosa TEXT NOT NULL,
  valor DECIMAL(15,2) NOT NULL CHECK (valor > 0),
  detalle TEXT,
  archivos_adjuntos JSONB DEFAULT '[]'::jsonb,
  usuario_id UUID REFERENCES perfiles(id),
  usuario_email VARCHAR(255) NOT NULL,
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  estado VARCHAR(20) DEFAULT 'enviada'
);

CREATE INDEX idx_solicitudes_oc_usuario ON solicitudes_oc(usuario_id);
CREATE INDEX idx_solicitudes_oc_proyecto ON solicitudes_oc(proyecto_id);
CREATE INDEX idx_solicitudes_oc_fecha ON solicitudes_oc(fecha_creacion DESC);

ALTER TABLE solicitudes_oc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own solicitudes" ON solicitudes_oc
  FOR SELECT USING (auth.uid() = usuario_id);

CREATE POLICY "Admins can view all solicitudes" ON solicitudes_oc
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol = 'admin'
    )
  );

CREATE POLICY "Users can insert own solicitudes" ON solicitudes_oc
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- Verificación
SELECT COUNT(*) as total_proyectos FROM proyectos;
SELECT nombre, ceco FROM proyectos ORDER BY nombre LIMIT 5;

-- =====================================================
-- COMPLETADO
-- =====================================================
--
-- NUEVA ESTRUCTURA:
--
-- Tabla PROYECTOS:
-- - id: UUID
-- - nombre: código/nombre del proyecto
-- - ceco: centro de costo (jerarquía completa)
-- - jefe: jefe de proyecto (NULL por defecto, llenar manualmente)
-- - created_at: fecha de creación
-- Total: 43 proyectos insertados
--
-- Tabla OPORTUNIDADES (nueva):
-- - id: UUID
-- - proyecto_id: FK a proyectos (requerido)
-- - ingresos: decimal (por defecto 0)
-- - hh: horas-hombre, decimal (por defecto 0)
-- - gastos: decimal (por defecto 0)
-- - fecha: timestamp
-- - creador: email del usuario
-- - estado: 'abierta', 'en_progreso', 'ganada', 'perdida', 'cerrada'
-- - observaciones: texto
-- - created_at, updated_at
--
-- Restricción: Solo pueden existir oportunidades de proyectos que
-- existan en la tabla proyectos (ON DELETE CASCADE)
--
-- =====================================================
