-- Faz 3.2 + 3.3 + B10 — deste listeleri sunucuda: engellenen kullanıcıların ve
-- gizlenen destelerin çıkarılması, kategori/dil/favori filtresi, arama ve A–Z
-- sıralaması sayfalamadan ÖNCE uygulanır. Eskiden bunlar sayfadan sonra
-- yapıldığı için sayfalar eksik geliyor ve A–Z sadece sayfa içinde sıralıyordu.
-- SQL editöründe tek seferde çalıştır. Yeni fonksiyon ekler, mevcut hiçbir
-- şeyi değiştirmez (1.2.0 etkilenmez). norm_search 20261128100000'de.

begin;

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

commit;

-- KONTROL:
-- select * from public.list_decks('myDecks', null, 'default', null, null, false, 0, 20);
