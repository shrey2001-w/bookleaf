import { CATEGORIES, PRIORITIES, Category, Priority } from "../constants";
import { callLLM, aiConfigured, LLMError } from "./llm";
import { applyPriorityFloor, heuristicCategory, heuristicPriority } from "./heuristics";

export interface Classification {
  category: Category;
  priority: Priority;
  reason: string;
  source: "ai" | "fallback";
}

/**
 * Cost note: classification sends ONLY subject + (truncated) description + one line of book context,
 * with a compact system prompt and max_tokens=120. No knowledge base, no thread history.
 */
const SYSTEM = `You triage author support tickets for BookLeaf Publishing (self-publishing, India/US).
Return ONLY a JSON object: {"category": string, "priority": string, "reason": string}

category must be exactly one of:
${CATEGORIES.map((c) => `- ${c}`).join("\n")}

Category guide: Royalty & Payments = royalty amounts, missing/late payouts, bank details, calculations. ISBN & Metadata Issues = wrong/duplicate ISBN, wrong title/author/description on platforms. Printing & Quality = misprints, binding, colour, damaged copies. Distribution & Availability = book unavailable/not listed on Amazon, Flipkart, BookLeaf Store. Book Status & Production Updates = where the book is in production, delays, proofs, cover approval. General Inquiry = everything else (account, bio, how-to).

priority must be exactly one of: Critical, High, Medium, Low.
- Critical: money/legal threats, long-unpaid royalties (months), data errors affecting sales, author threatening to leave/escalate publicly.
- High: ISBN errors, defective printed copies, book unavailable on a live platform, payout clearly overdue, time-sensitive events.
- Medium: standard questions about status, royalty calculation, or availability with no urgency.
- Low: informational or cosmetic requests (update bio, how do I...).

reason: one short sentence (max 20 words). No markdown, no text outside the JSON.`;

export async function classifyTicket(input: {
  subject: string;
  description: string;
  bookContext?: string;
}): Promise<Classification> {
  const text = `${input.subject}\n${input.description}`;
  const fallback = (why: string): Classification => {
    const category = heuristicCategory(text);
    return {
      category,
      priority: applyPriorityFloor(category, heuristicPriority(text, category)),
      reason: `Keyword-based triage (${why}).`,
      source: "fallback",
    };
  };

  if (!aiConfigured()) return fallback("AI not configured");

  try {
    const raw = await callLLM({
      system: SYSTEM,
      user: `Book: ${input.bookContext ?? "General / Account Level"}\nSubject: ${input.subject}\nMessage: ${input.description.slice(0, 1500)}`,
      maxTokens: 120,
      temperature: 0,
    });
    const parsed = parseJson(raw);
    if (!parsed) throw new LLMError("Model did not return JSON", "bad_response");
    const category = CATEGORIES.find((c) => c === parsed.category);
    const priority = PRIORITIES.find((p) => p === parsed.priority);
    if (!category || !priority) throw new LLMError("Model returned invalid labels", "bad_response");
    return {
      category,
      priority: applyPriorityFloor(category, priority),
      reason: String(parsed.reason ?? "").slice(0, 200),
      source: "ai",
    };
  } catch (e) {
    console.warn("[ai] classification fell back:", e instanceof LLMError ? `${e.kind} - ${e.message}` : e);
    return fallback(e instanceof LLMError ? e.kind.replace("_", " ") : "AI error");
  }
}

function parseJson(raw: string): Record<string, unknown> | null {
  const match = raw.match(/\{[\s\S]*\}/); // tolerate stray prose or code fences
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
