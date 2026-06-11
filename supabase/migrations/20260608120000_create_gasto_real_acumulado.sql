BEGIN;

CREATE TABLE IF NOT EXISTS public.gasto_real_acumulado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL DEFAULT '',
  gasto numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gasto_real_acumulado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gasto_real_acumulado FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gasto_real_acumulado_select ON public.gasto_real_acumulado;
DROP POLICY IF EXISTS gasto_real_acumulado_insert ON public.gasto_real_acumulado;
DROP POLICY IF EXISTS gasto_real_acumulado_update ON public.gasto_real_acumulado;
DROP POLICY IF EXISTS gasto_real_acumulado_delete ON public.gasto_real_acumulado;

CREATE POLICY gasto_real_acumulado_select ON public.gasto_real_acumulado
  FOR SELECT TO authenticated USING (true);

CREATE POLICY gasto_real_acumulado_insert ON public.gasto_real_acumulado
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY gasto_real_acumulado_update ON public.gasto_real_acumulado
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY gasto_real_acumulado_delete ON public.gasto_real_acumulado
  FOR DELETE TO authenticated USING (true);

COMMIT;
