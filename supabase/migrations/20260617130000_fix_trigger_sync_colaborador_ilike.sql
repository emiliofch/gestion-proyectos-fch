-- Corrige el trigger de sincronización de nombre de colaborador
-- para que use comparación insensible a mayúsculas/minúsculas (LOWER),
-- evitando que un mismatch de capitalización deje tablas desincronizadas.

CREATE OR REPLACE FUNCTION sync_colaborador_nombre()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.colaborador IS DISTINCT FROM NEW.colaborador THEN
    UPDATE horas_proyectadas
      SET colaborador = NEW.colaborador
      WHERE LOWER(colaborador) = LOWER(OLD.colaborador);

    UPDATE colaboradores_costos
      SET colaborador = NEW.colaborador
      WHERE LOWER(colaborador) = LOWER(OLD.colaborador);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
