// Minimal LLM client (Anthropic Messages API over fetch, no SDK needed).
// Set ANTHROPIC_API_KEY in the environment; LLM_MODEL is optional.

export class LlmNotConfiguredError extends Error {}

type Msg = { role: "user" | "assistant"; content: string };

async function call(opts: { system: string; messages: Msg[]; maxTokens: number }) {
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
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM request failed: ${res.status} ${(await res.text()).slice(0, 500)}`);
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  return { text, stopReason: data.stop_reason ?? null };
}

export async function complete(opts: { system: string; prompt: string; maxTokens?: number }) {
  const { text } = await call({
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
    maxTokens: opts.maxTokens ?? 800,
  });
  return text;
}

// Pulls the JSON object out of a reply (tolerates ```json fences and text around it).
export function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

// Asks for JSON and parses it. If the reply is cut off (max_tokens) or isn't valid JSON,
// retries once: with a bigger token budget, or by asking the model to fix its output.
export async function completeJson<T>(opts: { system: string; prompt: string; maxTokens?: number }): Promise<T> {
  const system = `${opts.system}\nReturn ONLY one valid JSON object. No markdown fences, no commentary before or after it.`;
  const maxTokens = opts.maxTokens ?? 1500;
  const messages: Msg[] = [{ role: "user", content: opts.prompt }];

  const first = await call({ system, messages, maxTokens });
  const parsed = extractJson<T>(first.text);
  if (parsed) return parsed;

  console.warn("LLM JSON parse failed", { stopReason: first.stopReason, head: first.text.slice(0, 200) });

  const second =
    first.stopReason === "max_tokens"
      ? await call({ system, messages, maxTokens: Math.min(maxTokens * 2, 8000) })
      : await call({
          system,
          messages: [
            ...messages,
            { role: "assistant", content: first.text || "(empty)" },
            { role: "user", content: "That was not valid JSON. Reply again with ONLY the JSON object, nothing else." },
          ],
          maxTokens,
        });

  const retried = extractJson<T>(second.text);
  if (retried) return retried;
  console.error("LLM JSON retry failed", { stopReason: second.stopReason, head: second.text.slice(0, 200) });
  throw new Error("LLM returned no JSON");
}
