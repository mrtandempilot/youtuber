import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { site } from "@/lib/site";
import { tools, liveTools } from "@/lib/tools";

const homeFaqs = [
  {
    q: `What is ${site.name}?`,
    a: `${site.name} is a collection of free online tools for video creators on YouTube, TikTok and Instagram. Each tool does one job well, such as downloading YouTube thumbnails or generating hashtags, and works in the browser without an account.`,
  },
  {
    q: "Are the tools really free?",
    a: "Yes. Every tool has a free tier with no sign-up. A Pro plan with higher limits, bulk processing and longer videos is planned for creators who need more.",
  },
  {
    q: "Which platforms are supported?",
    a: "YouTube (including Shorts), TikTok and Instagram Reels. Each tool page lists the platforms it works with.",
  },
];

export default function Home() {
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `${site.name} tools`,
            itemListElement: liveTools.map((t, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: t.name,
              url: `${site.url}/${t.slug}`,
            })),
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: homeFaqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]}
      />

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 md:pt-24">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Free · No sign-up · Works in your browser
        </p>
        <h1 className="max-w-3xl font-display text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
          Small tools that save creators <span className="text-accent">hours.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Analyze your channel, fix old videos, plan SEO for new ones, download thumbnails and generate
          hashtags — free AI tools built for YouTube, TikTok and Instagram creators.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {liveTools.map((t, i) => (
            <Link
              key={t.slug}
              href={`/${t.slug}`}
              className={
                i === 0
                  ? "rounded-full bg-accent px-5 py-2.5 font-medium text-accent-ink hover:opacity-90"
                  : "rounded-full border border-line bg-surface px-5 py-2.5 font-medium hover:border-ink"
              }
            >
              {t.name} →
            </Link>
          ))}
        </div>
      </section>

      <section id="tools" className="mx-auto max-w-6xl scroll-mt-20 px-4">
        <h2 className="font-display text-3xl font-bold">All tools</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => {
            const inner = (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted">{t.category}</span>
                  {t.status === "soon" ? (
                    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">Coming soon</span>
                  ) : (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Free</span>
                  )}
                </div>
                <h3 className="mt-4 font-display text-xl font-bold">{t.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t.cardDescription}</p>
                <p className="mt-4 text-xs text-muted">{t.platforms.join(" · ")}</p>
              </>
            );
            return (
              <li key={t.slug}>
                {t.status === "live" ? (
                  <Link
                    href={`/${t.slug}`}
                    className="block h-full rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="h-full rounded-2xl border border-dashed border-line p-5 opacity-70">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mx-auto mt-20 max-w-3xl px-4">
        <h2 className="font-display text-3xl font-bold">Questions</h2>
        <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
          {homeFaqs.map((f) => (
            <div key={f.q} className="p-5">
              <h3 className="font-semibold">{f.q}</h3>
              <p className="mt-2 leading-relaxed text-muted">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
