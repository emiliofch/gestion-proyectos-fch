-- Tabla para persistir notas de Seguimiento Financiero (operacional y sensibilidad)
-- Ejecutar en Supabase SQL Editor

create table if not exists seguimiento_financiero_notas (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  tipo text not null,
  contenido_html text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists seguimiento_financiero_notas_empresa_tipo_idx
  on seguimiento_financiero_notas (empresa, tipo);

-- Trigger para updated_at
create or replace function set_seguimiento_financiero_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_seguimiento_financiero_updated_at on seguimiento_financiero_notas;
create trigger trg_seguimiento_financiero_updated_at
before update on seguimiento_financiero_notas
for each row execute procedure set_seguimiento_financiero_updated_at();

-- RLS
alter table seguimiento_financiero_notas enable row level security;

-- Permitir lectura/escritura solo a usuarios autenticados de la misma empresa.
-- Requiere que la tabla perfiles tenga la columna empresa.
create policy "Notas seguimiento financiero: select por empresa"
on seguimiento_financiero_notas
for select
using (
  exists (
    select 1
    from perfiles p
    where p.id = auth.uid()
      and p.empresa = seguimiento_financiero_notas.empresa
  )
);

create policy "Notas seguimiento financiero: insert por empresa"
on seguimiento_financiero_notas
for insert
with check (
  exists (
    select 1
    from perfiles p
    where p.id = auth.uid()
      and p.empresa = seguimiento_financiero_notas.empresa
  )
);

create policy "Notas seguimiento financiero: update por empresa"
on seguimiento_financiero_notas
for update
using (
  exists (
    select 1
    from perfiles p
    where p.id = auth.uid()
      and p.empresa = seguimiento_financiero_notas.empresa
  )
)
with check (
  exists (
    select 1
    from perfiles p
    where p.id = auth.uid()
      and p.empresa = seguimiento_financiero_notas.empresa
  )
);
