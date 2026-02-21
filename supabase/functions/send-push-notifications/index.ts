import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const NOTIFICATION_TITLE = 'Knowia ile öğrenme zamanı!';
const NOTIFICATION_BODY = 'Bugün de bir adım at ve hedeflerine yaklaş!';

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, expo_push_token, last_active_at')
    .eq('notifications_enabled', true)
    .not('expo_push_token', 'is', null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // 24 saatten fazla inaktif olanları filtrele
  const now = new Date();
  const inactiveUsers = users.filter((user: any) => {
    if (!user.last_active_at) return true;
    const lastActive = new Date(user.last_active_at);
    return (now.getTime() - lastActive.getTime()) > 24 * 60 * 60 * 1000;
  });

  console.log('inactiveUsers count:', inactiveUsers.length);

  const expoResponses: unknown[] = [];

  // Expo push API'ye bildirim gönder
  for (const user of inactiveUsers) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: user.expo_push_token,
        sound: 'default',
        title: NOTIFICATION_TITLE,
        body: NOTIFICATION_BODY,
      }),
    });
    const body = await res.json().catch(() => ({}));
    console.log('Expo response (user ' + user.id + '):', JSON.stringify(body));
    expoResponses.push({ userId: user.id, status: res.status, body });
  }

  return new Response(
    JSON.stringify({ sent: inactiveUsers.length, expoResponses }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});