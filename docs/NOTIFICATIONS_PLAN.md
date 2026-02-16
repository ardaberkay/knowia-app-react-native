# Push Bildirimleri – Tam Plan (Baştan Sona)

Bu doküman, push bildirimlerin **çalışması için gerekli her şeyi** sırayla listeler. Bazı adımlar yapıldı, bazıları (özellikle altyapı) yapılmadığı için token alınamıyordu. Hepsi burada.

---

## Genel akış (ne gerekli?)

```text
[1]  Android: Firebase/FCM + google-services.json
[1b] iOS: Apple Developer + APNs key + EAS credentials
[2]  Proje: app.json → expo-notifications plugin (her iki platform)
[3]  Uygulama kodu: İzin, token, tercih, last_active_at (yapıldı)
[4]  Edge function: Gönderim (yapıldı)
[5]  Test: Build al → izin ver → token kontrolü → function tetikle
```

---

## 1. Altyapı – Android için FCM (Firebase)

**Neden gerekli?**  
Android’de push bildirim **FCM (Firebase Cloud Messaging)** üzerinden gider. Token’ı cihaza veren de FCM. FCM yoksa `getExpoPushTokenAsync()` hiçbir build’de (dev / preview / production) çalışmaz; token null kalır.

**Ne yapılmalı?**

| Adım | Açıklama | Durum |
|------|----------|--------|
| 1.1 | Firebase Console’da proje oluştur (console.firebase.google.com) | Yapılacak |
| 1.2 | Aynı projede **Android uygulaması** ekle; package name: `com.arda.knowia` (app.json ile aynı) | Yapılacak |
| 1.3 | **google-services.json** indir (Firebase’den) | Yapılacak |
| 1.4 | Bu dosyayı proje köküne koy: `knowia-app-react-native/google-services.json` | Yapılacak |

---

## 1b. Altyapı – iOS için APNs (Apple Push Notification service)

**Neden gerekli?**  
iOS’ta push bildirim **APNs (Apple Push Notification service)** üzerinden gider. Token’ı cihaza veren Apple. APNs yapılandırması olmadan iOS build’inde token alınamaz.

**Ne yapılmalı?** (Sırayla)

| Adım | Açıklama | Nerede / Nasıl |
|------|----------|----------------|
| 1b.1 | **Apple Developer Program** üyeliği | developer.apple.com – yıllık ücretli (zorunlu, push için) |
| 1b.2 | **App ID**’de Push Notifications capability | Apple Developer → Certificates, Identifiers & Profiles → Identifiers → uygulaman (bundle id: com.arda.knowia) → Push Notifications işaretle |
| 1b.3 | **APNs key** oluştur | Apple Developer → Keys → yeni key → “Apple Push Notifications service (APNs)” seç → indir (.p8). Key ID ve Team ID’yi not al; .p8 bir kez indirilir, tekrar indirilemez. |
| 1b.4 | **EAS’a credentials vermek** | Terminalde: `eas credentials` → iOS seç → “Push Notifications: Manage your Apple Push Notifications Key” → .p8, Key ID, Team ID, Bundle ID gir. Veya ilk `eas build --platform ios` çalıştırdığında EAS sorarsa orada yapılandır. |
| 1b.5 | **expo-notifications** plugin | Android ile aynı; app.json’da olacak (Bölüm 2). |

**Kısa akış:**  
Apple Developer hesabı aç → App ID’de Push aç → APNs key oluştur (.p8 + Key ID) → EAS’ta bu bilgileri gir (`eas credentials` veya ilk iOS build’de) → iOS build al. Uygulama kodu (izin, token, edge function) Android ile aynı; ekstra kod yazmaya gerek yok.

**Kaynak:** [Expo – Push notifications setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [EAS – Managed credentials](https://docs.expo.dev/app-signing/managed-credentials/).

---

## 2. Proje yapılandırması

**Neden gerekli?**  
Build (preview/production) oluşturulurken FCM’in tanınması ve token alınabilmesi için uygulamanın Firebase ile eşleşmesi gerekir.

| Adım | Açıklama | Dosya / Yer | Durum |
|------|----------|-------------|--------|
| 2.1 | **expo-notifications** plugin’ini ekle | [app.json](app.json) → `plugins` dizisi | Yapılacak |
| 2.2 | **google-services.json** proje kökünde olsun | Proje kökü | 1.4 ile birlikte |
| 2.3 | (İsteğe bağlı) EAS’ta FCM credentials: Expo Dashboard → proje → Credentials → FCM | EAS / Expo | Gerekirse |

**app.json’a eklenecek (plugins içine):**

```json
"expo-notifications"
```

Mevcut plugins örneği:

```json
"plugins": [
  "expo-font",
  "expo-localization",
  "expo-dev-client",
  "expo-notifications",
  "./plugins/withAndroidKeyboardMode"
]
```

---

## 3. Uygulama kodu (yapıldı)

Bu bölüm **tamamlandı**; sadece referans.

| Adım | Açıklama | Dosya | Durum |
|------|----------|--------|--------|
| 3.1 | Profil’de bildirim açılınca token kaydet | ProfileScreen.js → `registerForPushNotificationsAsync(userId)` | Yapıldı |
| 3.2 | İlk girişte (Home focus) izin iste / token güncelle + last_active_at | HomeScreen.js → useFocusEffect | Yapıldı |
| 3.3 | İzin reddedilince “Ayarlar”a yönlendir | NotificationService.js, ProfileScreen.js + locales | Yapıldı |
| 3.4 | getExpoPushTokenAsync hata verirse yakala (sarı uyarı önleme) | NotificationService.js try/catch | Yapıldı |
| 3.5 | last_active_at her Home focus’ta güncelle | HomeScreen.js | Yapıldı |

---

## 4. Edge function (yapıldı)

| Adım | Açıklama | Dosya | Durum |
|------|----------|--------|--------|
| 4.1 | useTranslation kaldır, sabit başlık/gövde kullan | send-push-notifications/index.ts | Yapıldı |
| 4.2 | Sadece `notifications_enabled === true` olanlara gönder | Aynı dosya → `.eq('notifications_enabled', true)` | Yapıldı |

---

## 5. Veritabanı (Supabase)

`profiles` tablosunda olması gereken alanlar (muhtemelen zaten var):

- `expo_push_token` (text, nullable)
- `notifications_enabled` (boolean)
- `last_active_at` (timestamptz, nullable)

Eksikse migration / SQL ile eklenmeli.

---

## 6. Test adımları

**Ön koşul:** 1. ve 2. bölümler tamamlanmış olmalı (Firebase + google-services.json + plugin). Yoksa token alınamaz.

| Adım | Ne yapılacak |
|------|----------------|
| 6.1 | Yeni build al: `eas build --profile preview --platform android` (veya production) |
| 6.2 | APK’yı indir, cihaza kur |
| 6.3 | Uygulamada giriş yap; ana sayfada izin diyaloğu çıkmalı (veya Profil’den bildirimleri aç) |
| 6.4 | Supabase → `profiles` → ilgili kullanıcı: `expo_push_token` dolu, `notifications_enabled` true olmalı |
| 6.5 | Test için `last_active_at`’i 24+ saat öncesine çek veya null bırak |
| 6.6 | Edge function’ı tetikle: Dashboard → Edge Functions → send-push-notifications → Invoke |
| 6.7 | Cihazda “Knowia ile öğrenme zamanı!” bildirimi gelmeli |

---

## 7. Özet checklist

**Android**
- [ ] **1.** Firebase projesi + Android uygulaması (package: com.arda.knowia) + google-services.json indirilip köke kondu
- [ ] **2.** app.json’a `expo-notifications` plugin eklendi
- [ ] Build + test (izin → token → edge function → bildirim)

**iOS**
- [ ] **1b.** Apple Developer üyeliği + App ID’de Push Notifications + APNs key (.p8) oluşturuldu
- [ ] **1b.** EAS’ta iOS push credentials girildi (`eas credentials` veya ilk iOS build’de)
- [ ] **2.** app.json’a `expo-notifications` (Android ile aynı)
- [ ] Build + test (izin → token → edge function → bildirim)

**Ortak (yapıldı)**
- [x] **3.** Uygulama kodu (Profil/Home, Ayarlar yönlendirme, last_active_at)
- [x] **4.** Edge function (sabit metin, notifications_enabled filtresi)

**Neden şimdi söyleniyor?**  
İlk planda sadece “uygulama içi” akış (izin, token kaydı, edge function metni) planlanmıştı. Android’de token’ın alınması için **FCM yapılandırması** zorunluydu; bu altyapı adımı planda yoktu. Bu doküman, “ne gerekli, neler yapılmalı”yı tek yerde topluyor: önce altyapı ve yapılandırma, sonra kod (yapıldı), sonra test.
