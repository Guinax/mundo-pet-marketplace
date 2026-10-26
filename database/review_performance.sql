-- Review update: supporting indexes and per-statement auth lookup; no grants or ownership rules changed.

set local lock_timeout = '3s';

set local statement_timeout = '20s';

create index if not exists "mp_review_appointments_pet_id_idx" on public."mp_appointments" ("pet_id");

create index if not exists "mp_review_appointments_provider_id_idx" on public."mp_appointments" ("provider_id");

create index if not exists "mp_review_appointments_service_id_idx" on public."mp_appointments" ("service_id");

create index if not exists "mp_review_appointments_tutor_id_idx" on public."mp_appointments" ("tutor_id");

create index if not exists "mp_review_clinical_notes_appointment_id_idx" on public."mp_clinical_notes" ("appointment_id");

create index if not exists "mp_review_clinical_notes_provider_id_idx" on public."mp_clinical_notes" ("provider_id");

create index if not exists "mp_review_delivery_codes_buyer_id_idx" on public."mp_delivery_codes" ("buyer_id");

create index if not exists "mp_review_messages_order_id_idx" on public."mp_messages" ("order_id");

create index if not exists "mp_review_messages_sender_id_idx" on public."mp_messages" ("sender_id");

create index if not exists "mp_review_order_items_order_id_idx" on public."mp_order_items" ("order_id");

create index if not exists "mp_review_order_items_product_id_idx" on public."mp_order_items" ("product_id");

create index if not exists "mp_review_orders_courier_id_idx" on public."mp_orders" ("courier_id");

create index if not exists "mp_review_orders_store_id_idx" on public."mp_orders" ("store_id");

create index if not exists "mp_review_pets_owner_id_idx" on public."mp_pets" ("owner_id");

create index if not exists "mp_review_products_catalog_source_id_idx" on public."mp_products" ("catalog_source_id");

create index if not exists "mp_review_services_provider_id_idx" on public."mp_services" ("provider_id");

create index if not exists "mp_review_stores_owner_id_idx" on public."mp_stores" ("owner_id");

create index if not exists "mp_review_wallet_entries_wallet_id_idx" on public."mp_wallet_entries" ("wallet_id");

alter policy "own_memberships" on public."mp_memberships" using ((user_id = (select auth.uid())));

alter policy "own_pets" on public."mp_pets" using ((owner_id = (select auth.uid()))) with check ((owner_id = (select auth.uid())));

alter policy "own_orders" on public."mp_orders" using ((buyer_id = (select auth.uid())));

alter policy "own_items" on public."mp_order_items" using ((EXISTS ( SELECT 1
   FROM mp_orders o
  WHERE ((o.id = mp_order_items.order_id) AND (o.buyer_id = (select auth.uid()))))));

alter policy "own_appointments" on public."mp_appointments" using (((tutor_id = (select auth.uid())) OR (provider_id = (select auth.uid()))));

alter policy "own_applications" on public."mp_applications" using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));

alter policy "mp_products_partner_insert" on public."mp_products" with check (((EXISTS ( SELECT 1
   FROM (mp_stores s
     JOIN mp_memberships m ON (((m.user_id = s.owner_id) AND (m.role = 'store'::text))))
  WHERE ((s.id = mp_products.store_id) AND (s.owner_id = (select auth.uid()))))) AND (approval_status = 'pending'::text) AND (submitted_by = (select auth.uid())) AND (active = false)));

alter policy "mp_products_partner_read" on public."mp_products" using ((EXISTS ( SELECT 1
   FROM mp_stores s
  WHERE ((s.id = mp_products.store_id) AND (s.owner_id = (select auth.uid()))))));

alter policy "mp_products_partner_update" on public."mp_products" using ((EXISTS ( SELECT 1
   FROM mp_stores s
  WHERE ((s.id = mp_products.store_id) AND (s.owner_id = (select auth.uid())))))) with check (((EXISTS ( SELECT 1
   FROM mp_stores s
  WHERE ((s.id = mp_products.store_id) AND (s.owner_id = (select auth.uid()))))) AND (approval_status = 'pending'::text) AND (active = false)));

alter policy "mp_services_partner_insert" on public."mp_services" with check (((provider_id = (select auth.uid())) AND (active = false) AND (EXISTS ( SELECT 1
   FROM mp_memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.role = ANY (ARRAY['vet'::text, 'store'::text])))))));

alter policy "mp_services_partner_read" on public."mp_services" using ((provider_id = (select auth.uid())));

alter policy "mp_services_partner_update" on public."mp_services" using (((provider_id = (select auth.uid())) AND (active = false))) with check (((provider_id = (select auth.uid())) AND (active = false)));

alter policy "mp_services_admin_manage" on public."mp_services" using ((EXISTS ( SELECT 1
   FROM mp_memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM mp_memberships m
  WHERE ((m.user_id = (select auth.uid())) AND (m.role = 'admin'::text)))));

