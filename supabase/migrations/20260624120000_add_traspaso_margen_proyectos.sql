-- Columna de "traspaso de margen": guarda cuánto se trasladó entre "Por Ingresar"
-- y "Por Gastar" durante la importación de reales para evitar valores negativos.
-- Magnitud = monto sumado a ambos lados; signo = origen del negativo
--   ( > 0 vino de Por Ingresar, < 0 vino de Por Gastar, 0 sin traslado ).
-- Permite revertir el traslado en una importación posterior (idempotente).
ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS traspaso_margen numeric NOT NULL DEFAULT 0;
