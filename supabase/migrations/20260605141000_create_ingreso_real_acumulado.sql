BEGIN;

CREATE TABLE IF NOT EXISTS public.ingreso_real_acumulado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL DEFAULT '',
  ingreso numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ingreso_real_acumulado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingreso_real_acumulado FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ingreso_real_acumulado_select ON public.ingreso_real_acumulado;
DROP POLICY IF EXISTS ingreso_real_acumulado_insert ON public.ingreso_real_acumulado;
DROP POLICY IF EXISTS ingreso_real_acumulado_update ON public.ingreso_real_acumulado;
DROP POLICY IF EXISTS ingreso_real_acumulado_delete ON public.ingreso_real_acumulado;

CREATE POLICY ingreso_real_acumulado_select ON public.ingreso_real_acumulado
  FOR SELECT TO authenticated USING (true);

CREATE POLICY ingreso_real_acumulado_insert ON public.ingreso_real_acumulado
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY ingreso_real_acumulado_update ON public.ingreso_real_acumulado
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY ingreso_real_acumulado_delete ON public.ingreso_real_acumulado
  FOR DELETE TO authenticated USING (true);

COMMIT;
