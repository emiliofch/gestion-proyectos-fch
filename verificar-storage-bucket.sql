-- =====================================================
-- VERIFICAR Y CONFIGURAR BUCKET DE STORAGE
-- =====================================================
-- Este script verifica si el bucket 'oc-adjuntos' existe
-- y muestra las políticas RLS configuradas
-- =====================================================

-- 1. Verificar si el bucket existe
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE name = 'oc-adjuntos';

-- Si el resultado está vacío, el bucket NO existe
-- En ese caso, debes crearlo manualmente en Supabase Dashboard

-- 2. Verificar políticas RLS del bucket (si existe)
SELECT
  id,
  name,
  definition,
  command
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects';

-- =====================================================
-- INSTRUCCIONES SI EL BUCKET NO EXISTE:
-- =====================================================
--
-- 1. Ve a Supabase Dashboard > Storage
-- 2. Click en "New bucket"
-- 3. Nombre: oc-adjuntos
-- 4. Public bucket: NO (desmarcar)
-- 5. File size limit: 10485760 (10 MB)
-- 6. Allowed MIME types:
--    - application/pdf
--    - image/jpeg
--    - image/png
--    - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
--    - application/vnd.ms-excel
-- 7. Click "Create bucket"
--
-- Luego ejecuta el script de políticas RLS a continuación
-- =====================================================

-- =====================================================
-- POLÍTICAS RLS PARA EL BUCKET (ejecutar después)
-- =====================================================

-- Eliminar políticas existentes si hay
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- Política: Usuarios pueden subir a su propia carpeta
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'oc-adjuntos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política: Usuarios pueden leer sus propios archivos
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'oc-adjuntos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política: Admins pueden leer todos los archivos
CREATE POLICY "Admins can read all files"
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

-- Política: Usuarios pueden eliminar sus propios archivos
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'oc-adjuntos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Verificar que las políticas se crearon
SELECT
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND policyname LIKE '%own folder%' OR policyname LIKE '%own files%';

-- =====================================================
-- FIN
-- =====================================================
