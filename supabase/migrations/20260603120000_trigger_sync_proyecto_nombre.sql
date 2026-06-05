-- Función y trigger para sincronizar cambios de nombre en proyectos
-- a las tablas que referencian el nombre como string.
-- Tablas afectadas: horas_proyectadas.proyecto, cambios.proyecto_nombre, solicitudes_oc.proyecto_nombre

CREATE OR REPLACE FUNCTION sync_proyecto_nombre()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.nombre IS DISTINCT FROM NEW.nombre THEN
    UPDATE horas_proyectadas
      SET proyecto = NEW.nombre
      WHERE proyecto = OLD.nombre;

    UPDATE cambios
      SET proyecto_nombre = NEW.nombre
      WHERE proyecto_nombre = OLD.nombre;

    UPDATE solicitudes_oc
      SET proyecto_nombre = NEW.nombre
      WHERE proyecto_nombre = OLD.nombre;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_proyecto_nombre ON proyectos;

CREATE TRIGGER trg_sync_proyecto_nombre
AFTER UPDATE OF nombre ON proyectos
FOR EACH ROW
EXECUTE FUNCTION sync_proyecto_nombre();
