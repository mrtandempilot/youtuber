import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

// Search engines and AI assistants (ChatGPT, Perplexity, Claude, Gemini) are all welcome:
// being crawled is how the tools get cited in AI answers (GEO).
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: "/api/" },
      { userAgent: AI_BOTS, allow: "/", disallow: "/api/" },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
