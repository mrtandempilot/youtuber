import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { JsonLd } from "./JsonLd";
import { absoluteUrl, site } from "@/lib/site";
import { liveTools, type Tool } from "@/lib/tools";

// Builds per-tool metadata (title, description, canonical, OG, Twitter).
export function toolMetadata(tool: Tool): Metadata {
  const url = `/${tool.slug}`;
  return {
    title: { absolute: tool.metaTitle },
    description: tool.metaDescription,
    keywords: tool.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: site.name,
      title: tool.metaTitle,
      description: tool.metaDescription,
    },
    twitter: { card: "summary_large_image", title: tool.metaTitle, description: tool.metaDescription },
  };
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Shared layout for every tool page: H1 + intro, the interactive tool,
// how-to, FAQ, related tools and all structured data.
export function ToolPage({ tool, children }: { tool: Tool; children: ReactNode }) {
  const url = absoluteUrl(`/${tool.slug}`);
  const related = liveTools.filter((t) => t.slug !== tool.slug);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: tool.name,
      url,
      description: tool.metaDescription,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any (web browser)",
      dateModified: tool.updated,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@type": "Organization", name: site.name, url: site.url },
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: `How to use the ${tool.name}`,
      step: tool.howTo.map((text, i) => ({ "@type": "HowToStep", position: i + 1, text })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: tool.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site.url },
        { "@type": "ListItem", position: 2, name: tool.name, item: url },
      ],
    },
  ];

  return (
    <article className="mx-auto max-w-3xl px-4 pt-8">
      <JsonLd data={jsonLd} />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
        <Link href="/" className="hover:text-ink">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{tool.name}</span>
      </nav>

      <header className="mb-8">
        <div className="mb-3 flex flex-wrap gap-2">
          {tool.platforms.map((p) => (
            <span key={p} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
              {p}
            </span>
          ))}
          <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">Free · No sign-up</span>
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">{tool.h1}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">{tool.intro}</p>
      </header>

      <section aria-label={tool.name} className="rounded-2xl border border-line bg-surface p-5 shadow-sm md:p-6">
        {children}
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-bold">How to use the {tool.name}</h2>
        <ol className="mt-5 space-y-4">
          {tool.howTo.map((step, i) => (
            <li key={i} className="flex gap-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-bg">
                {i + 1}
              </span>
              <p className="pt-0.5 leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-bold">Frequently asked questions</h2>
        <div className="mt-5 divide-y divide-line rounded-2xl border border-line bg-surface">
          {tool.faqs.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                <h3>{f.q}</h3>
                <span aria-hidden className="text-muted transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold">More free creator tools</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {related.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/${t.slug}`}
                  className="block rounded-xl border border-line bg-surface p-4 transition hover:border-accent"
                >
                  <span className="font-semibold">{t.name}</span>
                  <span className="mt-1 block text-sm text-muted">{t.cardDescription}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-sm text-muted">
        Last updated: <time dateTime={tool.updated}>{formatDate(tool.updated)}</time>
      </p>
    </article>
  );
}
