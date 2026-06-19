-- ============================================================
-- HARDENING RLS: tablas sin Row Level Security habilitado
-- Fecha: 2026-06-17
-- ============================================================

-- -------------------------------------------------------
-- 1. perfiles (tabla más crítica: contiene roles, empresa, módulos)
-- -------------------------------------------------------
ALTER TABLE IF EXISTS public.perfiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS perfiles_select ON public.perfiles;
DROP POLICY IF EXISTS perfiles_update ON public.perfiles;

-- Cada usuario ve su propio perfil; el admin ve todos los de su empresa
CREATE POLICY perfiles_select
  ON public.perfiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR (public.is_current_user_admin() AND empresa = public.current_user_empresa())
  );

-- Cada usuario puede editar su propio perfil; el admin puede editar los de su empresa
CREATE POLICY perfiles_update
  ON public.perfiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR (public.is_current_user_admin() AND empresa = public.current_user_empresa())
  )
  WITH CHECK (
    id = auth.uid()
    OR (public.is_current_user_admin() AND empresa = public.current_user_empresa())
  );

-- INSERT/DELETE de perfiles no se expone al cliente:
-- la creación de usuarios se hace via auth.admin.inviteUserByEmail (server-side).

-- -------------------------------------------------------
-- 2. colaboradores
-- -------------------------------------------------------
ALTER TABLE IF EXISTS public.colaboradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS colaboradores_autenticados ON public.colaboradores;

CREATE POLICY colaboradores_autenticados
  ON public.colaboradores FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- -------------------------------------------------------
-- 3. horas_proyectadas
-- -------------------------------------------------------
ALTER TABLE IF EXISTS public.horas_proyectadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS horas_proyectadas_autenticados ON public.horas_proyectadas;

CREATE POLICY horas_proyectadas_autenticados
  ON public.horas_proyectadas FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- -------------------------------------------------------
-- 4. colaboradores_costos
-- -------------------------------------------------------
ALTER TABLE IF EXISTS public.colaboradores_costos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS colaboradores_costos_autenticados ON public.colaboradores_costos;

CREATE POLICY colaboradores_costos_autenticados
  ON public.colaboradores_costos FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- -------------------------------------------------------
-- 5. financistas
-- -------------------------------------------------------
ALTER TABLE IF EXISTS public.financistas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financistas_autenticados ON public.financistas;

CREATE POLICY financistas_autenticados
  ON public.financistas FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- -------------------------------------------------------
-- 6. proyectos_ceco
-- -------------------------------------------------------
ALTER TABLE IF EXISTS public.proyectos_ceco ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proyectos_ceco_autenticados ON public.proyectos_ceco;

CREATE POLICY proyectos_ceco_autenticados
  ON public.proyectos_ceco FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- -------------------------------------------------------
-- 7. favoritos
-- -------------------------------------------------------
ALTER TABLE IF EXISTS public.favoritos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS favoritos_autenticados ON public.favoritos;

CREATE POLICY favoritos_autenticados
  ON public.favoritos FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- -------------------------------------------------------
-- 8. sugerencias
-- -------------------------------------------------------
ALTER TABLE IF EXISTS public.sugerencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sugerencias_autenticados ON public.sugerencias;

CREATE POLICY sugerencias_autenticados
  ON public.sugerencias FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- -------------------------------------------------------
-- 9. votos_sugerencias
-- -------------------------------------------------------
ALTER TABLE IF EXISTS public.votos_sugerencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS votos_sugerencias_autenticados ON public.votos_sugerencias;

CREATE POLICY votos_sugerencias_autenticados
  ON public.votos_sugerencias FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
