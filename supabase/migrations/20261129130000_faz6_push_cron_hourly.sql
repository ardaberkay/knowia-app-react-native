-- Faz 6 — bildirim cron'u saatliğe. YENİ send-push-notifications edge
-- function deploy edildikten SONRA çalıştır (eski fonksiyon saatlik
-- çağrılırsa her saat herkese gönderir).
-- Her saat başı çalışır; fonksiyon sadece o an yerel saati 20 olanlara,
-- günde en fazla bir kez gönderir (push_claim_due).

select cron.unschedule('send-push-notifications-daily')
where exists (select 1 from cron.job where jobname = 'send-push-notifications-daily');

select cron.unschedule('send-push-notifications-hourly')
where exists (select 1 from cron.job where jobname = 'send-push-notifications-hourly');

select cron.schedule(
  'send-push-notifications-hourly',
  '0 * * * *',
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

-- KONTROL: tek satır, schedule '0 * * * *'
-- select jobid, jobname, schedule from cron.job where jobname like 'send-push-notifications%';
