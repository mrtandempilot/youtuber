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

Plan şimdilik tarayıcıda (localStorage) saklanıyor, müşteri geri döndüğünde planını görüyor. Hesap sistemi ve veritabanı (Supabase) eklenince haftalık e-posta raporu ve plan takibi buna bağlanacak.

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
