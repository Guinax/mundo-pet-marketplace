-- Additive migration: existing orders remain delivery orders.
create schema if not exists mp_fulfillment_private;
revoke all on schema mp_fulfillment_private from public;
grant usage on schema mp_fulfillment_private to anon, authenticated, service_role;

create table public.mp_business_closures (
 day date primary key, reason text not null check(length(reason) between 1 and 180)
);
alter table public.mp_business_closures enable row level security;
grant select on public.mp_business_closures to anon, authenticated;
grant all on public.mp_business_closures to service_role;
grant insert,update,delete on public.mp_business_closures to authenticated;
create policy closures_read on public.mp_business_closures for select to anon,authenticated using(true);
create policy closures_admin on public.mp_business_closures for all to authenticated
 using(exists(select 1 from public.mp_memberships where user_id=(select auth.uid()) and role='admin'))
 with check(exists(select 1 from public.mp_memberships where user_id=(select auth.uid()) and role='admin'));

create function mp_fulfillment_private.easter(y integer) returns date language plpgsql immutable set search_path='' as $$
declare a integer:=y%19;b integer:=y/100;c integer:=y%100;d integer:=b/4;e integer:=b%4;f integer:=(b+8)/25;g integer:=(b-f+1)/3;h integer:=(19*a+b-d-g+15)%30;i integer:=c/4;k integer:=c%4;l integer:=(32+2*e+2*i-h-k)%7;m integer:=(a+11*h+22*l)/451;n integer:=h+l-7*m+114;
begin return make_date(y,n/31,n%31+1);end $$;
create function mp_fulfillment_private.business_day(d date) returns boolean language sql stable set search_path='' as $$
 select extract(isodow from d) between 1 and 5
 and to_char(d,'MM-DD') not in ('01-01','04-21','05-01','07-09','09-07','10-12','11-02','11-15','11-20','12-25')
 and d<>mp_fulfillment_private.easter(extract(year from d)::integer)-2
 and not exists(select 1 from public.mp_business_closures c where c.day=d)
$$;
create function public.mp_fulfillment_window(p_store uuid default null,p_at timestamptz default now()) returns jsonb
 language plpgsql stable security invoker set search_path='' as $$
declare localtime timestamp:=p_at at time zone 'America/Sao_Paulo';d date:=localtime::date;available boolean;store_open boolean:=true;starts timestamptz;
begin
 if p_store is not null then select is_open into store_open from public.mp_stores where id=p_store;end if;
 available:=mp_fulfillment_private.business_day(d) and localtime::time>=time '09:00' and localtime::time<time '18:00' and coalesce(store_open,false);
 if not available then
  if localtime::time>=time '18:00' or (localtime::time>=time '09:00' and not coalesce(store_open,false)) then d:=d+1;end if;
  while not mp_fulfillment_private.business_day(d) loop d:=d+1;end loop;
 end if;
 starts:=case when available then p_at else (d+time '09:00') at time zone 'America/Sao_Paulo' end;
 return jsonb_build_object('is_open',available,'starts_at',starts,'ends_at',(d+time '18:00') at time zone 'America/Sao_Paulo','queue_from',(d+time '08:00') at time zone 'America/Sao_Paulo','timezone','America/Sao_Paulo');
end $$;
revoke all on function public.mp_fulfillment_window(uuid,timestamptz) from public;
grant execute on function public.mp_fulfillment_window(uuid,timestamptz) to anon,authenticated,service_role;

alter table public.mp_orders
 add column fulfillment_method text not null default 'delivery' check(fulfillment_method in ('delivery','pickup')),
 add column scheduled_for timestamptz,
 add column queued_at timestamptz,
 add column pickup_address text,
 add column stock_reserved boolean not null default false,
 add constraint pickup_without_courier check(fulfillment_method<>'pickup' or (delivery_cents=0 and courier_id is null and status not in ('assigned','delivering')));
create index mp_orders_dispatch_due on public.mp_orders(scheduled_for) where status='ready' and payment_status='paid' and fulfillment_method='delivery';

create function mp_fulfillment_private.order_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare win jsonb;
begin
 if tg_op='UPDATE' and (new.fulfillment_method<>old.fulfillment_method or new.scheduled_for is distinct from old.scheduled_for or new.pickup_address is distinct from old.pickup_address) then raise exception 'A modalidade e o agendamento do pedido não podem ser alterados após a compra';end if;
 if tg_op='UPDATE' and ((old.payment_status='unpaid' and new.payment_status='paid') or (new.status='ready' and old.status<>'ready')) then
  win:=public.mp_fulfillment_window(new.store_id);
  new.scheduled_for:=greatest(new.scheduled_for,(win->>'starts_at')::timestamptz);
 end if;
 if new.status in ('assigned','delivering') and (tg_op='INSERT' or new.status is distinct from old.status or new.courier_id is distinct from old.courier_id) then
  win:=public.mp_fulfillment_window(new.store_id);
  if new.fulfillment_method<>'delivery' or new.payment_status<>'paid' or not (win->>'is_open')::boolean or coalesce(new.scheduled_for,now())>now() then raise exception 'Entrega disponível somente em dia útil, das 9h às 18h, com loja aberta e pedido pago';end if;
 end if;
 if tg_op='UPDATE' and new.status='canceled' and old.status<>'canceled' and old.stock_reserved then
  update public.mp_products p set stock=p.stock+i.quantity from public.mp_order_items i where i.order_id=old.id and i.product_id=p.id;
  new.stock_reserved:=false;
 end if;
 return new;
end $$;
create trigger mp_fulfillment_order_guard before insert or update on public.mp_orders for each row execute function mp_fulfillment_private.order_guard();

create function public.mp_create_fulfillment_order(p_buyer uuid,p_cart jsonb,p_address jsonb,p_request uuid,p_shipping_cents integer,p_method text,p_fulfillment text) returns uuid
 language plpgsql security definer set search_path='' as $$
declare created uuid;existing public.mp_orders;
begin
 if p_fulfillment not in ('delivery','pickup') or p_fulfillment is null then raise exception 'Escolha entrega ou retirada';end if;
 if p_fulfillment='pickup' and p_shipping_cents<>0 then raise exception 'Retirada sem frete';end if;
 select * into existing from public.mp_orders where buyer_id=p_buyer and request_key=p_request;
 if found then
  if existing.fulfillment_method<>p_fulfillment or existing.payment_method<>p_method then raise exception 'Solicitação pertence a outra modalidade';end if;
  return existing.id;
 end if;
 perform set_config('mp.fulfillment_method',p_fulfillment,true);
 perform set_config('mp.shipping_verified','yes',true);
 created:=public.mp_create_payment_order(p_buyer,p_cart,p_address,p_request,p_shipping_cents,p_method,'');
 return created;
end $$;
revoke all on function public.mp_create_fulfillment_order(uuid,jsonb,jsonb,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.mp_create_fulfillment_order(uuid,jsonb,jsonb,uuid,integer,text,text) to service_role;

create function mp_fulfillment_private.prepare_queue() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;localtime timestamp:=now() at time zone 'America/Sao_Paulo';
begin
 if not mp_fulfillment_private.business_day(localtime::date) or localtime::time<time '08:00' or localtime::time>=time '18:00' then return 0;end if;
 update public.mp_orders set queued_at=now() where payment_status='paid' and status in ('pending','preparing','ready') and queued_at is null
 and coalesce(scheduled_for,now())<((localtime::date+time '18:00') at time zone 'America/Sao_Paulo');
 get diagnostics n=row_count;return n;
end $$;
revoke all on all functions in schema mp_fulfillment_private from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.mp_create_payment_order(p_buyer uuid, p_cart jsonb, p_address jsonb, p_request uuid, p_shipping_cents integer, p_method text, p_coupon text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare item jsonb; prod record; target_store uuid; subtotal integer:=0; discount integer:=0; order_id uuid; n integer:=0; q integer; seen uuid[]:='{}'; 
begin
 if p_buyer is null or p_request is null or jsonb_typeof(p_cart)<>'array' or jsonb_array_length(p_cart) not between 1 and 30 then raise exception 'invalid cart'; end if;
 if p_method not in ('infinitepay_pix','infinitepay_card') then raise exception 'invalid method'; end if;
 if p_shipping_cents is null or p_shipping_cents<0 or p_shipping_cents>100000 then raise exception 'invalid shipping'; end if;
 if jsonb_typeof(p_address)<>'object' or length(trim(coalesce(p_address->>'street','')))<3 or length(trim(coalesce(p_address->>'number','')))<1 or length(trim(coalesce(p_address->>'city','')))<2 then raise exception 'invalid address'; end if;
 select id into order_id from public.mp_orders where buyer_id=p_buyer and request_key=p_request;
 if found then return order_id; end if;
 for item in select value from jsonb_array_elements(p_cart) loop
   if jsonb_typeof(item)<>'object' or coalesce(item->>'product_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(item->>'quantity','') !~ '^[0-9]{1,2}$' then raise exception 'invalid item'; end if;
   q:=(item->>'quantity')::integer;
   if q<1 or q>99 then raise exception 'invalid quantity'; end if;
   if (item->>'product_id')::uuid=any(seen) then raise exception 'duplicate item'; end if;
   seen:=array_append(seen,(item->>'product_id')::uuid);
   select p.id,p.store_id,p.name,p.price_cents,p.stock,p.active,p.approval_status,s.is_demo,s.is_open,p.pickup_enabled,p.delivery_enabled into prod from public.mp_products p join public.mp_stores s on s.id=p.store_id where p.id=(item->>'product_id')::uuid for update of p;
   if not found or not prod.active or prod.approval_status<>'approved' or prod.is_demo or prod.price_cents<1 or prod.stock<q then raise exception 'product unavailable'; end if;
   if target_store is null then target_store:=prod.store_id; elsif target_store<>prod.store_id then raise exception 'multiple stores'; end if;
   if current_setting('mp.fulfillment_method',true)='pickup' and prod.pickup_enabled=false then raise exception 'Retirada indisponível para este produto';end if;
   if coalesce(nullif(current_setting('mp.fulfillment_method',true),''),'delivery')='delivery' and prod.delivery_enabled=false then raise exception 'Entrega indisponível para este produto';end if;
   subtotal:=subtotal+prod.price_cents*q;
   n:=n+1;
 end loop;
 if current_user<>'postgres' then raise exception 'Privileged checkout only';end if;
 if subtotal<1 then raise exception 'invalid total'; end if;
 if coalesce(upper(trim(p_coupon)),'')='MUNDOPET10' then discount:=floor(subtotal/10); elsif nullif(trim(coalesce(p_coupon,'')),'') is not null then raise exception 'invalid coupon'; end if;
 if subtotal-discount+p_shipping_cents<1 then raise exception 'invalid total'; end if;
 insert into public.mp_orders(buyer_id,store_id,request_key,payment_method,address,subtotal_cents,discount_cents,delivery_cents,total_cents,is_demo,fulfillment_method,scheduled_for,pickup_address,stock_reserved)
 values(p_buyer,target_store,p_request,p_method,p_address,subtotal,discount,p_shipping_cents,subtotal-discount+p_shipping_cents,false,coalesce(nullif(current_setting('mp.fulfillment_method',true),''),'delivery'),(public.mp_fulfillment_window(target_store)->>'starts_at')::timestamptz,case when current_setting('mp.fulfillment_method',true)='pickup' then (select address from public.mp_stores where id=target_store) end,true)
 on conflict(buyer_id,request_key) do nothing returning id into order_id;
 if order_id is null then select id into order_id from public.mp_orders where buyer_id=p_buyer and request_key=p_request; return order_id; end if;
 for item in select value from jsonb_array_elements(p_cart) loop
  q:=(item->>'quantity')::integer;
  select name,price_cents into prod from public.mp_products where id=(item->>'product_id')::uuid;
  insert into public.mp_order_items(order_id,product_id,name,quantity,unit_cents) values(order_id,(item->>'product_id')::uuid,prod.name,q,prod.price_cents);
  update public.mp_products set stock=stock-q where id=(item->>'product_id')::uuid;
 end loop;
 return order_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.mp_transition_order(oid uuid, next_status text, delivery_code text DEFAULT ''::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); o public.mp_orders; admin boolean; owner boolean; courier boolean;
        dc public.mp_delivery_codes; bytes bytea; number_code integer;
begin
 if actor is null then raise exception 'Entre na sua conta.'; end if;
 select * into o from public.mp_orders where id=oid for update;
 if not found then raise exception 'Pedido não encontrado.'; end if;
 admin:=exists(select 1 from public.mp_memberships m where m.user_id=actor and m.role='admin');
 courier:=exists(select 1 from public.mp_memberships m where m.user_id=actor and m.role='courier');
 owner:=exists(select 1 from public.mp_stores s where s.id=o.store_id and s.owner_id=actor);
 if next_status='canceled' and o.status='pending' and (o.buyer_id=actor or owner or admin) then
   if o.payment_status='paid' or o.payment_checkout_url is not null then
      raise exception 'Pedido com pagamento iniciado exige conferência ou estorno; solicite suporte.';
   end if;
 elsif next_status='preparing' and o.status='pending' and (owner or admin) and o.payment_status='paid' then
   if coalesce(o.scheduled_for,now())>now() or not (public.mp_fulfillment_window(o.store_id)->>'is_open')::boolean then raise exception 'Aguarde o atendimento em dia útil, das 9h às 18h, com a loja aberta';end if;
   bytes:=extensions.gen_random_bytes(4);
   number_code:=100000+((get_byte(bytes,0)::bigint*16777216+get_byte(bytes,1)*65536+get_byte(bytes,2)*256+get_byte(bytes,3)) % 900000)::integer;
   insert into public.mp_delivery_codes(order_id,buyer_id,code)
      values(oid,o.buyer_id,number_code::text) on conflict(order_id) do nothing;
 elsif next_status='ready' and o.status='preparing' and (owner or admin) and o.payment_status='paid' then null;
 elsif next_status='assigned' and o.status='ready' and o.courier_id is null and o.payment_status='paid' and (courier or admin) then
   if not coalesce((select online from public.mp_profiles where user_id=actor),false) then raise exception 'Ative seu status online.'; end if;
   update public.mp_orders set courier_id=actor where id=oid;
 elsif next_status='delivering' and o.status='assigned' and o.courier_id=actor and o.payment_status='paid' then null;
 elsif next_status='delivered' and o.payment_status='paid' and ((o.status='delivering' and o.courier_id=actor and o.fulfillment_method='delivery') or (o.status='ready' and o.fulfillment_method='pickup' and (owner or admin))) then
   if o.fulfillment_method='pickup' and (coalesce(o.scheduled_for,now())>now() or not (public.mp_fulfillment_window(o.store_id)->>'is_open')::boolean) then raise exception 'Retirada disponível em dia útil, das 9h às 18h, com a loja aberta';end if;
   select * into dc from public.mp_delivery_codes where order_id=oid for update;
   if not found then raise exception 'Código de entrega ainda não gerado.'; end if;
   if dc.locked_until is not null and dc.locked_until>now() then return 'Aguarde 15 minutos antes de tentar novamente.'; end if;
   if dc.code<>delivery_code then
     update public.mp_delivery_codes set attempts=case when locked_until is not null and locked_until<=now() then 1 else coalesce(attempts,0)+1 end,
       locked_until=case when locked_until is null and coalesce(attempts,0)>=4 then now()+interval '15 minutes' else null end
       where order_id=oid;
     return 'Código de entrega incorreto.';
   end if;
 else raise exception 'Alteração não permitida para este perfil, pagamento ou status.'; end if;
 update public.mp_orders set status=next_status,updated_at=now() where id=oid;
 return 'ok';
end $function$
;
CREATE OR REPLACE FUNCTION public.mp_available_deliveries()
 RETURNS TABLE(id uuid, store_name text, pickup_address text, total_cents integer, is_demo boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); allowed boolean;
begin
 if actor is null then raise exception 'Entre na sua conta.'; end if;
 allowed:=exists(select 1 from public.mp_memberships m where m.user_id=actor and m.role in ('courier','admin'));
 if not allowed then raise exception 'Perfil de entregador não aprovado.'; end if;
 if not coalesce((select p.online from public.mp_profiles p where p.user_id=actor),false) then return; end if;
 return query select o.id,s.name,s.address,o.total_cents,o.is_demo
  from public.mp_orders o join public.mp_stores s on s.id=o.store_id
  where o.fulfillment_method='delivery' and coalesce(o.scheduled_for,now())<=now() and (public.mp_fulfillment_window(s.id)->>'is_open')::boolean and o.status='ready' and o.payment_status='paid' and o.courier_id is null
  order by o.created_at;
end $function$
;

revoke all on function public.mp_create_payment_order(uuid,jsonb,jsonb,uuid,integer,text,text) from public,anon,authenticated;
revoke all on function public.mp_create_verified_payment_order(uuid,jsonb,jsonb,uuid,integer,text) from public,anon,authenticated;
create extension if not exists pg_cron;
select cron.schedule('mp-prepare-business-queue','0 11 * * 1-5','select mp_fulfillment_private.prepare_queue()');

grant execute on function mp_fulfillment_private.easter(integer),mp_fulfillment_private.business_day(date) to anon,authenticated,service_role;
