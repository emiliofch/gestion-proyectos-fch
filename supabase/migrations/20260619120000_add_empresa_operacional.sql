-- ============================================================
-- Agrega aislamiento por empresa a tablas operacionales.
-- SUPUESTO: todos los registros existentes pertenecen a 'CGV'.
-- Si hay datos de HUB_MET, actualizar manualmente la columna empresa.
-- ============================================================

-- -------------------------------------------------------
-- colaboradores
-- -------------------------------------------------------
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS empresa text;

UPDATE public.colaboradores SET empresa = 'CGV' WHERE empresa IS NULL;

ALTER TABLE public.colaboradores ALTER COLUMN empresa SET NOT NULL;
ALTER TABLE public.colaboradores ALTER COLUMN empresa SET DEFAULT public.current_user_empresa();

DROP POLICY IF EXISTS colaboradores_autenticados ON public.colaboradores;

CREATE POLICY colaboradores_select_empresa ON public.colaboradores
  FOR SELECT TO authenticated
  USING (empresa = public.current_user_empresa());

CREATE POLICY colaboradores_insert_empresa ON public.colaboradores
  FOR INSERT TO authenticated
  WITH CHECK (empresa = public.current_user_empresa());

CREATE POLICY colaboradores_update_empresa ON public.colaboradores
  FOR UPDATE TO authenticated
  USING (empresa = public.current_user_empresa())
  WITH CHECK (empresa = public.current_user_empresa());

CREATE POLICY colaboradores_delete_empresa ON public.colaboradores
  FOR DELETE TO authenticated
  USING (empresa = public.current_user_empresa());

-- -------------------------------------------------------
-- horas_proyectadas
-- -------------------------------------------------------
ALTER TABLE public.horas_proyectadas
  ADD COLUMN IF NOT EXISTS empresa text;

UPDATE public.horas_proyectadas SET empresa = 'CGV' WHERE empresa IS NULL;

ALTER TABLE public.horas_proyectadas ALTER COLUMN empresa SET NOT NULL;
ALTER TABLE public.horas_proyectadas ALTER COLUMN empresa SET DEFAULT public.current_user_empresa();

DROP POLICY IF EXISTS horas_proyectadas_autenticados ON public.horas_proyectadas;

CREATE POLICY horas_proyectadas_select_empresa ON public.horas_proyectadas
  FOR SELECT TO authenticated
  USING (empresa = public.current_user_empresa());

CREATE POLICY horas_proyectadas_insert_empresa ON public.horas_proyectadas
  FOR INSERT TO authenticated
  WITH CHECK (empresa = public.current_user_empresa());

CREATE POLICY horas_proyectadas_update_empresa ON public.horas_proyectadas
  FOR UPDATE TO authenticated
  USING (empresa = public.current_user_empresa())
  WITH CHECK (empresa = public.current_user_empresa());

CREATE POLICY horas_proyectadas_delete_empresa ON public.horas_proyectadas
  FOR DELETE TO authenticated
  USING (empresa = public.current_user_empresa());

-- -------------------------------------------------------
-- colaboradores_costos
-- -------------------------------------------------------
ALTER TABLE public.colaboradores_costos
  ADD COLUMN IF NOT EXISTS empresa text;

UPDATE public.colaboradores_costos SET empresa = 'CGV' WHERE empresa IS NULL;

ALTER TABLE public.colaboradores_costos ALTER COLUMN empresa SET NOT NULL;
ALTER TABLE public.colaboradores_costos ALTER COLUMN empresa SET DEFAULT public.current_user_empresa();

DROP POLICY IF EXISTS colaboradores_costos_autenticados ON public.colaboradores_costos;

CREATE POLICY colaboradores_costos_select_empresa ON public.colaboradores_costos
  FOR SELECT TO authenticated
  USING (empresa = public.current_user_empresa());

CREATE POLICY colaboradores_costos_insert_empresa ON public.colaboradores_costos
  FOR INSERT TO authenticated
  WITH CHECK (empresa = public.current_user_empresa());

CREATE POLICY colaboradores_costos_update_empresa ON public.colaboradores_costos
  FOR UPDATE TO authenticated
  USING (empresa = public.current_user_empresa())
  WITH CHECK (empresa = public.current_user_empresa());

CREATE POLICY colaboradores_costos_delete_empresa ON public.colaboradores_costos
  FOR DELETE TO authenticated
  USING (empresa = public.current_user_empresa());

-- -------------------------------------------------------
-- financistas
-- -------------------------------------------------------
ALTER TABLE public.financistas
  ADD COLUMN IF NOT EXISTS empresa text;

UPDATE public.financistas SET empresa = 'CGV' WHERE empresa IS NULL;

ALTER TABLE public.financistas ALTER COLUMN empresa SET NOT NULL;
ALTER TABLE public.financistas ALTER COLUMN empresa SET DEFAULT public.current_user_empresa();

DROP POLICY IF EXISTS financistas_autenticados ON public.financistas;

CREATE POLICY financistas_select_empresa ON public.financistas
  FOR SELECT TO authenticated
  USING (empresa = public.current_user_empresa());

CREATE POLICY financistas_insert_empresa ON public.financistas
  FOR INSERT TO authenticated
  WITH CHECK (empresa = public.current_user_empresa());

CREATE POLICY financistas_update_empresa ON public.financistas
  FOR UPDATE TO authenticated
  USING (empresa = public.current_user_empresa())
  WITH CHECK (empresa = public.current_user_empresa());

CREATE POLICY financistas_delete_empresa ON public.financistas
  FOR DELETE TO authenticated
  USING (empresa = public.current_user_empresa());
