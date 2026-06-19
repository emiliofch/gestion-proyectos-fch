-- Elimina la columna costo_empresa de la tabla colaboradores.
-- El costo mensual de cada colaborador se gestiona exclusivamente en colaboradores_costos.
ALTER TABLE IF EXISTS public.colaboradores DROP COLUMN IF EXISTS costo_empresa;
