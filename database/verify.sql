-- All fixture records are rolled back, including temporary auth identities.
begin;
insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values
 ('e1000000-0000-4000-8000-000000000001','authenticated','authenticated','mp-buyer-fixture@example.invalid',now(),now(),now()),
 ('e1000000-0000-4000-8000-000000000002','authenticated','authenticated','mp-peer-fixture@example.invalid',now(),now(),now()),
 ('e1000000-0000-4000-8000-000000000003','authenticated','authenticated','mp-courier-fixture@example.invalid',now(),now(),now());
insert into public.mp_memberships values('e1000000-0000-4000-8000-000000000003','courier');
insert into public.mp_profiles(user_id,full_name,online) values('e1000000-0000-4000-8000-000000000003','Entregador de teste',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into public.mp_pets(id,owner_id,name,species) values('e2000000-0000-4000-8000-000000000001',auth.uid(),'Pet de teste','Cão');
do $$declare oid uuid;again uuid;aid uuid;begin
 oid:=public.mp_checkout('[{"product_id":"c2000000-0000-4000-8000-000000000001","quantity":2}]','{"street":"Rua de teste","number":"1","city":"Cidade de teste"}','e3000000-0000-4000-8000-000000000001','MUNDOPET10');
 if (select total_cents from public.mp_orders where id=oid)<>56142 then raise exception 'FAIL: server price';end if;
 again:=public.mp_checkout('[{"product_id":"c2000000-0000-4000-8000-000000000001","quantity":2}]','{"street":"Rua de teste","number":"1","city":"Cidade de teste"}','e3000000-0000-4000-8000-000000000001','MUNDOPET10');
 if again<>oid then raise exception 'FAIL: idempotency';end if;
 perform set_config('mp.test_order',oid::text,true);
 perform set_config('mp.test_code',(select code from public.mp_delivery_codes where order_id=oid),true);
 aid:=public.mp_book_appointment('c3000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001',date_trunc('hour',now())+interval '2 days','clinic','Fixture');
 if (select total_cents from public.mp_appointments where id=aid)<>12000 then raise exception 'FAIL: service price';end if;
 begin
  perform public.mp_book_appointment('c3000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001',date_trunc('hour',now())+interval '2 days 30 minutes','clinic','Fixture');
  raise exception 'FAIL: double booking allowed';
 exception when others then if sqlerrm='FAIL: double booking allowed' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.mp_pets where owner_id='e1000000-0000-4000-8000-000000000001') then raise exception 'FAIL: peer pet leak';end if;
 if exists(select 1 from public.mp_orders where id=current_setting('mp.test_order')::uuid) then raise exception 'FAIL: peer order leak';end if;
 if exists(select 1 from public.mp_delivery_codes where order_id=current_setting('mp.test_order')::uuid) then raise exception 'FAIL: peer delivery code leak';end if;
 begin
  perform public.mp_transition_order(current_setting('mp.test_order')::uuid,'preparing');
  raise exception 'FAIL: unauthorized status transition';
 exception when others then if sqlerrm='FAIL: unauthorized status transition' then raise;end if;end;
 begin
  insert into public.mp_memberships(user_id,role) values(auth.uid(),'admin');
  raise exception 'FAIL: self elevation';
 exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"714bab9a-bff0-4bdc-af70-8f3b415cd038","role":"authenticated"}',true);
do $$declare oid uuid:=current_setting('mp.test_order')::uuid;begin
 perform public.mp_transition_order(oid,'preparing');perform public.mp_transition_order(oid,'ready');
end $$;
select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$declare oid uuid:=current_setting('mp.test_order')::uuid;begin
 if exists(select 1 from public.mp_orders where id=oid) then raise exception 'FAIL: address exposed before claim';end if;
 if not exists(select 1 from public.mp_available_deliveries() where id=oid) then raise exception 'FAIL: available delivery missing';end if;
 perform public.mp_transition_order(oid,'assigned');
 if not exists(select 1 from public.mp_orders where id=oid) then raise exception 'FAIL: courier cannot see accepted order';end if;
 if exists(select 1 from public.mp_delivery_codes where order_id=oid) then raise exception 'FAIL: courier can read customer code';end if;
 perform public.mp_transition_order(oid,'delivering');
 if public.mp_transition_order(oid,'delivered','wrong')='ok' then raise exception 'FAIL: invalid code accepted';end if;
 if (select status from public.mp_orders where id=oid)<>'delivering' then raise exception 'FAIL: invalid code moved status';end if;
 if public.mp_transition_order(oid,'delivered',current_setting('mp.test_code'))<>'ok' then raise exception 'FAIL: valid code rejected';end if;
 if (select payment_status from public.mp_orders where id=oid)<>'unpaid' then raise exception 'FAIL: demo faked payment';end if;
end $$;
reset role;
select json_build_object('result','passed','checks',array['server pricing','coupon validation','idempotency','booking conflicts','RLS isolation','role elevation denied','courier address protection','delivery code authorization','unpaid demo preserved']) as verification;
rollback;
