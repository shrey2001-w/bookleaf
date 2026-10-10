import type { Category } from "../constants";
import { CATEGORY_PLAYBOOK, KB, knowledgeFor } from "./knowledge";
import { aiConfigured, callLLM, LLMError } from "./llm";
import { heuristicCategory } from "./heuristics";
import { bookLine, BookFacts } from "./draft";
import { fmtDate, nextPayoutInfo } from "../royalty";

export interface AssistInput {
  message: string;
  authorName: string;
  authorPackage: string;
  bankDetailsLinked: boolean;
  books: BookFacts[];
}
export interface AssistResult {
  category: Category;
  answer: string | null; // null => AI unavailable
  needsHuman: boolean;
  source: "ai" | "unavailable";
}

const SYSTEM = `You are BookLeaf Publishing's author-support assistant. You give an author an instant, accurate answer to their question, either before they raise a ticket or instead of one.

RULES
1. Use ONLY the POLICY and AUTHOR DATA provided. Never invent amounts, dates or promises. Quote the author's real figures (royalty earned/paid/pending, ISBN, production stage, platform availability, next payout deadline) when relevant.
2. If resolving it needs a human (verifying a defect, investigating a missing payment or ISBN mismatch, a stock re-sync, anything account-specific you cannot see), explain what the policy is and what will happen, and set needs_human to true.
3. Follow the tone guidelines: acknowledge a problem with empathy first, own BookLeaf's mistakes, be specific, no vague reassurance.
4. At most 110 words, plain text, no markdown.
5. If the question is unrelated to BookLeaf publishing, politely say you can only help with BookLeaf questions and set needs_human to false.

Output ONLY a JSON object: {"answer": string, "needs_human": boolean}`;

export async function answerAuthor(input: AssistInput): Promise<AssistResult> {
  // Category picked with the free keyword classifier, so no extra LLM call is needed to scope the knowledge base.
  const category = heuristicCategory(input.message);
  if (!aiConfigured()) return { category, answer: null, needsHuman: true, source: "unavailable" };

  const { deadline } = nextPayoutInfo();
  const user = [
    `POLICY\n${knowledgeFor(category)}`,
    KB.tone,
    `GUIDANCE FOR ${category.toUpperCase()}\n${CATEGORY_PLAYBOOK[category]}`,
    `AUTHOR DATA
Name: ${input.authorName} | Package: ${input.authorPackage} | Bank details linked: ${input.bankDetailsLinked ? "yes" : "NO"}
Today: ${fmtDate(new Date())} | Next royalty payout deadline: ${fmtDate(deadline)}
Books:\n${input.books.slice(0, 5).map(bookLine).join("\n") || "No books on this account yet."}`,
    `AUTHOR'S QUESTION\n${input.message.slice(0, 1500)}`,
  ].join("\n\n");

  try {
    const raw = await callLLM({ system: SYSTEM, user, maxTokens: 300, temperature: 0.2 });
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (typeof parsed.answer === "string" && parsed.answer.trim()) {
          return { category, answer: parsed.answer.trim(), needsHuman: Boolean(parsed.needs_human), source: "ai" };
        }
      } catch {
        /* fall through to raw text */
      }
    }
    return { category, answer: raw, needsHuman: true, source: "ai" };
  } catch (e) {
    console.warn("[ai] assist unavailable:", e instanceof LLMError ? `${e.kind} - ${e.message}` : e);
    return { category, answer: null, needsHuman: true, source: "unavailable" };
  }
}

const SUMMARY_SYSTEM = `You summarise author support tickets for BookLeaf's internal operations team. In at most 60 words of plain text state: the core issue, any key facts (numbers, book, dates), what has been done so far, and what is still pending. No greeting, no markdown.`;

export async function summarizeTicket(input: {
  subject: string;
  category: string;
  bookTitle?: string;
  description: string;
  thread: { sender: string; body: string }[];
}): Promise<{ text: string; source: "ai" | "fallback" }> {
  const fallback = () => ({ text: input.description.replace(/\s+/g, " ").slice(0, 220) + (input.description.length > 220 ? "…" : ""), source: "fallback" as const });
  if (!aiConfigured()) return fallback();
  try {
    const user = `Category: ${input.category}\nBook: ${input.bookTitle ?? "General / Account Level"}\nSubject: ${input.subject}\nAuthor message: ${input.description.slice(0, 1500)}\n${input.thread
      .slice(-6)
      .map((m) => `${m.sender.toUpperCase()}: ${m.body.slice(0, 300)}`)
      .join("\n")}`;
    return { text: await callLLM({ system: SUMMARY_SYSTEM, user, maxTokens: 120, temperature: 0.2 }), source: "ai" };
  } catch {
    return fallback();
  }
}
