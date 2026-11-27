-- Faz 3 (2. kısım) — B12 atomik deste yazımı, B7'nin kalan yerleri (ilerleme
-- sayıları), "Çalıştığım Desteler" listesi sunucuda.
-- SQL editöründe tek seferde çalıştır. Sadece yeni fonksiyon ve index ekler,
-- mevcut hiçbir şeyi değiştirmez (1.2.0 etkilenmez).

begin;

-- ─────────────────────────────────────────────────────────────
-- B12: deste + dilleri tek transaction'da. p_deck_id null → yeni deste,
-- dolu → güncelleme. Hata olursa hiçbir şey yazılmaz (deste dilsiz kalmaz).
-- p_language_ids sırası taraf demek: [ön, arka]; en fazla 2.
-- SECURITY INVOKER: decks ve decks_languages kullanıcının kendi RLS'iyle yazılır.
-- ─────────────────────────────────────────────────────────────
create or replace function public.save_deck(
  p_deck_id uuid,
  p_name text,
  p_to_name text default null,
  p_description text default null,
  p_category_id uuid default null,
  p_language_ids uuid[] default null
)
returns uuid
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'name required' using errcode = '22023';
  end if;

  if p_deck_id is null then
    insert into public.decks (user_id, name, to_name, description, category_id,
                              is_shared, is_admin_created, card_count, is_started)
    values (auth.uid(), btrim(p_name), nullif(btrim(coalesce(p_to_name, '')), ''),
            nullif(btrim(coalesce(p_description, '')), ''), p_category_id,
            false, false, 0, false)
    returning id into v_id;
  else
    update public.decks
       set name = btrim(p_name),
           to_name = nullif(btrim(coalesce(p_to_name, '')), ''),
           description = nullif(btrim(coalesce(p_description, '')), ''),
           category_id = p_category_id,
           updated_at = now()
     where id = p_deck_id
    returning id into v_id;
    if v_id is null then
      raise exception 'deck not found' using errcode = 'P0002';
    end if;
    delete from public.decks_languages where deck_id = v_id;
  end if;

  if p_language_ids is not null and cardinality(p_language_ids) > 0 then
    insert into public.decks_languages (deck_id, language_id, side)
    select v_id, l.language_id, case when l.ord = 1 then 'front' else 'back' end
    from unnest(p_language_ids[1:2]) with ordinality as l(language_id, ord);
  end if;

  return v_id;
end;
$$;

revoke all on function public.save_deck(uuid, text, text, text, uuid, uuid[]) from public, anon;
grant execute on function public.save_deck(uuid, text, text, text, uuid, uuid[]) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- B7: deste / bölüm ilerleme sayıları tek istekte. Raporlanan kartlar
-- NOT EXISTS ile çıkarılır (eskiden uzun NOT IN URL'si + 3 ayrı sayım).
--   p_scope: 'deck' | 'chapter' (p_chapter_id) | 'unassigned'
-- ─────────────────────────────────────────────────────────────
create or replace function public.card_progress_counts(
  p_deck_id uuid,
  p_scope text default 'deck',
  p_chapter_id uuid default null
)
returns table (total integer, learned integer, learning integer)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select count(*)::int,
         count(*) filter (where ucp.status = 'learned')::int,
         count(*) filter (where ucp.status = 'learning')::int
  from public.cards c
  left join public.user_card_progress ucp
    on ucp.card_id = c.id and ucp.user_id = auth.uid()
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
$$;

revoke all on function public.card_progress_counts(uuid, text, uuid) from public, anon;
grant execute on function public.card_progress_counts(uuid, text, uuid) to authenticated;

-- Bölümün gelecekteki tekrarları: en yakın zaman (+ o anki kart sayısı) ve en uzak zaman.
create or replace function public.chapter_future_reviews(
  p_deck_id uuid,
  p_chapter_id uuid
)
returns table (nearest_at timestamptz, nearest_count integer, farthest_at timestamptz)
language sql
stable
security invoker
set search_path to 'public'
as $$
  with r as (
    select ucp.next_review
    from public.user_card_progress ucp
    join public.cards c on c.id = ucp.card_id
    where ucp.user_id = auth.uid()
      and ucp.status <> 'learned'
      and ucp.next_review > now()
      and c.deck_id = p_deck_id
      and c.chapter_id = p_chapter_id
      and not exists (
        select 1 from public.reports rp
        where rp.reporter_id = auth.uid() and rp.report_type = 'card' and rp.target_id = c.id
      )
  )
  select min(next_review),
         (select count(*)::int from r r2 where r2.next_review = (select min(next_review) from r)),
         max(next_review)
  from r
  having count(*) > 0
$$;

revoke all on function public.chapter_future_reviews(uuid, uuid) from public, anon;
grant execute on function public.chapter_future_reviews(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- "Çalıştığım Desteler": en son çalışılan üstte, engellenen kullanıcı ve
-- gizlenen deste hariç; arama, kategori, dil, sadece favori, A–Z sunucuda.
-- Satır list_decks ile aynı şekil + last_started_at, learned_count,
-- total_count (filtre sonrası toplam).
-- ─────────────────────────────────────────────────────────────
create index if not exists decks_stats_user_deck_started_idx
  on public.decks_stats (user_id, deck_id, started_at);

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
    case when p_sort = 'az' then public.norm_search((x.d).name) end asc nulls last,
    (x.st).last_started_at desc nulls last,
    (x.d).id desc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(coalesce(p_limit, 500), 500)
$$;

revoke all on function public.list_in_progress_decks(text, text, integer[], uuid[], boolean, integer, integer) from public, anon;
grant execute on function public.list_in_progress_decks(text, text, integer[], uuid[], boolean, integer, integer) to authenticated;

commit;

-- KONTROL:
-- select * from public.list_in_progress_decks(null, 'default', null, null, false, 0, 10);
-- select * from public.card_progress_counts('<deck-id>', 'deck', null);
