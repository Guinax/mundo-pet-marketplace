-- All fixtures and edits below are rolled back, including financial records.
begin;
create temp table admin_qa_context(admin uuid,store uuid,paid_order uuid,ready_order uuid,other_order uuid) on commit drop;
insert into admin_qa_context select user_id,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid() from public.mp_memberships where role='admin' limit 1;
do $$begin if not exists(select 1 from admin_qa_context) then raise exception 'Missing authorized admin';end if;end$$;
grant select on admin_qa_context to authenticated;
insert into public.mp_stores(id,owner_id,name,address,is_demo) select store,admin,'QA transaction only','QA rollback',false from admin_qa_context;
insert into public.mp_orders(id,buyer_id,store_id,request_key,status,payment_status,payment_method,address,subtotal_cents,total_cents,is_demo,created_at,updated_at)
select paid_order,admin,store,gen_random_uuid(),'delivered','paid','infinitepay_pix','{}'::jsonb,10000,10000,false,now()-interval '8 days',now()-interval '7 days' from admin_qa_context
union all select ready_order,admin,store,gen_random_uuid(),'ready','paid','infinitepay_pix','{}'::jsonb,10000,10000,false,now(),now() from admin_qa_context
union all select other_order,admin,store,gen_random_uuid(),'ready','paid','infinitepay_pix','{}'::jsonb,10000,10000,false,now(),now() from admin_qa_context;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$declare n integer;begin
 begin perform public.mp_admin_directory();raise exception 'UNAUTHORIZED DIRECTORY ACCEPTED';exception when insufficient_privilege then null;end;
 begin perform public.mp_admin_reconcile_orders();raise exception 'UNAUTHORIZED RECONCILIATION ACCEPTED';exception when insufficient_privilege then null;end;
 begin insert into public.mp_campaigns(title) values('Unauthorized');raise exception 'UNAUTHORIZED CAMPAIGN ACCEPTED';exception when insufficient_privilege then null;end;
 update public.mp_commission_policy set products_bps=9000 where id;get diagnostics n=row_count;if n<>0 then raise exception 'UNAUTHORIZED COMMISSION ACCEPTED';end if;
end$$;
reset role;
select set_config('request.jwt.claim.sub',(select admin::text from admin_qa_context),true);
set local role authenticated;
do $$declare cid uuid;pid uuid;pid2 uuid;k uuid:=gen_random_uuid();w uuid;n integer;rate integer;begin
 if jsonb_typeof(public.mp_admin_directory())<>'array' then raise exception 'DIRECTORY RESPONSE';end if;
 insert into public.mp_campaigns(title,image_url,active) values('QA rollback banner','https://example.org/test.jpg',false) returning id into cid;
 update public.mp_campaigns set active=true where id=cid;
 if not exists(select 1 from public.mp_campaigns where id=cid and active) then raise exception 'CAMPAIGN UPDATE';end if;
 update public.mp_campaigns set active=false where id=cid;
 insert into public.mp_admin_notification_reads(notification_key) values('qa:rollback') on conflict(admin_id,notification_key) do nothing;
 insert into public.mp_admin_notification_reads(notification_key) values('qa:rollback') on conflict(admin_id,notification_key) do nothing;
 if (select count(*) from public.mp_admin_notification_reads where notification_key='qa:rollback')<>1 then raise exception 'NOTIFICATION IDEMPOTENCY';end if;
 select commission_bps into rate from public.mp_orders where id=(select paid_order from admin_qa_context);
 update public.mp_commission_policy set products_bps=2000 where id;
 if (select commission_bps from public.mp_orders where id=(select paid_order from admin_qa_context))<>rate then raise exception 'RETROACTIVE COMMISSION';end if;
 perform public.mp_admin_reconcile_orders();
 if (select commission_cents from public.mp_order_settlements where order_id=(select paid_order from admin_qa_context))<>round(10000*rate/10000.0) then raise exception 'COMMISSION CALCULATION';end if;
 n:=public.mp_admin_reconcile_orders();if n<>0 then raise exception 'DUPLICATE SETTLEMENT';end if;
 begin perform public.mp_admin_request_payout(null,999999999999,'QA','qa@example.org',gen_random_uuid());raise exception 'OVERDRAFT ACCEPTED';exception when raise_exception then if sqlerrm='OVERDRAFT ACCEPTED' then raise;end if;end;
 pid:=public.mp_admin_request_payout(null,100,'QA Platform','qa@example.org',k);
 pid2:=public.mp_admin_request_payout(null,100,'QA Platform','qa@example.org',k);if pid<>pid2 then raise exception 'DUPLICATE REQUEST';end if;
 perform public.mp_admin_resolve_payout(pid,'canceled','');
 begin perform public.mp_admin_resolve_payout(pid,'paid','QA-reference');raise exception 'CANCELED PAYOUT PAID';exception when raise_exception then if sqlerrm='CANCELED PAYOUT PAID' then raise;end if;end;
 select id into w from public.mp_wallets where store_id=(select store from admin_qa_context) and wallet_type='store';
 pid:=public.mp_admin_request_payout(w,100,'QA Partner','qa@example.org',gen_random_uuid());
 begin perform public.mp_admin_resolve_payout(pid,'paid','x');raise exception 'SHORT BANK REFERENCE ACCEPTED';exception when raise_exception then if sqlerrm='SHORT BANK REFERENCE ACCEPTED' then raise;end if;end;
 perform public.mp_admin_resolve_payout(pid,'paid','QA-reference-rollback');
 begin perform public.mp_admin_resolve_payout(pid,'paid','QA-reference-rollback');raise exception 'DUPLICATE DEBIT ACCEPTED';exception when raise_exception then if sqlerrm='DUPLICATE DEBIT ACCEPTED' then raise;end if;end;
 if (select count(*) from public.mp_wallet_entries where reference='payout:'||pid)<>1 then raise exception 'PAYOUT DEBIT COUNT';end if;
 if not exists(select 1 from public.mp_admin_audit where entity_type='mp_campaigns' and entity_id=cid::text) then raise exception 'MISSING AUDIT';end if;
end$$;
reset role;
-- Courier assignment is tested using the existing admin as a temporary courier, in this rollback transaction only.
insert into public.mp_memberships(user_id,role) select admin,'courier' from admin_qa_context on conflict do nothing;
insert into public.mp_profiles(user_id,online,presence_updated_at) select admin,true,now() from admin_qa_context on conflict(user_id) do update set online=true,presence_updated_at=now();
set local role authenticated;
do $$begin
 perform public.mp_admin_assign_courier((select ready_order from admin_qa_context),(select admin from admin_qa_context));
 begin perform public.mp_admin_assign_courier((select other_order from admin_qa_context),(select admin from admin_qa_context));raise exception 'BUSY COURIER ACCEPTED';exception when raise_exception then if sqlerrm='BUSY COURIER ACCEPTED' then raise;end if;end;
end$$;
reset role;
rollback;
select 'Admin permissions, campaigns, commissions, notifications, reconciliation, payouts and courier assignment passed; all fixtures rolled back.' as verification;
