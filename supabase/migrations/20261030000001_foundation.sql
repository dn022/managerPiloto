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
