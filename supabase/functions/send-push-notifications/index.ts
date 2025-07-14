import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { useTranslation } from 'react-i18next';

serve(async (req) => {
  // Supabase client'ı başlat
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { t } = useTranslation();

  // Push token'ı olan kullanıcıları bul
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, expo_push_token, last_active_at')
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

  // Expo push API'ye bildirim gönder
  for (const user of inactiveUsers) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: user.expo_push_token,
        sound: 'default', 
        title: t('notifications.title', 'Knowia ile öğrenme zamanı!'),
        body: t('notifications.body', 'Bugün de bir adım at ve hedeflerine yaklaş!'),
      }),
    });
  }

  return new Response(JSON.stringify({ sent: inactiveUsers.length }), { status: 200 });
});