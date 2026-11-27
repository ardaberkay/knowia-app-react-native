import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Faz 1.1 (S1 + S14): only the daily cron may call this function.
// The cron job sends `x-cron-secret`, read from Supabase Vault; the same value
// is stored as the function secret PUSH_CRON_SECRET. Anything else gets 401.
// Content (single Turkish text, Istanbul day) is unchanged until Faz 6.

const NOTIFICATION_TITLE = 'Knowia ile öğrenme zamanı!';
const NOTIFICATION_BODY = 'Bugün de bir adım at ve hedeflerine yaklaş!';
const TARGET_TIMEZONE = 'Europe/Istanbul';
const EXPO_BATCH_SIZE = 100; // Expo accepts up to 100 messages per request

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

function dateKeyInTimezone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const expected = Deno.env.get('PUSH_CRON_SECRET') ?? '';
  const given = req.headers.get('x-cron-secret') ?? '';
  if (!expected || !safeEqual(given, expected)) return json(401, { error: 'Unauthorized' });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, adminKey());

  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, expo_push_token, last_active_at')
    .eq('notifications_enabled', true)
    .not('expo_push_token', 'is', null);

  if (error) {
    console.error('profiles query failed:', error.message);
    return json(500, { error: 'Query failed' });
  }

  // Users not active today (Istanbul day)
  const todayKey = dateKeyInTimezone(new Date(), TARGET_TIMEZONE);
  const inactiveUsers = (users ?? []).filter((user: any) => {
    if (!user.last_active_at) return true;
    return dateKeyInTimezone(new Date(user.last_active_at), TARGET_TIMEZONE) !== todayKey;
  });

  // One message per token even if a token were on several profiles
  const tokens = [...new Set(inactiveUsers.map((u: any) => u.expo_push_token).filter(Boolean))] as string[];

  let accepted = 0;
  let failed = 0;
  for (let i = 0; i < tokens.length; i += EXPO_BATCH_SIZE) {
    const batch = tokens.slice(i, i + EXPO_BATCH_SIZE).map((to) => ({
      to,
      sound: 'default',
      title: NOTIFICATION_TITLE,
      body: NOTIFICATION_BODY,
    }));
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
      tickets.forEach((t) => (t?.status === 'ok' ? accepted++ : failed++));
      if (!tickets.length) failed += batch.length;
    } catch (e) {
      console.error('Expo request failed:', (e as Error).message);
      failed += batch.length;
    }
  }

  console.log('push run', { todayKey, targets: tokens.length, accepted, failed });
  // Counts only: no user ids or tokens leave the function.
  return json(200, { targets: tokens.length, accepted, failed });
});
