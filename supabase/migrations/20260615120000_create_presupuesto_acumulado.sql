CREATE TABLE IF NOT EXISTS public.presupuesto_acumulado (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      TEXT        NOT NULL,
  ingreso     NUMERIC     DEFAULT 0,
  gasto_hh    NUMERIC     DEFAULT 0,
  gasto_op    NUMERIC     DEFAULT 0,
  margen      NUMERIC     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.presupuesto_acumulado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados pueden leer presupuesto_acumulado"
  ON public.presupuesto_acumulado FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Autenticados pueden modificar presupuesto_acumulado"
  ON public.presupuesto_acumulado FOR ALL
  USING (auth.role() = 'authenticated');
