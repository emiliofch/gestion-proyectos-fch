-- ============================================================
-- RLS para config_correos_oc (tabla sin cobertura previa).
-- Solo admins pueden ver/modificar configuracion de correos.
-- ============================================================

ALTER TABLE IF EXISTS public.config_correos_oc ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS config_correos_oc_select ON public.config_correos_oc;
DROP POLICY IF EXISTS config_correos_oc_all ON public.config_correos_oc;

-- Lectura: solo admins de la misma empresa
CREATE POLICY config_correos_oc_select
  ON public.config_correos_oc FOR SELECT
  TO authenticated
  USING (public.is_current_user_admin());

-- Modificacion: solo admins
CREATE POLICY config_correos_oc_insert
  ON public.config_correos_oc FOR INSERT
  TO authenticated
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY config_correos_oc_update
  ON public.config_correos_oc FOR UPDATE
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY config_correos_oc_delete
  ON public.config_correos_oc FOR DELETE
  TO authenticated
  USING (public.is_current_user_admin());
