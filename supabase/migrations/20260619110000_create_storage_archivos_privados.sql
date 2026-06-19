-- ============================================================
-- Crea bucket privado "archivos-privados" para xlsx sensibles
-- Los archivos son accesibles solo para usuarios autenticados.
-- Archivos esperados: ppto2026.xlsx, ppto_a_la_fecha.xlsx
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'archivos-privados',
  'archivos-privados',
  false,
  10485760,  -- 10 MB
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Solo usuarios autenticados pueden leer
DROP POLICY IF EXISTS archivos_privados_select ON storage.objects;
CREATE POLICY archivos_privados_select
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'archivos-privados');

-- Solo admins pueden subir/actualizar
DROP POLICY IF EXISTS archivos_privados_insert ON storage.objects;
CREATE POLICY archivos_privados_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'archivos-privados'
    AND public.is_current_user_admin()
  );

DROP POLICY IF EXISTS archivos_privados_update ON storage.objects;
CREATE POLICY archivos_privados_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'archivos-privados'
    AND public.is_current_user_admin()
  );

DROP POLICY IF EXISTS archivos_privados_delete ON storage.objects;
CREATE POLICY archivos_privados_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'archivos-privados'
    AND public.is_current_user_admin()
  );
