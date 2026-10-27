// Minimal LLM client (Anthropic Messages API over fetch, no SDK needed).
// Set ANTHROPIC_API_KEY in the environment; LLM_MODEL is optional.

export class LlmNotConfiguredError extends Error {}

export async function complete(opts: { system: string; prompt: string; maxTokens?: number }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new LlmNotConfiguredError("ANTHROPIC_API_KEY is not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "claude-haiku-5-5",
      max_tokens: opts.maxTokens ?? 800,
      system: opts.system,
      messages: [{ role: "user", content: opts.prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM request failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

// Asks for JSON and parses the first {...} object in the reply.
export async function completeJson<T>(opts: { system: string; prompt: string; maxTokens?: number }): Promise<T> {
  const text = await complete({ ...opts, system: `${opts.system}\nReturn ONLY valid JSON. No markdown, no commentary.` });
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("LLM returned no JSON");
  return JSON.parse(text.slice(start, end + 1)) as T;
}
