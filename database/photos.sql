begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('mp-pets','mp-pets',false,5242880,array['image/jpeg','image/png']) on conflict(id) do nothing;
create policy mp_pet_photo_insert on storage.objects for insert to authenticated with check(bucket_id='mp-pets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy mp_pet_photo_read on storage.objects for select to authenticated using(bucket_id='mp-pets' and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.mp_pets p where p.photo_path=storage.objects.name)));
commit;
