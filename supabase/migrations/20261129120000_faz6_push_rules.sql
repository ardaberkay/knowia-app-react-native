-- Faz 6 — bildirim kuralları, son hâli (kullanıcıyla 28 Kasım'da kararlaştırıldı).
-- 20261129110000'den sonra çalıştır. push_claim_due'yu yeniden tanımlar ve
-- son gönderilen metnin numarasını tutan kolonu ekler. Hâlâ hiçbir şey
-- göndermez; cron saatliğe yeni edge function deploy edildikten sonra çevrilir.
--
-- Her kullanıcıya kendi saat diliminde 20:00'de, günde en fazla 1 bildirim.
-- O günün hedefini tamamlayana gitmez. Tür:
--   bugün çalıştı, hedef yarım            → 3 hedef          (her gün)
--   bugün çalışmadı, serisi var            → 1 seri           (her gün; tekrar kuralından muaf)
--   1–7 gündür çalışmadı                   → 2 kart bekliyor (≥ 5 vadesi gelmiş kart),
--                                            4 yarım deste (%15–%99), 5 geri dönüş (3+ gün)
--                                            uygun olanlar arasında sırayla döner: 2 → 4 → 5 → 2
--   8–30 gündür çalışmadı                  → sadece 5, 2 günde bir
--   31–90 gündür çalışmadı                 → sadece 5, haftada bir
--   90 günden fazla                        → hiç
-- Metin: her türün metinlerinden rastgele biri; aynı tür dün de gittiyse dünkü
-- metin seçilmez. Metin sayıları edge function'daki listelerle aynı olmalı:
-- 1 → 4, 2 → 4, 3 → 5, 4 → 4, 5 → 7.

begin;

alter table public.profiles add column if not exists last_push_variant smallint;

drop function if exists public.push_claim_due();

create function public.push_claim_due()
returns table (
  user_id uuid,
  token text,
  lang text,
  push_type smallint,
  variant smallint,
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
           p.last_push_on, p.last_push_type, p.last_push_variant, p.created_at,
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
           c.today - coalesce(ls.last_day, (c.created_at at time zone c.tz)::date) as idle_days,
           coalesce(du.cnt, 0) as due_count,
           du.deck_id as due_deck_id,
           ip.deck_id as ip_deck_id,
           ip.pct as ip_percent,
           c.today - coalesce(c.last_push_on, date '2000-01-01') as days_since_push
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
    -- son çalışılan gün (yoksa hesabın açıldığı gün)
    left join lateral (
      select max(a.day) as last_day from public.user_daily_activity a
      where a.user_id = c.id and a.swipes > 0
    ) ls on true
    -- vadesi gelmiş kartlar (sola atılmış, tekrar süresi dolmuş) ve en çok bekleyen deste
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
    -- son başlatılan 5 desteden, %15–%99 öğrenilmiş en son çalışılan
    left join lateral (
      select s.deck_id, s.pct from (
        select ds.deck_id, max(ds.started_at) as last_at,
               (select case when count(*) = 0 then 0
                            else (100 * count(*) filter (where u.status = 'learned') / count(*))::int end
                from public.cards k
                left join public.user_card_progress u on u.card_id = k.id and u.user_id = c.id
                where k.deck_id = ds.deck_id
                  and not exists (select 1 from public.reports r
                                  where r.reporter_id = c.id and r.report_type = 'card' and r.target_id = k.id)) as pct
        from public.decks_stats ds
        where ds.user_id = c.id
        group by ds.deck_id
        order by max(ds.started_at) desc
        limit 5
      ) s
      where s.pct between 15 and 99
      order by s.last_at desc
      limit 1
    ) ip on true
  ),
  options as (
    -- uygun türler; ord küçük olan seçilir
    select f.*, o.t, o.ord
    from facts f
    cross join lateral (values
      (3::smallint, 1, f.today_swipes > 0),
      (1::smallint, 2, f.today_swipes = 0 and f.streak > 0),
      -- 2 / 4 / 5 sırayla döner: dün giden türden sonraki gelir
      (2::smallint, 10 + (0 - coalesce(array_position(array[2,4,5], f.last_push_type::int) - 1, 2) + 2) % 3,
         f.today_swipes = 0 and f.idle_days <= 7 and f.due_count >= 5),
      (4::smallint, 10 + (1 - coalesce(array_position(array[2,4,5], f.last_push_type::int) - 1, 2) + 2) % 3,
         f.today_swipes = 0 and f.idle_days <= 7 and f.ip_deck_id is not null),
      (5::smallint, 10 + (2 - coalesce(array_position(array[2,4,5], f.last_push_type::int) - 1, 2) + 2) % 3,
         f.today_swipes = 0 and f.idle_days >= 3 and (
           f.idle_days <= 7
           or (f.idle_days <= 30 and f.days_since_push >= 2)
           or (f.idle_days <= 90 and f.days_since_push >= 7)
         ))
    ) as o(t, ord, ok)
    where o.ok
      and f.today_swipes < f.today_goal                      -- hedefini tamamlayana gitmez
  ),
  chosen as (
    select distinct on (o.id) o.*,
           (array[4, 4, 5, 4, 7])[o.t] as n_variants
    from options o
    order by o.id, o.ord
  ),
  picked as (
    -- rastgele metin; aynı tür dün gittiyse dünkü metin atlanır
    select ch.*,
           case
             when ch.last_push_on = ch.today - 1 and ch.last_push_type = ch.t
                  and ch.last_push_variant between 1 and ch.n_variants
               then ((ch.last_push_variant - 1 + 1 + floor(random() * (ch.n_variants - 1))::int) % ch.n_variants + 1)::smallint
             else (floor(random() * ch.n_variants)::int + 1)::smallint
           end as v
    from chosen ch
  ),
  claimed as (
    update public.profiles p
       set last_push_on = pk.today, last_push_type = pk.t, last_push_variant = pk.v
      from picked pk
     where p.id = pk.id
    returning p.id
  )
  select pk.id,
         pk.token,
         case when pk.language like 'tr%' then 'tr'
              when pk.language is null and pk.tz = 'Europe/Istanbul' then 'tr'
              else 'en' end,
         pk.t,
         pk.v,
         pk.streak,
         pk.due_count,
         greatest(pk.today_goal - pk.today_swipes, 0),
         case pk.t when 2 then pk.due_deck_id when 4 then pk.ip_deck_id end,
         (select d.name from public.decks d
          where d.id = case pk.t when 2 then pk.due_deck_id when 4 then pk.ip_deck_id end),
         case when pk.t = 4 then pk.ip_percent end
  from picked pk
  join claimed cl on cl.id = pk.id
$$;

revoke all on function public.push_claim_due() from public, anon, authenticated;
grant execute on function public.push_claim_due() to service_role;

commit;

-- KONTROL (hiçbir şey göndermez, kimseyi işaretlemez):
-- select proname from pg_proc where proname in ('push_claim_due', 'push_drop_tokens');
