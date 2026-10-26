-- Additive admin console. No user, product, order or payment is deleted.
create schema if not exists mp_admin_private;
revoke all on schema mp_admin_private from public, anon;
grant usage on schema mp_admin_private to authenticated;

create function mp_admin_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.mp_memberships where user_id=auth.uid() and role='admin');
$$;
revoke all on function mp_admin_private.is_admin() from public,anon;
grant execute on function mp_admin_private.is_admin() to authenticated;
create function mp_admin_private.require_admin() returns void language plpgsql security invoker set search_path='' as $$
begin if not mp_admin_private.is_admin() then raise exception 'Acesso restrito ao administrador' using errcode='42501'; end if; end;
$$;
revoke all on function mp_admin_private.require_admin() from public,anon;
grant execute on function mp_admin_private.require_admin() to authenticated;

create table public.mp_admin_audit (
 id bigint generated always as identity primary key, actor_id uuid not null references auth.users(id),
 action text not null, entity_type text not null, entity_id text not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table public.mp_admin_audit enable row level security;
create policy admin_audit_read on public.mp_admin_audit for select to authenticated using ((select mp_admin_private.is_admin()));
grant select on public.mp_admin_audit to authenticated;

create table public.mp_campaigns (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) between 2 and 120),
 description text not null default '' check(length(description)<=500), image_url text not null default '',
 target_url text not null default '/mundo_pet_catalogo/', active boolean not null default false,
 starts_at timestamptz, ends_at timestamptz, position integer not null default 0 check(position between 0 and 999),
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(ends_at is null or starts_at is null or ends_at>starts_at),
 check(image_url='' or image_url ~ '^https://[^[:space:]]+$'),
 check(not active or image_url<>''),
 check(target_url ~ '^/mundo_pet_[a-z_]+/([?][^[:space:]]*)?$' or target_url ~ '^https://[^[:space:]]+$')
);
alter table public.mp_campaigns enable row level security;
create policy campaign_public on public.mp_campaigns for select to anon,authenticated using(active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()));
create policy campaign_admin on public.mp_campaigns for all to authenticated using((select mp_admin_private.is_admin())) with check((select mp_admin_private.is_admin()));
grant select on public.mp_campaigns to anon;
grant select,insert,update on public.mp_campaigns to authenticated;

create table public.mp_admin_notification_reads (
 admin_id uuid not null default auth.uid() references auth.users(id), notification_key text not null check(length(notification_key) between 1 and 200),
 read_at timestamptz not null default now(), primary key(admin_id,notification_key)
);
alter table public.mp_admin_notification_reads enable row level security;
create policy notification_admin on public.mp_admin_notification_reads for all to authenticated using(admin_id=(select auth.uid()) and (select mp_admin_private.is_admin())) with check(admin_id=(select auth.uid()) and (select mp_admin_private.is_admin()));
grant select,insert,update on public.mp_admin_notification_reads to authenticated;

alter table public.mp_profiles add column if not exists presence_updated_at timestamptz;
alter table public.mp_orders add column if not exists commission_bps integer check(commission_bps between 0 and 10000);
alter table public.mp_wallet_entries add column if not exists available_at timestamptz not null default now();
create function mp_admin_private.snapshot_commission() returns trigger language plpgsql security definer set search_path='' as $$
begin select products_bps into new.commission_bps from public.mp_commission_policy where id; new.commission_bps:=coalesce(new.commission_bps,1000); return new; end;
$$;
revoke all on function mp_admin_private.snapshot_commission() from public,anon,authenticated;
create trigger snapshot_order_commission before insert on public.mp_orders for each row execute function mp_admin_private.snapshot_commission();
update public.mp_orders set commission_bps=(select products_bps from public.mp_commission_policy where id) where commission_bps is null;
create policy commission_admin_update on public.mp_commission_policy for update to authenticated using((select mp_admin_private.is_admin())) with check((select mp_admin_private.is_admin()));
grant update(products_bps,services_bps,updated_at) on public.mp_commission_policy to authenticated;

create table public.mp_order_settlements (
 order_id uuid primary key references public.mp_orders(id), commission_bps integer not null check(commission_bps between 0 and 10000),
 base_cents bigint not null check(base_cents>=0), commission_cents bigint not null check(commission_cents>=0),
 partner_cents bigint not null check(partner_cents>=0), courier_cents bigint not null check(courier_cents>=0),
 available_at timestamptz not null, created_at timestamptz not null default now(), check(commission_cents+partner_cents=base_cents)
);
alter table public.mp_order_settlements enable row level security;
create policy settlement_admin on public.mp_order_settlements for select to authenticated using((select mp_admin_private.is_admin()));
grant select on public.mp_order_settlements to authenticated;
create table public.mp_payout_requests (
 id uuid primary key default gen_random_uuid(), wallet_id uuid references public.mp_wallets(id), requested_by uuid not null references auth.users(id),
 request_key uuid not null, amount_cents bigint not null check(amount_cents>0), recipient text not null check(length(trim(recipient)) between 2 and 150),
 pix_key text not null check(length(trim(pix_key)) between 3 and 150), status text not null default 'requested' check(status in ('requested','paid','canceled')),
 reference text not null default '', created_at timestamptz not null default now(), resolved_at timestamptz,
 unique(requested_by,request_key), check(status<>'paid' or length(trim(reference)) between 6 and 200)
);
alter table public.mp_payout_requests enable row level security;
create policy payout_admin_read on public.mp_payout_requests for select to authenticated using((select mp_admin_private.is_admin()));
grant select on public.mp_payout_requests to authenticated;
create index mp_payout_requests_wallet_idx on public.mp_payout_requests(wallet_id,status);
create index mp_campaigns_schedule_idx on public.mp_campaigns(active,starts_at,ends_at);

-- Read only directory: no email, CPF, auth secrets or tokens are exposed.
create function mp_admin_private.directory() returns jsonb language plpgsql security definer set search_path='' as $$
declare data jsonb;
begin
 perform mp_admin_private.require_admin();
 select coalesce(jsonb_agg(jsonb_build_object('user_id',u.user_id,'name',coalesce(nullif(p.full_name,''),a.name,'Parceiro'),
  'phone',coalesce(p.phone,a.phone,''),'roles',u.roles,'online',coalesce(p.online,false) and p.presence_updated_at>now()-interval '3 minutes','presence_updated_at',p.presence_updated_at)), '[]') into data
 from (select user_id,array_agg(role order by role) roles from public.mp_memberships group by user_id) u
 left join public.mp_profiles p on p.user_id=u.user_id
 left join lateral (select name,phone from public.mp_applications where user_id=u.user_id and status='approved' order by created_at desc limit 1) a on true;
 return data;
end;
$$;
create function public.mp_admin_directory() returns jsonb language sql security invoker set search_path='' as $$select mp_admin_private.directory()$$;

create function mp_admin_private.assign_courier(p_order uuid,p_courier uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.mp_orders;
begin
 perform mp_admin_private.require_admin(); perform pg_advisory_xact_lock(hashtextextended(p_courier::text,0)); select * into o from public.mp_orders where id=p_order for update;
 if not found or o.status not in ('ready','assigned') or o.payment_status<>'paid' or o.is_demo then raise exception 'Só é possível atribuir pedidos pagos aguardando coleta'; end if;
 if not exists(select 1 from public.mp_memberships where user_id=p_courier and role='courier') then raise exception 'Entregador não credenciado'; end if;
 if not exists(select 1 from public.mp_profiles where user_id=p_courier and online and presence_updated_at>now()-interval '3 minutes') then raise exception 'O entregador precisa estar online'; end if;
 if exists(select 1 from public.mp_orders where courier_id=p_courier and status in ('assigned','delivering') and id<>p_order) then raise exception 'Entregador já está em outra corrida'; end if;
 update public.mp_orders set courier_id=p_courier,status='assigned',updated_at=now() where id=p_order;
 insert into public.mp_admin_audit(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'assign_courier','mp_orders',p_order::text,jsonb_build_object('courier_id',p_courier));
end;
$$;
create function public.mp_admin_assign_courier(p_order uuid,p_courier uuid) returns void language sql security invoker set search_path='' as $$select mp_admin_private.assign_courier(p_order,p_courier)$$;
create policy admin_location_read on public.mp_courier_locations for select to authenticated using((select mp_admin_private.is_admin()));

-- Idempotent accounting of already confirmed payments; never calls a banking API.
create function mp_admin_private.reconcile_orders() returns integer language plpgsql security definer set search_path='' as $$
declare o public.mp_orders; w uuid; n integer:=0; b bigint; c bigint; rate integer; due timestamptz; d date; partner uuid;
begin
 perform mp_admin_private.require_admin();
 perform pg_advisory_xact_lock(734880,1);
 for o in select * from public.mp_orders x where status='delivered' and payment_status='paid' and not is_demo and not exists(select 1 from public.mp_order_settlements y where y.order_id=x.id) order by created_at for update loop
  if o.delivery_cents>0 and o.courier_id is null then continue; end if;
  b:=greatest(0,o.subtotal_cents-o.discount_cents); rate:=coalesce(o.commission_bps,1000); c:=round(b*rate/10000.0);
  d:=((o.updated_at at time zone 'America/Sao_Paulo')::date+1); while extract(isodow from d)>5 loop d:=d+1; end loop;
  due:=(d+time '08:00') at time zone 'America/Sao_Paulo';
  select owner_id into partner from public.mp_stores where id=o.store_id;
  insert into public.mp_order_settlements(order_id,commission_bps,base_cents,commission_cents,partner_cents,courier_cents,available_at) values(o.id,rate,b,c,b-c,o.delivery_cents,due);
  select id into w from public.mp_wallets where wallet_type='store' and store_id=o.store_id order by created_at limit 1;
  if w is null then insert into public.mp_wallets(wallet_type,owner_id,store_id) values('store',partner,o.store_id) returning id into w; end if;
  if b>c then insert into public.mp_wallet_entries(wallet_id,amount_cents,entry_type,reference,available_at) values(w,b-c,'credit','order:'||o.id,due); end if;
  if o.courier_id is not null and o.delivery_cents>0 then
   select id into w from public.mp_wallets where wallet_type='courier' and owner_id=o.courier_id order by created_at limit 1;
   if w is null then insert into public.mp_wallets(wallet_type,owner_id) values('courier',o.courier_id) returning id into w; end if;
   insert into public.mp_wallet_entries(wallet_id,amount_cents,entry_type,reference,available_at) values(w,o.delivery_cents,'credit','order:'||o.id,due);
  end if;
  n:=n+1;
 end loop;
 insert into public.mp_admin_audit(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'reconcile','mp_order_settlements','batch',jsonb_build_object('count',n));
 return n;
end;
$$;
create function public.mp_admin_reconcile_orders() returns integer language sql security invoker set search_path='' as $$select mp_admin_private.reconcile_orders()$$;

create function mp_admin_private.request_payout(p_wallet uuid,p_amount bigint,p_recipient text,p_pix text,p_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare balance bigint; reserved bigint; pid uuid;
begin
 perform mp_admin_private.require_admin(); perform pg_advisory_xact_lock(734880,1);
 select id into pid from public.mp_payout_requests where requested_by=auth.uid() and request_key=p_key;
 if pid is not null then return pid; end if;
 if p_wallet is not null then
  if not exists(select 1 from public.mp_wallets where id=p_wallet) then raise exception 'Carteira não encontrada'; end if;
  select coalesce(sum(amount_cents),0) into balance from public.mp_wallet_entries where wallet_id=p_wallet and available_at<=now();
 else select coalesce(sum(commission_cents),0) into balance from public.mp_order_settlements where available_at<=now(); end if;
 select coalesce(sum(amount_cents),0) into reserved from public.mp_payout_requests where wallet_id is not distinct from p_wallet and status='requested';
 if p_wallet is null then select reserved+coalesce(sum(amount_cents),0) into reserved from public.mp_payout_requests where wallet_id is null and status='paid'; end if;
 if p_amount is null or p_amount<=0 or p_amount>balance-reserved then raise exception 'Saldo conciliado disponível insuficiente'; end if;
 insert into public.mp_payout_requests(wallet_id,requested_by,request_key,amount_cents,recipient,pix_key) values(p_wallet,auth.uid(),p_key,p_amount,trim(p_recipient),trim(p_pix)) returning id into pid;
 return pid;
end;
$$;
create function public.mp_admin_request_payout(p_wallet uuid,p_amount bigint,p_recipient text,p_pix text,p_key uuid) returns uuid language sql security invoker set search_path='' as $$select mp_admin_private.request_payout(p_wallet,p_amount,p_recipient,p_pix,p_key)$$;
create function mp_admin_private.resolve_payout(p_id uuid,p_status text,p_reference text) returns void language plpgsql security definer set search_path='' as $$
declare p public.mp_payout_requests;
begin
 perform mp_admin_private.require_admin(); perform pg_advisory_xact_lock(734880,1);
 select * into p from public.mp_payout_requests where id=p_id for update;
 if not found or p.status<>'requested' then raise exception 'Solicitação não está pendente'; end if;
 if p_status not in ('paid','canceled') or p_status is null then raise exception 'Status inválido'; end if;
 if p_status='paid' and length(trim(coalesce(p_reference,'')))<6 then raise exception 'Informe a referência da transferência realizada'; end if;
 update public.mp_payout_requests set status=p_status,reference=trim(coalesce(p_reference,'')),resolved_at=now() where id=p_id;
 if p_status='paid' and p.wallet_id is not null then insert into public.mp_wallet_entries(wallet_id,amount_cents,entry_type,reference) values(p.wallet_id,-p.amount_cents,'payout','payout:'||p.id); end if;
end;
$$;
create function public.mp_admin_resolve_payout(p_id uuid,p_status text,p_reference text) returns void language sql security invoker set search_path='' as $$select mp_admin_private.resolve_payout(p_id,p_status,p_reference)$$;

create function mp_admin_private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 if mp_admin_private.is_admin() then
  v:=to_jsonb(new);
  insert into public.mp_admin_audit(actor_id,action,entity_type,entity_id,details) values(auth.uid(),lower(tg_op),tg_table_name,coalesce(v->>'id',v->>'order_id',''),
   jsonb_strip_nulls(jsonb_build_object('name',v->>'name','title',v->>'title','active',v->'active','status',v->>'status','products_bps',v->'products_bps','services_bps',v->'services_bps')));
 end if;
 if tg_table_name in ('mp_campaigns','mp_commission_policy') then new.updated_at:=now(); end if;
 return new;
end;
$$;
revoke all on function mp_admin_private.audit_change() from public,anon,authenticated;
do $$declare t text; begin foreach t in array array['mp_campaigns','mp_commission_policy','mp_payout_requests','mp_products','mp_stores','mp_services','mp_applications'] loop execute format('create trigger admin_audit_change before insert or update on public.%I for each row execute function mp_admin_private.audit_change()',t); end loop; end$$;

-- Self service applicants can submit pending records, but cannot approve themselves.
drop policy if exists own_applications on public.mp_applications;
create policy application_self_read on public.mp_applications for select to authenticated using(user_id=(select auth.uid()));
create policy application_self_submit on public.mp_applications for insert to authenticated with check(user_id=(select auth.uid()) and status='pending');

do $$declare p regprocedure; begin
 for p in select oid::regprocedure from pg_proc where pronamespace='mp_admin_private'::regnamespace and proname in ('directory','assign_courier','reconcile_orders','request_payout','resolve_payout') loop
  execute format('revoke all on function %s from public,anon',p); execute format('grant execute on function %s to authenticated',p);
 end loop;
 for p in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('mp_admin_directory','mp_admin_assign_courier','mp_admin_reconcile_orders','mp_admin_request_payout','mp_admin_resolve_payout') loop
  execute format('revoke all on function %s from public,anon',p); execute format('grant execute on function %s to authenticated',p);
 end loop;
end$$;
