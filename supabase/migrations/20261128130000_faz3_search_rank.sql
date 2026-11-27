-- Faz 3 — arama sıralaması. Aramada en iyi eşleşmeler üstte: önce
-- başlığı (kart: soru, deste: ad) aranan metinle BAŞLAYANLAR, sonra başlığında
-- aranan metinle başlayan bir KELİME olanlar, sonra başlığın içinde geçenler,
-- en son sadece cevapta / ikinci adda geçenler. Aynı gruptakiler eskisi gibi
-- (seçili sıralama, sonra en yeni). Arama yokken sıra değişmez.
-- Örnek: "ye" → "yell" (başlıyor) "recommendation"dan (içinde geçiyor) önce.
-- SQL editöründe tek seferde çalıştır. list_cards, list_favorite_cards,
-- list_decks ve list_in_progress_decks aynı imzayla yeniden tanımlanır.

begin;

-- 0 = başlık aranan metinle başlıyor, 1 = başlıkta bir kelime onunla başlıyor,
-- 2 = başlığın içinde geçiyor, 3 = ikinci metin onunla / bir kelimesi onunla
-- başlıyor, 4 = diğer. p_s zaten norm_search'ten geçmiş olmalı.
create or replace function public.search_rank(p_main text, p_other text, p_s text)
returns integer
language sql
immutable
parallel safe
set search_path to 'public'
as $$
  select case
    when p_s is null then 0
    when left(coalesce(public.norm_search(p_main), ''), length(p_s)) = p_s then 0
    when strpos(' ' || coalesce(public.norm_search(p_main), ''), ' ' || p_s) > 0 then 1
    when strpos(coalesce(public.norm_search(p_main), ''), p_s) > 0 then 2
    when left(coalesce(public.norm_search(p_other), ''), length(p_s)) = p_s
      or strpos(' ' || coalesce(public.norm_search(p_other), ''), ' ' || p_s) > 0 then 3
    else 4
  end
$$;

-- ─────────────────────────────────────────────────────────────
-- Deste / bölüm kartları.
--   p_scope : 'deck' (bütün deste) | 'chapter' (p_chapter_id) | 'unassigned'
--   p_filter: null | 'learned' | 'unlearned' | 'fav'
--   p_sort  : 'original' (en yeni üstte) | 'az' (soruya göre)
-- SECURITY INVOKER: kartları, ilerlemeyi ve favorileri kullanıcının kendi
-- RLS'iyle okur; sadece görebildiği kartlar döner.
-- Sıra her zaman (…, created_at desc, id desc) ile biter: sayfa sınırları sabit.
-- ─────────────────────────────────────────────────────────────
create or replace function public.list_cards(
  p_deck_id uuid,
  p_scope text default 'deck',
  p_chapter_id uuid default null,
  p_filter text default null,
  p_search text default null,
  p_sort text default 'original',
  p_offset integer default 0,
  p_limit integer default 50
)
returns table (
  id uuid,
  question text,
  answer text,
  created_at timestamptz,
  image text,
  chapter_id uuid,
  status text,
  is_favorite boolean
)
language sql
stable
security invoker
set search_path to 'public'
as $$
  with q as (select public.norm_search(p_search) as s)
  select c.id, c.question, c.answer, c.created_at, c.image, c.chapter_id,
         coalesce(ucp.status, 'new') as status,
         (fc.card_id is not null) as is_favorite
  from public.cards c
  cross join q
  left join public.user_card_progress ucp
    on ucp.card_id = c.id and ucp.user_id = auth.uid()
  left join public.favorite_cards fc
    on fc.card_id = c.id and fc.user_id = auth.uid()
  where c.deck_id = p_deck_id
    and (
      p_scope = 'deck'
      or (p_scope = 'chapter' and c.chapter_id = p_chapter_id)
      or (p_scope = 'unassigned' and c.chapter_id is null)
    )
    and not exists (
      select 1 from public.reports r
      where r.reporter_id = auth.uid() and r.report_type = 'card' and r.target_id = c.id
    )
    and (
      p_filter is null
      or (p_filter = 'learned' and ucp.status = 'learned')
      or (p_filter = 'unlearned' and coalesce(ucp.status, 'new') <> 'learned')
      or (p_filter = 'fav' and fc.card_id is not null)
    )
    and (
      q.s is null
      or strpos(public.norm_search(coalesce(c.question, '') || ' ' || coalesce(c.answer, '')), q.s) > 0
    )
  order by
    public.search_rank(c.question, c.answer, q.s),
    case when p_sort = 'az' then public.norm_search(c.question) end asc nulls last,
    c.created_at desc,
    c.id desc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

revoke all on function public.list_cards(uuid, text, uuid, text, text, text, integer, integer) from public, anon;
grant execute on function public.list_cards(uuid, text, uuid, text, text, text, integer, integer) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Favori kartlar (bütün desteler). Varsayılan sıra: en son favorilenen üstte.
--   p_filter: null | 'learned' | 'unlearned'
--   p_sort  : 'original' | 'az'
-- Kartı artık görülemeyen (silinmiş/paylaşımdan kalkmış) favoriler dönmez
-- (eski "hayalet" satırlar).
-- ─────────────────────────────────────────────────────────────
create or replace function public.list_favorite_cards(
  p_filter text default null,
  p_search text default null,
  p_sort text default 'original',
  p_offset integer default 0,
  p_limit integer default 50
)
returns table (
  id uuid,
  question text,
  answer text,
  created_at timestamptz,
  image text,
  favorited_at timestamptz,
  status text,
  deck_id uuid,
  deck_name text,
  deck_to_name text,
  deck_user_id uuid,
  category_id uuid,
  category_name text,
  category_sort_order integer
)
language sql
stable
security invoker
set search_path to 'public'
as $$
  with q as (select public.norm_search(p_search) as s)
  select c.id, c.question, c.answer, c.created_at, c.image,
         fc.created_at as favorited_at,
         coalesce(ucp.status, 'new') as status,
         d.id, d.name, d.to_name, d.user_id,
         cat.id, cat.name, cat.sort_order
  from public.favorite_cards fc
  cross join q
  join public.cards c on c.id = fc.card_id
  join public.decks d on d.id = c.deck_id
  left join public.categories cat on cat.id = d.category_id
  left join public.user_card_progress ucp
    on ucp.card_id = c.id and ucp.user_id = auth.uid()
  where fc.user_id = auth.uid()
    and not exists (
      select 1 from public.reports r
      where r.reporter_id = auth.uid() and r.report_type = 'card' and r.target_id = c.id
    )
    and (
      p_filter is null
      or (p_filter = 'learned' and ucp.status = 'learned')
      or (p_filter = 'unlearned' and coalesce(ucp.status, 'new') <> 'learned')
    )
    and (
      q.s is null
      or strpos(public.norm_search(coalesce(c.question, '') || ' ' || coalesce(c.answer, '')), q.s) > 0
    )
  order by
    public.search_rank(c.question, c.answer, q.s),
    case when p_sort = 'az' then public.norm_search(c.question) end asc nulls last,
    fc.created_at desc,
    c.id desc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

revoke all on function public.list_favorite_cards(text, text, text, integer, integer) from public, anon;
grant execute on function public.list_favorite_cards(text, text, text, integer, integer) to authenticated;


-- p_category: 'myDecks' | 'defaultDecks' | 'communityDecks' | 'favorites'
-- p_sort    : 'default' | 'az'  ('popularity' = default)
-- p_limit null = sınırsız (en fazla 500)
-- Satır, uygulamanın kullandığı deste nesnesiyle aynı şekilde jsonb döner.
create or replace function public.list_decks(
  p_category text,
  p_search text default null,
  p_sort text default 'default',
  p_category_sort_orders integer[] default null,
  p_language_ids uuid[] default null,
  p_favorites_only boolean default false,
  p_offset integer default 0,
  p_limit integer default null
)
returns setof jsonb
language sql
stable
security invoker
set search_path to 'public'
as $$
  with q as (select public.norm_search(p_search) as s, auth.uid() as uid)
  select jsonb_build_object(
    'id', d.id,
    'name', d.name,
    'to_name', d.to_name,
    'description', d.description,
    'card_count', d.card_count,
    'user_id', d.user_id,
    'category_id', d.category_id,
    'is_shared', d.is_shared,
    'is_admin_created', d.is_admin_created,
    'shared_at', d.shared_at,
    'updated_at', d.updated_at,
    'created_at', d.created_at,
    'profiles', (select jsonb_build_object('username', p.username, 'image_url', p.image_url)
                 from public.profiles p where p.id = d.user_id),
    'categories', case when cat.id is null then null
                       else jsonb_build_object('id', cat.id, 'name', cat.name, 'sort_order', cat.sort_order) end,
    'decks_languages', coalesce((select jsonb_agg(jsonb_build_object('language_id', dl.language_id))
                                 from public.decks_languages dl where dl.deck_id = d.id), '[]'::jsonb),
    'chapter_count', (select count(*) from public.chapters ch where ch.deck_id = d.id),
    'is_favorite', fd.deck_id is not null,
    'favorited_at', fd.created_at
  )
  from public.decks d
  cross join q
  left join public.categories cat on cat.id = d.category_id
  left join public.favorite_decks fd on fd.deck_id = d.id and fd.user_id = q.uid
  where
    case p_category
      when 'myDecks' then d.user_id = q.uid and d.is_admin_created = false
      when 'defaultDecks' then d.is_admin_created = true
      when 'communityDecks' then d.is_shared = true and d.is_admin_created = false
      when 'favorites' then fd.deck_id is not null
      else false
    end
    -- engellenen kullanıcıların ve gizlenen destelerin desteleri (kendi destelerin hariç)
    and (
      p_category = 'myDecks'
      or (
        not exists (select 1 from public.blocked_users b where b.blocker_id = q.uid and b.blocked_id = d.user_id)
        and not exists (select 1 from public.user_hidden_decks h where h.user_id = q.uid and h.deck_id = d.id)
      )
    )
    and (not coalesce(p_favorites_only, false) or fd.deck_id is not null)
    and (
      p_category_sort_orders is null or cardinality(p_category_sort_orders) = 0
      or cat.sort_order = any(p_category_sort_orders)
    )
    and (
      p_language_ids is null or cardinality(p_language_ids) = 0
      or exists (select 1 from public.decks_languages dl2 where dl2.deck_id = d.id and dl2.language_id = any(p_language_ids))
    )
    and (
      q.s is null
      or strpos(public.norm_search(coalesce(d.name, '') || ' ' || coalesce(d.to_name, '')), q.s) > 0
    )
  order by
    public.search_rank(d.name, d.to_name, q.s),
    case when p_sort = 'az' then public.norm_search(d.name) end asc nulls last,
    case p_category
      when 'communityDecks' then d.shared_at
      when 'favorites' then fd.created_at
      else d.updated_at
    end desc nulls last,
    d.id desc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(coalesce(p_limit, 500), 500)
$$;

revoke all on function public.list_decks(text, text, text, integer[], uuid[], boolean, integer, integer) from public, anon;
grant execute on function public.list_decks(text, text, text, integer[], uuid[], boolean, integer, integer) to authenticated;


create or replace function public.list_in_progress_decks(
  p_search text default null,
  p_sort text default 'default',
  p_category_sort_orders integer[] default null,
  p_language_ids uuid[] default null,
  p_favorites_only boolean default false,
  p_offset integer default 0,
  p_limit integer default null
)
returns setof jsonb
language sql
stable
security invoker
set search_path to 'public'
as $$
  with q as (select public.norm_search(p_search) as s, auth.uid() as uid),
  started as (
    select ds.deck_id, max(ds.started_at) as last_started_at
    from public.decks_stats ds, q
    where ds.user_id = q.uid
    group by ds.deck_id
  ),
  picked as (
    select d, cat, fd, st,
           count(*) over () as total_count
    from started st
    cross join q
    join public.decks d on d.id = st.deck_id
    left join public.categories cat on cat.id = d.category_id
    left join public.favorite_decks fd on fd.deck_id = d.id and fd.user_id = q.uid
    where not exists (select 1 from public.blocked_users b where b.blocker_id = q.uid and b.blocked_id = d.user_id)
      and not exists (select 1 from public.user_hidden_decks h where h.user_id = q.uid and h.deck_id = d.id)
      and (not coalesce(p_favorites_only, false) or fd.deck_id is not null)
      and (
        p_category_sort_orders is null or cardinality(p_category_sort_orders) = 0
        or cat.sort_order = any(p_category_sort_orders)
      )
      and (
        p_language_ids is null or cardinality(p_language_ids) = 0
        or exists (select 1 from public.decks_languages dl2 where dl2.deck_id = d.id and dl2.language_id = any(p_language_ids))
      )
      and (
        q.s is null
        or strpos(public.norm_search(coalesce(d.name, '') || ' ' || coalesce(d.to_name, '')), q.s) > 0
      )
  )
  select jsonb_build_object(
    'id', (x.d).id,
    'name', (x.d).name,
    'to_name', (x.d).to_name,
    'description', (x.d).description,
    'card_count', (x.d).card_count,
    'user_id', (x.d).user_id,
    'category_id', (x.d).category_id,
    'is_shared', (x.d).is_shared,
    'is_admin_created', (x.d).is_admin_created,
    'shared_at', (x.d).shared_at,
    'updated_at', (x.d).updated_at,
    'created_at', (x.d).created_at,
    'profiles', (select jsonb_build_object('username', p.username, 'image_url', p.image_url)
                 from public.profiles p where p.id = (x.d).user_id),
    'categories', case when (x.cat).id is null then null
                       else jsonb_build_object('id', (x.cat).id, 'name', (x.cat).name, 'sort_order', (x.cat).sort_order) end,
    'decks_languages', coalesce((select jsonb_agg(jsonb_build_object('language_id', dl.language_id))
                                 from public.decks_languages dl where dl.deck_id = (x.d).id), '[]'::jsonb),
    'chapter_count', (select count(*) from public.chapters ch where ch.deck_id = (x.d).id),
    'is_favorite', (x.fd).deck_id is not null,
    'favorited_at', (x.fd).created_at,
    'last_started_at', (x.st).last_started_at,
    'learned_count', (select count(*) from public.user_card_progress ucp
                      join public.cards c on c.id = ucp.card_id
                      where ucp.user_id = auth.uid() and ucp.status = 'learned' and c.deck_id = (x.d).id),
    'total_count', x.total_count
  )
  from picked x
  order by
    public.search_rank((x.d).name, (x.d).to_name, public.norm_search(p_search)),
    case when p_sort = 'az' then public.norm_search((x.d).name) end asc nulls last,
    (x.st).last_started_at desc nulls last,
    (x.d).id desc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(coalesce(p_limit, 500), 500)
$$;

revoke all on function public.list_in_progress_decks(text, text, integer[], uuid[], boolean, integer, integer) from public, anon;
grant execute on function public.list_in_progress_decks(text, text, integer[], uuid[], boolean, integer, integer) to authenticated;

commit;
