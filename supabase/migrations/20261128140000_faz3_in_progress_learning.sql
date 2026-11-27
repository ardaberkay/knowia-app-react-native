-- Faz 3 — "Çalıştığım Desteler" satırında öğrenildi / öğreniliyor / toplam,
-- DeckDetail ile AYNI hesapla (raporlanan kartlar hariç; eskiden liste
-- card_count sütununu kullandığı için yüzde detaydan farklı çıkabiliyordu).
-- Listeden açılan DeckDetail bu sayıları ilk karede gösterir.
-- SQL editöründe tek seferde çalıştır. list_in_progress_decks aynı imzayla
-- yeniden tanımlanır (arama sıralaması dahil, 20261128130000 ile aynı).

begin;

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
    -- same counting as DeckDetail (card_progress_counts): reported cards left out
    'progress_total', pc.total,
    'learned_count', pc.learned,
    'learning_count', pc.learning,
    'total_count', x.total_count
  )
  from picked x
  cross join lateral (
    select count(*)::int as total,
           count(*) filter (where ucp.status = 'learned')::int as learned,
           count(*) filter (where ucp.status = 'learning')::int as learning
    from public.cards c
    left join public.user_card_progress ucp on ucp.card_id = c.id and ucp.user_id = auth.uid()
    where c.deck_id = (x.d).id
      and not exists (
        select 1 from public.reports r
        where r.reporter_id = auth.uid() and r.report_type = 'card' and r.target_id = c.id
      )
  ) pc
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
