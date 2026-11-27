-- Faz 2 — swipe oturumu: config, oturum tablosu, tekrar kuralları, skip, undo
-- sınırı, erişim kontrolü (S11), saatlik temizlik.
-- SQL editöründe tek seferde çalıştır. Tek transaction.
--
-- 1.2.0 uyumlu: RPC imzaları aynı. Davranış değişiklikleri (olasılık, mesafe,
-- skip, 1 dk gecikme) eski sürüm için de geçerli ve onu bozmaz.
-- Bu dosyadan önce açılmış (swipe_sessions satırı olmayan) oturumlar çalışmaya
-- devam eder; temizlik onları eski yöntemle (satırların en yeni aktivitesi) siler.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1) Ayarlar (K1–K3, K4d). Tek satır; değerler panelden değiştirilebilir.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.swipe_config (
  id boolean primary key default true check (id),
  left_delay_seconds integer not null default 60 check (left_delay_seconds between 0 and 3600),
  tier1_probability numeric not null default 0.75 check (tier1_probability between 0 and 1),
  tier2_probability numeric not null default 0.40 check (tier2_probability between 0 and 1),
  min_gap integer not null default 5 check (min_gap >= 1),
  max_gap integer check (max_gap is null or max_gap >= 1),
  undo_limit integer not null default 10 check (undo_limit between 1 and 100),
  session_ttl interval not null default interval '4 hours',
  updated_at timestamptz not null default now()
);
insert into public.swipe_config (id) values (true) on conflict (id) do nothing;
alter table public.swipe_config enable row level security;  -- sadece RPC'ler okur

-- Uygulamanın tekrar kontrol aralığını sol gecikmesine bağlayabilmesi için.
create or replace function public.swipe_client_config()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object('left_delay_seconds', left_delay_seconds, 'undo_limit', undo_limit)
  from public.swipe_config where id
$$;
revoke all on function public.swipe_client_config() from public, anon;
grant execute on function public.swipe_client_config() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2) Oturum tablosu (K4): aktivite tek satırda. Kuyruk satırları artık
--    her istekte topluca güncellenmez.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.swipe_sessions (
  session_id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  chapter_id uuid,
  unassigned_only boolean not null default false,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
create index if not exists swipe_sessions_user_idx on public.swipe_sessions (user_id);
create index if not exists swipe_sessions_activity_idx on public.swipe_sessions (last_activity_at);
alter table public.swipe_sessions enable row level security;  -- sadece RPC'ler yazar/okur

create or replace function public._touch_swipe_session(p_session_id uuid, p_user_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.swipe_sessions
  set last_activity_at = now()
  where session_id = p_session_id and user_id = p_user_id
$$;
revoke all on function public._touch_swipe_session(uuid, uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3) Oturum açılışı: erişim kontrolü (S11) + kullanıcının diğer açık
--    oturumları silinir (K4b) + oturum satırı.
-- ─────────────────────────────────────────────────────────────
create or replace function public.swipe_session_start(p_deck_id uuid, p_chapter_id uuid default null::uuid, p_unassigned_only boolean default false)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session_id uuid := gen_random_uuid();
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Sadece kendi destesi, paylaşılmış ya da resmi deste
  if not exists (
    select 1 from public.decks d
    where d.id = p_deck_id
      and (d.user_id = v_user_id or d.is_shared = true or d.is_admin_created = true)
  ) then
    raise exception 'Deck not accessible';
  end if;

  -- Tek açık oturum: önceki oturumların satırları gider
  delete from public.swipe_session_undo_stack where user_id = v_user_id;
  delete from public.swipe_session_queue where user_id = v_user_id;
  delete from public.swipe_sessions where user_id = v_user_id;

  insert into public.swipe_sessions (session_id, user_id, deck_id, chapter_id, unassigned_only)
  values (v_session_id, v_user_id, p_deck_id, p_chapter_id, coalesce(p_unassigned_only, false));

  insert into public.swipe_session_queue (
    session_id, user_id, card_id, sort_key, probability_tier,
    hide_for_rest_of_session, tier2_decision_applied, tier2_move, last_activity_at
  )
  select
    v_session_id,
    v_user_id,
    eligible.card_id,
    row_number() over (order by eligible.random_order) * 1000,
    0, false, false, null, now()
  from (
    select c.id as card_id, random() as random_order
    from public.cards c
    left join public.user_card_progress ucp
      on ucp.card_id = c.id and ucp.user_id = v_user_id
    where c.deck_id = p_deck_id
      and (
        case
          when p_chapter_id is not null then c.chapter_id = p_chapter_id
          when p_unassigned_only then c.chapter_id is null
          else true
        end
      )
      and (
        ucp.id is null
        or (ucp.status != 'learned' and ucp.next_review <= now())
      )
  ) eligible;

  return v_session_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4) Sonraki kartlar + tekrarlar.
--    - Toplu last_activity_at güncellemesi yok; oturum satırı güncellenir.
--    - Her tier (1 ve 2) kendi zarını bir kez atar: tier1 %75, tier2 %40
--      (config). Gelmeyen kart oturumun kalanında gizlenir. Tier 3 gelmez.
--      tier2_decision_applied kolonu artık "bu tier için zar atıldı" demek;
--      her sol kaydırmada sıfırlanır (record_swipe).
--    - Konum: aktif karttan sonra en az min_gap kart (gizli/tier3 sayılmaz),
--      max_gap null ise üst sınır yok; yeterli kart yoksa en sona.
-- ─────────────────────────────────────────────────────────────
create or replace function public.swipe_session_next_cards(
  p_session_id uuid,
  p_after_sort_key numeric default null::numeric,
  p_after_queue_id bigint default null::bigint,
  p_current_sort_key numeric default null::numeric,
  p_current_queue_id bigint default null::bigint,
  p_limit integer default 50
)
returns table(queue_id bigint, sort_key numeric, card_id uuid, question text, answer text, image text, example text, note text, chapter_id uuid, status text, next_review timestamp with time zone)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_sort_key numeric := coalesce(p_current_sort_key, 0);
  v_cfg public.swipe_config%rowtype;
  r record;
  v_prob numeric;
  v_prev_sort_key numeric;
  v_prev_queue_id bigint;
  v_next_sort_key numeric;
  v_new_sort_key numeric;
  v_reinserted_queue_ids bigint[] := '{}';
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_cfg from public.swipe_config where id;
  perform public._touch_swipe_session(p_session_id, v_user_id);

  for r in
    select q.id, q.probability_tier
    from public.swipe_session_queue q
    join public.user_card_progress ucp
      on ucp.card_id = q.card_id and ucp.user_id = v_user_id
    where q.session_id = p_session_id
      and q.user_id = v_user_id
      and p_current_sort_key is not null
      and q.hide_for_rest_of_session = false
      and q.tier2_decision_applied = false
      and q.probability_tier in (1, 2)
      and ucp.status != 'learned'
      and ucp.next_review <= now()
      and (
        q.sort_key < v_current_sort_key
        or (q.sort_key = v_current_sort_key and q.id <= coalesce(p_current_queue_id, 0))
      )
  loop
    v_prob := case when r.probability_tier = 1 then v_cfg.tier1_probability else v_cfg.tier2_probability end;

    if random() >= v_prob then
      update public.swipe_session_queue q
      set hide_for_rest_of_session = true,
          tier2_decision_applied = true,
          tier2_move = false,
          last_activity_at = now()
      where q.id = r.id and q.user_id = v_user_id;
      continue;
    end if;

    v_prev_sort_key := null;
    v_prev_queue_id := null;
    v_next_sort_key := null;

    -- Aktif kartın ilerisindeki görünür kartlar; k = aradaki kart sayısı - 1
    select base.sort_key, base.id
    into v_prev_sort_key, v_prev_queue_id
    from (
      select q2.sort_key, q2.id,
             row_number() over (order by q2.sort_key, q2.id) - 1 as k
      from public.swipe_session_queue q2
      where q2.session_id = p_session_id
        and q2.user_id = v_user_id
        and q2.id <> r.id
        and q2.hide_for_rest_of_session = false
        and q2.probability_tier < 3
        and (
          q2.sort_key > v_current_sort_key
          or (q2.sort_key = v_current_sort_key and q2.id > coalesce(p_current_queue_id, 0))
        )
    ) base
    where base.k >= v_cfg.min_gap - 1
      and (v_cfg.max_gap is null or base.k <= v_cfg.max_gap - 1)
    order by random()
    limit 1;

    if v_prev_sort_key is null then
      select coalesce(max(q.sort_key), 0) + 1000
      into v_new_sort_key
      from public.swipe_session_queue q
      where q.session_id = p_session_id and q.user_id = v_user_id;
    else
      select q3.sort_key
      into v_next_sort_key
      from public.swipe_session_queue q3
      where q3.session_id = p_session_id
        and q3.user_id = v_user_id
        and q3.id <> r.id
        and (q3.sort_key > v_prev_sort_key or (q3.sort_key = v_prev_sort_key and q3.id > v_prev_queue_id))
      order by q3.sort_key asc, q3.id asc
      limit 1;

      v_new_sort_key := case
        when v_next_sort_key is null then v_prev_sort_key + 1000
        else (v_prev_sort_key + v_next_sort_key) / 2
      end;
    end if;

    update public.swipe_session_queue q
    set sort_key = v_new_sort_key,
        tier2_decision_applied = true,
        tier2_move = true,
        last_activity_at = now()
    where q.id = r.id and q.user_id = v_user_id;

    v_reinserted_queue_ids := array_append(v_reinserted_queue_ids, r.id);
  end loop;

  return query
  with visible_cards as (
    select
      q.id as queue_id,
      q.sort_key,
      c.id as card_id,
      c.question,
      c.answer,
      c.image,
      c.example,
      c.note,
      c.chapter_id,
      coalesce(ucp.status, 'new') as status,
      ucp.next_review
    from public.swipe_session_queue q
    join public.cards c on c.id = q.card_id
    left join public.user_card_progress ucp
      on ucp.card_id = c.id and ucp.user_id = v_user_id
    where q.session_id = p_session_id
      and q.user_id = v_user_id
      and q.hide_for_rest_of_session = false
      and q.probability_tier < 3
      and (ucp.id is null or (ucp.status != 'learned' and ucp.next_review <= now()))
      and (
        q.id = any(v_reinserted_queue_ids)
        or p_after_sort_key is null
        or q.sort_key > p_after_sort_key
        or (q.sort_key = p_after_sort_key and q.id > coalesce(p_after_queue_id, 0))
      )
  )
  select vc.queue_id, vc.sort_key, vc.card_id, vc.question, vc.answer, vc.image,
         vc.example, vc.note, vc.chapter_id, vc.status, vc.next_review
  from visible_cards vc
  order by vc.sort_key asc, vc.queue_id asc
  limit p_limit;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5) Swipe kaydı.
--    - Sol: gecikme config'ten (60 sn); tier +1; zar bayrağı sıfırlanır.
--    - Skip: 1–10080 dk; kart oturumun kalanında gelmez (K: "10dk = bu oturumda
--      bir daha gösterme"). Undo gizlemeyi de geri alır (snapshot).
--    - Undo yığını oturum başına son undo_limit (10) kayıtla sınırlı.
-- ─────────────────────────────────────────────────────────────
create or replace function public.swipe_session_record_swipe(p_session_id uuid, p_card_id uuid, p_direction text, p_skip_minutes integer default null::integer)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_cfg public.swipe_config%rowtype;
  v_progress public.user_card_progress%rowtype;
  v_queue public.swipe_session_queue%rowtype;
  v_next_review timestamptz;
  v_day date;
  v_learned integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_direction not in ('left', 'right', 'skip') then
    raise exception 'Invalid direction';
  end if;
  if p_direction = 'skip' and (p_skip_minutes is null or p_skip_minutes < 1 or p_skip_minutes > 10080) then
    raise exception 'Skip minutes must be between 1 and 10080';
  end if;

  select * into v_cfg from public.swipe_config where id;

  select * into v_queue
  from public.swipe_session_queue
  where session_id = p_session_id and user_id = v_user_id and card_id = p_card_id
  limit 1;
  if not found then
    raise exception 'Queue item not found';
  end if;

  select * into v_progress
  from public.user_card_progress
  where user_id = v_user_id and card_id = p_card_id
  limit 1;

  v_day := public._activity_today(v_user_id);
  v_learned := case
    when p_direction = 'right' and coalesce(v_progress.status, '') <> 'learned' then 1
    else 0
  end;

  insert into public.swipe_session_undo_stack (session_id, user_id, snapshot)
  values (
    p_session_id,
    v_user_id,
    jsonb_build_object(
      'type', 'record_swipe',
      'card_id', p_card_id,
      'direction', p_direction,
      'prev_user_card_progress', to_jsonb(v_progress),
      'prev_queue_row', jsonb_build_object(
        'sort_key', v_queue.sort_key,
        'probability_tier', v_queue.probability_tier,
        'hide_for_rest_of_session', v_queue.hide_for_rest_of_session,
        'tier2_decision_applied', v_queue.tier2_decision_applied,
        'tier2_move', v_queue.tier2_move
      ),
      'activity_day', v_day,
      'activity_learned', v_learned
    )
  );

  -- Undo sınırı: bu oturumda en yeni undo_limit kayıt kalır
  delete from public.swipe_session_undo_stack u
  where u.session_id = p_session_id
    and u.user_id = v_user_id
    and u.id not in (
      select u2.id from public.swipe_session_undo_stack u2
      where u2.session_id = p_session_id and u2.user_id = v_user_id
      order by u2.id desc
      limit v_cfg.undo_limit
    );

  if p_direction = 'left' then
    v_next_review := now() + make_interval(secs => v_cfg.left_delay_seconds);

    insert into public.user_card_progress (user_id, card_id, status, next_review)
    values (v_user_id, p_card_id, 'learning', v_next_review)
    on conflict (user_id, card_id)
    do update set status = 'learning', next_review = excluded.next_review;

    update public.swipe_session_queue
    set probability_tier = least(probability_tier + 1, 3),
        tier2_decision_applied = false,
        tier2_move = null,
        last_activity_at = now()
    where id = v_queue.id;

  elsif p_direction = 'right' then
    insert into public.user_card_progress (user_id, card_id, status, next_review)
    values (v_user_id, p_card_id, 'learned', null)
    on conflict (user_id, card_id)
    do update set status = 'learned', next_review = null;

    delete from public.swipe_session_queue where id = v_queue.id;

  else -- skip
    v_next_review := now() + make_interval(mins => p_skip_minutes);

    insert into public.user_card_progress (user_id, card_id, status, next_review)
    values (v_user_id, p_card_id, 'learning', v_next_review)
    on conflict (user_id, card_id)
    do update set next_review = excluded.next_review;

    update public.swipe_session_queue
    set hide_for_rest_of_session = true,
        last_activity_at = now()
    where id = v_queue.id;
  end if;

  perform public._touch_swipe_session(p_session_id, v_user_id);
  perform public._bump_daily_activity(v_user_id, v_day, 1, v_learned);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6) Bitiş: oturum satırı da silinir.
-- ─────────────────────────────────────────────────────────────
create or replace function public.swipe_session_end(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  delete from public.swipe_session_undo_stack where session_id = p_session_id and user_id = v_user_id;
  delete from public.swipe_session_queue where session_id = p_session_id and user_id = v_user_id;
  delete from public.swipe_sessions where session_id = p_session_id and user_id = v_user_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 7) Temizlik: session_ttl (4 saat) hareketsiz oturumlar.
--    Yeni oturumlar swipe_sessions'tan, eski (satırı olmayan) oturumlar kuyruk
--    satırlarının en yeni aktivitesinden bulunur.
-- ─────────────────────────────────────────────────────────────
create or replace function public.swipe_session_cleanup_expired()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ttl interval;
  v_ids uuid[];
  v_deleted integer := 0;
begin
  select session_ttl into v_ttl from public.swipe_config where id;

  select array_agg(session_id) into v_ids
  from (
    select s.session_id
    from public.swipe_sessions s
    where s.last_activity_at < now() - v_ttl
    union
    select q.session_id
    from public.swipe_session_queue q
    where not exists (select 1 from public.swipe_sessions s where s.session_id = q.session_id)
    group by q.session_id
    having max(q.last_activity_at) < now() - v_ttl
    union
    select u.session_id
    from public.swipe_session_undo_stack u
    where not exists (select 1 from public.swipe_sessions s where s.session_id = u.session_id)
      and not exists (select 1 from public.swipe_session_queue q where q.session_id = u.session_id)
    group by u.session_id
    having max(u.created_at) < now() - v_ttl
  ) expired;

  if v_ids is null then
    return 0;
  end if;

  delete from public.swipe_session_undo_stack where session_id = any(v_ids);
  delete from public.swipe_session_queue where session_id = any(v_ids);
  get diagnostics v_deleted = row_count;
  delete from public.swipe_sessions where session_id = any(v_ids);
  return v_deleted;
end;
$$;

revoke all on function public.swipe_session_cleanup_expired() from public, anon, authenticated;

-- Saatlik temizlik işi (pg_cron zaten kurulu)
select cron.unschedule('swipe-session-cleanup-hourly')
where exists (select 1 from cron.job where jobname = 'swipe-session-cleanup-hourly');
select cron.schedule('swipe-session-cleanup-hourly', '7 * * * *', $cmd$select public.swipe_session_cleanup_expired();$cmd$);

commit;

-- KONTROL:
-- select * from public.swipe_config;
-- select jobname, schedule from cron.job;
-- select count(*) from public.swipe_session_queue;  -- ilk temizlikten sonra düşmeli
