-- Faz 1.1 (S14 + S1) — push cron'u: service_role anahtarı komuttan çıkar,
-- yerine Vault'taki rastgele bir "cron secret" header olarak gönderilir.
-- Sıra önemli; adımlar plan dosyasında (1.1) ve sohbette:
--   1) Bu dosyayı SQL editöründe çalıştır.
--   2) Son SELECT'in verdiği değeri kopyala ve terminalde:
--        npx supabase secrets set PUSH_CRON_SECRET=<değer>
--      Değeri hiçbir dosyaya ya da sohbete yapıştırma.
--   3) Claude fonksiyonu deploy eder (verify_jwt = false, header kontrolü fonksiyonda).
-- 1) ile 3) arasında eski fonksiyon header'ı yok sayar, push çalışmaya devam eder.

-- Rastgele secret, sadece yoksa oluşturulur (tekrar çalıştırınca değişmez).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'push_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'push_cron_secret',
                                'x-cron-secret for send-push-notifications');
  end if;
end $$;

-- Eski işi (komutunda service_role JWT gömülü) kaldır, aynı saatle yeniden kur.
select cron.unschedule('send-push-notifications-daily')
where exists (select 1 from cron.job where jobname = 'send-push-notifications-daily');

select cron.schedule(
  'send-push-notifications-daily',
  '30 17 * * *',  -- her gün 17:30 UTC (20:30 İstanbul), eskisiyle aynı
  $cmd$
  select net.http_post(
    url := 'https://xgciwiqbtxzccabwbqtl.supabase.co/functions/v1/send-push-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

-- Kontrol: komutta artık anahtar yok.
select jobname, schedule, command from cron.job where jobname = 'send-push-notifications-daily';

-- 2. adım için değer (sadece sen gör; kopyala, terminale yapıştır):
select decrypted_secret as push_cron_secret from vault.decrypted_secrets where name = 'push_cron_secret';
