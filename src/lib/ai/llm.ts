/**
 * Thin, provider-agnostic LLM client (Anthropic or OpenAI) built on fetch.
 * - Keys come from server-side env vars only; this module is never imported by client code.
 * - Hard timeout + one retry on 429/5xx, then a throw the callers turn into a graceful fallback.
 * - Tiny in-memory circuit breaker: after 3 consecutive failures we skip the API for 60s so a
 *   provider outage doesn't add latency to every ticket submission.
 */
export type LLMErrorKind = "disabled" | "timeout" | "rate_limit" | "upstream" | "bad_response" | "circuit_open";

export class LLMError extends Error {
  constructor(message: string, public kind: LLMErrorKind) {
    super(message);
  }
}

/**
 * Picks the provider. AI_PROVIDER is a preference, but if only the *other* provider's key is present
 * we use that one, so a mismatched AI_PROVIDER can never silently disable AI.
 */
const provider = (): "anthropic" | "openai" => {
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  if (process.env.AI_PROVIDER === "openai") return hasOpenAI || !hasAnthropic ? "openai" : "anthropic";
  return hasAnthropic || !hasOpenAI ? "anthropic" : "openai";
};
const apiKey = () => (provider() === "openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY);
export const modelName = () => {
  const override = process.env.AI_MODEL;
  // Ignore a model override that clearly belongs to the other provider.
  if (override && (provider() === "openai") === /^(gpt|o\d|chatgpt)/i.test(override)) return override;
  return provider() === "openai" ? "gpt-4o-mini" : "claude-haiku-5-5";
};
export const aiConfigured = () => Boolean(apiKey());
/** Admin diagnostic: makes one tiny real call and reports exactly why it failed, if it did. */
export async function aiSelfTest(): Promise<{ ok: boolean; error?: string }> {
  if (!aiConfigured()) return { ok: false, error: "No API key found. Check OPENAI_API_KEY / ANTHROPIC_API_KEY in .env.local and restart the server." };
  circuitOpenUntil = 0; // a manual test should always really try
  try {
    await callLLM({ system: "Reply with the single word: ok", user: "ping", maxTokens: 5, temperature: 0 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
export const aiStatus = () => ({ enabled: aiConfigured(), provider: provider(), model: modelName() });

let consecutiveFailures = 0;
let circuitOpenUntil = 0;
const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 60_000;

interface CallOptions {
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
}

async function once(opts: CallOptions, signal: AbortSignal): Promise<string> {
  const key = apiKey()!;
  let res: Response;
  if (provider() === "openai") {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: modelName(),
        max_tokens: opts.maxTokens,
        temperature: opts.temperature ?? 0.2,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      }),
    });
  } else {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: modelName(),
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
      }),
    });
  }
  if (!res.ok) {
    // Surface the provider's own explanation (invalid key, no credit, unknown model...) to make setup problems obvious.
    const detail = await res.json().then((j) => j?.error?.message ?? "").catch(() => "");
    const msg = `${provider()} returned ${res.status}${detail ? `: ${String(detail).slice(0, 200)}` : ""}`;
    throw new LLMError(msg, res.status === 429 ? "rate_limit" : "upstream");
  }
  const data = await res.json();
  const text: string | undefined =
    provider() === "openai" ? data?.choices?.[0]?.message?.content : data?.content?.find?.((b: any) => b.type === "text")?.text;
  if (!text) throw new LLMError("Empty response from AI provider", "bad_response");
  return text.trim();
}

export async function callLLM(opts: CallOptions): Promise<string> {
  if (!aiConfigured()) throw new LLMError("No AI API key configured", "disabled");
  if (Date.now() < circuitOpenUntil) throw new LLMError("AI temporarily disabled after repeated failures", "circuit_open");

  const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 12_000;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const text = await once(opts, ctrl.signal);
      consecutiveFailures = 0;
      return text;
    } catch (e) {
      lastErr = e instanceof Error && e.name === "AbortError" ? new LLMError("AI request timed out", "timeout") : e;
      const retryable = lastErr instanceof LLMError && ["rate_limit", "upstream", "timeout"].includes(lastErr.kind);
      if (!retryable || attempt === 1) break;
      await new Promise((r) => setTimeout(r, 600));
    } finally {
      clearTimeout(timer);
    }
  }
  if (++consecutiveFailures >= FAILURE_THRESHOLD) circuitOpenUntil = Date.now() + COOLDOWN_MS;
  throw lastErr instanceof LLMError ? lastErr : new LLMError("AI request failed", "upstream");
}
