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
