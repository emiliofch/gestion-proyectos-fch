-- =====================================================
-- HARDENING RLS POR EMPRESA / ROL
-- Fecha: 2026-02-26
-- Objetivo:
-- 1) Eliminar politicas excesivamente abiertas (USING true)
-- 2) Aislar datos por empresa (CGV/HUB_MET)
-- 3) Mantener gestion admin con alcance de su misma empresa
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- Helpers de seguridad (empresa y rol del usuario actual)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_empresa()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.empresa FROM public.perfiles p WHERE p.id = auth.uid()),
    'CGV'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.rol = 'admin'
  );
$$;

-- -----------------------------------------------------
-- 1) proyectos: agregar empresa y aislar por empresa
-- -----------------------------------------------------
ALTER TABLE IF EXISTS public.proyectos
  ADD COLUMN IF NOT EXISTS empresa text;

UPDATE public.proyectos
SET empresa = CASE
  WHEN COALESCE(ceco, '') ILIKE '%hub met%'
    OR COALESCE(ceco, '') ILIKE '%metropolitano%'
    THEN 'HUB_MET'
  ELSE 'CGV'
END
WHERE empresa IS NULL;

ALTER TABLE IF EXISTS public.proyectos
  ALTER COLUMN empresa SET DEFAULT public.current_user_empresa();

ALTER TABLE IF EXISTS public.proyectos
  ALTER COLUMN empresa SET NOT NULL;

ALTER TABLE IF EXISTS public.proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.proyectos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view proyectos" ON public.proyectos;
DROP POLICY IF EXISTS "Admins can manage proyectos" ON public.proyectos;
DROP POLICY IF EXISTS proyectos_select_same_empresa ON public.proyectos;
DROP POLICY IF EXISTS proyectos_insert_same_empresa ON public.proyectos;
DROP POLICY IF EXISTS proyectos_update_same_empresa ON public.proyectos;
DROP POLICY IF EXISTS proyectos_delete_same_empresa ON public.proyectos;

CREATE POLICY proyectos_select_same_empresa
ON public.proyectos
FOR SELECT
TO authenticated
USING (
  empresa = public.current_user_empresa()
  OR public.is_current_user_admin()
);

CREATE POLICY proyectos_insert_same_empresa
ON public.proyectos
FOR INSERT
TO authenticated
WITH CHECK (
  empresa = public.current_user_empresa()
  OR public.is_current_user_admin()
);

CREATE POLICY proyectos_update_same_empresa
ON public.proyectos
FOR UPDATE
TO authenticated
USING (
  empresa = public.current_user_empresa()
  OR public.is_current_user_admin()
)
WITH CHECK (
  empresa = public.current_user_empresa()
  OR public.is_current_user_admin()
);

CREATE POLICY proyectos_delete_same_empresa
ON public.proyectos
FOR DELETE
TO authenticated
USING (
  empresa = public.current_user_empresa()
  OR public.is_current_user_admin()
);

-- -----------------------------------------------------
-- 2) oportunidades: agregar empresa y aislar por empresa
-- -----------------------------------------------------
ALTER TABLE IF EXISTS public.oportunidades
  ADD COLUMN IF NOT EXISTS empresa text;

UPDATE public.oportunidades o
SET empresa = p.empresa
FROM public.proyectos p
WHERE o.proyecto_id = p.id
  AND o.empresa IS NULL;

UPDATE public.oportunidades
SET empresa = public.current_user_empresa()
WHERE empresa IS NULL;

ALTER TABLE IF EXISTS public.oportunidades
  ALTER COLUMN empresa SET DEFAULT public.current_user_empresa();

ALTER TABLE IF EXISTS public.oportunidades
  ALTER COLUMN empresa SET NOT NULL;

ALTER TABLE IF EXISTS public.oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.oportunidades FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all oportunidades" ON public.oportunidades;
DROP POLICY IF EXISTS "Users can view oportunidades" ON public.oportunidades;
DROP POLICY IF EXISTS "Users can insert oportunidades" ON public.oportunidades;
DROP POLICY IF EXISTS "Authenticated users can insert oportunidades" ON public.oportunidades;
DROP POLICY IF EXISTS "Users can update oportunidades" ON public.oportunidades;
DROP POLICY IF EXISTS "Users can update own oportunidades" ON public.oportunidades;
DROP POLICY IF EXISTS "Users can delete oportunidades" ON public.oportunidades;
DROP POLICY IF EXISTS "Admins can manage all oportunidades" ON public.oportunidades;
DROP POLICY IF EXISTS oportunidades_select_same_empresa ON public.oportunidades;
DROP POLICY IF EXISTS oportunidades_insert_same_empresa ON public.oportunidades;
DROP POLICY IF EXISTS oportunidades_update_same_empresa ON public.oportunidades;
DROP POLICY IF EXISTS oportunidades_delete_same_empresa ON public.oportunidades;

CREATE POLICY oportunidades_select_same_empresa
ON public.oportunidades
FOR SELECT
TO authenticated
USING (
  empresa = public.current_user_empresa()
  OR public.is_current_user_admin()
);

CREATE POLICY oportunidades_insert_same_empresa
ON public.oportunidades
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    empresa = public.current_user_empresa()
    OR public.is_current_user_admin()
  )
);

CREATE POLICY oportunidades_update_same_empresa
ON public.oportunidades
FOR UPDATE
TO authenticated
USING (
  empresa = public.current_user_empresa()
  OR public.is_current_user_admin()
)
WITH CHECK (
  empresa = public.current_user_empresa()
  OR public.is_current_user_admin()
);

CREATE POLICY oportunidades_delete_same_empresa
ON public.oportunidades
FOR DELETE
TO authenticated
USING (
  empresa = public.current_user_empresa()
  OR public.is_current_user_admin()
);

-- -----------------------------------------------------
-- 3) cambios: agregar empresa y aislar por empresa
-- -----------------------------------------------------
ALTER TABLE IF EXISTS public.cambios
  ADD COLUMN IF NOT EXISTS empresa text;

UPDATE public.cambios c
SET empresa = p.empresa
FROM public.proyectos p
WHERE c.proyecto_id = p.id
  AND c.empresa IS NULL;

UPDATE public.cambios
SET empresa = public.current_user_empresa()
WHERE empresa IS NULL;

ALTER TABLE IF EXISTS public.cambios
  ALTER COLUMN empresa SET DEFAULT public.current_user_empresa();

ALTER TABLE IF EXISTS public.cambios
  ALTER COLUMN empresa SET NOT NULL;

ALTER TABLE IF EXISTS public.cambios ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cambios FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view cambios" ON public.cambios;
DROP POLICY IF EXISTS "Authenticated users can insert cambios" ON public.cambios;
DROP POLICY IF EXISTS cambios_select_same_empresa ON public.cambios;
DROP POLICY IF EXISTS cambios_insert_same_empresa ON public.cambios;

CREATE POLICY cambios_select_same_empresa
ON public.cambios
FOR SELECT
TO authenticated
USING (
  empresa = public.current_user_empresa()
  OR public.is_current_user_admin()
);

CREATE POLICY cambios_insert_same_empresa
ON public.cambios
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    empresa = public.current_user_empresa()
    OR public.is_current_user_admin()
  )
);

-- -----------------------------------------------------
-- 4) solicitudes_oc: reforzar aislamiento por empresa
-- -----------------------------------------------------
ALTER TABLE IF EXISTS public.solicitudes_oc ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.solicitudes_oc FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own solicitudes" ON public.solicitudes_oc;
DROP POLICY IF EXISTS "Admins can view all solicitudes" ON public.solicitudes_oc;
DROP POLICY IF EXISTS "Users can insert own solicitudes" ON public.solicitudes_oc;
DROP POLICY IF EXISTS solicitudes_oc_select_same_empresa ON public.solicitudes_oc;
DROP POLICY IF EXISTS solicitudes_oc_insert_same_empresa ON public.solicitudes_oc;
DROP POLICY IF EXISTS solicitudes_oc_update_admin_same_empresa ON public.solicitudes_oc;

CREATE POLICY solicitudes_oc_select_same_empresa
ON public.solicitudes_oc
FOR SELECT
TO authenticated
USING (
  (
    auth.uid() = usuario_id
    AND empresa = public.current_user_empresa()
  )
  OR (
    public.is_current_user_admin()
    AND empresa = public.current_user_empresa()
  )
);

CREATE POLICY solicitudes_oc_insert_same_empresa
ON public.solicitudes_oc
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = usuario_id
  AND empresa = public.current_user_empresa()
);

CREATE POLICY solicitudes_oc_update_admin_same_empresa
ON public.solicitudes_oc
FOR UPDATE
TO authenticated
USING (
  public.is_current_user_admin()
  AND empresa = public.current_user_empresa()
)
WITH CHECK (
  public.is_current_user_admin()
  AND empresa = public.current_user_empresa()
);

-- -----------------------------------------------------
-- 5) configuracion_emails: solo admin de su empresa
-- -----------------------------------------------------
ALTER TABLE IF EXISTS public.configuracion_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.configuracion_emails FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configuracion_emails_select_same_empresa ON public.configuracion_emails;
DROP POLICY IF EXISTS configuracion_emails_admin_manage_same_empresa ON public.configuracion_emails;

CREATE POLICY configuracion_emails_select_same_empresa
ON public.configuracion_emails
FOR SELECT
TO authenticated
USING (
  tipo = public.current_user_empresa()
  OR public.is_current_user_admin()
);

CREATE POLICY configuracion_emails_admin_manage_same_empresa
ON public.configuracion_emails
FOR ALL
TO authenticated
USING (
  public.is_current_user_admin()
  AND tipo = public.current_user_empresa()
)
WITH CHECK (
  public.is_current_user_admin()
  AND tipo = public.current_user_empresa()
);

-- -----------------------------------------------------
-- 6) storage (oc-adjuntos): admin solo misma empresa del owner
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Admins can read all files" ON storage.objects;
DROP POLICY IF EXISTS storage_oc_adjuntos_admin_read_same_empresa ON storage.objects;

CREATE POLICY storage_oc_adjuntos_admin_read_same_empresa
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'oc-adjuntos'
  AND public.is_current_user_admin()
  AND EXISTS (
    SELECT 1
    FROM public.perfiles admin_p
    JOIN public.perfiles owner_p
      ON owner_p.id = ((storage.foldername(name))[1])::uuid
    WHERE admin_p.id = auth.uid()
      AND admin_p.empresa = owner_p.empresa
  )
);

COMMIT;

-- -----------------------------------------------------
-- Verificaciones sugeridas (ejecutar manualmente):
-- 1) SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;
-- 2) SELECT COUNT(*) FROM proyectos WHERE empresa IS NULL;
-- 3) SELECT COUNT(*) FROM oportunidades WHERE empresa IS NULL;
-- 4) SELECT COUNT(*) FROM cambios WHERE empresa IS NULL;
-- -----------------------------------------------------
