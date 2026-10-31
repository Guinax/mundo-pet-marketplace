-- Reusable guard: one partner application per account, document, or phone.
-- Existing records remain intact, even when older records are duplicated.
create or replace function public.mp_application_unique_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare doc text; tel text;
begin
 doc := upper(regexp_replace(coalesce(new.registration,''),'[^A-Za-z0-9]','','g'));
 tel := regexp_replace(coalesce(new.phone,''),'[^0-9]','','g');
 if tg_op='UPDATE' then
   if new.user_id is distinct from old.user_id or new.registration is distinct from old.registration or new.phone is distinct from old.phone then
     raise exception 'Documento, telefone e titular não podem ser alterados após o envio. Solicite revisão ao administrador.';
   end if;
   return new;
 end if;
 if new.user_id is null or length(doc)<5 or length(tel)<10 or length(tel)>13 then
   raise exception 'Informe um documento e um telefone válidos para solicitar credenciamento.';
 end if;
 perform pg_advisory_xact_lock(570031,33001);
 if exists(select 1 from public.mp_applications a where a.user_id=new.user_id) then
   raise exception 'Esta conta já possui solicitação de parceiro. Acompanhe a análise existente.';
 end if;
 if exists(select 1 from public.mp_applications a where upper(regexp_replace(coalesce(a.registration,''),'[^A-Za-z0-9]','','g'))=doc) then
   raise exception 'Este documento já possui cadastro ou solicitação enviada.';
 end if;
 if exists(select 1 from public.mp_applications a where regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')=tel) then
   raise exception 'Este telefone já possui cadastro ou solicitação enviada.';
 end if;
 new.status:='pending';
 return new;
end;
$$;
revoke all on function public.mp_application_unique_guard() from public,anon,authenticated;
drop trigger if exists mp_application_unique_guard_trigger on public.mp_applications;
create trigger mp_application_unique_guard_trigger before insert or update on public.mp_applications
for each row execute function public.mp_application_unique_guard();
