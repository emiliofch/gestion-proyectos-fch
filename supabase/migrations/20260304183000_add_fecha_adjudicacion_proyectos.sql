BEGIN;

ALTER TABLE public.proyectos
ADD COLUMN IF NOT EXISTS fecha_adjudicacion text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'proyectos_fecha_adjudicacion_chk'
  ) THEN
    ALTER TABLE public.proyectos
      ADD CONSTRAINT proyectos_fecha_adjudicacion_chk
      CHECK (
        fecha_adjudicacion IS NULL
        OR fecha_adjudicacion ~ '^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)-[0-9]{2}$'
      );
  END IF;
END $$;

COMMIT;
