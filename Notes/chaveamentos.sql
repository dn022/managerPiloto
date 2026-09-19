create table if not exists public.chaveamentos (
  id text primary key,
  name text not null,
  description text not null default '',
  athlete_ids jsonb not null default '[]'::jsonb,
  slot_athlete_ids jsonb not null default '[]'::jsonb,
  winner_selections jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.chaveamentos
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create or replace function public.set_chaveamentos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_chaveamentos_updated_at on public.chaveamentos;

create trigger trg_chaveamentos_updated_at
before update on public.chaveamentos
for each row
execute function public.set_chaveamentos_updated_at();

