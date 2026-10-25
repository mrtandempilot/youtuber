import { absoluteUrl, site } from "@/lib/site";
import { liveTools, tools } from "@/lib/tools";

// llms.txt: a plain-text summary of the site for AI assistants (https://llmstxt.org).
export function GET() {
  const lines = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    "All tools are free, run in the browser and need no account. Not affiliated with YouTube, TikTok or Instagram.",
    "",
    "## Tools",
    ...liveTools.map((t) => `- [${t.name}](${absoluteUrl(`/${t.slug}`)}): ${t.intro}`),
    "",
    "## Coming soon",
    ...tools.filter((t) => t.status === "soon").map((t) => `- ${t.name}: ${t.cardDescription}`),
    "",
    "## FAQ",
    ...liveTools.flatMap((t) => t.faqs.map((f) => `- ${t.name} — ${f.q} ${f.a}`)),
    "",
    "## Optional",
    `- [About](${absoluteUrl("/about")})`,
    `- [Sitemap](${absoluteUrl("/sitemap.xml")})`,
  ];
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
