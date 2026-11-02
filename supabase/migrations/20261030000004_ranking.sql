-- Fase 4: Ranking genérico. A pontuação é a soma de eventos imutáveis (histórico),
-- nunca um total editável. `source_type`/`source_id` permitem ligar campeonatos depois.

create table public.rankings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sport_id uuid,
  name text not null check (length(trim(name)) > 0),
  season text not null check (length(trim(season)) > 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, sport_id) references public.sports (tenant_id, id)
);
create unique index rankings_name_season_uidx on public.rankings (tenant_id, lower(name), season);

create table public.ranking_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  ranking_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (ranking_id, id),
  unique (ranking_id, name),
  foreign key (tenant_id, ranking_id) references public.rankings (tenant_id, id) on delete cascade
);

create table public.ranking_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  ranking_id uuid not null,
  category_id uuid,
  student_id uuid,
  name text not null check (length(trim(name)) > 0), -- atleta externo ou cópia do nome do aluno
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, ranking_id) references public.rankings (tenant_id, id) on delete cascade,
  foreign key (ranking_id, category_id) references public.ranking_categories (ranking_id, id),
  foreign key (tenant_id, student_id) references public.students (tenant_id, id)
);
create unique index ranking_entries_student_uidx
  on public.ranking_entries (ranking_id, student_id, coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where student_id is not null;
create index ranking_entries_ranking_idx on public.ranking_entries (ranking_id);

create table public.ranking_point_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  entry_id uuid not null,
  points integer not null check (points <> 0 and points between -100000 and 100000),
  reason text not null check (length(trim(reason)) > 0),
  source_type text not null default 'manual' check (source_type in ('manual', 'championship')),
  source_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, entry_id) references public.ranking_entries (tenant_id, id) on delete cascade,
  check ((source_type = 'manual') = (source_id is null))
);
-- Integração idempotente: o mesmo evento de origem não pontua duas vezes a mesma entrada.
create unique index ranking_events_source_uidx
  on public.ranking_point_events (entry_id, source_type, source_id) where source_id is not null;
create index ranking_events_entry_idx on public.ranking_point_events (entry_id);

create trigger trg_rankings_updated_at before update on public.rankings
  for each row execute function public.set_updated_at();
create trigger trg_rankings_tenant_immutable before update on public.rankings
  for each row execute function public.prevent_tenant_change();
create trigger trg_ranking_entries_tenant_immutable before update on public.ranking_entries
  for each row execute function public.prevent_tenant_change();

-- Classificação: soma dos eventos + posição (empates compartilham a posição).
create view public.ranking_standings with (security_invoker = true) as
select
  e.id as entry_id,
  e.tenant_id,
  e.ranking_id,
  e.category_id,
  e.student_id,
  e.name,
  coalesce(sum(p.points), 0)::integer as total_points,
  count(p.id)::integer as events_count,
  (rank() over (
    partition by e.ranking_id, e.category_id
    order by coalesce(sum(p.points), 0) desc
  ))::integer as position
from public.ranking_entries e
left join public.ranking_point_events p on p.entry_id = e.id
where e.active
group by e.id;

-- ---------------------------------------------------------------------------
-- RLS: membros leem (módulo ativo); rankings.write escreve.
-- ---------------------------------------------------------------------------
alter table public.rankings enable row level security;
alter table public.ranking_categories enable row level security;
alter table public.ranking_entries enable row level security;
alter table public.ranking_point_events enable row level security;

create policy rankings_select on public.rankings for select to authenticated
  using (public.is_member(tenant_id) and public.module_enabled(tenant_id, 'ranking'));
create policy ranking_categories_select on public.ranking_categories for select to authenticated
  using (public.is_member(tenant_id) and public.module_enabled(tenant_id, 'ranking'));
create policy ranking_entries_select on public.ranking_entries for select to authenticated
  using (public.is_member(tenant_id) and public.module_enabled(tenant_id, 'ranking'));
create policy ranking_events_select on public.ranking_point_events for select to authenticated
  using (public.is_member(tenant_id) and public.module_enabled(tenant_id, 'ranking'));

create policy rankings_write on public.rankings for all to authenticated
  using (public.has_permission(tenant_id, 'rankings.write') and public.module_enabled(tenant_id, 'ranking'))
  with check (public.has_permission(tenant_id, 'rankings.write') and public.module_enabled(tenant_id, 'ranking'));
create policy ranking_categories_write on public.ranking_categories for all to authenticated
  using (public.has_permission(tenant_id, 'rankings.write') and public.module_enabled(tenant_id, 'ranking'))
  with check (public.has_permission(tenant_id, 'rankings.write') and public.module_enabled(tenant_id, 'ranking'));
create policy ranking_entries_write on public.ranking_entries for all to authenticated
  using (public.has_permission(tenant_id, 'rankings.write') and public.module_enabled(tenant_id, 'ranking'))
  with check (public.has_permission(tenant_id, 'rankings.write') and public.module_enabled(tenant_id, 'ranking'));
create policy ranking_events_insert on public.ranking_point_events for insert to authenticated
  with check (public.has_permission(tenant_id, 'rankings.write') and public.module_enabled(tenant_id, 'ranking'));

-- Grants: eventos são append-only (sem UPDATE/DELETE); correções = evento compensatório.
revoke all on public.rankings, public.ranking_categories, public.ranking_entries,
  public.ranking_point_events from anon, authenticated;
grant select, insert, update on public.rankings, public.ranking_entries to authenticated;
grant select, insert, update, delete on public.ranking_categories to authenticated;
grant select, insert on public.ranking_point_events to authenticated;
grant select on public.ranking_standings to authenticated;
