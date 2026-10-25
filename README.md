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
