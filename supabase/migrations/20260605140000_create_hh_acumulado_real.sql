BEGIN;

CREATE TABLE IF NOT EXISTS public.hh_acumulado_real (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL DEFAULT '',
  nombre_proyecto text NOT NULL DEFAULT '',
  monto_hh_real numeric NOT NULL DEFAULT 0,
  mes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hh_acumulado_real ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hh_acumulado_real FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hh_acumulado_real_select ON public.hh_acumulado_real;
DROP POLICY IF EXISTS hh_acumulado_real_insert ON public.hh_acumulado_real;
DROP POLICY IF EXISTS hh_acumulado_real_update ON public.hh_acumulado_real;
DROP POLICY IF EXISTS hh_acumulado_real_delete ON public.hh_acumulado_real;

CREATE POLICY hh_acumulado_real_select ON public.hh_acumulado_real
  FOR SELECT TO authenticated USING (true);

CREATE POLICY hh_acumulado_real_insert ON public.hh_acumulado_real
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY hh_acumulado_real_update ON public.hh_acumulado_real
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY hh_acumulado_real_delete ON public.hh_acumulado_real
  FOR DELETE TO authenticated USING (true);

COMMIT;
