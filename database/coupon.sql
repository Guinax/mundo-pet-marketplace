begin;
create function mp_private.checkout(cart jsonb,delivery_address jsonb,request_id uuid,coupon text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare oid uuid; already_created boolean; c text:=upper(trim(coalesce(coupon,'')));
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||request_id::text,0));
 select exists(select 1 from public.mp_orders where buyer_id=auth.uid() and request_key=request_id) into already_created;
 if c not in ('','MUNDOPET10') then raise exception 'Cupom inválido.';end if;
 oid:=mp_private.create_order(cart,delivery_address,request_id);
 if c='MUNDOPET10' and not already_created then
  update public.mp_orders set discount_cents=subtotal_cents/10,total_cents=subtotal_cents-subtotal_cents/10 where id=oid and is_demo;
 end if;
 return oid;
end $$;
revoke all on function mp_private.checkout(jsonb,jsonb,uuid,text) from public,anon;
grant execute on function mp_private.checkout(jsonb,jsonb,uuid,text) to authenticated;
create function public.mp_checkout(cart jsonb,delivery_address jsonb,request_id uuid,coupon text default '') returns uuid
language sql security invoker set search_path='' as $$select mp_private.checkout(cart,delivery_address,request_id,coupon)$$;
revoke all on function public.mp_checkout(jsonb,jsonb,uuid,text) from public,anon;
grant execute on function public.mp_checkout(jsonb,jsonb,uuid,text) to authenticated;
commit;
