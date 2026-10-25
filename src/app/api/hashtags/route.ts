import { complete, LlmNotConfiguredError } from "@/lib/llm";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const PLATFORMS = {
  tiktok: { label: "TikTok", count: "12", note: "Favor discovery tags used on TikTok's For You page." },
  instagram: { label: "Instagram Reels", count: "15", note: "Mix tag sizes; avoid banned or spammy tags." },
  youtube: { label: "YouTube Shorts and videos", count: "10", note: "YouTube ignores all hashtags if a video uses more than 15." },
} as const;

type Platform = keyof typeof PLATFORMS;

const DAILY_LIMIT = Number(process.env.FREE_DAILY_LIMIT ?? 30);

const SYSTEM = `You are a social media growth expert who writes hashtags for short-form video creators.
Return ONLY valid JSON, no markdown, in this exact shape:
{"broad":["#tag"],"niche":["#tag"],"community":["#tag"]}
Rules: lowercase, no spaces inside a tag, each tag starts with #, no duplicates,
only tags that real creators in this topic use, never misleading or unrelated tags,
write tags in the same language as the video description.`;

function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const tag = "#" + raw.replace(/^#+/, "").replace(/\s+/g, "").toLowerCase();
    if (tag.length < 3 || tag.length > 50 || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

export async function POST(request: Request) {
  let body: { topic?: unknown; platform?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const platform = (typeof body.platform === "string" ? body.platform : "") as Platform;

  if (topic.length < 3 || topic.length > 300) {
    return Response.json({ error: "Describe your video in 3–300 characters." }, { status: 400 });
  }
  if (!(platform in PLATFORMS)) {
    return Response.json({ error: "Unknown platform." }, { status: 400 });
  }

  const limit = rateLimit(`hashtags:${clientIp(request)}`, DAILY_LIMIT);
  if (!limit.ok) {
    return Response.json(
      { error: "You've reached today's free limit. Come back tomorrow — Pro with higher limits is coming soon." },
      { status: 429 },
    );
  }

  const p = PLATFORMS[platform];
  try {
    const text = await complete({
      system: SYSTEM,
      prompt: `Platform: ${p.label}. ${p.note}
Video description: """${topic}"""
Give about ${p.count} hashtags in total, split across broad (high reach), niche (specific to this video) and community (audience/creator community) groups.`,
    });

    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    const result = {
      broad: cleanTags(json.broad),
      niche: cleanTags(json.niche),
      community: cleanTags(json.community),
    };
    if (!result.broad.length && !result.niche.length && !result.community.length) {
      throw new Error("Empty result");
    }
    return Response.json({ ...result, remaining: limit.remaining });
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      return Response.json({ error: "The generator isn't configured yet (missing API key)." }, { status: 503 });
    }
    console.error("hashtag generation failed", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 502 });
  }
}
