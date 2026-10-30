# Configuração do Supabase (SQL Editor)

Este guia reúne **tudo que precisa ser executado no Supabase** para o projeto ficar completo: banco, segurança (RLS), Storage e o primeiro Super Admin. O conteúdo das migrations abaixo é copiado de `supabase/migrations/`, que continua sendo a fonte de verdade.

> Use um projeto Supabase **novo**, criado só para esta plataforma. Nunca reaproveite o projeto de outro sistema.

## Visão geral

| Passo | O que fazer | Onde |
|------|-------------|------|
| 1 | Criar o projeto e copiar URL e chave anon | Supabase > Project Settings > API |
| 2 | Preencher o `.env.local` | Raiz do projeto |
| 3 | Rodar as 7 migrations, **na ordem** | SQL Editor |
| 4 | Conferir tabelas, funções e bucket | SQL Editor / Storage |
| 5 | Criar o primeiro usuário e torná-lo Super Admin | Authentication + SQL Editor |
| 6 | Criar a primeira arena | App, em `/platform` |

## 1. Projeto e variáveis de ambiente

1. Crie um projeto em https://supabase.com/dashboard.
2. Em **Project Settings > API**, copie a **Project URL** e a chave **anon / publishable**.
3. Crie o arquivo `.env.local` na raiz (veja `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
```

A aplicação usa **somente** a chave anon: o isolamento entre arenas é garantido pelas políticas RLS do banco. Não use a `service_role` no front nem a coloque no `.env.local`.

## 2. Rodar as migrations

No **SQL Editor** do Supabase, abra uma nova query para **cada** bloco abaixo, cole o conteúdo e execute com **Run**, seguindo a ordem 1 a 7. Se alguma falhar, pare e corrija antes de seguir: cada migration depende da anterior.

> Alternativa: com a Supabase CLI, `supabase link --project-ref SEU-REF` e depois `supabase db push` aplicam as mesmas 7 migrations.

### Migration 1 de 7: Base multi-tenant: tenants, usuários, papéis, permissões, módulos, planos e RLS

Arquivo: `supabase/migrations/20261030000001_foundation.sql`

```sql
-- Foundation: multi-tenant, memberships, roles/permissions, módulos/planos e RLS.
-- Pré-requisito: schema `auth` do Supabase (auth.users, auth.uid()).

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Plataforma
-- ---------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$'),
  logo_path text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create trigger trg_tenants_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Papéis e permissões (tenant_id nulo = papel do sistema)
-- ---------------------------------------------------------------------------
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  code text not null check (code ~ '^[a-z_]+$'),
  name text not null,
  created_at timestamptz not null default now()
);
create unique index roles_code_uidx
  on public.roles (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission text not null check (permission ~ '^[a-z_]+\.[a-z_]+$'),
  primary key (role_id, permission)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  role_id uuid not null references public.roles (id),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);
create index memberships_tenant_idx on public.memberships (tenant_id);
create trigger trg_memberships_updated_at before update on public.memberships
  for each row execute function public.set_updated_at();

-- O papel precisa ser do sistema ou do próprio tenant da membership.
create or replace function public.check_membership_role()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.roles r
    where r.id = new.role_id and (r.tenant_id is null or r.tenant_id = new.tenant_id)
  ) then
    raise exception 'role % não pertence ao tenant %', new.role_id, new.tenant_id;
  end if;
  return new;
end;
$$;
create trigger trg_memberships_role_check before insert or update on public.memberships
  for each row execute function public.check_membership_role();

-- ---------------------------------------------------------------------------
-- Módulos, planos, limites e assinatura (apenas estrutura; sem cobrança)
-- ---------------------------------------------------------------------------
create table public.modules (
  code text primary key,
  name text not null
);

create table public.plans (
  code text primary key,
  name text not null,
  active boolean not null default true
);

create table public.plan_modules (
  plan_code text not null references public.plans (code) on delete cascade,
  module_code text not null references public.modules (code) on delete cascade,
  primary key (plan_code, module_code)
);

create table public.plan_limits (
  plan_code text not null references public.plans (code) on delete cascade,
  key text not null,
  value integer not null check (value >= 0),
  primary key (plan_code, key)
);

create table public.tenant_subscriptions (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  plan_code text not null references public.plans (code),
  status text not null default 'active' check (status in ('trial', 'active', 'past_due', 'cancelled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_subscriptions_updated_at before update on public.tenant_subscriptions
  for each row execute function public.set_updated_at();

-- Override por tenant: sobrepõe o que o plano define.
create table public.tenant_modules (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  module_code text not null references public.modules (code) on delete cascade,
  enabled boolean not null,
  primary key (tenant_id, module_code)
);

-- ---------------------------------------------------------------------------
-- Funções de autorização (security definer: leem tabelas sem depender de RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.is_member(p_tenant uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.user_id = auth.uid()
      and m.tenant_id = p_tenant
      and m.status = 'active'
      and t.status = 'active'
      and t.deleted_at is null
  );
$$;

create or replace function public.has_permission(p_tenant uuid, p_permission text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    join public.role_permissions rp on rp.role_id = m.role_id
    where m.user_id = auth.uid()
      and m.tenant_id = p_tenant
      and m.status = 'active'
      and t.status = 'active'
      and t.deleted_at is null
      and rp.permission = p_permission
  );
$$;

create or replace function public.module_enabled(p_tenant uuid, p_module text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select tm.enabled from public.tenant_modules tm
      where tm.tenant_id = p_tenant and tm.module_code = p_module),
    exists (
      select 1
      from public.tenant_subscriptions s
      join public.plan_modules pm on pm.plan_code = s.plan_code
      where s.tenant_id = p_tenant
        and s.status in ('trial', 'active')
        and pm.module_code = p_module
    )
  );
$$;

-- Limite do plano para uma chave (ex.: 'students'); nulo = sem limite definido.
create or replace function public.plan_limit(p_tenant uuid, p_key text)
returns integer
language sql stable security definer set search_path = public
as $$
  select pl.value
  from public.tenant_subscriptions s
  join public.plan_limits pl on pl.plan_code = s.plan_code and pl.key = p_key
  where s.tenant_id = p_tenant;
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
-- Cria tenant + assinatura + membership owner. Somente Super Admin.
create or replace function public.create_tenant(
  p_name text,
  p_slug text,
  p_owner_email text,
  p_plan_code text default 'completo'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_owner uuid;
  v_role uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select id into v_owner from auth.users where lower(email) = lower(p_owner_email);
  if v_owner is null then
    raise exception 'usuário % não encontrado', p_owner_email;
  end if;

  select id into v_role from public.roles where tenant_id is null and code = 'owner';

  insert into public.tenants (name, slug) values (p_name, p_slug) returning id into v_tenant;
  insert into public.tenant_subscriptions (tenant_id, plan_code) values (v_tenant, p_plan_code);
  insert into public.memberships (user_id, tenant_id, role_id) values (v_owner, v_tenant, v_role);

  return v_tenant;
end;
$$;

-- Adiciona usuário já existente ao tenant. Exige users.manage; só owner atribui owner.
create or replace function public.add_member(
  p_tenant uuid,
  p_email text,
  p_role_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_role uuid;
  v_membership uuid;
begin
  if not public.has_permission(p_tenant, 'users.manage') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select id into v_role from public.roles
  where code = p_role_code and (tenant_id is null or tenant_id = p_tenant)
  order by tenant_id nulls last limit 1;
  if v_role is null then
    raise exception 'papel % inexistente', p_role_code;
  end if;

  if p_role_code = 'owner' and not exists (
    select 1 from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.user_id = auth.uid() and m.tenant_id = p_tenant
      and m.status = 'active' and r.code = 'owner'
  ) then
    raise exception 'somente owner pode atribuir owner' using errcode = '42501';
  end if;

  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then
    raise exception 'usuário % não encontrado', p_email;
  end if;

  insert into public.memberships (user_id, tenant_id, role_id)
  values (v_user, p_tenant, v_role)
  on conflict (user_id, tenant_id) do update set role_id = excluded.role_id, status = 'active'
  returning id into v_membership;

  return v_membership;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.platform_admins enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.memberships enable row level security;
alter table public.modules enable row level security;
alter table public.plans enable row level security;
alter table public.plan_modules enable row level security;
alter table public.plan_limits enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.tenant_modules enable row level security;

-- tenants: membros veem o seu; Super Admin vê todos. Dono edita dados cosméticos.
create policy tenants_select on public.tenants for select to authenticated
  using (public.is_member(id) or public.is_platform_admin());
create policy tenants_update on public.tenants for update to authenticated
  using (public.has_permission(id, 'tenant.manage'))
  with check (public.has_permission(id, 'tenant.manage'));

-- platform_admins: ninguém lê/escreve pela API (apenas via funções).
-- (sem policies = negado)

-- profiles: o próprio usuário e quem gerencia usuários de um tenant em comum.
create policy profiles_select on public.profiles for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.memberships m
      where m.user_id = profiles.user_id and public.has_permission(m.tenant_id, 'users.read')
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- roles / permissões: papéis do sistema são públicos para autenticados; os do tenant só para membros.
create policy roles_select on public.roles for select to authenticated
  using (tenant_id is null or public.is_member(tenant_id));
create policy role_permissions_select on public.role_permissions for select to authenticated
  using (exists (
    select 1 from public.roles r
    where r.id = role_permissions.role_id and (r.tenant_id is null or public.is_member(r.tenant_id))
  ));

-- memberships: vê as próprias e, com users.read, as do tenant. Escrita só via add_member().
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.has_permission(tenant_id, 'users.read'));

-- catálogo de planos: leitura para autenticados.
create policy modules_select on public.modules for select to authenticated using (true);
create policy plans_select on public.plans for select to authenticated using (true);
create policy plan_modules_select on public.plan_modules for select to authenticated using (true);
create policy plan_limits_select on public.plan_limits for select to authenticated using (true);

-- assinatura / módulos do tenant: membros leem; Super Admin lê tudo. Escrita só por service role.
create policy subscriptions_select on public.tenant_subscriptions for select to authenticated
  using (public.is_member(tenant_id) or public.is_platform_admin());
create policy tenant_modules_select on public.tenant_modules for select to authenticated
  using (public.is_member(tenant_id) or public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Privilégios (princípio do menor privilégio)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon;

grant select on public.tenants, public.profiles, public.roles, public.role_permissions,
  public.memberships, public.modules, public.plans, public.plan_modules, public.plan_limits,
  public.tenant_subscriptions, public.tenant_modules to authenticated;
-- tenant só altera dados cosméticos; status é do Super Admin (service role).
grant update (name, logo_path, settings) on public.tenants to authenticated;
grant update (name, phone) on public.profiles to authenticated;

grant execute on function
  public.is_platform_admin(), public.is_member(uuid), public.has_permission(uuid, text),
  public.module_enabled(uuid, text), public.plan_limit(uuid, text),
  public.create_tenant(text, text, text, text), public.add_member(uuid, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Dados de sistema (catálogo, não são dados de cliente)
-- ---------------------------------------------------------------------------
insert into public.modules (code, name) values
  ('management', 'Gestão de Turmas'),
  ('championships', 'Campeonatos'),
  ('ranking', 'Ranking');

insert into public.plans (code, name) values
  ('gestao', 'Gestão'),
  ('campeonatos', 'Campeonatos'),
  ('completo', 'Completo');

insert into public.plan_modules (plan_code, module_code) values
  ('gestao', 'management'),
  ('campeonatos', 'championships'),
  ('completo', 'management'),
  ('completo', 'championships'),
  ('completo', 'ranking');

insert into public.plan_limits (plan_code, key, value) values
  ('gestao', 'students', 100),
  ('gestao', 'classes', 10),
  ('completo', 'students', 1000);

insert into public.roles (tenant_id, code, name) values
  (null, 'owner', 'Proprietário'),
  (null, 'admin', 'Administrador'),
  (null, 'staff', 'Funcionário'),
  (null, 'teacher', 'Professor'),
  (null, 'student', 'Aluno');

insert into public.role_permissions (role_id, permission)
select r.id, p.permission
from public.roles r
join (values
  ('owner', 'tenant.manage'), ('owner', 'users.read'), ('owner', 'users.manage'),
  ('admin', 'users.read'),
  ('staff', 'payments.read'), ('staff', 'payments.write'),
  ('teacher', 'classes.read'), ('teacher', 'students.read'), ('teacher', 'enrollments.read')
) as p (role_code, permission) on p.role_code = r.code
where r.tenant_id is null;

-- Permissões de domínio: owner e admin têm tudo; staff e teacher recebem subconjuntos acima/abaixo.
insert into public.role_permissions (role_id, permission)
select r.id, d.resource || '.' || d.action
from public.roles r
cross join (
  select resource, action
  from unnest(array['students','teachers','sports','classes','enrollments','payments','rankings','championships']) as resource
  cross join unnest(array['read','write']) as action
) d
where r.tenant_id is null and r.code in ('owner', 'admin')
on conflict do nothing;

insert into public.role_permissions (role_id, permission)
select r.id, p.permission
from public.roles r
join (values
  ('staff', 'students.read'), ('staff', 'students.write'), ('staff', 'classes.read'),
  ('staff', 'enrollments.read'), ('staff', 'enrollments.write'), ('staff', 'sports.read'),
  ('staff', 'teachers.read'),
  ('teacher', 'sports.read')
) as p (role_code, permission) on p.role_code = r.code
where r.tenant_id is null
on conflict do nothing;
```

### Migration 2 de 7: Gestão: modalidades, professores, alunos, turmas, matrículas e horários

Arquivo: `supabase/migrations/20261030000002_management.sql`

```sql
-- Fase 2: Gestão (modalidades, professores, alunos, turmas, horários, matrículas).
-- Toda tabela de tenant: tenant_id + RLS + FKs compostas (tenant_id, id) para impedir
-- referências entre tenants + grants explícitos.

create or replace function public.prevent_tenant_change()
returns trigger
language plpgsql
as $$
begin
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'tenant_id é imutável';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.sports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
create unique index sports_name_uidx on public.sports (tenant_id, lower(name)) where deleted_at is null;

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  phone text,
  email text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
create unique index teachers_user_uidx on public.teachers (tenant_id, user_id) where user_id is not null;

create table public.students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  phone text,
  email text,
  birth_date date,
  document text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
create unique index students_user_uidx on public.students (tenant_id, user_id) where user_id is not null;
create index students_tenant_idx on public.students (tenant_id) where deleted_at is null;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sport_id uuid not null,
  teacher_id uuid,
  name text not null check (length(trim(name)) > 0),
  capacity integer not null check (capacity > 0),
  monthly_fee_cents integer not null default 0 check (monthly_fee_cents >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, sport_id) references public.sports (tenant_id, id),
  foreign key (tenant_id, teacher_id) references public.teachers (tenant_id, id)
);
create index classes_tenant_idx on public.classes (tenant_id) where deleted_at is null;
create index classes_teacher_idx on public.classes (teacher_id);

create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  class_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo
  start_time time not null,
  end_time time not null,
  check (end_time > start_time),
  foreign key (tenant_id, class_id) references public.classes (tenant_id, id) on delete cascade
);
create index class_schedules_class_idx on public.class_schedules (class_id);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  student_id uuid not null,
  class_id uuid not null,
  started_at date not null default current_date,
  ended_at date,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  fee_cents integer not null default 0 check (fee_cents >= 0),
  capacity_override boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  check (ended_at is null or ended_at >= started_at),
  foreign key (tenant_id, student_id) references public.students (tenant_id, id),
  foreign key (tenant_id, class_id) references public.classes (tenant_id, id)
);
create unique index enrollments_open_uidx on public.enrollments (student_id, class_id) where status <> 'ended';
create index enrollments_class_idx on public.enrollments (class_id) where status = 'active';
create index enrollments_student_idx on public.enrollments (student_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['sports','teachers','students','classes','enrollments'] loop
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
  foreach t in array array['sports','teachers','students','classes','class_schedules','enrollments'] loop
    execute format('create trigger trg_%1$s_tenant_immutable before update on public.%1$s for each row execute function public.prevent_tenant_change()', t);
  end loop;
end $$;

-- Capacidade: bloqueia matrícula ativa acima da capacidade, salvo exceção autorizada.
create or replace function public.enforce_enrollment_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_active integer;
begin
  if new.capacity_override and not public.has_permission(new.tenant_id, 'enrollments.override') then
    raise exception 'sem permissão para exceder a capacidade' using errcode = '42501';
  end if;

  if new.status <> 'active' or new.capacity_override then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' and old.class_id = new.class_id then
    return new;
  end if;

  -- trava a turma para serializar matrículas concorrentes
  select capacity into v_capacity from public.classes where id = new.class_id for update;

  select count(*) into v_active from public.enrollments
  where class_id = new.class_id and status = 'active' and id <> new.id;

  if v_active >= v_capacity then
    raise exception 'turma lotada (% de % vagas)', v_active, v_capacity using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger trg_enrollments_capacity before insert or update on public.enrollments
  for each row execute function public.enforce_enrollment_capacity();

-- Limites do plano (students / classes). Sem limite definido = ilimitado.
create or replace function public.enforce_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := tg_argv[0];
  v_limit integer;
  v_count integer;
begin
  v_limit := public.plan_limit(new.tenant_id, v_key);
  if v_limit is null then
    return new;
  end if;
  execute format('select count(*) from public.%I where tenant_id = $1 and deleted_at is null', tg_table_name)
    into v_count using new.tenant_id;
  if v_count >= v_limit then
    raise exception 'limite do plano atingido (% de %)', v_count, v_limit using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger trg_students_limit before insert on public.students
  for each row execute function public.enforce_plan_limit('students');
create trigger trg_classes_limit before insert on public.classes
  for each row execute function public.enforce_plan_limit('classes');

-- ---------------------------------------------------------------------------
-- Funções de relacionamento (portal de professores e alunos)
-- ---------------------------------------------------------------------------
create or replace function public.is_teacher_of_class(p_class uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    join public.teachers t on t.id = c.teacher_id and t.tenant_id = c.tenant_id
    where c.id = p_class and t.user_id = auth.uid() and public.is_member(c.tenant_id)
  );
$$;

create or replace function public.is_own_student(p_student uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.id = p_student and s.user_id = auth.uid() and public.is_member(s.tenant_id)
  );
$$;

create or replace function public.is_teacher_of_student(p_student uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    join public.teachers t on t.id = c.teacher_id and t.tenant_id = c.tenant_id
    where e.student_id = p_student and e.status = 'active'
      and t.user_id = auth.uid() and public.is_member(e.tenant_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.sports enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.classes enable row level security;
alter table public.class_schedules enable row level security;
alter table public.enrollments enable row level security;

-- Catálogo e agenda: qualquer membro do tenant lê (sem dados pessoais de alunos).
create policy sports_select on public.sports for select to authenticated using (public.is_member(tenant_id));
create policy teachers_select on public.teachers for select to authenticated using (public.is_member(tenant_id));
create policy classes_select on public.classes for select to authenticated using (public.is_member(tenant_id));
create policy class_schedules_select on public.class_schedules for select to authenticated using (public.is_member(tenant_id));

-- Alunos: quem tem students.read, o próprio aluno ou o professor de uma turma dele.
create policy students_select on public.students for select to authenticated
  using (
    public.has_permission(tenant_id, 'students.read')
    or user_id = auth.uid()
    or public.is_teacher_of_student(id)
  );

-- Matrículas: enrollments.read, o próprio aluno ou o professor da turma.
create policy enrollments_select on public.enrollments for select to authenticated
  using (
    public.has_permission(tenant_id, 'enrollments.read')
    or public.is_own_student(student_id)
    or public.is_teacher_of_class(class_id)
  );

-- Escrita: permissão + módulo ativo.
create policy sports_write on public.sports for all to authenticated
  using (public.has_permission(tenant_id, 'sports.write') and public.module_enabled(tenant_id, 'management'))
  with check (public.has_permission(tenant_id, 'sports.write') and public.module_enabled(tenant_id, 'management'));
create policy teachers_write on public.teachers for all to authenticated
  using (public.has_permission(tenant_id, 'teachers.write') and public.module_enabled(tenant_id, 'management'))
  with check (public.has_permission(tenant_id, 'teachers.write') and public.module_enabled(tenant_id, 'management'));
create policy students_write on public.students for all to authenticated
  using (public.has_permission(tenant_id, 'students.write') and public.module_enabled(tenant_id, 'management'))
  with check (public.has_permission(tenant_id, 'students.write') and public.module_enabled(tenant_id, 'management'));
create policy classes_write on public.classes for all to authenticated
  using (public.has_permission(tenant_id, 'classes.write') and public.module_enabled(tenant_id, 'management'))
  with check (public.has_permission(tenant_id, 'classes.write') and public.module_enabled(tenant_id, 'management'));
create policy class_schedules_write on public.class_schedules for all to authenticated
  using (public.has_permission(tenant_id, 'classes.write') and public.module_enabled(tenant_id, 'management'))
  with check (public.has_permission(tenant_id, 'classes.write') and public.module_enabled(tenant_id, 'management'));
create policy enrollments_write on public.enrollments for all to authenticated
  using (public.has_permission(tenant_id, 'enrollments.write') and public.module_enabled(tenant_id, 'management'))
  with check (public.has_permission(tenant_id, 'enrollments.write') and public.module_enabled(tenant_id, 'management'));

-- ---------------------------------------------------------------------------
-- Grants (sem DELETE: exclusão lógica via deleted_at / status; exceto horários)
-- ---------------------------------------------------------------------------
revoke all on public.sports, public.teachers, public.students, public.classes,
  public.class_schedules, public.enrollments from anon, authenticated;

grant select, insert, update on public.sports, public.teachers, public.students,
  public.classes, public.enrollments to authenticated;
grant select, insert, update, delete on public.class_schedules to authenticated;

revoke all on function public.is_teacher_of_class(uuid), public.is_own_student(uuid),
  public.is_teacher_of_student(uuid), public.enforce_enrollment_capacity(),
  public.enforce_plan_limit() from public, anon;
grant execute on function public.is_teacher_of_class(uuid), public.is_own_student(uuid),
  public.is_teacher_of_student(uuid) to authenticated;

-- Ocupação das turmas (respeita RLS de quem consulta).
create view public.class_occupancy with (security_invoker = true) as
select
  c.id as class_id,
  c.tenant_id,
  c.capacity,
  (select count(*) from public.enrollments e where e.class_id = c.id and e.status = 'active')::integer as enrolled
from public.classes c;
grant select on public.class_occupancy to authenticated;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
-- Professor passa a enxergar alunos/matrículas só das próprias turmas (via relação, não permissão global).
delete from public.role_permissions rp
using public.roles r
where rp.role_id = r.id and r.tenant_id is null and r.code = 'teacher'
  and rp.permission in ('classes.read', 'students.read', 'enrollments.read');

insert into public.role_permissions (role_id, permission)
select id, 'enrollments.override' from public.roles
where tenant_id is null and code in ('owner', 'admin');
```

### Migration 3 de 7: Financeiro: mensalidades, pagamentos e inadimplência

Arquivo: `supabase/migrations/20261030000003_finance.sql`

```sql
-- Fase 3: Mensalidades (controle manual; sem gateway).
-- "Atrasado" não é gravado: é derivado de status = 'pending' e due_date < hoje.

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  student_id uuid not null,
  enrollment_id uuid not null,
  competence date not null check (competence = date_trunc('month', competence)::date),
  amount_cents integer not null check (amount_cents >= 0),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'exempt')),
  paid_at timestamptz,
  paid_amount_cents integer check (paid_amount_cents >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, student_id) references public.students (tenant_id, id),
  foreign key (tenant_id, enrollment_id) references public.enrollments (tenant_id, id),
  check (
    (status = 'paid' and paid_at is not null and paid_amount_cents is not null)
    or (status <> 'paid' and paid_at is null and paid_amount_cents is null)
  )
);
-- Uma mensalidade por matrícula e competência, exceto as canceladas (permite regerar).
create unique index invoices_enrollment_competence_uidx
  on public.invoices (enrollment_id, competence) where status <> 'cancelled';
create index invoices_tenant_competence_idx on public.invoices (tenant_id, competence);
create index invoices_student_idx on public.invoices (student_id);
create index invoices_pending_due_idx on public.invoices (tenant_id, due_date) where status = 'pending';

create trigger trg_invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();
create trigger trg_invoices_tenant_immutable before update on public.invoices
  for each row execute function public.prevent_tenant_change();

-- Impede alterar a identidade da cobrança (aluno/matrícula/competência) depois de criada.
create or replace function public.invoices_immutable_keys()
returns trigger
language plpgsql
as $$
begin
  if new.student_id is distinct from old.student_id
     or new.enrollment_id is distinct from old.enrollment_id
     or new.competence is distinct from old.competence then
    raise exception 'aluno, matrícula e competência da mensalidade são imutáveis';
  end if;
  return new;
end;
$$;
create trigger trg_invoices_keys_immutable before update on public.invoices
  for each row execute function public.invoices_immutable_keys();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.invoices enable row level security;

create policy invoices_select on public.invoices for select to authenticated
  using (
    public.has_permission(tenant_id, 'payments.read')
    or public.is_own_student(student_id)
  );

create policy invoices_write on public.invoices for all to authenticated
  using (public.has_permission(tenant_id, 'payments.write') and public.module_enabled(tenant_id, 'management'))
  with check (public.has_permission(tenant_id, 'payments.write') and public.module_enabled(tenant_id, 'management'));

revoke all on public.invoices from anon, authenticated;
grant select, insert, update on public.invoices to authenticated;

-- Status exibido (inclui "overdue"); respeita o RLS de quem consulta.
create view public.invoices_with_status with (security_invoker = true) as
select
  i.*,
  case
    when i.status = 'pending' and i.due_date < current_date then 'overdue'
    else i.status
  end as display_status
from public.invoices i;
grant select on public.invoices_with_status to authenticated;

-- ---------------------------------------------------------------------------
-- Geração mensal a partir das matrículas ativas
-- ---------------------------------------------------------------------------
create or replace function public.generate_monthly_invoices(
  p_tenant uuid,
  p_competence date,
  p_due_day integer default 10
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date := date_trunc('month', p_competence)::date;
  v_end date := (date_trunc('month', p_competence) + interval '1 month - 1 day')::date;
  v_count integer;
begin
  if not (public.has_permission(p_tenant, 'payments.write') and public.module_enabled(p_tenant, 'management')) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_due_day < 1 or p_due_day > 28 then
    raise exception 'dia de vencimento deve estar entre 1 e 28';
  end if;

  insert into public.invoices (tenant_id, student_id, enrollment_id, competence, amount_cents, due_date)
  select e.tenant_id, e.student_id, e.id, v_start, e.fee_cents, v_start + (p_due_day - 1)
  from public.enrollments e
  where e.tenant_id = p_tenant
    and e.fee_cents > 0
    and e.status = 'active'
    and e.started_at <= v_end
    and (e.ended_at is null or e.ended_at >= v_start)
  on conflict (enrollment_id, competence) where status <> 'cancelled' do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Resumo financeiro do mês (competência)
-- ---------------------------------------------------------------------------
create or replace function public.finance_summary(p_tenant uuid, p_competence date)
returns table (
  paid_cents bigint,
  pending_cents bigint,
  overdue_cents bigint,
  paid_count integer,
  pending_count integer,
  overdue_count integer,
  delinquent_students integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start date := date_trunc('month', p_competence)::date;
begin
  if not public.has_permission(p_tenant, 'payments.read') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  return query
  select
    coalesce(sum(i.paid_amount_cents) filter (where i.status = 'paid'), 0)::bigint,
    coalesce(sum(i.amount_cents) filter (where i.status = 'pending' and i.due_date >= current_date), 0)::bigint,
    coalesce(sum(i.amount_cents) filter (where i.status = 'pending' and i.due_date < current_date), 0)::bigint,
    (count(*) filter (where i.status = 'paid'))::integer,
    (count(*) filter (where i.status = 'pending' and i.due_date >= current_date))::integer,
    (count(*) filter (where i.status = 'pending' and i.due_date < current_date))::integer,
    (count(distinct i.student_id) filter (where i.status = 'pending' and i.due_date < current_date))::integer
  from public.invoices i
  where i.tenant_id = p_tenant and i.competence = v_start;
end;
$$;

-- Inadimplência atual (todas as competências em atraso), por aluno.
create or replace function public.delinquent_students(p_tenant uuid)
returns table (
  student_id uuid,
  student_name text,
  overdue_count integer,
  overdue_cents bigint,
  oldest_due date
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_permission(p_tenant, 'payments.read') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  return query
  select s.id, s.name, count(*)::integer, sum(i.amount_cents)::bigint, min(i.due_date)
  from public.invoices i
  join public.students s on s.id = i.student_id and s.tenant_id = i.tenant_id
  where i.tenant_id = p_tenant and i.status = 'pending' and i.due_date < current_date
  group by s.id, s.name
  order by min(i.due_date);
end;
$$;

revoke all on function public.generate_monthly_invoices(uuid, date, integer),
  public.finance_summary(uuid, date), public.delinquent_students(uuid), public.invoices_immutable_keys()
  from public, anon;
grant execute on function public.generate_monthly_invoices(uuid, date, integer),
  public.finance_summary(uuid, date), public.delinquent_students(uuid) to authenticated;
```

### Migration 4 de 7: Ranking: temporadas, categorias e pontos

Arquivo: `supabase/migrations/20261030000004_ranking.sql`

```sql
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
```

### Migration 5 de 7: Campeonatos: eventos, categorias, inscrições, chaves, resultados e despesas

Arquivo: `supabase/migrations/20261030000005_championships.sql`

```sql
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
```

### Migration 6 de 7: Identidade visual: cores, logo, bucket de Storage e gestão de usuários

Arquivo: `supabase/migrations/20261030000006_tenant_branding.sql`

```sql
-- Fase 6: personalização do tenant (dados da organização, cor, logo).
-- O logo fica no Storage (bucket `tenant-assets`), numa pasta com o id do tenant.

-- Chaves permitidas em tenants.settings, com validação de formato.
create or replace function public.valid_tenant_settings(s jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(s) = 'object'
    and not exists (
      select 1
      from jsonb_each(s) e
      where e.key <> all (array['phone', 'whatsapp', 'instagram', 'website', 'address', 'primary_color'])
         or jsonb_typeof(e.value) <> 'string'
         or length(e.value #>> '{}') > 200
         or (e.key = 'primary_color' and (e.value #>> '{}') !~ '^#[0-9a-fA-F]{6}$')
    );
$$;

alter table public.tenants
  add constraint tenants_settings_valid check (public.valid_tenant_settings(settings)),
  add constraint tenants_logo_path_in_folder check (logo_path is null or logo_path like id::text || '/%');

-- Tenant dono de um caminho de arquivo ("<tenant_id>/arquivo"); nulo se o formato for inválido.
create or replace function public.tenant_of_path(p_name text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and position('/' in p_name) > 0
    then split_part(p_name, '/', 1)::uuid
  end;
$$;
grant execute on function public.tenant_of_path(text) to authenticated;

-- Bucket público para leitura (logos aparecem na interface); escrita restrita por policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tenant-assets', 'tenant-assets', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy tenant_assets_select on storage.objects for select to authenticated
  using (bucket_id = 'tenant-assets' and public.is_member(public.tenant_of_path(name)));

create policy tenant_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-assets' and public.has_permission(public.tenant_of_path(name), 'tenant.manage'));

create policy tenant_assets_update on storage.objects for update to authenticated
  using (bucket_id = 'tenant-assets' and public.has_permission(public.tenant_of_path(name), 'tenant.manage'))
  with check (bucket_id = 'tenant-assets' and public.has_permission(public.tenant_of_path(name), 'tenant.manage'));

create policy tenant_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'tenant-assets' and public.has_permission(public.tenant_of_path(name), 'tenant.manage'));

-- Gestão de usuários: todo tenant mantém ao menos um owner ativo (vale para qualquer caminho:
-- rebaixar via add_member, desativar via set_member_status ou apagar a membership).
create or replace function public.ensure_owner_remains()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_is_owner boolean;
  v_new_is_owner boolean := false;
begin
  -- exclusão em cascata do tenant: o tenant já não existe, nada a proteger
  if not exists (select 1 from public.tenants where id = old.tenant_id) then
    return coalesce(new, old);
  end if;

  select exists (select 1 from public.roles r where r.id = old.role_id and r.code = 'owner')
    and old.status = 'active' into v_old_is_owner;

  if tg_op = 'UPDATE' then
    select exists (select 1 from public.roles r where r.id = new.role_id and r.code = 'owner')
      and new.status = 'active' into v_new_is_owner;
  end if;

  if v_old_is_owner and not v_new_is_owner and not exists (
    select 1 from public.memberships m join public.roles r on r.id = m.role_id
    where m.tenant_id = old.tenant_id and m.status = 'active' and r.code = 'owner' and m.id <> old.id
  ) then
    raise exception 'o tenant precisa de ao menos um owner ativo';
  end if;

  return coalesce(new, old);
end;
$$;
create trigger trg_memberships_owner_remains before update or delete on public.memberships
  for each row execute function public.ensure_owner_remains();

create or replace function public.set_member_status(p_tenant uuid, p_user uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission(p_tenant, 'users.manage') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_status not in ('active', 'disabled') then
    raise exception 'status inválido';
  end if;
  update public.memberships set status = p_status where tenant_id = p_tenant and user_id = p_user;
end;
$$;
revoke all on function public.set_member_status(uuid, uuid, text), public.ensure_owner_remains() from public, anon;
grant execute on function public.set_member_status(uuid, uuid, text) to authenticated;
```

### Migration 7 de 7: Planos e assinaturas: limites, módulos por plano e status

Arquivo: `supabase/migrations/20261030000007_subscriptions.sql`

```sql
-- Fase 7: estado da assinatura, overrides do Super Admin e uso dos limites.
-- Sem cobrança: o status é definido manualmente pelo Super Admin (a integração de
-- pagamento futura só precisará chamar set_tenant_subscription).

-- Assinatura vigente: trial/active/past_due (past_due = carência). Trial vencido não vale.
create or replace function public.subscription_active(p_tenant uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select s.status in ('trial', 'active', 'past_due')
      and (s.status <> 'trial' or s.current_period_end is null or s.current_period_end > now())
    from public.tenant_subscriptions s
    where s.tenant_id = p_tenant
  ), false);
$$;

create or replace function public.module_enabled(p_tenant uuid, p_module text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.subscription_active(p_tenant) and coalesce(
    (select tm.enabled from public.tenant_modules tm
      where tm.tenant_id = p_tenant and tm.module_code = p_module),
    exists (
      select 1
      from public.tenant_subscriptions s
      join public.plan_modules pm on pm.plan_code = s.plan_code
      where s.tenant_id = p_tenant and pm.module_code = p_module
    )
  );
$$;

-- Status efetivo para exibição (membros e Super Admin).
create or replace function public.subscription_status(p_tenant uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when s.status = 'trial' and s.current_period_end is not null and s.current_period_end <= now() then 'expired'
    else s.status
  end
  from public.tenant_subscriptions s
  where s.tenant_id = p_tenant
    and (public.is_member(p_tenant) or public.is_platform_admin());
$$;

-- Uso x limite de cada recurso limitado (limite nulo = ilimitado). Membros e Super Admin.
create or replace function public.plan_usage(p_tenant uuid)
returns table (key text, used integer, "limit" integer)
language sql stable security definer set search_path = public
as $$
  select k.key,
    case k.key
      when 'students' then (select count(*)::int from public.students where tenant_id = p_tenant and deleted_at is null)
      when 'classes' then (select count(*)::int from public.classes where tenant_id = p_tenant and deleted_at is null)
    end,
    public.plan_limit(p_tenant, k.key)
  from (values ('students'), ('classes')) as k(key)
  where public.is_member(p_tenant) or public.is_platform_admin();
$$;

-- Super Admin: troca plano/status/validade da assinatura.
create or replace function public.set_tenant_subscription(
  p_tenant uuid,
  p_plan_code text,
  p_status text,
  p_period_end timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_status not in ('trial', 'active', 'past_due', 'cancelled') then
    raise exception 'status inválido';
  end if;
  if not exists (select 1 from public.plans where code = p_plan_code and active) then
    raise exception 'plano % inexistente ou inativo', p_plan_code;
  end if;
  update public.tenant_subscriptions
  set plan_code = p_plan_code, status = p_status, current_period_end = p_period_end
  where tenant_id = p_tenant;
  if not found then
    raise exception 'assinatura não encontrada';
  end if;
end;
$$;

-- Super Admin: liga/desliga um módulo para um tenant; p_enabled nulo remove o override (volta ao plano).
create or replace function public.set_tenant_module(p_tenant uuid, p_module text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_enabled is null then
    delete from public.tenant_modules where tenant_id = p_tenant and module_code = p_module;
  else
    insert into public.tenant_modules (tenant_id, module_code, enabled)
    values (p_tenant, p_module, p_enabled)
    on conflict (tenant_id, module_code) do update set enabled = excluded.enabled;
  end if;
end;
$$;

revoke all on function
  public.subscription_active(uuid), public.subscription_status(uuid), public.plan_usage(uuid),
  public.set_tenant_subscription(uuid, text, text, timestamptz),
  public.set_tenant_module(uuid, text, boolean)
  from public, anon;
grant execute on function
  public.subscription_active(uuid), public.subscription_status(uuid), public.plan_usage(uuid),
  public.set_tenant_subscription(uuid, text, text, timestamptz),
  public.set_tenant_module(uuid, text, boolean)
  to authenticated;
```

## 3. Conferir se deu certo

Rode no SQL Editor:

```sql
-- Todas as tabelas do app devem ter RLS ligada (rls_ativa = true)
select c.relname as tabela, c.relrowsecurity as rls_ativa
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- Planos e módulos criados pela migration 1 e 7
select code, name from public.modules order by code;
select code, name from public.plans order by code;

-- Funções principais
select proname from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('create_tenant', 'add_member', 'module_enabled', 'subscription_status',
                  'plan_usage', 'set_tenant_subscription', 'set_tenant_module', 'set_member_status')
order by proname;

-- Bucket de logos (migration 6)
select id, public, file_size_limit from storage.buckets where id = 'tenant-assets';
```

Esperado: nenhuma tabela com `rls_ativa = false`, os 3 módulos (`championships`, `management`, `ranking`), os planos, as 8 funções e o bucket `tenant-assets`.

## 4. Criar o primeiro Super Admin

O Super Admin cria e administra as arenas em `/platform`.

1. No Supabase, vá em **Authentication > Users > Add user**, informe e-mail e senha e marque **Auto Confirm User**.
2. Copie o **User UID** do usuário criado.
3. No SQL Editor, rode (troque o UUID):

```sql
insert into public.platform_admins (user_id)
values ('COLE-AQUI-O-USER-UID');
```

## 5. Criar a primeira arena

1. Antes, crie em **Authentication > Users** o usuário que será o **dono** da arena (ele precisa existir, pois a arena é vinculada pelo e-mail).
2. Rode `npm run dev`, entre em `/entrar` com o Super Admin e abra `/platform`.
3. Informe nome, endereço (slug) da arena, e-mail do dono e o plano. A arena nasce com a assinatura e o dono já vinculados.
4. O dono entra em `/entrar` e acessa `/t/<slug>`. Novos usuários da arena são adicionados em **Administração > Usuários**, também pelo e-mail de um usuário já existente no Authentication.

## 6. Ajustes recomendados em Authentication

- **URL Configuration:** defina **Site URL** (por exemplo `http://localhost:3000` em desenvolvimento e o domínio real em produção) e adicione o domínio em **Redirect URLs**.
- **Providers > Email:** o app usa e-mail e senha. Se quiser que usuários criados pelo painel entrem sem confirmar e-mail, deixe **Confirm email** desligado, ou use **Auto Confirm User** ao criá-los.
- **Sign-ups:** o app não tem cadastro público. Desative **Allow new users to sign up** para que só entre quem você criar.

## 7. Como reaplicar ou resetar (somente desenvolvimento)

Para recomeçar do zero em um projeto de testes, apague o schema `public` e rode as migrations de novo. **Nunca faça isso em produção:** apaga todos os dados.

```sql
drop schema public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to postgres, service_role;
alter default privileges in schema public grant all on functions to postgres, service_role;
alter default privileges in schema public grant all on sequences to postgres, service_role;
```

Depois volte à seção 2. Os objetos do Storage (bucket `tenant-assets`) ficam fora do schema `public`; a migration 6 recria o bucket se ele não existir.

## 8. Testar sem banco

Sem Supabase nenhum, `npm run dev:demo` sobe o app com um banco local em memória e contas de exemplo (veja o README). Serve para visualizar a interface, não substitui um teste no Supabase real.
