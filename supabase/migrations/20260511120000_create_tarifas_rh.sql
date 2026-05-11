-- Tabla de tarifas por hora de recurso humano
-- RLS habilitado sin policy SELECT → nadie puede leer directamente
create table if not exists tarifas_rh (
  cargo        text primary key,
  tarifa_hora  numeric not null
);

alter table tarifas_rh enable row level security;

-- Seed inicial
insert into tarifas_rh (cargo, tarifa_hora) values
  ('director',     66662),
  ('consultor',    28994),
  ('especialista', 26517),
  ('analista',     14341)
on conflict (cargo) do update set tarifa_hora = excluded.tarifa_hora;

-- RPC 1: devuelve solo los nombres de cargo (sin tarifas)
create or replace function listar_cargos_rh()
returns table(cargo text)
language sql
security definer
set search_path = public
as $$
  select cargo from tarifas_rh order by cargo;
$$;

-- RPC 2: devuelve la tarifa de un cargo específico
-- Usada internamente para cálculos; no expone la tabla directamente
create or replace function calcular_tarifa_rh(p_cargo text)
returns numeric
language sql
security definer
set search_path = public
as $$
  select tarifa_hora from tarifas_rh where cargo = p_cargo;
$$;

-- Permisos de ejecución para usuarios autenticados
grant execute on function listar_cargos_rh()           to authenticated;
grant execute on function calcular_tarifa_rh(text)     to authenticated;
