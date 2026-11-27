import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Personal study reminders (Faz 6). Only the hourly cron may call this: it
// sends `x-cron-secret` (Supabase Vault); the same value is the function
// secret PUSH_CRON_SECRET. Anything else gets 401.
//
// Each run, push_claim_due() picks the users whose local time is 20:xx and
// who should get a reminder today, chooses the kind and the text variant
// (rules in supabase/migrations/20261129120000_faz6_push_rules.sql) and marks
// them as sent. This function only fills in the text and sends it.

const EXPO_BATCH_SIZE = 100; // Expo accepts up to 100 messages per request

type Lang = 'tr' | 'en';
type Row = {
  user_id: string;
  token: string;
  lang: Lang;
  push_type: number;
  variant: number;
  streak: number;
  due_count: number;
  goal_left: number;
  deck_id: string | null;
  deck_name: string | null;
  deck_percent: number | null;
};

// [title, body]. {streak} {due} {left} {deck} {pct} are filled in per user.
// The number of texts per kind must match push_claim_due (4, 4, 5, 4, 7).
// Turkish texts never put a suffix right after a number or a deck name
// (%60'ta / %50'de changes with the number).
const TEXTS: Record<Lang, Record<number, [string, string][]>> = {
  tr: {
    1: [ // streak in danger
      ['🔥 {streak} günlük serin tehlikede', 'Birkaç kart çalış, serin devam etsin.'],
      ['Serini bozma!', '{streak} gündür buradasın. Bugünü de ekle.'],
      ['{streak} gün oldu, bugün de var mısın?', 'Gün bitmeden kısa bir tekrar yeter.'],
      ['Serin bitmek üzere ⏳', '2 dakikalık bir tekrar serini kurtarır.'],
    ],
    2: [ // cards due
      ['{due} kart seni bekliyor', 'Tekrar zamanı geldi.'],
      ['Tekrar vakti 📚', '{due} kartın hazır. İlk durak: {deck}.'],
      ['Hafızanı tazele', '{due} kart tekrarını bekliyor. 5 dakika yeter.'],
      ['Unutmayı yen 🧠', 'Şimdi tekrar edersen {due} kartı bir daha unutmazsın.'],
    ],
    3: [ // daily goal half done
      ['Hedefine {left} kart kaldı', 'Az kaldı, bugünü tamamla.'],
      ['Neredeyse bitti 💪', '{left} kart daha ve günlük hedefin tamam.'],
      ['Bugün iyi başladın', 'Hedefe {left} kart var, bitirelim mi?'],
      ['Son düzlük 🏁', '{left} kartla bugünü kapat.'],
      ['Hayalin büyükse, emeğin de büyük olmalı 💪', 'Bugünkü hedefine {left} kart kaldı.'],
    ],
    4: [ // deck half done
      ['Kaldığın yerden devam et', '{deck} destesinde ilerlemen %{pct}. Biraz daha!'],
      ['Yarıda bırakma 🎯', '{deck} seni bekliyor. İlerleme: %{pct}.'],
      ['Bir adım daha', '{deck} destesinde kaldığın yerden devam et.'],
      ['{deck} 📖', 'İlerlemen %{pct}. Bugün birkaç kart daha ekle.'],
    ],
    5: [ // come back
      ['Kartların seni özledi 👀', 'Kısa bir tekrarla geri dön, kaldığın yer hazır.'],
      ['Bir süredir görüşemedik', '5 dakikan var mı? Bugün birkaç kartla başla.'],
      ['Yeniden başlamak için güzel bir gün ✨', 'Küçük adımlar büyük fark yaratır.'],
      ['Öğrendiklerini unutma', 'Hızlı bir tekrar, bildiklerini taze tutar.'],
      ['Seni bekleyen desteler var', 'Kaldığın yerden devam et ya da yeni bir deste keşfet.'],
      ['Bugünü iyi yaşa ✨', 'Dünün mutlu, yarının umutlu olması bugüne bağlı. Birkaç kartla başla.'],
      ['Hiçbir çiçek vaktinden önce açmaz 🌱', 'Her gün biraz tekrar, gerisi zamanla gelir.'],
    ],
  },
  en: {
    1: [
      ['🔥 Your {streak}-day streak is at risk', 'Study a few cards to keep it going.'],
      ["Don't break your streak!", "You've been here {streak} days in a row. Make it one more."],
      ['{streak} days strong. In for today?', 'A quick review before the day ends is enough.'],
      ['Your streak is about to end ⏳', 'A 2-minute review saves it.'],
    ],
    2: [
      ['{due} cards are waiting for you', "It's time to review."],
      ['Review time 📚', '{due} cards are ready. First stop: {deck}.'],
      ['Refresh your memory', '{due} cards are due. 5 minutes is enough.'],
      ['Beat forgetting 🧠', "Review {due} cards now and they'll stick for good."],
    ],
    3: [
      ['{left} cards to your goal', 'Almost there. Finish today strong.'],
      ['Nearly done 💪', '{left} more cards and your daily goal is complete.'],
      ['Great start today', '{left} cards to go. Shall we finish?'],
      ['Final stretch 🏁', 'Wrap up today with {left} cards.'],
      ['Big dreams take big effort 💪', '{left} cards left for today\'s goal.'],
    ],
    4: [
      ['Pick up where you left off', "You're {pct}% through {deck}. Keep going!"],
      ["Don't stop halfway 🎯", '{deck} is waiting. Progress: {pct}%.'],
      ['One more step', 'Continue {deck} from where you left off.'],
      ['{deck} 📖', "You're at {pct}%. Add a few more cards today."],
    ],
    5: [
      ['Your cards miss you 👀', 'Come back for a quick review. Your spot is saved.'],
      ["It's been a while", 'Got 5 minutes? Start with a few cards today.'],
      ['A great day to start again ✨', 'Small steps make a big difference.'],
      ["Don't forget what you learned", 'A quick review keeps it fresh.'],
      ['Your decks are waiting', 'Continue where you left off or discover a new deck.'],
      ['Make today count ✨', 'A happy yesterday and a hopeful tomorrow start today. Begin with a few cards.'],
      ['No flower blooms before its time 🌱', 'A little review every day; the rest comes with time.'],
    ],
  },
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Constant-time comparison so the secret can't be guessed byte by byte.
function safeEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// New-style secret key when available, legacy service role otherwise.
function adminKey() {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    if (keys?.default) return keys.default as string;
  } catch { /* fall through */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
}

function fill(text: string, row: Row) {
  return text
    .replaceAll('{streak}', String(row.streak ?? 0))
    .replaceAll('{due}', String(row.due_count ?? 0))
    .replaceAll('{left}', String(row.goal_left ?? 0))
    .replaceAll('{pct}', String(row.deck_percent ?? 0))
    .replaceAll('{deck}', row.deck_name ?? '');
}

function messageFor(row: Row) {
  const lang: Lang = row.lang === 'tr' ? 'tr' : 'en';
  const list = TEXTS[lang][row.push_type];
  if (!list?.length) return null;
  const [title, body] = list[(Math.max(1, row.variant) - 1) % list.length];
  // Texts that need a deck name are only chosen when the row has one; guard anyway.
  if ((title + body).includes('{deck}') && !row.deck_name) return null;
  return {
    to: row.token,
    sound: 'default',
    title: fill(title, row),
    body: fill(body, row),
    // No channelId: Android uses the app's 'default' channel (created by the
    // app; older installs without it still get the notification).
    // Read by the app when the notification is tapped (K19):
    // cards / deck reminders open that deck, the others open Home.
    data: { kind: 'study_reminder', type: row.push_type, deckId: row.deck_id ?? null },
  };
}

serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const expected = Deno.env.get('PUSH_CRON_SECRET') ?? '';
  const given = req.headers.get('x-cron-secret') ?? '';
  if (!expected || !safeEqual(given, expected)) return json(401, { error: 'Unauthorized' });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, adminKey());

  const { data, error } = await supabase.rpc('push_claim_due');
  if (error) {
    console.error('push_claim_due failed:', error.message);
    return json(500, { error: 'Query failed' });
  }

  // One message per token, even if a token were on several profiles.
  const seen = new Set<string>();
  const messages = ((data ?? []) as Row[])
    .filter((row) => row.token && !seen.has(row.token) && seen.add(row.token))
    .map(messageFor)
    .filter(Boolean) as NonNullable<ReturnType<typeof messageFor>>[];

  let accepted = 0;
  let failed = 0;
  const deadTokens: string[] = [];
  for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
    const batch = messages.slice(i, i + EXPO_BATCH_SIZE);
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });
      const body = await res.json().catch(() => ({}));
      const tickets: any[] = Array.isArray(body?.data) ? body.data : [];
      tickets.forEach((ticket, idx) => {
        if (ticket?.status === 'ok') { accepted++; return; }
        failed++;
        // App uninstalled / token no longer valid: stop sending to it.
        if (ticket?.details?.error === 'DeviceNotRegistered') deadTokens.push(batch[idx].to);
      });
      if (!tickets.length) failed += batch.length;
    } catch (e) {
      console.error('Expo request failed:', (e as Error).message);
      failed += batch.length;
    }
  }

  let dropped = 0;
  if (deadTokens.length) {
    const { data: n, error: dropError } = await supabase.rpc('push_drop_tokens', { p_tokens: deadTokens });
    if (dropError) console.error('push_drop_tokens failed:', dropError.message);
    else dropped = Number(n) || 0;
  }

  const byType: Record<number, number> = {};
  messages.forEach((m) => { byType[m.data.type] = (byType[m.data.type] ?? 0) + 1; });
  console.log('push run', { targets: messages.length, accepted, failed, dropped, byType });
  // Counts only: no user ids or tokens leave the function.
  return json(200, { targets: messages.length, accepted, failed, dropped, byType });
});
