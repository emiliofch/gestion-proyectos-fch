BEGIN;

CREATE TABLE IF NOT EXISTS public.centros_costo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ceco text NOT NULL,
  empresa text NOT NULL DEFAULT public.current_user_empresa(),
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'centros_costo_ceco_empresa_unique'
  ) THEN
    ALTER TABLE public.centros_costo
      ADD CONSTRAINT centros_costo_ceco_empresa_unique UNIQUE (ceco, empresa);
  END IF;
END $$;

ALTER TABLE public.centros_costo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centros_costo FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS centros_costo_select_same_empresa ON public.centros_costo;
DROP POLICY IF EXISTS centros_costo_insert_same_empresa ON public.centros_costo;
DROP POLICY IF EXISTS centros_costo_update_admin_same_empresa ON public.centros_costo;
DROP POLICY IF EXISTS centros_costo_delete_admin_same_empresa ON public.centros_costo;

CREATE POLICY centros_costo_select_same_empresa
ON public.centros_costo
FOR SELECT
TO authenticated
USING (
  empresa = public.current_user_empresa()
  OR public.is_current_user_admin()
);

CREATE POLICY centros_costo_insert_same_empresa
ON public.centros_costo
FOR INSERT
TO authenticated
WITH CHECK (
  empresa = public.current_user_empresa()
  OR public.is_current_user_admin()
);

CREATE POLICY centros_costo_update_admin_same_empresa
ON public.centros_costo
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

CREATE POLICY centros_costo_delete_admin_same_empresa
ON public.centros_costo
FOR DELETE
TO authenticated
USING (
  public.is_current_user_admin()
  AND empresa = public.current_user_empresa()
);

COMMIT;
