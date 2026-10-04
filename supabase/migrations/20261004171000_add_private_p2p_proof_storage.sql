insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('aura-p2p-proofs','aura-p2p-proofs',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

drop policy if exists "p2p_proof_upload_own_folder" on storage.objects;
create policy "p2p_proof_upload_own_folder" on storage.objects
for insert to authenticated with check (
  bucket_id='aura-p2p-proofs' and split_part(name,'/',1)=auth.uid()::text
);

drop policy if exists "p2p_proof_read_participants" on storage.objects;
create policy "p2p_proof_read_participants" on storage.objects
for select to authenticated using (
  bucket_id='aura-p2p-proofs'
  and (
    split_part(name,'/',1)=auth.uid()::text
    or exists (
      select 1 from public.p2p_orders o
      where o.id::text=split_part(name,'/',2)
        and (o.buyer_id=auth.uid() or o.seller_id=auth.uid())
    )
  )
);