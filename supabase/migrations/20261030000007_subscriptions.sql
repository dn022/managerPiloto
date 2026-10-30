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
