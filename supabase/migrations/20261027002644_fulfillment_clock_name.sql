create or replace function public.mp_fulfillment_window(p_store uuid default null,p_at timestamptz default now()) returns jsonb
 language plpgsql stable security invoker set search_path='' as $$
declare local_clock timestamp:=p_at at time zone 'America/Sao_Paulo';d date:=local_clock::date;available boolean;store_open boolean:=true;starts timestamptz;
begin
 if p_store is not null then select is_open into store_open from public.mp_stores where id=p_store;end if;
 available:=mp_fulfillment_private.business_day(d) and local_clock::time>=time '09:00' and local_clock::time<time '18:00' and coalesce(store_open,false);
 if not available then
  if local_clock::time>=time '18:00' or (local_clock::time>=time '09:00' and not coalesce(store_open,false)) then d:=d+1;end if;
  while not mp_fulfillment_private.business_day(d) loop d:=d+1;end loop;
 end if;
 starts:=case when available then p_at else (d+time '09:00') at time zone 'America/Sao_Paulo' end;
 return jsonb_build_object('is_open',available,'starts_at',starts,'ends_at',(d+time '18:00') at time zone 'America/Sao_Paulo','queue_from',(d+time '08:00') at time zone 'America/Sao_Paulo','timezone','America/Sao_Paulo');
end $$;

create or replace function mp_fulfillment_private.prepare_queue() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;local_clock timestamp:=now() at time zone 'America/Sao_Paulo';
begin
 if not mp_fulfillment_private.business_day(local_clock::date) or local_clock::time<time '08:00' or local_clock::time>=time '18:00' then return 0;end if;
 update public.mp_orders set queued_at=now() where payment_status='paid' and status in ('pending','preparing','ready') and queued_at is null
 and coalesce(scheduled_for,now())<((local_clock::date+time '18:00') at time zone 'America/Sao_Paulo');
 get diagnostics n=row_count;return n;
end $$;

