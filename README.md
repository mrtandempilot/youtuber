# CreatorKit (çalışma adı)

YouTube, TikTok ve Instagram içerik üreticileri için ücretsiz araçlar sitesi. Next.js 16 (App Router), TypeScript, Tailwind 4.

## Çalıştırma

```bash
npm install
cp .env.example .env.local   # değerleri doldur
npm run dev                  # http://localhost:3000
```

## Hazır araçlar

| Sayfa | Dosyalar |
|---|---|
| `/youtube-thumbnail-downloader` | `src/components/tools/ThumbnailDownloader.tsx`, `src/app/api/thumbnail/route.ts` |
| `/hashtag-generator` | `src/components/tools/HashtagGenerator.tsx`, `src/app/api/hashtags/route.ts` (ANTHROPIC_API_KEY gerekir) |

## YouTube Channel Analyzer (`/youtube-channel-analyzer`)

İki mod var:
- **Herhangi bir public kanal:** @handle veya link yapıştırılır, sadece `YOUTUBE_API_KEY` gerekir.
- **Kendi kanalını bağla (Google OAuth, salt okunur):** buna ek olarak son 90 günün izlenme süresi, ortalama izleme süresi, trafik kaynakları ve izleyicilerin YouTube'da gerçekten aradığı kelimeler gelir.

Analiz son 50 video üzerinden yapılır. Her videonun **skoru** = günlük izlenme ÷ kanal medyanı (Shorts ve uzun video ayrı hesaplanır). Raporda iyi ve kötü etiketler, hashtag'ler, en iyi gün ve saat, başlık uzunluğu, Shorts ile uzun video karşılaştırması ve SEO eksikleri var. AI ile üç şey yapılabiliyor: kanal denetimi, eski videoyu iyileştirme, yeni video için SEO paketi.

### Google Cloud kurulumu (bir kere)

1. https://console.cloud.google.com adresinde yeni bir proje aç.
2. **APIs & Services → Library** bölümünden **YouTube Data API v3** ve **YouTube Analytics API**'yi etkinleştir.
3. **Credentials → Create credentials → API key** ile anahtar oluştur. Anahtarı sadece YouTube Data API v3 ile sınırla ve `YOUTUBE_API_KEY` olarak kaydet.
4. **OAuth consent screen** bölümünde: tip *External*, uygulama adı, destek e-postası, logo, gizlilik linki (`/privacy`) ve şartlar linki (`/terms`). Scope olarak `youtube.readonly` ve `yt-analytics.readonly` ekle.
5. **Credentials → Create credentials → OAuth client ID** ile *Web application* tipinde bir istemci oluştur. Authorized redirect URI'lere şunları ekle:
   - `http://localhost:3000/api/auth/google/callback`
   - `https://<domain>/api/auth/google/callback`
6. Client ID ve secret'ı `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` olarak kaydet. `SESSION_SECRET` için `openssl rand -base64 32` çıktısını kullan.

**Önemli:** Bu scope'lar Google'ın "sensitive" listesinde. Uygulama doğrulanana kadar sadece **Test users** listesine eklediğin en fazla 100 hesap bağlanabilir, diğerleri "unverified app" uyarısı görür. Herkese açmak için consent screen'den **Publish app → Verification** başvurusu yap. Domain doğrulaması, gizlilik politikası ve demo videosu istenir, süreç birkaç gün ile birkaç hafta sürer. Public kanal analizi bu süreçten etkilenmez, hemen çalışır.

**Kota:** Varsayılan kota günde 10.000 birimdir. Bir analiz yaklaşık 3-4 birim tutar, yani günde ~2.500 analiz yapılabilir. `/c/isim` gibi eski tip linkler arama yaptığı için 100 birim harcar.

## Onboarding wizard (`/start`)

Müşterinin sisteme giriş akışı. Header'daki ve ana sayfadaki "Get your plan" butonları buraya götürüyor.

1. **Kanal:** müşteri ya "Connect YouTube channel" ile Google'a gidip geri döner (`/api/auth/google?next=/start`) ya da kanal linkini yapıştırır. Analiz bu adımda arka planda başlar.
2. **Hedefler:** ana hedef (izlenme, abone, monetizasyon, Shorts, arama), konu (kanal anahtar kelimeleriyle otomatik doldurulur), haftada kaç video yapabileceği ve format.
3. **Plan:** ilerleme animasyonu gösterilirken AI kişisel 4 haftalık planı yazar (`/api/youtube/suggest` içinde `mode: "plan"`). Planda bugün yapılacak 3 iş, haftalık video başlıkları, alışkanlıklar ve monetizasyon ilerlemesi var. Sonunda "Open full report" butonu analyzer'ı otomatik açar.

Google ile giriş yapan müşterinin planı Supabase'deki hesabına kaydediliyor, başka cihazdan girince de görünüyor. Link yapıştıran müşterinin planı sadece kendi tarayıcısında kalıyor.

## Supabase (hesaplar, planlar, kanal geçmişi)

Şema dosyası: `supabase/migrations/20261027120000_init.sql`

| Tablo | İçerik |
|---|---|
| `profiles` | Google hesabı (sub, e-posta, ad), şifreli refresh token, `plan_tier` (free/pro) |
| `channels` | Müşterinin YouTube kanalları |
| `plans` | Wizard'daki cevaplar ve AI planı; kanal başına en son satır aktif plan |
| `channel_snapshots` | Kanal başına günde bir istatistik kaydı (ilerleme grafiği ve haftalık rapor için) |

Bütün tablolarda RLS açık ve hiç policy yok. Yani public/anon key hiçbir şey okuyamaz, erişim sadece sunucudan `SUPABASE_SECRET_KEY` ile oluyor.

Kurulum:
1. Supabase → SQL Editor'e migration dosyasının içeriğini yapıştırıp **Run** de.
2. Project Settings → API (veya API Keys) altından **Project URL** ve bir **Secret key** (`sb_secret_…`) al.
3. `.env.local` dosyasına ve Vercel'e `SUPABASE_URL` ile `SUPABASE_SECRET_KEY` olarak gir. Secret key'i asla `NEXT_PUBLIC_` ile başlatma.

Supabase ayarlanmazsa site çalışmaya devam eder, sadece hesap ve kayıt özellikleri devre dışı kalır.

Veri silme: `/privacy` sayfasındaki "Delete my data" butonu profili ve ona bağlı her şeyi siler, Google erişimini de iptal eder. Bu, Google doğrulaması için zorunlu.

## Growth dashboard (`/dashboard`)

Kanalını bağlayan creator için büyüme sayfası (YouTube Analytics'ten canlı veri):
- 7 / 28 / 90 gün / 12 ay; her metrik bir önceki aynı uzunluktaki dönemle karşılaştırılır
- İzlenme (çizgi), net abone (bar, 12 ayda haftalık), trafik kaynakları, ülkeler, cihazlar, en iyi videolar
- **Değişikliklerin etkisi:** "Apply to YouTube" ile yapılan her değişiklik `change_log` tablosuna yazılır; videonun değişiklikten önceki ve sonraki 7 günlük ortalama günlük izlenmesi karşılaştırılır (en az 3 gün veri gerekir)

`change_log` tablosu için `supabase/migrations/20261027150000_change_log.sql` dosyasını Supabase SQL Editor'de çalıştır. Tablo yoksa dashboard yine çalışır, sadece bu bölüm boş kalır.

## Yeni araç ekleme

1. `src/lib/tools.ts` içine kayıt ekle (`status: "live"`, SEO metinleri, how-to, FAQ).
2. `src/app/<slug>/page.tsx` oluştur (mevcut iki sayfayı kopyala) ve araç bileşenini yaz.
3. İstersen `opengraph-image.tsx` kopyala.

Ana sayfa, menü, footer, sitemap, llms.txt ve "diğer araçlar" linkleri otomatik güncellenir.

## SEO / GEO

- Her sayfada benzersiz title, description, canonical, Open Graph, Twitter kartı ve otomatik OG görseli
- JSON-LD: WebSite, Organization, SoftwareApplication, HowTo, FAQPage, BreadcrumbList, ItemList
- `sitemap.xml`, `robots.txt` (GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot vb. izinli, `/api/` kapalı)
- `/llms.txt` — yapay zekâ asistanları için site özeti
- Görünür "Last updated" tarihi, kısa ve alıntılanabilir intro/FAQ metinleri
- Search Console ve Bing doğrulama kodları env üzerinden
- Fontlar self-host (Google Fonts isteği yok), sayfalar statik üretiliyor

## Yayına alma (Vercel)

1. Repo'yu GitHub'a gönder, Vercel'de import et.
2. Env değişkenlerini Vercel'e gir; `NEXT_PUBLIC_SITE_URL` gerçek domain olmalı.
3. Domain bağla, Search Console + Bing Webmaster'a `sitemap.xml` gönder.

## Sonraki adımlar

- Ürün adı ve domain (şu an `NEXT_PUBLIC_SITE_NAME` ile değişiyor)
- Supabase: kullanıcılar, kalıcı kullanım limitleri (şu anki limit bellek içi, sunucular arası paylaşılmaz)
- Ödeme (Stripe / Lemon Squeezy) ve Pro plan
- Transcript, altyazı, başlık/açıklama araçları (`tools.ts` içinde "soon" olarak hazır)
