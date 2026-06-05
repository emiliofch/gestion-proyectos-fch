-- Función y trigger para sincronizar cambios de nombre en colaboradores
-- a las tablas que referencian el nombre como string.
-- Tablas afectadas: horas_proyectadas.colaborador, colaboradores_costos.colaborador

CREATE OR REPLACE FUNCTION sync_colaborador_nombre()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.colaborador IS DISTINCT FROM NEW.colaborador THEN
    UPDATE horas_proyectadas
      SET colaborador = NEW.colaborador
      WHERE colaborador = OLD.colaborador;

    UPDATE colaboradores_costos
      SET colaborador = NEW.colaborador
      WHERE colaborador = OLD.colaborador;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_colaborador_nombre ON colaboradores;

CREATE TRIGGER trg_sync_colaborador_nombre
AFTER UPDATE OF colaborador ON colaboradores
FOR EACH ROW
EXECUTE FUNCTION sync_colaborador_nombre();
