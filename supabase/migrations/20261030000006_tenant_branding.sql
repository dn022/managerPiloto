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
