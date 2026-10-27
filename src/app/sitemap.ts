import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { liveTools } from "@/lib/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const latest = liveTools.map((t) => t.updated).sort().at(-1);
  return [
    { url: absoluteUrl("/"), lastModified: latest, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/start"), changeFrequency: "monthly", priority: 0.8 },
    ...liveTools.map((t) => ({
      url: absoluteUrl(`/${t.slug}`),
      lastModified: t.updated,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    ...["/about", "/privacy", "/terms"].map((p) => ({ url: absoluteUrl(p), changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
}
