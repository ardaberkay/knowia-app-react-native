# Reports ve Profil Düzeltmeleri

## 1. Reports tablosu – report_type

`reports` tablosunda şikayet tipi sütunu **`report_type`** (veri tipi: `report_target_type` enum). Uygulama bu sütun adıyla insert yapıyor; ek bir işlem gerekmez.

---

## 2. Reports – "aynı madde ile tekrar şikayet" (sadece reason sütunu)

Uygulama şikayet sebebini mevcut **reason (text)** sütununda saklıyor: önceden tanımlı maddeler için `"spam"`, `"harassment"` vb., "Diğer" için `"other: kullanıcının yazdığı metin"`. Ek sütun (reason_code) yok.

Aynı kullanıcı aynı hedefe **aynı sebeple** sadece bir kez şikayet edebilsin diye unique kısıtı ekleyebilirsiniz (isteğe bağlı; uygulama tarafında da kontrol ediliyor): eski unique `(reporter_id, report_type, target_id)` varsa kaldırıp **yeni unique** `(reporter_id, report_type, target_id, reason)` tanımlayın.

Supabase **SQL Editor**'de (constraint adını kendi projenize göre düzenleyin):

```sql
-- Eski unique kısıtı kaldır (Table Editor > reports > Constraints'ten adı kontrol edin)
ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_reporter_id_report_type_target_id_key;

-- Aynı kullanıcı aynı hedefe aynı reason değeriyle sadece bir kez şikayet edebilir
ALTER TABLE public.reports
  ADD CONSTRAINT reports_reporter_type_target_reason_unique
  UNIQUE (reporter_id, report_type, target_id, reason);
```

**Not:** "Diğer" için reason `"other: ..."` olarak saklandığı için, aynı kullanıcı farklı metinle birden fazla "Diğer" şikayeti gönderebilir (DB'de reason farklı). Uygulama, bu hedef için daha önce "Diğer" ile şikayet varsa "Diğer" seçeneğini devre dışı bırakıyor; yani "aynı madde" kuralı "Diğer" için uygulama tarafında uygulanıyor.

---

## 3. Başka kullanıcının destesinde "Kullanıcı" adının görünmesi

Deste sahibinin kullanıcı adı, `profiles` tablosundan join ile gelir. Eğer `profiles` üzerinde RLS (Row Level Security) varsa ve sadece "kendi profilini oku" izni veriyorsa, başka kullanıcının profil satırı okunmaz; bu yüzden sadece "Kullanıcı" görünür.

Aşağıdaki politika, **giriş yapmış her kullanıcının** tüm profillerdeki satırları (en azından liste/deste detayı için gerekli bilgileri) okuyabilmesini sağlar. Uygulama tarafında zaten sadece `username`, `image_url` gibi alanları çekiyorsunuz.

Supabase Dashboard → **SQL Editor** → New query. Şunu çalıştır:

```sql
-- Giriş yapmış kullanıcılar diğer kullanıcıların profil bilgilerini (username, avatar vb.) okuyabilsin
CREATE POLICY "Authenticated users can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
```

Eğer `profiles` tablosunda zaten `FOR SELECT` ile başka bir politika varsa (örneğin "sadece kendi profilim"), bu yeni politika onunla birlikte çalışır; RLS'te birden fazla politika varsa **OR** mantığı uygulanır. Yani kullanıcı hem kendi profilini hem diğerlerininkini okuyabilir.

Bu politikayı ekledikten sonra deste detayını yenilediğinizde, başka kullanıcının destesinde de o kullanıcının adı (ve varsa avatar) görünür.
