BEGIN;

CREATE TABLE IF NOT EXISTS public.lineas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linea text NOT NULL,
  empresa text NOT NULL DEFAULT public.current_user_empresa(),
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lineas_linea_empresa_unique'
  ) THEN
    ALTER TABLE public.lineas
      ADD CONSTRAINT lineas_linea_empresa_unique UNIQUE (linea, empresa);
  END IF;
END $$;

ALTER TABLE public.lineas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineas FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lineas_select_same_empresa ON public.lineas;
DROP POLICY IF EXISTS lineas_insert_same_empresa ON public.lineas;
DROP POLICY IF EXISTS lineas_update_admin_same_empresa ON public.lineas;
DROP POLICY IF EXISTS lineas_delete_admin_same_empresa ON public.lineas;

CREATE POLICY lineas_select_same_empresa
ON public.lineas
FOR SELECT
TO authenticated
USING (
  empresa = public.current_user_empresa()
  OR public.is_current_user_admin()
);

CREATE POLICY lineas_insert_same_empresa
ON public.lineas
FOR INSERT
TO authenticated
WITH CHECK (
  empresa = public.current_user_empresa()
  OR public.is_current_user_admin()
);

CREATE POLICY lineas_update_admin_same_empresa
ON public.lineas
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

CREATE POLICY lineas_delete_admin_same_empresa
ON public.lineas
FOR DELETE
TO authenticated
USING (
  public.is_current_user_admin()
  AND empresa = public.current_user_empresa()
);

COMMIT;
