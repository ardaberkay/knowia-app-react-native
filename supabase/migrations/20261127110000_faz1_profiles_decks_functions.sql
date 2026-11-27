-- Faz 1 — 1.2 (S8, birinci adım), 1.4 (S9), 1.5 (S10 + S13)
-- SQL editöründe tek seferde çalıştır. Tek transaction: bir hata olursa hiçbir şey değişmez.
-- Canlıdaki 1.2.0 ile uyumlu: 1.2.0'ın okuduğu/yazdığı hiçbir kolon kapatılmıyor.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1.2 (S8) Profiller: push token, son aktiflik ve saat dilimi artık
-- başka kullanıcılara görünmez.
-- Satır bazında RLS ("herkes okuyabilir") kalıyor, çünkü desteler
-- profiles(username, image_url) embed ediyor. Kolon yetkisiyle hassas
-- kolonlar API'den tamamen kapatılıyor.
-- Uygulama (1.2.0 ve yeni sürüm) yalnızca şu kolonları SELECT ediyor:
--   id, username, created_at, email, updated_at, image_url,
--   notifications_enabled, theme_preference.
-- Kapatılanlar: expo_push_token, last_active_at, timezone.
-- Bu kolonları okuyan RPC'ler SECURITY DEFINER olduğu için etkilenmez;
-- edge function'lar service role kullandığı için etkilenmez.
-- UPDATE yetkisi değişmiyor (uygulama last_active_at, token vb. yazmaya devam eder).
-- e-posta: 1.2.0 kendi profilini okurken e-postayı da seçtiği için şimdilik açık
-- kalıyor → "1.2.0 ortadan kalkınca temizlenecekler" listesinde.
-- ─────────────────────────────────────────────────────────────
revoke select on public.profiles from anon, authenticated;
grant select (
  id, username, created_at, email, updated_at, image_url,
  notifications_enabled, theme_preference, is_active, deleted_at, daily_goal
) on public.profiles to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 1.4 (S9) Desteler: kullanıcı is_admin_created ve card_count'u
-- değiştiremez. Panel ve SQL editörü (JWT'siz istek) etkilenmez; kullanıcı
-- resmi desteyi panelden true yapmaya devam eder.
-- card_count'u güncelleyen update_deck_card_count trigger'ı iç içe çalıştığı
-- için (pg_trigger_depth() > 1) serbest bırakılıyor.
-- Hata fırlatmak yerine değeri sessizce geri alıyor: 1.2.0'ın insert'te
-- gönderdiği is_admin_created:false / card_count değerleri sorunsuz kalır.
-- ─────────────────────────────────────────────────────────────
create or replace function public.guard_deck_protected_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then
    return new;  -- panel, SQL editörü, service role
  end if;
  if pg_trigger_depth() > 1 then
    return new;  -- kart ekleme/silme trigger'ından gelen card_count güncellemesi
  end if;

  if tg_op = 'INSERT' then
    new.is_admin_created := false;
    new.card_count := 0;
  else
    new.is_admin_created := old.is_admin_created;
    new.card_count := old.card_count;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_deck_protected_columns on public.decks;
create trigger guard_deck_protected_columns
  before insert or update on public.decks
  for each row execute function public.guard_deck_protected_columns();

-- ─────────────────────────────────────────────────────────────
-- 1.5 (S10) distribute_unassigned_evenly: sadece deste sahibi çalıştırabilir,
-- verilen bölümler de o desteye ait olmalı. İmza aynı (1.2.0 uyumlu).
-- ─────────────────────────────────────────────────────────────
create or replace function public.distribute_unassigned_evenly(p_deck uuid, p_chapters uuid[] default null::uuid[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_card record;
  v_target_chapter uuid;
  v_chapters_filter uuid[];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from decks where id = p_deck and user_id = auth.uid()) then
    raise exception 'Not allowed';
  end if;

  -- Verilen bölümlerden yalnızca bu desteye ait olanlar; verilmediyse destenin tüm bölümleri
  select array_agg(id) into v_chapters_filter
  from chapters
  where deck_id = p_deck
    and (p_chapters is null or array_length(p_chapters, 1) is null or id = any(p_chapters));

  if v_chapters_filter is null or array_length(v_chapters_filter, 1) = 0 then
    return;
  end if;

  -- Atanmamış kartları eski->yeni sırada tek tek al ve dağıt
  for v_card in
    select id
    from cards
    where deck_id = p_deck
      and chapter_id is null
    order by created_at asc
  loop
    -- O anki en az yüklü bölüm (eşitlikte en eski)
    select c.id
    into v_target_chapter
    from chapters c
    left join cards cr
      on cr.chapter_id = c.id
      and cr.deck_id = p_deck
    where c.deck_id = p_deck
      and c.id = any(v_chapters_filter)
    group by c.id, c.created_at
    order by count(cr.id) asc, c.created_at asc
    limit 1;

    if v_target_chapter is not null then
      update cards
      set chapter_id = v_target_chapter
      where id = v_card.id;
    end if;
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 1.5 (S13) search_path sabitleme: SECURITY DEFINER olanlar önce,
-- sonra Supabase linter'ın uyardığı diğerleri.
-- ─────────────────────────────────────────────────────────────
alter function public.handle_new_user() set search_path to 'public';
alter function public.handle_auth_user_email_update() set search_path to 'public';
alter function public.check_chapter_limit() set search_path to 'public';
alter function public.enforce_max_two_deck_languages() set search_path to 'public';
alter function public.get_deck_chapters_progress(uuid, uuid) set search_path to 'public';
alter function public.random_username() set search_path to 'public';
alter function public.set_shared_at() set search_path to 'public';
alter function public.set_updated_at() set search_path to 'public';
alter function public.update_deck_card_count() set search_path to 'public';

-- check_chapter_limit: yorum koddaki sınırla (40) uyumlu hale getirildi.
create or replace function public.check_chapter_limit()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  -- Destedeki bölüm sayısı 40'a ulaştıysa yeni bölüm eklenemez
  if (select count(*) from chapters where deck_id = new.deck_id) >= 40 then
    raise exception 'Bu deste için maksimum bölüm (chapter) sınırına (40) ulaşıldı.';
  end if;
  return new;
end;
$$;

commit;

-- KONTROL (isteğe bağlı, commit'ten sonra):
-- select column_name, privilege_type from information_schema.column_privileges
-- where table_name = 'profiles' and grantee = 'authenticated' and privilege_type = 'SELECT';
