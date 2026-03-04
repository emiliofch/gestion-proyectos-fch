BEGIN;

INSERT INTO public.lineas (linea, empresa)
VALUES
  ('Desarrollo de Negocios', 'CGV'),
  ('Gerencia de Área', 'CGV'),
  ('Hub Metropolitano', 'CGV'),
  ('Proyectos Corporativos', 'CGV'),
  ('Startup Lab.01', 'CGV'),
  ('Venture Capital', 'CGV'),
  ('Desarrollo de Negocios', 'HUB_MET'),
  ('Gerencia de Área', 'HUB_MET'),
  ('Hub Metropolitano', 'HUB_MET'),
  ('Proyectos Corporativos', 'HUB_MET'),
  ('Startup Lab.01', 'HUB_MET'),
  ('Venture Capital', 'HUB_MET')
ON CONFLICT (linea, empresa) DO NOTHING;

COMMIT;
