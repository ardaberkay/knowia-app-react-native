-- Faz 6 — kişiye özel bildirimler, veritabanı kısmı.
-- SQL editöründe tek seferde çalıştır. Sadece kolon + fonksiyon ekler;
-- mevcut bildirim (günlük 17:30 UTC cron) aynen çalışmaya devam eder.
-- Cron'un saatliğe çevrilmesi yeni edge function deploy edildikten SONRA
-- ayrı bir SQL ile yapılacak (yoksa eski fonksiyon her saat herkese gönderir).
--
-- Kurallar (K17, K17b, K18, K19):
--  * herkese kendi saat diliminde 20:00'de, günde en fazla 1 bildirim
--  * o günün hedefini tamamlayana gitmez
--  * tür duruma göre seçilir:
--      bugün çalıştı ama hedef yarım        → 3 hedef
--      bugün çalışmadı, seri > 0             → 1 seri tehlikede
--      değilse vadesi gelmiş ≥ 5 kart        → 2 "X kart seni bekliyor"
--      değilse yarım kalan deste             → 4 "Y destesinde %60'tasın"
--      3+ gündür hiç çalışmadı               → 5 geri dönüş
--  * aynı tür üst üste 2 gün gitmez: sıradaki uygun tür seçilir, başka uygun
--    tür yoksa o gün gönderilmez
--  * dil: Türkçe kullanana TR, diğer herkese EN

begin;

-- Uygulama dili ('tr', 'en', 'de', …; client yazar) ve son bildirim.
alter table public.profiles add column if not exists language text;
alter table public.profiles add column if not exists last_push_on date;      -- kullanıcının yerel günü
alter table public.profiles add column if not exists last_push_type smallint; -- 1..5

alter table public.profiles drop constraint if exists profiles_language_format;
alter table public.profiles add constraint profiles_language_format
  check (language is null or language ~ '^[a-z]{2}(-[A-Za-z]{2,4})?$');

-- Client kendi dilini okuyup yazabilsin (Faz 1'de SELECT kolon bazında açıldı).
grant select (language) on public.profiles to authenticated;
grant update (language) on public.profiles to authenticated; -- RLS: sadece kendi satırı

-- ─────────────────────────────────────────────────────────────
-- Şu an yerel saati 20 olan ve bugün bildirim almamış kullanıcılardan,
-- kurallara göre bildirim alacak olanları seçer, onları "bugün gönderildi"
-- diye işaretler ve gönderim verisini döner. Edge function saatlik çağırır.
-- Sadece service_role (edge function) çağırabilir.
-- ─────────────────────────────────────────────────────────────
create or replace function public.push_claim_due()
returns table (
  user_id uuid,
  token text,
  lang text,
  push_type smallint,
  streak integer,
  due_count integer,
  goal_left integer,
  deck_id uuid,
  deck_name text,
  deck_percent integer
)
language sql
volatile
security definer
set search_path to 'public'
as $$
  with tz as (select name from pg_timezone_names),
  cand as (
    select p.id, p.expo_push_token as token, p.timezone as tz, p.daily_goal, p.language,
           p.last_push_on, p.last_push_type, p.created_at,
           (now() at time zone p.timezone)::date as today
    from public.profiles p
    join tz on tz.name = p.timezone
    where p.notifications_enabled
      and p.expo_push_token is not null
      and p.deleted_at is null
      and coalesce(p.is_active, true)
      and extract(hour from now() at time zone p.timezone) = 20
      and (p.last_push_on is null or p.last_push_on < (now() at time zone p.timezone)::date)
  ),
  facts as (
    select c.*,
           coalesce(td.swipes, 0) as today_swipes,
           coalesce(td.goal, c.daily_goal) as today_goal,
           coalesce(st.len, 0) as streak,
           coalesce(ls.last_day, (c.created_at at time zone c.tz)::date) as last_study_day,
           coalesce(du.cnt, 0) as due_count,
           du.deck_id as due_deck_id,
           ip.deck_id as ip_deck_id,
           ip.pct as ip_percent
    from cand c
    left join public.user_daily_activity td on td.user_id = c.id and td.day = c.today
    -- seri: dün biten, hedefin tutturulduğu ardışık günler
    left join lateral (
      with met as (
        select a.day from public.user_daily_activity a
        where a.user_id = c.id and a.swipes > 0 and a.swipes >= a.goal and a.day < c.today
      ),
      g as (select day, day - (row_number() over (order by day))::int as grp from met)
      select count(*)::int as len from g
      where grp = (select g2.grp from g g2 where g2.day = c.today - 1)
    ) st on true
    left join lateral (
      select max(a.day) as last_day from public.user_daily_activity a
      where a.user_id = c.id and a.swipes > 0
    ) ls on true
    -- vadesi gelmiş kartlar ve en çok vadesi gelen deste
    left join lateral (
      select sum(x.n)::int as cnt,
             (array_agg(x.deck_id order by x.n desc))[1] as deck_id
      from (
        select k.deck_id, count(*)::int as n
        from public.user_card_progress u
        join public.cards k on k.id = u.card_id
        where u.user_id = c.id and u.status <> 'learned' and u.next_review <= now()
          and not exists (select 1 from public.reports r
                          where r.reporter_id = c.id and r.report_type = 'card' and r.target_id = k.id)
        group by k.deck_id
      ) x
    ) du on true
    -- en son çalışılan, yarım kalmış deste (%1–%99)
    left join lateral (
      select s.deck_id, s.pct from (
        select ds.deck_id, max(ds.started_at) as last_at,
               (select case when count(*) = 0 then 0
                            else (100 * count(*) filter (where u.status = 'learned') / count(*))::int end
                from public.cards k
                left join public.user_card_progress u on u.card_id = k.id and u.user_id = c.id
                where k.deck_id = ds.deck_id) as pct
        from public.decks_stats ds
        where ds.user_id = c.id
        group by ds.deck_id
        order by max(ds.started_at) desc
        limit 5
      ) s
      where s.pct between 1 and 99
      order by s.last_at desc
      limit 1
    ) ip on true
  ),
  options as (
    -- her kullanıcı için uygun türler, öncelik sırasıyla
    select f.*, o.t, o.ord
    from facts f
    cross join lateral (values
      (3::smallint, 1, f.today_swipes > 0),
      (1::smallint, 2, f.today_swipes = 0 and f.streak > 0),
      (2::smallint, 3, f.today_swipes = 0 and f.due_count >= 5),
      (4::smallint, 4, f.today_swipes = 0 and f.ip_deck_id is not null),
      (5::smallint, 5, f.today_swipes = 0 and f.last_study_day <= f.today - 3)
    ) as o(t, ord, ok)
    where o.ok
      and f.today_swipes < f.today_goal                      -- hedefini tamamlayana gitmez
      -- dün aynı tür gittiyse o tür bugün atlanır
      and not (f.last_push_on = f.today - 1 and f.last_push_type = o.t)
  ),
  chosen as (
    select distinct on (o.id) o.*
    from options o
    order by o.id, o.ord
  ),
  claimed as (
    update public.profiles p
       set last_push_on = ch.today, last_push_type = ch.t
      from chosen ch
     where p.id = ch.id
    returning p.id
  )
  select ch.id,
         ch.token,
         case when ch.language like 'tr%' then 'tr'
              when ch.language is null and ch.tz = 'Europe/Istanbul' then 'tr'
              else 'en' end,
         ch.t,
         ch.streak,
         ch.due_count,
         greatest(ch.today_goal - ch.today_swipes, 0),
         case ch.t when 2 then ch.due_deck_id when 4 then ch.ip_deck_id end,
         (select d.name from public.decks d
          where d.id = case ch.t when 2 then ch.due_deck_id when 4 then ch.ip_deck_id end),
         case when ch.t = 4 then ch.ip_percent end
  from chosen ch
  join claimed cl on cl.id = ch.id
$$;

revoke all on function public.push_claim_due() from public, anon, authenticated;
grant execute on function public.push_claim_due() to service_role;

-- Expo "DeviceNotRegistered" dediği token'lar silinir (uygulama kaldırılmış).
create or replace function public.push_drop_tokens(p_tokens text[])
returns integer
language sql
volatile
security definer
set search_path to 'public'
as $$
  with gone as (
    update public.profiles set expo_push_token = null
    where expo_push_token = any(p_tokens)
    returning 1
  )
  select count(*)::int from gone
$$;

revoke all on function public.push_drop_tokens(text[]) from public, anon, authenticated;
grant execute on function public.push_drop_tokens(text[]) to service_role;

commit;

-- KONTROL (hiçbir şey göndermez; sadece kolonlar):
-- select column_name from information_schema.columns
-- where table_name = 'profiles' and column_name in ('language', 'last_push_on', 'last_push_type');
