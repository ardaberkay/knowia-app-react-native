-- Faz 1.6 (S3 + S5) — storage limitleri, yükleme kuralı, hesap silme yardımcısı.
-- SQL editöründe tek seferde çalıştır. Tek transaction.
-- 1.2.0 uyumlu: eski sürüm dosyaları düz adla yüklüyor (card_{deckId}_{userId}_{ts}.webp,
-- user_{userId}_{ts}.webp); yeni kural bu adları da kabul ediyor.
-- → "1.2.0 ortadan kalkınca temizlenecekler": düz ad istisnası kaldırılacak.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1) Bucket limitleri (K10): dosya başına 2 MB, sadece görsel türleri.
--    Uygulama görseli 512px / 0.7 webp'e küçültüp ~30–100 KB yüklüyor;
--    limit sadece kötüye kullanımı keser. Mevcut dosyalar etkilenmez.
-- ─────────────────────────────────────────────────────────────
update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
where id in ('images', 'avatars');

-- ─────────────────────────────────────────────────────────────
-- 2) INSERT kuralı: kullanıcı yalnızca kendi klasörüne ({userId}/…) ya da
--    adında kendi userId'si geçen eski düz ada yükleyebilir.
--    Önce bu iki bucket için mevcut INSERT policy'leri kaldırılır
--    (adları dump'ta yok; bucket adına göre bulunur, NOTICE ile listelenir).
-- ─────────────────────────────────────────────────────────────
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd = 'INSERT'
      and (coalesce(with_check, '') ~ '(images|avatars)')
  loop
    raise notice 'dropping storage INSERT policy: %', p.policyname;
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy "images_insert_own_folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    -- 1.2.0: card_{deckId}_{userId}_{ts}.webp
    or name ~ ('^card_[0-9a-fA-F-]+_' || auth.uid()::text || '_[0-9]+\.webp$')
  )
);

create policy "avatars_insert_own_folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    -- 1.2.0: user_{userId}_{ts}.webp
    or name ~ ('^user_' || auth.uid()::text || '_[0-9]+\.webp$')
  )
);

-- ─────────────────────────────────────────────────────────────
-- 3) Hesap silme (S3): kullanıcının yüklediği bütün dosyalar.
--    Sadece service role (delete-account edge function) çağırabilir.
--    Dosyaların kendisini fonksiyon Storage API ile siler; burada sadece liste.
-- ─────────────────────────────────────────────────────────────
create or replace function public.storage_objects_of_user(p_user_id uuid)
returns table (bucket_id text, name text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select o.bucket_id, o.name
  from storage.objects o
  where o.bucket_id in ('images', 'avatars')
    and (o.owner_id = p_user_id::text or o.owner = p_user_id)
$$;

revoke all on function public.storage_objects_of_user(uuid) from public, anon, authenticated;
grant execute on function public.storage_objects_of_user(uuid) to service_role;

commit;

-- KONTROL:
-- select id, file_size_limit, allowed_mime_types from storage.buckets where id in ('images','avatars');
-- select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' order by cmd;
