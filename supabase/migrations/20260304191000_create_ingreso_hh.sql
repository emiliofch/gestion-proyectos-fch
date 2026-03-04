BEGIN;

CREATE TABLE IF NOT EXISTS public.ingreso_hh (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proyecto_id uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  mes date NOT NULL,
  horas numeric(6,2) NOT NULL CHECK (horas > 0 AND horas <= 170),
  empresa text NOT NULL DEFAULT public.current_user_empresa(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ingreso_hh_user_proyecto_mes_unique'
  ) THEN
    ALTER TABLE public.ingreso_hh
      ADD CONSTRAINT ingreso_hh_user_proyecto_mes_unique UNIQUE (user_id, proyecto_id, mes);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ingreso_hh_user_mes_idx ON public.ingreso_hh(user_id, mes);

ALTER TABLE public.ingreso_hh ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingreso_hh FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ingreso_hh_select_same_user_or_admin_same_empresa ON public.ingreso_hh;
DROP POLICY IF EXISTS ingreso_hh_insert_same_user_or_admin_same_empresa ON public.ingreso_hh;
DROP POLICY IF EXISTS ingreso_hh_update_same_user_or_admin_same_empresa ON public.ingreso_hh;
DROP POLICY IF EXISTS ingreso_hh_delete_same_user_or_admin_same_empresa ON public.ingreso_hh;

CREATE POLICY ingreso_hh_select_same_user_or_admin_same_empresa
ON public.ingreso_hh
FOR SELECT
TO authenticated
USING (
  (
    auth.uid() = user_id
    AND empresa = public.current_user_empresa()
  )
  OR (
    public.is_current_user_admin()
    AND empresa = public.current_user_empresa()
  )
);

CREATE POLICY ingreso_hh_insert_same_user_or_admin_same_empresa
ON public.ingreso_hh
FOR INSERT
TO authenticated
WITH CHECK (
  (
    auth.uid() = user_id
    AND empresa = public.current_user_empresa()
  )
  OR (
    public.is_current_user_admin()
    AND empresa = public.current_user_empresa()
  )
);

CREATE POLICY ingreso_hh_update_same_user_or_admin_same_empresa
ON public.ingreso_hh
FOR UPDATE
TO authenticated
USING (
  (
    auth.uid() = user_id
    AND empresa = public.current_user_empresa()
  )
  OR (
    public.is_current_user_admin()
    AND empresa = public.current_user_empresa()
  )
)
WITH CHECK (
  (
    auth.uid() = user_id
    AND empresa = public.current_user_empresa()
  )
  OR (
    public.is_current_user_admin()
    AND empresa = public.current_user_empresa()
  )
);

CREATE POLICY ingreso_hh_delete_same_user_or_admin_same_empresa
ON public.ingreso_hh
FOR DELETE
TO authenticated
USING (
  (
    auth.uid() = user_id
    AND empresa = public.current_user_empresa()
  )
  OR (
    public.is_current_user_admin()
    AND empresa = public.current_user_empresa()
  )
);

COMMIT;
