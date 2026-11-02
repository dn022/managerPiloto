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
