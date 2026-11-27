-- Faz 3b — decks_stats budaması (kullanıcı kararı): 366 günden eski
-- başlatma kayıtları silinir. Keşfet bundan sonra "tüm zamanlar" yerine son
-- 1 yılın başlatmalarını sayar (güncel Keşfet). Trend zaten 14 günlük yarı
-- ömürle hesaplandığı için ona etkisi yok. 366: "Bu yıl" filtresi 365 gün
-- geriye bakıyor, onun verisi eksiksiz kalsın.
-- Favoriler etkilenmez (ayrı tablo). "Çalıştığım Desteler"den 1 yıldır hiç
-- başlatılmamış desteler düşer.
-- SQL editöründe tek seferde çalıştır: fonksiyonu kurar, hemen bir kez
-- çalıştırır ve her ay 1'inde 03:17 UTC'de çalışacak cron job'u ekler.

begin;

create or replace function public.decks_stats_prune()
returns integer
language sql
security definer
set search_path to 'public'
as $$
  with gone as (
    delete from public.decks_stats
    where started_at < now() - interval '366 days'
    returning 1
  )
  select count(*)::int from gone
$$;

revoke all on function public.decks_stats_prune() from public, anon, authenticated;

commit;

-- hemen bir kez (silinen satır sayısını döndürür)
select public.decks_stats_prune();

-- her ay
select cron.schedule(
  'decks-stats-prune-monthly',
  '17 3 1 * *',
  $$select public.decks_stats_prune();$$
);

-- KONTROL:
-- select jobid, jobname, schedule from cron.job where jobname = 'decks-stats-prune-monthly';
