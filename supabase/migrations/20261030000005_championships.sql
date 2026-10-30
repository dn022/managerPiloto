-- Fase 5: Campeonatos/eventos esportivos multi-tenant.
-- Categorias configuráveis por evento, inscrições, chaves, resultados e integração
-- OPCIONAL e desacoplada com ranking (via eventos de pontos).

create table public.championships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sport_id uuid,
  name text not null check (length(trim(name)) > 0),
  event_date date,
  location text,
  description text,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'finished')),
  ranking_id uuid, -- opcional: ranking que recebe os pontos ao finalizar
  results_published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, sport_id) references public.sports (tenant_id, id),
  foreign key (tenant_id, ranking_id) references public.rankings (tenant_id, id)
);
create index championships_tenant_idx on public.championships (tenant_id, event_date desc);

create table public.championship_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  championship_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  gender text check (gender in ('M', 'F')),
  min_age integer check (min_age >= 0),
  max_age integer,
  min_weight_kg numeric(6, 2) check (min_weight_kg >= 0),
  max_weight_kg numeric(6, 2),
  level text, -- livre: faixa, nível, classe etc. (depende da modalidade)
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (championship_id, id),
  unique (championship_id, name),
  check (max_age is null or min_age is null or max_age >= min_age),
  check (max_weight_kg is null or min_weight_kg is null or max_weight_kg >= min_weight_kg),
  foreign key (tenant_id, championship_id) references public.championships (tenant_id, id) on delete cascade
);

create table public.championship_registrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  championship_id uuid not null,
  category_id uuid,
  student_id uuid,
  name text not null check (length(trim(name)) > 0),
  team text,
  gender text check (gender in ('M', 'F')),
  birth_date date,
  weight_kg numeric(6, 2) check (weight_kg >= 0),
  level text,
  phone text,
  email text,
  fee_cents integer not null default 0 check (fee_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (championship_id, id),
  foreign key (tenant_id, championship_id) references public.championships (tenant_id, id) on delete cascade,
  foreign key (championship_id, category_id) references public.championship_categories (championship_id, id),
  foreign key (tenant_id, student_id) references public.students (tenant_id, id)
);
create unique index championship_registrations_student_uidx
  on public.championship_registrations (championship_id, student_id, coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where student_id is not null and status <> 'cancelled';
create index championship_registrations_champ_idx on public.championship_registrations (championship_id);

-- Chave: slots (ids de inscrição, em ordem) e vencedores por rodada, como no módulo original.
create table public.championship_brackets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  championship_id uuid not null,
  category_id uuid,
  name text not null check (length(trim(name)) > 0),
  slots jsonb not null default '[]'::jsonb check (jsonb_typeof(slots) = 'array'),
  winners jsonb not null default '[]'::jsonb check (jsonb_typeof(winners) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, championship_id) references public.championships (tenant_id, id) on delete cascade,
  foreign key (championship_id, category_id) references public.championship_categories (championship_id, id)
);
-- Constraint (não índice parcial) para permitir upsert via on_conflict; categoria nula repete.
alter table public.championship_brackets
  add constraint championship_brackets_category_key unique (championship_id, category_id);

-- Resultados por categoria (empates, p.ex. dois 3º lugares, são permitidos).
create table public.championship_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  championship_id uuid not null,
  category_id uuid,
  registration_id uuid not null,
  placement integer not null check (placement >= 1),
  created_at timestamptz not null default now(),
  unique (championship_id, registration_id),
  foreign key (tenant_id, championship_id) references public.championships (tenant_id, id) on delete cascade,
  foreign key (championship_id, category_id) references public.championship_categories (championship_id, id),
  foreign key (championship_id, registration_id) references public.championship_registrations (championship_id, id) on delete cascade
);

-- Pontos por colocação (usados só se o campeonato estiver ligado a um ranking).
create table public.championship_points_rules (
  tenant_id uuid not null,
  championship_id uuid not null,
  placement integer not null check (placement >= 1),
  points integer not null check (points <> 0),
  primary key (championship_id, placement),
  foreign key (tenant_id, championship_id) references public.championships (tenant_id, id) on delete cascade
);

-- Despesas do evento (substitui a antiga tabela `custos`).
create table public.championship_expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  championship_id uuid not null,
  description text not null check (length(trim(description)) > 0),
  category text,
  amount_cents integer not null check (amount_cents >= 0),
  spent_on date not null default current_date,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, championship_id) references public.championships (tenant_id, id) on delete cascade
);
create index championship_expenses_champ_idx on public.championship_expenses (championship_id);

do $$
declare t text;
begin
  foreach t in array array['championships','championship_registrations','championship_brackets'] loop
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
  foreach t in array array['championships','championship_registrations','championship_brackets'] loop
    execute format('create trigger trg_%1$s_tenant_immutable before update on public.%1$s for each row execute function public.prevent_tenant_change()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'championships','championship_categories','championship_registrations',
    'championship_brackets','championship_results','championship_points_rules','championship_expenses'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    -- leitura: membros do tenant com o módulo ativo (despesas: ver abaixo)
    if t <> 'championship_expenses' then
      execute format(
        'create policy %1$s_select on public.%1$I for select to authenticated using (public.is_member(tenant_id) and public.module_enabled(tenant_id, ''championships''))', t);
    end if;
    execute format(
      'create policy %1$s_write on public.%1$I for all to authenticated
         using (public.has_permission(tenant_id, ''championships.write'') and public.module_enabled(tenant_id, ''championships''))
         with check (public.has_permission(tenant_id, ''championships.write'') and public.module_enabled(tenant_id, ''championships''))', t);
  end loop;
end $$;

-- Despesas são dados financeiros: exigem payments.read.
create policy championship_expenses_select on public.championship_expenses for select to authenticated
  using (public.has_permission(tenant_id, 'payments.read') and public.module_enabled(tenant_id, 'championships'));
drop policy championship_expenses_write on public.championship_expenses;
create policy championship_expenses_write on public.championship_expenses for all to authenticated
  using (public.has_permission(tenant_id, 'payments.write') and public.module_enabled(tenant_id, 'championships'))
  with check (public.has_permission(tenant_id, 'payments.write') and public.module_enabled(tenant_id, 'championships'));

revoke all on public.championships, public.championship_categories, public.championship_registrations,
  public.championship_brackets, public.championship_results, public.championship_points_rules,
  public.championship_expenses from anon, authenticated;
grant select, insert, update on public.championships, public.championship_registrations,
  public.championship_brackets to authenticated;
grant select, insert, update, delete on public.championship_categories, public.championship_results,
  public.championship_points_rules, public.championship_expenses to authenticated;

-- ---------------------------------------------------------------------------
-- Integração opcional com ranking: gera eventos de pontos a partir dos resultados.
-- Idempotente (índice único por entrada + origem); só quem pode escrever nos dois módulos.
-- ---------------------------------------------------------------------------
create or replace function public.publish_results_to_ranking(p_championship uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_champ public.championships%rowtype;
  v_row record;
  v_entry uuid;
  v_inserted integer := 0;
  v_count integer;
begin
  select * into v_champ from public.championships where id = p_championship;
  if not found then
    raise exception 'campeonato não encontrado';
  end if;

  if not (
    public.has_permission(v_champ.tenant_id, 'championships.write')
    and public.has_permission(v_champ.tenant_id, 'rankings.write')
    and public.module_enabled(v_champ.tenant_id, 'championships')
    and public.module_enabled(v_champ.tenant_id, 'ranking')
  ) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if v_champ.ranking_id is null then
    raise exception 'campeonato não está vinculado a um ranking';
  end if;

  for v_row in
    select r.registration_id, r.placement, reg.name, reg.student_id, pr.points
    from public.championship_results r
    join public.championship_registrations reg on reg.id = r.registration_id
    join public.championship_points_rules pr
      on pr.championship_id = r.championship_id and pr.placement = r.placement
    where r.championship_id = p_championship
  loop
    -- localiza (ou cria) o participante no ranking, sem categoria
    select e.id into v_entry
    from public.ranking_entries e
    where e.ranking_id = v_champ.ranking_id and e.category_id is null and e.active
      and (
        (v_row.student_id is not null and e.student_id = v_row.student_id)
        or (v_row.student_id is null and e.student_id is null and lower(e.name) = lower(v_row.name))
      )
    limit 1;

    if v_entry is null then
      insert into public.ranking_entries (tenant_id, ranking_id, student_id, name)
      values (v_champ.tenant_id, v_champ.ranking_id, v_row.student_id, v_row.name)
      returning id into v_entry;
    end if;

    insert into public.ranking_point_events (tenant_id, entry_id, points, reason, source_type, source_id, created_by)
    values (
      v_champ.tenant_id, v_entry, v_row.points,
      v_champ.name || ': ' || v_row.placement || 'º lugar',
      'championship', p_championship, auth.uid()
    )
    on conflict (entry_id, source_type, source_id) where source_id is not null do nothing;

    get diagnostics v_count = row_count;
    v_inserted := v_inserted + v_count;
  end loop;

  update public.championships set results_published_at = now() where id = p_championship;
  return v_inserted;
end;
$$;

revoke all on function public.publish_results_to_ranking(uuid) from public, anon;
grant execute on function public.publish_results_to_ranking(uuid) to authenticated;
