-- Faz 3b — 3b.3 decks_stats: kullanıcı + deste + gün için tek satır (S12),
-- 3b.4 reports / blocked_users / user_hidden_decks: tekrar eden kayıt yok.
--
-- Uygulama kodu DEĞİŞMEZ ve 1.2.0 da aynen çalışır: tekrar eden INSERT'leri
-- BEFORE INSERT trigger'ları karşılar (decks_stats'ta o günün satırının
-- sayacını artırır, diğerlerinde sessizce yok sayar). Hata dönmez.
--
-- Keşfet (get_discover_decks) değişmez: başlatmaları satır sayarak hesapladığı
-- için artık bir kullanıcı bir desteye günde en fazla 1 başlatma ekleyebilir;
-- aynı desteyi yüzlerce kez başlatarak trend / popülerlik şişirilemez.
-- "Çalıştığım Desteler" max(started_at) kullandığı için o da değişmez.
--
-- SQL editöründe tek seferde çalıştır. Önce mevcut kopyaları birleştirir /
-- siler, sonra unique index'leri kurar.

begin;

-- ─────────────────────────────────────────────────────────────
-- 3b.3 decks_stats
-- ─────────────────────────────────────────────────────────────
-- O gün kaç kez başlatıldı (bilgi amaçlı; Keşfet satırları sayar, bunu değil).
alter table public.decks_stats
  add column if not exists start_count integer not null default 1;

-- Gün (UTC), started_at'ten türetilir.
alter table public.decks_stats
  add column if not exists started_on date
  generated always as ((started_at at time zone 'UTC')::date) stored;

-- Mevcut kopyaları birleştir: her (kullanıcı, deste, gün) için en son satır
-- kalır, sayacı o günün başlatma sayısı olur.
update public.decks_stats t
   set start_count = g.cnt
  from (
    select user_id, deck_id, started_on, count(*)::int as cnt, max(started_at) as last_at
    from public.decks_stats
    group by user_id, deck_id, started_on
    having count(*) > 1
  ) g
 where t.user_id = g.user_id and t.deck_id = g.deck_id and t.started_on = g.started_on
   and t.started_at = g.last_at;

delete from public.decks_stats a
 using public.decks_stats b
 where a.user_id = b.user_id and a.deck_id = b.deck_id and a.started_on = b.started_on
   and (a.started_at, a.ctid) < (b.started_at, b.ctid);

create unique index if not exists decks_stats_user_deck_day_key
  on public.decks_stats (user_id, deck_id, started_on);

-- Aynı gün tekrar başlatma: yeni satır yerine o günün satırı güncellenir.
-- SECURITY DEFINER: kullanıcıların decks_stats'ta UPDATE izni olmayabilir.
-- Sadece kendi satırı (user_id = auth.uid()) için çalışır; başkası adına
-- yazılan satır olduğu gibi geçer ve RLS onu reddeder.
create or replace function public.decks_stats_merge_same_day()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.user_id is distinct from auth.uid() then
    return new;
  end if;
  update public.decks_stats
     set start_count = start_count + 1,
         started_at = greatest(started_at, coalesce(new.started_at, now()))
   where user_id = new.user_id
     and deck_id = new.deck_id
     and started_on = (coalesce(new.started_at, now()) at time zone 'UTC')::date;
  if found then
    return null; -- o günün satırı güncellendi, yeni satır yazılmaz
  end if;
  return new;
end;
$$;

revoke all on function public.decks_stats_merge_same_day() from public, anon, authenticated;

drop trigger if exists decks_stats_merge_same_day on public.decks_stats;
create trigger decks_stats_merge_same_day
  before insert on public.decks_stats
  for each row execute function public.decks_stats_merge_same_day();

-- ─────────────────────────────────────────────────────────────
-- 3b.4 Tekrar eden rapor / engel / gizleme
-- ─────────────────────────────────────────────────────────────
-- Mevcut kopyalar: her gruptan bir satır kalır.
delete from public.reports a
 using public.reports b
 where a.reporter_id = b.reporter_id and a.report_type = b.report_type and a.target_id = b.target_id
   and a.reason is not distinct from b.reason
   and a.ctid > b.ctid;

delete from public.blocked_users a
 using public.blocked_users b
 where a.blocker_id = b.blocker_id and a.blocked_id = b.blocked_id
   and a.ctid > b.ctid;

delete from public.user_hidden_decks a
 using public.user_hidden_decks b
 where a.user_id = b.user_id and a.deck_id = b.deck_id
   and a.ctid > b.ctid;

-- Aynı hedefe FARKLI sebeple rapor verilebilir (rapor ekranı verilmiş sebepleri
-- gösterir), aynı sebeple ikinci kez verilemez. Faz 3'teki sıradan index
-- (reporter_id, report_type, target_id) NOT EXISTS aramaları için kalır.
create unique index if not exists reports_reporter_type_target_reason_key
  on public.reports (reporter_id, report_type, target_id, reason) nulls not distinct;
create unique index if not exists blocked_users_blocker_blocked_key
  on public.blocked_users (blocker_id, blocked_id);
create unique index if not exists user_hidden_decks_user_deck_key
  on public.user_hidden_decks (user_id, deck_id);

-- Zaten var olan kaydı tekrar yazmak hata vermez, sessizce yok sayılır
-- (1.2.0 ve yeni sürüm aynı kodla çalışır). Sadece kendi kaydı için:
-- başkası adına yazılan satır olduğu gibi geçer ve RLS onu reddeder.
create or replace function public.skip_duplicate_user_action()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_table_name = 'reports' then
    if new.reporter_id is distinct from auth.uid() then return new; end if;
    if exists (select 1 from public.reports r
               where r.reporter_id = new.reporter_id and r.report_type = new.report_type
                 and r.target_id = new.target_id and r.reason is not distinct from new.reason) then
      return null;
    end if;
  elsif tg_table_name = 'blocked_users' then
    if new.blocker_id is distinct from auth.uid() then return new; end if;
    if exists (select 1 from public.blocked_users b
               where b.blocker_id = new.blocker_id and b.blocked_id = new.blocked_id) then
      return null;
    end if;
  elsif tg_table_name = 'user_hidden_decks' then
    if new.user_id is distinct from auth.uid() then return new; end if;
    if exists (select 1 from public.user_hidden_decks h
               where h.user_id = new.user_id and h.deck_id = new.deck_id) then
      return null;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.skip_duplicate_user_action() from public, anon, authenticated;

drop trigger if exists reports_skip_duplicate on public.reports;
create trigger reports_skip_duplicate
  before insert on public.reports
  for each row execute function public.skip_duplicate_user_action();

drop trigger if exists blocked_users_skip_duplicate on public.blocked_users;
create trigger blocked_users_skip_duplicate
  before insert on public.blocked_users
  for each row execute function public.skip_duplicate_user_action();

drop trigger if exists user_hidden_decks_skip_duplicate on public.user_hidden_decks;
create trigger user_hidden_decks_skip_duplicate
  before insert on public.user_hidden_decks
  for each row execute function public.skip_duplicate_user_action();

commit;

-- KONTROL (hepsi 0 dönmeli):
-- select count(*) from (select 1 from public.decks_stats group by user_id, deck_id, started_on having count(*) > 1) x;
-- select count(*) from (select 1 from public.reports group by reporter_id, report_type, target_id, reason having count(*) > 1) x;
-- Satır sayısı (önce / sonra karşılaştırmak için):
-- select count(*) from public.decks_stats;
