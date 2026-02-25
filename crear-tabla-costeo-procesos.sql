-- crear-tabla-costeo-procesos.sql
-- Persistencia del modulo "Proceso de Costeo" por usuario y empresa

CREATE TABLE IF NOT EXISTS public.costeo_procesos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa TEXT NOT NULL DEFAULT 'CGV',
  duracion_meses INTEGER NOT NULL DEFAULT 1 CHECK (duracion_meses >= 1),
  inputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  celdas_activas JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, empresa)
);

ALTER TABLE public.costeo_procesos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "costeo_procesos_select_own" ON public.costeo_procesos;
CREATE POLICY "costeo_procesos_select_own"
ON public.costeo_procesos
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "costeo_procesos_insert_own" ON public.costeo_procesos;
CREATE POLICY "costeo_procesos_insert_own"
ON public.costeo_procesos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "costeo_procesos_update_own" ON public.costeo_procesos;
CREATE POLICY "costeo_procesos_update_own"
ON public.costeo_procesos
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "costeo_procesos_delete_own" ON public.costeo_procesos;
CREATE POLICY "costeo_procesos_delete_own"
ON public.costeo_procesos
FOR DELETE
USING (auth.uid() = user_id);
