import { completeJson, LlmNotConfiguredError } from "@/lib/llm";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const DAILY_LIMIT = Number(process.env.SUGGEST_DAILY_LIMIT ?? 30);

const SYSTEM = `You are a senior YouTube growth strategist and SEO expert.
You get real statistics from a creator's channel. Base every recommendation on that data:
reuse patterns from their best videos, avoid patterns from their weak ones.
Write titles, descriptions, tags and hashtags in the main language of the channel's videos.
Never invent statistics, never promise specific view counts, never suggest clickbait that misrepresents the video.
Tags: no "#", 2–4 words max each, most specific first. Hashtags: start with "#", no spaces, max 5.`;

type Mode = "audit" | "improve" | "new" | "plan" | "channel";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const GOALS: Record<string, string> = {
  views: "get more views per video",
  subscribers: "grow subscribers faster",
  monetize: "reach YouTube Partner Program requirements (1,000 subscribers + 4,000 watch hours, or 10M Shorts views)",
  shorts: "grow with YouTube Shorts",
  search: "rank higher in YouTube and Google search",
};

function prompt(mode: Mode, context: string, body: Record<string, unknown>): { prompt: string; maxTokens: number } | null {
  if (mode === "channel") {
    const c = (body.current ?? {}) as Record<string, unknown>;
    const trailers = Array.isArray(body.trailerCandidates) ? body.trailerCandidates.slice(0, 5) : [];
    return {
      maxTokens: 2500,
      prompt: `${context}

Optimize this channel's settings for YouTube and Google search and for converting new visitors into subscribers.
Current channel description:
"""${str(c.description, 1200)}"""
Current channel keywords: ${Array.isArray(c.keywords) ? c.keywords.slice(0, 40).join(", ") : "none"}
Current trailer for non-subscribers: ${str(c.unsubscribedTrailer, 20) || "none"}
Trailer candidates (best long videos): ${trailers.map((t) => { const o = (t ?? {}) as Record<string, unknown>; return `${str(o.id, 11)} "${str(o.title, 100)}" (${str(String(o.score ?? ""), 6)}x)`; }).join("; ") || "none"}

JSON shape:
{"diagnosis":["what is weak in the current settings"],
"description":"new channel description, max 900 characters: first 150 characters say who the channel is for and what they get (with the main keyword), then what videos to expect and how often, then a call to subscribe. No links, no hashtags.",
"keywords":["10–15 channel keywords, most important first, 1–3 words each"],
"trailerVideoId":"one id from the trailer candidates or empty string",
"trailerReason":"why this video works as the channel trailer"}`,
    };
  }
  if (mode === "plan") {
    const goal = GOALS[str(body.goal, 20)] ?? GOALS.views;
    const perWeek = Math.min(Math.max(Number(body.videosPerWeek) || 1, 1), 14);
    return {
      maxTokens: 4000,
      prompt: `${context}

The creator just signed up. Their main goal: ${goal}.
Niche / topic in their words: ${str(body.niche, 200) || "use the channel data"}
They can publish about ${perWeek} video(s) per week. Preferred format: ${str(body.format, 20) || "mixed"}.

Build a personal 4-week growth plan. JSON shape:
{"headline":"one motivating sentence about where they stand","summary":"3 sentences: current situation vs goal, based on the data",
"quickWins":[{"title":"action doable today","detail":"exactly what to do, referencing their real videos/tags"}],
"weeks":[{"week":1,"focus":"theme of the week","videos":[{"title":"ready-to-use title","format":"short|long","why":"which data point supports it"}],"tasks":["non-video task"]}],
"habits":["ongoing rule to follow"]}
3 quick wins, exactly 4 weeks with ${perWeek} video(s) each (max 4 listed per week), 3 habits.`,
    };
  }
  if (mode === "audit") {
    return {
      maxTokens: 2500,
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
      maxTokens: 3000,
      prompt: `${context}

Improve the metadata of this existing video so it gets found more in YouTube search and suggestions.
Title: ${title}
Performance: ${str(String(v.score ?? ""), 10)}x the channel median; ${str(String(v.views ?? ""), 20)} views; ${v.isShort ? "Short" : "long video"}
Current tags: ${Array.isArray(v.tags) ? v.tags.slice(0, 40).join(", ") : "none"}
Current description:
"""${str(v.description, 1500)}"""

JSON shape:
{"diagnosis":["what is holding it back"],"titles":["3 better titles, under 70 chars"],"description":"improved description, max 1200 characters (first 2 lines hook + keywords, then summary, then hashtags)","tags":["15 tags"],"hashtags":["3–5"],"thumbnailText":["3 short thumbnail text ideas"]}`,
    };
  }
  const topic = str(body.topic, 300);
  if (topic.length < 3) return null;
  return {
    maxTokens: 3500,
    prompt: `${context}

The creator is planning a NEW video.
Topic: ${topic}
Format: ${body.format === "short" ? "YouTube Short" : "long video"}
Notes: ${str(body.notes, 500) || "none"}

JSON shape:
{"titles":["5 titles, under 70 chars, in the style of the channel's best videos"],"description":"SEO description, max 1500 characters, with hook, summary, ${body.format === "short" ? "" : "placeholder chapters (00:00 Intro …), "}call to action and hashtags","tags":["15–20 tags"],"hashtags":["3–5"],"keywords":["5 main search keywords to target"],"thumbnailText":["3 ideas"],"hook":"first 5 seconds script idea"}`,
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
  if (!["audit", "improve", "new", "plan", "channel"].includes(mode)) return Response.json({ error: "Unknown mode." }, { status: 400 });
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
