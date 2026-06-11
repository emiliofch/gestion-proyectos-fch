-- Agrega columna modulos a perfiles para restringir acceso por módulo
-- NULL = acceso total (comportamiento actual para todos los usuarios)
-- ARRAY['costeo'] = solo puede ver el módulo de costeo

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS modulos TEXT[] DEFAULT NULL;
