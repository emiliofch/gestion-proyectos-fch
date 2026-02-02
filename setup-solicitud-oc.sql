-- =====================================================
-- SCRIPT DE CONFIGURACIÓN: SISTEMA DE SOLICITUD OC
-- =====================================================
-- Este script debe ejecutarse en Supabase SQL Editor
-- para crear las tablas y configuraciones necesarias
-- =====================================================

-- 1. TABLA: proyectos_ceco
-- Almacena los códigos de centro de costo (CECO) por proyecto
CREATE TABLE IF NOT EXISTS proyectos_ceco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE CASCADE,
  ceco VARCHAR(50) NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_proyecto_ceco UNIQUE(proyecto_id, ceco)
);

-- Índice para mejorar rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_proyectos_ceco_proyecto ON proyectos_ceco(proyecto_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE proyectos_ceco ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad: Todos pueden ver CECOs
DROP POLICY IF EXISTS "Users can view cecos" ON proyectos_ceco;
CREATE POLICY "Users can view cecos" ON proyectos_ceco
  FOR SELECT USING (true);

-- Políticas de seguridad: Solo admins pueden gestionar CECOs
DROP POLICY IF EXISTS "Admins can manage cecos" ON proyectos_ceco;
CREATE POLICY "Admins can manage cecos" ON proyectos_ceco
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol = 'admin'
    )
  );

-- =====================================================

-- 2. TABLA: solicitudes_oc
-- Almacena las solicitudes de orden de compra
CREATE TABLE IF NOT EXISTS solicitudes_oc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(50) NOT NULL,
  proveedor VARCHAR(255) NOT NULL,
  rut VARCHAR(20) NOT NULL,
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE SET NULL,
  proyecto_nombre VARCHAR(255),
  subproyecto VARCHAR(255),
  ceco VARCHAR(50),
  glosa TEXT NOT NULL,
  valor DECIMAL(15,2) NOT NULL CHECK (valor > 0),
  detalle TEXT,
  archivos_adjuntos JSONB DEFAULT '[]'::jsonb,
  usuario_id UUID REFERENCES perfiles(id),
  usuario_email VARCHAR(255) NOT NULL,
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  estado VARCHAR(20) DEFAULT 'enviada'
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_solicitudes_oc_usuario ON solicitudes_oc(usuario_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_oc_proyecto ON solicitudes_oc(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_oc_fecha ON solicitudes_oc(fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_solicitudes_oc_estado ON solicitudes_oc(estado);

-- Habilitar Row Level Security (RLS)
ALTER TABLE solicitudes_oc ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad: Usuarios pueden ver sus propias solicitudes
DROP POLICY IF EXISTS "Users can view own solicitudes" ON solicitudes_oc;
CREATE POLICY "Users can view own solicitudes" ON solicitudes_oc
  FOR SELECT USING (auth.uid() = usuario_id);

-- Políticas de seguridad: Admins pueden ver todas las solicitudes
DROP POLICY IF EXISTS "Admins can view all solicitudes" ON solicitudes_oc;
CREATE POLICY "Admins can view all solicitudes" ON solicitudes_oc
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol = 'admin'
    )
  );

-- Políticas de seguridad: Usuarios pueden insertar sus propias solicitudes
DROP POLICY IF EXISTS "Users can insert own solicitudes" ON solicitudes_oc;
CREATE POLICY "Users can insert own solicitudes" ON solicitudes_oc
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- =====================================================

-- 3. CONFIGURACIÓN DEL STORAGE BUCKET
-- Nota: Los buckets de Storage NO se pueden crear con SQL.
-- Debe hacerse manualmente en Supabase Dashboard > Storage:
--
-- 1. Crear bucket llamado: oc-adjuntos
-- 2. Configurarlo como PRIVADO (no público)
-- 3. Configurar tamaño máximo de archivo: 10 MB
-- 4. Tipos MIME permitidos: PDF, imágenes, Excel
-- 5. Aplicar las políticas RLS que se muestran a continuación

-- Políticas RLS para Storage (ejecutar después de crear el bucket)
-- Usuarios pueden subir a su propia carpeta
CREATE POLICY IF NOT EXISTS "Users can upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'oc-adjuntos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Usuarios pueden leer sus propios archivos
CREATE POLICY IF NOT EXISTS "Users can read own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'oc-adjuntos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins pueden leer todos los archivos
CREATE POLICY IF NOT EXISTS "Admins can read all files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'oc-adjuntos' AND
  EXISTS (
    SELECT 1 FROM perfiles
    WHERE perfiles.id = auth.uid()
    AND perfiles.rol = 'admin'
  )
);

-- Usuarios pueden eliminar sus propios archivos
CREATE POLICY IF NOT EXISTS "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'oc-adjuntos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================

-- VERIFICACIÓN
-- Ejecutar estas queries para verificar que todo se creó correctamente

-- Verificar tablas creadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('proyectos_ceco', 'solicitudes_oc');

-- Verificar políticas RLS
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('proyectos_ceco', 'solicitudes_oc');

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
