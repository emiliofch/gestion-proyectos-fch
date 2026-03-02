-- Habilita borrado de registros en cambios solo para admin de la misma empresa.
BEGIN;

ALTER TABLE IF EXISTS public.cambios ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cambios FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cambios_delete_admin_same_empresa ON public.cambios;

CREATE POLICY cambios_delete_admin_same_empresa
ON public.cambios
FOR DELETE
TO authenticated
USING (
  public.is_current_user_admin()
  AND empresa = public.current_user_empresa()
);

COMMIT;
