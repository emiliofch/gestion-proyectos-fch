-- Agrega campo para registrar mes de adjudicacion en formato abreviado (ene-26)
ALTER TABLE public.oportunidades
ADD COLUMN IF NOT EXISTS fecha_adjudicacion TEXT;

-- Valida formato: mes abreviado en espanol + guion + dos digitos de anio.
-- Permite NULL para no obligar carga historica inmediata.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'oportunidades_fecha_adjudicacion_chk'
  ) THEN
    ALTER TABLE public.oportunidades
    ADD CONSTRAINT oportunidades_fecha_adjudicacion_chk
    CHECK (
      fecha_adjudicacion IS NULL
      OR fecha_adjudicacion ~ '^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)-[0-9]{2}$'
    );
  END IF;
END $$;
