-- Additive migration: archive individual unpaid orders in the admin dashboard.
-- Records, checkout links, stock reservations, payments and financial ledgers are preserved.
alter table public.mp_orders
 add column if not exists admin_archived_at timestamptz,
 add column if not exists admin_archived_by uuid references auth.users(id) on delete restrict;

create index if not exists mp_orders_admin_archived_at_idx
 on public.mp_orders(admin_archived_at) where admin_archived_at is not null;

CREATE OR REPLACE FUNCTION public.mp_admin_archive_unpaid_order(p_order uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  existing public.mp_orders;
begin
  if actor is null or not exists (
    select 1 from public.mp_memberships where user_id = actor and role = 'admin'
  ) then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;
  select * into existing from public.mp_orders where id = p_order for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if existing.admin_archived_at is not null then return; end if;
  if existing.payment_status <> 'unpaid'
     or existing.status not in ('pending', 'canceled')
     or existing.payment_nsu is not null
     or coalesce(existing.payment_details @> '{"paid":true}'::jsonb, false)
     or exists (select 1 from public.mp_order_settlements where order_id = p_order)
  then
    raise exception 'Somente pedidos pendentes ou cancelados, sem pagamento confirmado, podem ser removidos do histórico.';
  end if;

  update public.mp_orders
     set admin_archived_at = now(), admin_archived_by = actor
   where id = p_order;
  insert into public.mp_admin_audit(actor_id, action, entity_type, entity_id, details)
  values (actor, 'archive_unpaid_order', 'mp_orders', p_order::text,
    jsonb_build_object('status', existing.status, 'payment_status', existing.payment_status,
      'checkout_started', existing.payment_checkout_url is not null));
end;
$function$


revoke all on function public.mp_admin_archive_unpaid_order(uuid) from public, anon;
grant execute on function public.mp_admin_archive_unpaid_order(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.mp_admin_restore_order(p_order uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid := auth.uid(); existing public.mp_orders;
begin
  if actor is null or not exists (
    select 1 from public.mp_memberships where user_id = actor and role = 'admin'
  ) then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;
  select * into existing from public.mp_orders where id = p_order for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if existing.admin_archived_at is null then return; end if;
  update public.mp_orders
     set admin_archived_at = null, admin_archived_by = null
   where id = p_order;
  insert into public.mp_admin_audit(actor_id, action, entity_type, entity_id, details)
  values (actor, 'restore_order', 'mp_orders', p_order::text,
    jsonb_build_object('previous_archive_at', existing.admin_archived_at));
end;
$function$


revoke all on function public.mp_admin_restore_order(uuid) from public, anon;
grant execute on function public.mp_admin_restore_order(uuid) to authenticated;
