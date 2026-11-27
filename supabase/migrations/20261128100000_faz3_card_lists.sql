-- Faz 3.2 + 3.3 — kart listeleri sunucuda: raporlanan kartlar, öğrenildi /
-- öğrenilmedi / favori filtresi ve arama sayfalamadan ÖNCE uygulanır (B5, B7).
-- Arama Türkçe harf eşitlemeli (K8): büyük/küçük harf farkı yok, İ/I/ı/i aynı.
-- SQL editöründe tek seferde çalıştır. Yeni fonksiyonlar ekler, mevcut hiçbir
-- şeyi değiştirmez (1.2.0 etkilenmez).

begin;

-- Arama metnini normalleştirir: trim, İ/I/ı → i, küçük harf. Boşsa null.
create or replace function public.norm_search(p text)
returns text
language sql
immutable
parallel safe
set search_path to 'public'
as $$
  select nullif(lower(translate(btrim(coalesce(p, '')), 'İIı', 'iii')), '')
$$;

-- Raporlanan kart filtresi için (NOT EXISTS hızlı kalsın)
create index if not exists reports_reporter_type_target_idx
  on public.reports (reporter_id, report_type, target_id);

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
    case when p_sort = 'az' then public.norm_search(c.question) end asc nulls last,
    fc.created_at desc,
    c.id desc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

revoke all on function public.list_favorite_cards(text, text, text, integer, integer) from public, anon;
grant execute on function public.list_favorite_cards(text, text, text, integer, integer) to authenticated;

commit;

-- KONTROL (kendi destelerinden birinin id'siyle):
-- select * from public.list_cards('<deck-id>', 'deck', null, null, 'istanbul');
