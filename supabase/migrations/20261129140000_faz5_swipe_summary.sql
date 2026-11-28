-- Faz 5.8 — swipe oturum sonu özeti tek istekte. Eskiden client oturumun
-- kart listesini çekip uzun bir .in() ile ilerlemeyi ayrıca soruyordu.
-- SQL editöründe tek seferde çalıştır. Yeni fonksiyon ekler, mevcut hiçbir
-- şeyi değiştirmez.
--
-- studied  : oturumdaki farklı kart sayısı
-- learned  : bunlardan şu an "öğrenildi" olanlar (oturumda sağa atılanlar)
-- learning : "öğreniliyor" olanlar (sola atılan, tekrar planlanan)
-- next_review_at / next_review_count : bu kartların en yakın tekrarı

begin;

create or replace function public.swipe_session_summary(p_session_id uuid)
returns table (
  studied integer,
  learned integer,
  learning integer,
  next_review_at timestamptz,
  next_review_count integer
)
language sql
stable
security invoker
set search_path to 'public'
as $$
  with cards as (
    select distinct q.card_id
    from public.swipe_session_queue q
    where q.session_id = p_session_id and q.user_id = auth.uid()
  ),
  prog as (
    select u.status, u.next_review
    from cards c
    left join public.user_card_progress u on u.card_id = c.card_id and u.user_id = auth.uid()
  ),
  nxt as (
    select min(next_review) as at from prog
    where status = 'learning' and next_review > now()
  )
  select (select count(*)::int from cards),
         (select count(*)::int from prog where status = 'learned'),
         (select count(*)::int from prog where status = 'learning'),
         (select at from nxt),
         (select count(*)::int from prog, nxt where prog.status = 'learning' and prog.next_review = nxt.at)
$$;

revoke all on function public.swipe_session_summary(uuid) from public, anon;
grant execute on function public.swipe_session_summary(uuid) to authenticated;

commit;
