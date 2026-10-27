import { completeJson, LlmNotConfiguredError } from "@/lib/llm";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const DAILY_LIMIT = Number(process.env.SUGGEST_DAILY_LIMIT ?? 30);

const SYSTEM = `You are a senior YouTube growth strategist and SEO expert.
You get real statistics from a creator's channel. Base every recommendation on that data:
reuse patterns from their best videos, avoid patterns from their weak ones.
Write titles, descriptions, tags and hashtags in the main language of the channel's videos.
Never invent statistics, never promise specific view counts, never suggest clickbait that misrepresents the video.
Tags: no "#", 2–4 words max each, most specific first. Hashtags: start with "#", no spaces, max 5.`;

type Mode = "audit" | "improve" | "new";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function prompt(mode: Mode, context: string, body: Record<string, unknown>): { prompt: string; maxTokens: number } | null {
  if (mode === "audit") {
    return {
      maxTokens: 1500,
      prompt: `${context}

Write a short channel audit. JSON shape:
{"summary":"2 sentences","strengths":["..."],"problems":["..."],"actions":[{"title":"...","why":"...","how":"..."}],"contentIdeas":[{"title":"video title","why":"based on which data"}]}
3–4 strengths, 3–4 problems, 5 prioritized actions, 5 content ideas.`,
    };
  }
  if (mode === "improve") {
    const v = (body.video ?? {}) as Record<string, unknown>;
    const title = str(v.title, 200);
    if (!title) return null;
    return {
      maxTokens: 1500,
      prompt: `${context}

Improve the metadata of this existing video so it gets found more in YouTube search and suggestions.
Title: ${title}
Performance: ${str(String(v.score ?? ""), 10)}x the channel median; ${str(String(v.views ?? ""), 20)} views; ${v.isShort ? "Short" : "long video"}
Current tags: ${Array.isArray(v.tags) ? v.tags.slice(0, 40).join(", ") : "none"}
Current description:
"""${str(v.description, 1500)}"""

JSON shape:
{"diagnosis":["what is holding it back"],"titles":["3 better titles, under 70 chars"],"description":"full improved description (first 2 lines hook + keywords, then summary, then hashtags)","tags":["15 tags"],"hashtags":["3–5"],"thumbnailText":["3 short thumbnail text ideas"]}`,
    };
  }
  const topic = str(body.topic, 300);
  if (topic.length < 3) return null;
  return {
    maxTokens: 1800,
    prompt: `${context}

The creator is planning a NEW video.
Topic: ${topic}
Format: ${body.format === "short" ? "YouTube Short" : "long video"}
Notes: ${str(body.notes, 500) || "none"}

JSON shape:
{"titles":["5 titles, under 70 chars, in the style of the channel's best videos"],"description":"full SEO description with hook, summary, ${body.format === "short" ? "" : "placeholder chapters (00:00 Intro …), "}call to action and hashtags","tags":["15–20 tags"],"hashtags":["3–5"],"keywords":["5 main search keywords to target"],"thumbnailText":["3 ideas"],"hook":"first 5 seconds script idea"}`,
  };
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const mode = body.mode as Mode;
  if (!["audit", "improve", "new"].includes(mode)) return Response.json({ error: "Unknown mode." }, { status: 400 });
  const context = str(body.context, 5000);
  if (!context) return Response.json({ error: "Analyze a channel first." }, { status: 400 });

  const p = prompt(mode, context, body);
  if (!p) return Response.json({ error: mode === "new" ? "Describe your video idea first." : "Missing video." }, { status: 400 });

  const limit = rateLimit(`suggest:${clientIp(request)}`, DAILY_LIMIT);
  if (!limit.ok) return Response.json({ error: "You've reached today's free AI limit. Try again tomorrow." }, { status: 429 });

  try {
    const result = await completeJson<Record<string, unknown>>({ system: SYSTEM, prompt: p.prompt, maxTokens: p.maxTokens });
    return Response.json({ mode, result, remaining: limit.remaining });
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      return Response.json({ error: "AI suggestions aren't configured yet (missing API key)." }, { status: 503 });
    }
    console.error("suggest failed", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 502 });
  }
}
