-- Limpieza única: traslada los "Por Ingresar"/"Por Gastar" (proyectos.ingresos/gastos)
-- negativos existentes al otro lado como positivos, conservando el margen
-- (ingresos - gastos por proyecto no cambia). Registra el monto en traspaso_margen
-- para que sea reversible y consistente con la lógica de importación.
--
-- Verifica que la suma global de (ingresos - gastos) no cambie; si cambiara,
-- aborta toda la transacción (rollback). Idempotente: si no hay negativos, no hace nada.
DO $$
DECLARE
  margen_antes numeric;
  margen_despues numeric;
  afectados integer;
BEGIN
  SELECT COALESCE(SUM(COALESCE(ingresos, 0) - COALESCE(gastos, 0)), 0)
    INTO margen_antes FROM public.proyectos;

  WITH base AS (
    SELECT id,
      COALESCE(ingresos, 0) - ABS(COALESCE(traspaso_margen, 0)) AS raw_i,
      COALESCE(gastos, 0)   - ABS(COALESCE(traspaso_margen, 0)) AS raw_g
    FROM public.proyectos
  )
  UPDATE public.proyectos p
  SET ingresos = b.raw_i + GREATEST(0, -b.raw_i, -b.raw_g),
      gastos   = b.raw_g + GREATEST(0, -b.raw_i, -b.raw_g),
      traspaso_margen = CASE
        WHEN GREATEST(0, -b.raw_i, -b.raw_g) = 0 THEN 0
        WHEN b.raw_i <= b.raw_g THEN  GREATEST(0, -b.raw_i, -b.raw_g)
        ELSE -GREATEST(0, -b.raw_i, -b.raw_g)
      END
  FROM base b
  WHERE p.id = b.id AND (b.raw_i < 0 OR b.raw_g < 0);

  GET DIAGNOSTICS afectados = ROW_COUNT;

  SELECT COALESCE(SUM(COALESCE(ingresos, 0) - COALESCE(gastos, 0)), 0)
    INTO margen_despues FROM public.proyectos;

  RAISE NOTICE 'cleanup traspaso_margen: % proyectos ajustados; suma(ingresos-gastos) antes=% despues=%',
    afectados, margen_antes, margen_despues;

  IF margen_antes IS DISTINCT FROM margen_despues THEN
    RAISE EXCEPTION 'Abortado: el margen cambio (antes=% despues=%)', margen_antes, margen_despues;
  END IF;
END $$;
