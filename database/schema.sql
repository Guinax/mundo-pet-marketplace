begin;
create schema if not exists mp_private;
revoke all on schema mp_private from public, anon;
grant usage on schema mp_private to authenticated;

create table public.mp_memberships (
 user_id uuid references auth.users(id) on delete restrict, role text check(role in ('admin','store','vet','courier')), primary key(user_id,role)
);
create table public.mp_profiles (
 user_id uuid primary key references auth.users(id) on delete restrict,
 full_name text not null default '', phone text not null default '', cpf text not null default '',
 address jsonb not null default '{}', online boolean not null default false, created_at timestamptz not null default now()
);
create table public.mp_pets (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete restrict,
 name text not null check(length(name) between 1 and 80), species text not null check(species in ('Cão','Gato','Ave','Outro')),
 breed text not null default '', size text not null default 'Pequeno', age text not null default '', weight numeric check(weight>0 and weight<1000),
 vaccinated boolean not null default false, neutered boolean not null default false, allergies text not null default '', medications text not null default '',
 photo_path text, created_at timestamptz not null default now()
);
create index mp_pets_owner_idx on public.mp_pets(owner_id);
create table public.mp_stores (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete restrict,
 name text not null, address text not null default '', phone text not null default '', is_open boolean not null default false,
 is_demo boolean not null default false, created_at timestamptz not null default now()
);
create index mp_stores_owner_idx on public.mp_stores(owner_id);
create table public.mp_products (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.mp_stores(id),
 name text not null check(length(name) between 1 and 150), category text not null default 'Pet Shops',
 price_cents integer not null check(price_cents>0 and price_cents<=10000000), stock integer not null default 0 check(stock>=0),
 image_url text not null default '', active boolean not null default true, created_at timestamptz not null default now()
);
create index mp_products_store_idx on public.mp_products(store_id);
create table public.mp_services (
 id uuid primary key default gen_random_uuid(), provider_id uuid not null references auth.users(id),
 name text not null, provider_name text not null, category text not null default 'Veterinários',
 price_cents integer not null check(price_cents>0), duration_minutes integer not null default 60 check(duration_minutes between 15 and 480),
 image_url text not null default '', active boolean not null default true, is_demo boolean not null default false
);
create index mp_services_provider_idx on public.mp_services(provider_id);
create table public.mp_orders (
 id uuid primary key default gen_random_uuid(), buyer_id uuid not null references auth.users(id), store_id uuid not null references public.mp_stores(id),
 courier_id uuid references auth.users(id), request_key uuid not null,
 status text not null default 'pending' check(status in ('pending','preparing','ready','assigned','delivering','delivered','canceled')),
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','paid')),
 payment_method text not null default 'on_delivery' check(payment_method='on_delivery'), address jsonb not null,
 subtotal_cents integer not null, discount_cents integer not null default 0, delivery_cents integer not null default 0,
 total_cents integer not null check(total_cents>0), is_demo boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(buyer_id,request_key)
);
create index mp_orders_buyer_idx on public.mp_orders(buyer_id);
create index mp_orders_store_idx on public.mp_orders(store_id);
create index mp_orders_courier_idx on public.mp_orders(courier_id);
create table public.mp_order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.mp_orders(id), product_id uuid not null references public.mp_products(id),
 name text not null, quantity integer not null check(quantity between 1 and 99), unit_cents integer not null check(unit_cents>0)
);
create index mp_order_items_order_idx on public.mp_order_items(order_id);
create index mp_order_items_product_idx on public.mp_order_items(product_id);
create table public.mp_delivery_codes (
 order_id uuid primary key references public.mp_orders(id), buyer_id uuid not null references auth.users(id), code text not null,
 attempts integer not null default 0, locked_until timestamptz
);
create index mp_delivery_codes_buyer_idx on public.mp_delivery_codes(buyer_id);
create table public.mp_appointments (
 id uuid primary key default gen_random_uuid(), tutor_id uuid not null references auth.users(id), pet_id uuid not null references public.mp_pets(id),
 provider_id uuid not null references auth.users(id), service_id uuid not null references public.mp_services(id),
 starts_at timestamptz not null, mode text not null check(mode in ('clinic','home','taxi')), notes text not null default '',
 status text not null default 'pending' check(status in ('pending','confirmed','completed','canceled')),
 total_cents integer not null, is_demo boolean not null default false, created_at timestamptz not null default now()
);
create index mp_appointments_tutor_idx on public.mp_appointments(tutor_id);
create index mp_appointments_pet_idx on public.mp_appointments(pet_id);
create index mp_appointments_service_idx on public.mp_appointments(service_id);
create unique index mp_appointments_slot_idx on public.mp_appointments(provider_id,starts_at) where status <> 'canceled';
create table public.mp_clinical_notes (
 id uuid primary key default gen_random_uuid(), appointment_id uuid not null references public.mp_appointments(id),
 provider_id uuid not null references auth.users(id), body text not null check(length(body) between 1 and 10000), created_at timestamptz not null default now()
);
create index mp_clinical_notes_appointment_idx on public.mp_clinical_notes(appointment_id);
create index mp_clinical_notes_provider_idx on public.mp_clinical_notes(provider_id);
create table public.mp_applications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), role text not null check(role in ('store','vet','courier')),
 name text not null, registration text not null default '', address text not null default '', phone text not null default '',
 status text not null default 'pending' check(status in ('pending','approved','rejected')), created_at timestamptz not null default now(), unique(user_id,role)
);
create index mp_applications_user_idx on public.mp_applications(user_id);
create table public.mp_messages (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.mp_orders(id), sender_id uuid not null references auth.users(id),
 body text not null check(length(body) between 1 and 1000), created_at timestamptz not null default now()
);
create index mp_messages_order_idx on public.mp_messages(order_id);
create index mp_messages_sender_idx on public.mp_messages(sender_id);

create function mp_private.has_role(wanted text) returns boolean language sql stable security definer set search_path=''
as $$select auth.uid() is not null and exists(select 1 from public.mp_memberships where user_id=auth.uid() and role=wanted)$$;
revoke all on function mp_private.has_role(text) from public,anon;
grant execute on function mp_private.has_role(text) to authenticated;

do $$ declare t text; begin
 foreach t in array array['mp_memberships','mp_profiles','mp_pets','mp_stores','mp_products','mp_services','mp_orders','mp_order_items','mp_delivery_codes','mp_appointments','mp_clinical_notes','mp_applications','mp_messages'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
grant select on public.mp_stores,public.mp_products,public.mp_services to anon;
create policy members_self on public.mp_memberships for select to authenticated using(user_id=(select auth.uid()) or (select mp_private.has_role('admin')));
create policy profiles_self on public.mp_profiles for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant insert,update on public.mp_profiles to authenticated;
create policy pets_self on public.mp_pets for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy pets_provider on public.mp_pets for select to authenticated using(exists(select 1 from public.mp_appointments a where a.pet_id=mp_pets.id and a.provider_id=(select auth.uid()) and a.status<>'canceled'));
grant insert,update on public.mp_pets to authenticated;
create policy stores_public on public.mp_stores for select to anon,authenticated using(true);
create policy stores_owner on public.mp_stores for update to authenticated using(owner_id=(select auth.uid()) or (select mp_private.has_role('admin'))) with check(owner_id=(select auth.uid()) or (select mp_private.has_role('admin')));
grant update(is_open,name,address,phone) on public.mp_stores to authenticated;
create policy products_public on public.mp_products for select to anon,authenticated using(active or exists(select 1 from public.mp_stores s where s.id=store_id and s.owner_id=(select auth.uid())));
create policy products_owner on public.mp_products for all to authenticated using(exists(select 1 from public.mp_stores s where s.id=store_id and s.owner_id=(select auth.uid()))) with check(exists(select 1 from public.mp_stores s where s.id=store_id and s.owner_id=(select auth.uid())));
grant insert,update on public.mp_products to authenticated;
create policy services_public on public.mp_services for select to anon,authenticated using(active or provider_id=(select auth.uid()));
create policy services_owner on public.mp_services for all to authenticated using(provider_id=(select auth.uid()) and ((select mp_private.has_role('vet')) or (select mp_private.has_role('admin')))) with check(provider_id=(select auth.uid()) and ((select mp_private.has_role('vet')) or (select mp_private.has_role('admin'))));
grant insert,update on public.mp_services to authenticated;
create policy orders_participant on public.mp_orders for select to authenticated using(buyer_id=(select auth.uid()) or courier_id=(select auth.uid()) or (select mp_private.has_role('admin')) or exists(select 1 from public.mp_stores s where s.id=store_id and s.owner_id=(select auth.uid())));
create policy order_items_participant on public.mp_order_items for select to authenticated using(exists(select 1 from public.mp_orders o where o.id=order_id));
create policy delivery_codes_buyer on public.mp_delivery_codes for select to authenticated using(buyer_id=(select auth.uid()));
create policy appointments_participant on public.mp_appointments for select to authenticated using(tutor_id=(select auth.uid()) or provider_id=(select auth.uid()) or (select mp_private.has_role('admin')));
create policy notes_participant on public.mp_clinical_notes for select to authenticated using(provider_id=(select auth.uid()) or exists(select 1 from public.mp_appointments a where a.id=appointment_id and a.tutor_id=(select auth.uid())));
create policy notes_provider on public.mp_clinical_notes for insert to authenticated with check(provider_id=(select auth.uid()) and exists(select 1 from public.mp_appointments a where a.id=appointment_id and a.provider_id=(select auth.uid()) and a.status in ('confirmed','completed')));
grant insert on public.mp_clinical_notes to authenticated;
create policy applications_self_read on public.mp_applications for select to authenticated using(user_id=(select auth.uid()) or (select mp_private.has_role('admin')));
create policy applications_self_create on public.mp_applications for insert to authenticated with check(user_id=(select auth.uid()) and status='pending');
grant insert on public.mp_applications to authenticated;
create policy messages_participant on public.mp_messages for select to authenticated using(exists(select 1 from public.mp_orders o where o.id=order_id));
create policy messages_send on public.mp_messages for insert to authenticated with check(sender_id=(select auth.uid()) and exists(select 1 from public.mp_orders o where o.id=order_id));
grant insert on public.mp_messages to authenticated;

create function mp_private.create_order(cart jsonb, delivery_address jsonb, request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); oid uuid; sid uuid; pid uuid; q integer; p public.mp_products; st public.mp_stores; sub integer:=0; r record;
begin
 if u is null then raise exception 'Entre na sua conta para continuar.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||request_id::text,0));
 select id into oid from public.mp_orders where buyer_id=u and request_key=request_id;
 if oid is not null then return oid; end if;
 if jsonb_typeof(cart)<>'array' or jsonb_array_length(cart) not between 1 and 30 then raise exception 'Carrinho inválido.'; end if;
 if length(coalesce(delivery_address->>'street',''))<3 or length(coalesce(delivery_address->>'number',''))<1 or length(coalesce(delivery_address->>'city',''))<2 then raise exception 'Preencha rua, número e cidade no endereço.'; end if;
 for r in select (x->>'product_id')::uuid as product_id, sum((x->>'quantity')::integer)::integer as qty from jsonb_array_elements(cart) x group by 1 order by 1 loop
  if r.qty not between 1 and 99 then raise exception 'Quantidade inválida.'; end if;
  select * into p from public.mp_products where id=r.product_id for update;
  if not found or not p.active or p.stock<r.qty then raise exception 'Produto indisponível ou estoque insuficiente.'; end if;
  if sid is not null and sid<>p.store_id then raise exception 'Finalize uma loja por vez.'; end if;
  sid:=p.store_id; sub:=sub+p.price_cents*r.qty;
 end loop;
 select * into st from public.mp_stores where id=sid;
 if not st.is_open then raise exception 'A loja está fechada.'; end if;
 -- Delivery pricing and payment-provider credentials require merchant setup.
 -- Demo catalog can exercise the complete workflow; live commerce stays blocked.
 if not st.is_demo then raise exception 'Esta loja ainda precisa configurar pagamento e entrega.'; end if;
 insert into public.mp_orders(buyer_id,store_id,request_key,address,subtotal_cents,total_cents,is_demo)
 values(u,sid,request_id,delivery_address,sub,sub,st.is_demo) returning id into oid;
 insert into public.mp_delivery_codes(order_id,buyer_id,code) values(oid,u,lpad((floor(random()*100000000))::text,8,'0'));
 for r in select (x->>'product_id')::uuid as product_id,sum((x->>'quantity')::integer)::integer as qty from jsonb_array_elements(cart) x group by 1 order by 1 loop
  select * into p from public.mp_products where id=r.product_id;
  insert into public.mp_order_items(order_id,product_id,name,quantity,unit_cents) values(oid,p.id,p.name,r.qty,p.price_cents);
  update public.mp_products set stock=stock-r.qty where id=p.id;
 end loop;
 return oid;
end $$;

create function mp_private.transition_order(oid uuid, next_status text, delivery_code text default '') returns text
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); o public.mp_orders; own boolean; admin boolean; dc public.mp_delivery_codes; item record;
begin
 if u is null then raise exception 'Entre na sua conta.'; end if;
 select * into o from public.mp_orders where id=oid for update;
 if not found then raise exception 'Pedido não encontrado.'; end if;
 admin:=mp_private.has_role('admin');
 own:=exists(select 1 from public.mp_stores where id=o.store_id and owner_id=u);
 if next_status='canceled' and o.status='pending' and (o.buyer_id=u or own or admin) then
  for item in select * from public.mp_order_items where order_id=oid loop
   update public.mp_products set stock=stock+item.quantity where id=item.product_id;
  end loop;
 elsif next_status='preparing' and o.status='pending' and (own or admin) then null;
 elsif next_status='ready' and o.status='preparing' and (own or admin) then null;
 elsif next_status='assigned' and o.status='ready' and o.courier_id is null and (mp_private.has_role('courier') or admin) then
  if not coalesce((select online from public.mp_profiles where user_id=u),false) then raise exception 'Ative seu status online.'; end if;
  update public.mp_orders set courier_id=u where id=oid;
 elsif next_status='delivering' and o.status='assigned' and o.courier_id=u then null;
 elsif next_status='delivered' and o.status='delivering' and o.courier_id=u then
  select * into dc from public.mp_delivery_codes where order_id=oid for update;
  if dc.locked_until>now() then return 'Aguarde 15 minutos antes de tentar novamente.'; end if;
  if dc.code<>delivery_code then
   update public.mp_delivery_codes set attempts=attempts+1,locked_until=case when attempts>=4 then now()+interval '15 minutes' else null end where order_id=oid;
   return 'Código de entrega incorreto.';
  end if;
 else raise exception 'Esta alteração não é permitida para seu perfil ou para o status atual.';
 end if;
 update public.mp_orders set status=next_status,updated_at=now() where id=oid;
 return 'ok';
end $$;

create function mp_private.available_deliveries() returns table(id uuid,store_name text,pickup_address text,total_cents integer,is_demo boolean)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not(mp_private.has_role('courier') or mp_private.has_role('admin')) then raise exception 'Perfil de entregador não aprovado.'; end if;
 if not coalesce((select online from public.mp_profiles where user_id=auth.uid()),false) then return; end if;
 return query select o.id,s.name,s.address,o.total_cents,o.is_demo from public.mp_orders o join public.mp_stores s on s.id=o.store_id where o.status='ready' and o.courier_id is null order by o.created_at;
end $$;

create function mp_private.book_appointment(service uuid,pet uuid,slot timestamptz,attendance text,observation text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.mp_services; aid uuid;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 if not exists(select 1 from public.mp_pets where id=pet and owner_id=auth.uid()) then raise exception 'Selecione um pet da sua conta.'; end if;
 select * into s from public.mp_services where id=service and active;
 if not found then raise exception 'Serviço indisponível.'; end if;
 if not s.is_demo then raise exception 'O profissional ainda precisa configurar os atendimentos.'; end if;
 if slot<now()+interval '30 minutes' or slot>now()+interval '90 days' or attendance not in ('clinic','home','taxi') then raise exception 'Data, horário ou modalidade inválidos.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(s.provider_id::text,0));
 if exists(select 1 from public.mp_appointments a join public.mp_services x on x.id=a.service_id where a.provider_id=s.provider_id and a.status<>'canceled' and tstzrange(a.starts_at,a.starts_at+make_interval(mins=>x.duration_minutes),'[)') && tstzrange(slot,slot+make_interval(mins=>s.duration_minutes),'[)')) then raise exception 'Horário indisponível. Escolha outro horário.'; end if;
 insert into public.mp_appointments(tutor_id,pet_id,provider_id,service_id,starts_at,mode,notes,total_cents,is_demo)
 values(auth.uid(),pet,s.provider_id,service,slot,attendance,left(observation,250),s.price_cents+case attendance when 'home' then 3000 when 'taxi' then 4000 else 0 end,s.is_demo) returning id into aid;
 return aid;
end $$;

create function mp_private.transition_appointment(aid uuid,next_status text) returns void language plpgsql security definer set search_path='' as $$
declare a public.mp_appointments;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 select * into a from public.mp_appointments where id=aid for update;
 if not found then raise exception 'Agendamento não encontrado.'; end if;
 if next_status='canceled' and a.status in ('pending','confirmed') and (a.provider_id=auth.uid() or a.tutor_id=auth.uid() or mp_private.has_role('admin')) then null;
 elsif next_status='confirmed' and a.status='pending' and (a.provider_id=auth.uid() or mp_private.has_role('admin')) then null;
 elsif next_status='completed' and a.status='confirmed' and (a.provider_id=auth.uid() or mp_private.has_role('admin')) then null;
 else raise exception 'Alteração não permitida.'; end if;
 update public.mp_appointments set status=next_status where id=aid;
end $$;

create function mp_private.review_application(aid uuid,approved boolean) returns void language plpgsql security definer set search_path='' as $$
declare a public.mp_applications;
begin
 if auth.uid() is null or not mp_private.has_role('admin') then raise exception 'Acesso restrito à administração.'; end if;
 select * into a from public.mp_applications where id=aid and status='pending' for update;
 if not found then raise exception 'Solicitação não está pendente.'; end if;
 update public.mp_applications set status=case when approved then 'approved' else 'rejected' end where id=aid;
 if approved then
  insert into public.mp_memberships(user_id,role) values(a.user_id,a.role) on conflict do nothing;
  if a.role='store' then insert into public.mp_stores(owner_id,name,address,phone) values(a.user_id,a.name,a.address,a.phone); end if;
 end if;
end $$;

-- Invoker wrappers expose only the specific operations; privileged bodies remain outside public.
create function public.mp_create_order(cart jsonb,delivery_address jsonb,request_id uuid) returns uuid language sql security invoker set search_path='' as $$select mp_private.create_order(cart,delivery_address,request_id)$$;
create function public.mp_transition_order(oid uuid,next_status text,delivery_code text default '') returns text language sql security invoker set search_path='' as $$select mp_private.transition_order(oid,next_status,delivery_code)$$;
create function public.mp_available_deliveries() returns table(id uuid,store_name text,pickup_address text,total_cents integer,is_demo boolean) language sql security invoker set search_path='' as $$select * from mp_private.available_deliveries()$$;
create function public.mp_book_appointment(service uuid,pet uuid,slot timestamptz,attendance text,observation text default '') returns uuid language sql security invoker set search_path='' as $$select mp_private.book_appointment(service,pet,slot,attendance,observation)$$;
create function public.mp_transition_appointment(aid uuid,next_status text) returns void language sql security invoker set search_path='' as $$select mp_private.transition_appointment(aid,next_status)$$;
create function public.mp_review_application(aid uuid,approved boolean) returns void language sql security invoker set search_path='' as $$select mp_private.review_application(aid,approved)$$;
do $$declare r record; begin
 for r in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='mp_private' or (n.nspname='public' and p.proname like 'mp_%') loop
  execute format('revoke all on function %I.%I(%s) from public,anon',r.nspname,r.proname,r.args);
  execute format('grant execute on function %I.%I(%s) to authenticated',r.nspname,r.proname,r.args);
 end loop;
end $$;

-- Existing verified owner of the selected account; no auth account is created or removed.
insert into public.mp_memberships(user_id,role) select id,'admin' from auth.users where id='714bab9a-bff0-4bdc-af70-8f3b415cd038' and email_confirmed_at is not null on conflict do nothing;
insert into public.mp_profiles(user_id,full_name) select id,'Wagner' from auth.users where id='714bab9a-bff0-4bdc-af70-8f3b415cd038' on conflict do nothing;
insert into public.mp_stores(id,owner_id,name,address,is_open,is_demo) values('c1000000-0000-4000-8000-000000000001','714bab9a-bff0-4bdc-af70-8f3b415cd038','Mundo Pet • Loja de demonstração','Endereço de teste',true,true);
insert into public.mp_products(id,store_id,name,category,price_cents,stock) values
 ('c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','Ração Golden Retriever Adulto 15kg','Pet Shops',31190,100),
 ('c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','Antipulgas Bravecto Cães 10 a 20kg','Farmácia',18785,100),
 ('c2000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000001','Areia Sanitária Pipicat Classic 4kg','Pet Shops',1690,100);
insert into public.mp_services(id,provider_id,name,provider_name,category,price_cents,is_demo) values
 ('c3000000-0000-4000-8000-000000000001','714bab9a-bff0-4bdc-af70-8f3b415cd038','Consulta Veterinária Geral','Mundo Pet • Clínica de demonstração','Veterinários',12000,true),
 ('c3000000-0000-4000-8000-000000000002','714bab9a-bff0-4bdc-af70-8f3b415cd038','Banho, Tosa Higiênica & Spa','Mundo Pet • Spa de demonstração','Banho & Tosa',6500,true);
update public.mp_products set image_url='https://lh3.googleusercontent.com/aida-public/AB6AXuDj1nmbm9d3Qp5U-XE26AMkXCBxoNqU33_1S5oVrDuuIKKLG0qbRWIzDts6LgHKKJQy09Snf-6CnMyLRiUBKYgTF2cax0Mn1vGzCGljOQCoEB9o5-HKHYUzIk202QrXST-eC8aeJyZhr9tFQHc_0-jC99M8Fp4HY5PfKGXAcuYdOIMq22Sx3cIEBL_hUvY-kp4W1rv11cKd4MHeDGwkJxnuQkEfh79xFftLwb5JMzS4' where name='Ração Golden Retriever Adulto 15kg';
update public.mp_products set image_url='https://lh3.googleusercontent.com/aida-public/AB6AXuBGZANjeA6FD1QogUb6IJ2S_EJmgcmpenpXCivjWkYNWNJMIzvBGurCWYN6GDBP68LXz9lMFHfEkMxVwffTHKMxcEa5FxqjzgL30Wqp3nsF9G4L7kekWIUVsl67taHoYJ12_LgvUHN4dDm7wrP4awjcy8IJn5LJPeaU5Er8ECe6jfOkwAh_-ZcP17EouRsB_ZkPPrccRWjlV8aW1Nw5B7E2kEtC51eSYM28KbxNcnj8' where name='Antipulgas Bravecto Cães 10 a 20kg';
update public.mp_products set image_url='https://lh3.googleusercontent.com/aida-public/AB6AXuA941DOH9_8Io3vDxlDAjtbmxSgbzuugjva6j4vipSXkgwqO_Jwe2b5tR5Pt7QqklJDnJH-t4zvdsUWIpXH17FYBWePUA-0OsJiQTU-c8ZKEzS-eXz1p38vwpiEYNGBOQ4H5V2WIgZlUeM0kAaBiu5hKggRi6FWygXh_omBRG8k4lDwUQmvmPco_SRqLYV4l7o00rZ2dR_Hq3l6yJDiwS3xBc4tNMUg1YbmThdAc6LC' where name='Areia Sanitária Pipicat Classic 4kg';
update public.mp_services set image_url='https://lh3.googleusercontent.com/aida-public/AB6AXuAozJxLR2YbSD_pYnT69-lazOGWX1m7lCK_bryxBwwwgqaWoV9txIdvkEiUSoLRzxUys2QW2bkXd_8uVeSha7oAhfw_pNzOZgC76c_vJLu4iijA4JBmyBIhEej0nGgmnaIdUciZ1VkoVFlz_2HaJGpax--DSwCxMTq85xogqwp1McHgFwL3PJ4CbMosHirphJRTw7WmOT7-_V92Y02IV0puz7PD6h2nLA42-D0euWM7' where name='Consulta Veterinária Geral';
update public.mp_services set image_url='https://lh3.googleusercontent.com/aida-public/AB6AXuC2rRNSPZ6sS7_JnJbCm_HwdfQeR2rK3uLwjo5eWent0Uji6tW1YAf46EJ7XoRU7MclBeQoI6muJa72oVb64fkDSooYAEVwk4HVTWUb82LkhnVQCn0XZhcPkDP1XxwzwzyJ-lPjkuMvWZudSRsAzXhg0IhAT0w5xzKVRPPvBcuBPI7HBCLSMRrTQnoJaCuKpoR4JGJ8fC1lUltDQ-G4i_6gQVoWVwS1bE-CQFR8g5zw' where name='Banho, Tosa Higiênica & Spa';
commit;
