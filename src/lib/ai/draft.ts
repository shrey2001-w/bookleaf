import type { Category } from "../constants";
import { CATEGORY_PLAYBOOK, KB, knowledgeFor } from "./knowledge";
import { callLLM, aiConfigured, modelName, LLMError } from "./llm";
import { fmtDate, inr, nextPayoutInfo } from "../royalty";

export interface DraftInput {
  authorName: string;
  authorPackage: string;
  bankDetailsLinked: boolean;
  category: Category;
  priority: string;
  subject: string;
  description: string;
  ticketAgeDays: number;
  books: BookFacts[]; // the referenced book, or all of the author's books for account-level tickets
  thread: { sender: string; body: string }[];
}
export interface BookFacts {
  title: string;
  isbn: string | null;
  status: string;
  productionStage: string | null;
  publicationDate: Date | null;
  mrp: number;
  copiesSold: number;
  royaltyEarned: number;
  royaltyPaid: number;
  royaltyPending: number;
  platforms: { name: string; available: boolean }[];
}
export interface Draft {
  text: string;
  source: "ai" | "template";
  model: string;
}

const SYSTEM = `You are a senior author-support representative at BookLeaf Publishing writing a reply to an author's support ticket. An admin will review and edit your draft before it is sent.

HARD RULES
1. Use ONLY facts from the POLICY and AUTHOR DATA sections. Never invent amounts, dates, order numbers, or commitments that policy does not allow. If a fact you need is missing, insert a bracketed placeholder such as [ADMIN: confirm bank transfer date] instead of guessing.
2. Be specific: quote the author's real numbers (copies sold, royalty earned/paid/pending, ISBN, production stage, next payout date) when they are relevant.
3. Follow the TONE GUIDELINES: acknowledge the concern first, own BookLeaf mistakes directly, give a clear timeline for escalations, end with a clear next step.
4. Do not claim an action has already happened (e.g. "I have re-synced") unless the policy says it is done; say what the team WILL do and by when.
5. Never blame the author, even if the delay is on their side; keep it collaborative.

FORMAT: plain text only (no markdown, no bullets unless listing 2-3 short items). Start with "Hi <first name>,". 110-200 words. Short paragraphs. End with a line starting "Next step:" and then sign off exactly:
Warm regards,
BookLeaf Author Support Team`;

export async function generateDraft(input: DraftInput): Promise<Draft> {
  if (!aiConfigured()) return templateDraft(input);
  try {
    const text = await callLLM({
      system: SYSTEM,
      user: buildUserPrompt(input),
      maxTokens: 450,
      temperature: 0.3,
    });
    return { text, source: "ai", model: modelName() };
  } catch (e) {
    console.warn("[ai] draft fell back to template:", e instanceof LLMError ? `${e.kind} - ${e.message}` : e);
    return templateDraft(input);
  }
}

/**
 * Cost control: the prompt contains only (1) KB sections for this category, (2) a compact
 * per-book fact line, (3) the last 3 thread messages truncated to 400 chars each.
 */
function buildUserPrompt(i: DraftInput): string {
  const { quarterEnd, deadline } = nextPayoutInfo();
  const books = i.books.slice(0, 5).map(bookLine).join("\n") || "No specific book (account-level query).";
  const thread = i.thread
    .slice(-3)
    .map((m) => `${m.sender.toUpperCase()}: ${m.body.slice(0, 400)}`)
    .join("\n");
  return [
    `POLICY\n${knowledgeFor(i.category)}`,
    `${KB.tone}`,
    `HOW TO RESPOND TO THIS CATEGORY (${i.category})\n${CATEGORY_PLAYBOOK[i.category]}`,
    `AUTHOR DATA
Name: ${i.authorName} | Package: ${i.authorPackage} | Bank details linked: ${i.bankDetailsLinked ? "yes" : "NO"}
Today: ${fmtDate(new Date())} | Most recent quarter end: ${fmtDate(quarterEnd)} | Next royalty payout deadline: ${fmtDate(deadline)}
Books:\n${books}`,
    `TICKET (priority ${i.priority}, open for ${i.ticketAgeDays} day(s))
Subject: ${i.subject}
Message: ${i.description.slice(0, 1500)}${thread ? `\nPrevious messages:\n${thread}` : ""}`,
    `Write the reply now.`,
  ].join("\n\n");
}

export function bookLine(b: BookFacts): string {
  const base = `- "${b.title}" | ISBN: ${b.isbn ?? "not yet assigned"} | ${b.status}${b.productionStage ? ` (stage: ${b.productionStage})` : ""}`;
  if (b.status !== "Published") return `${base} | MRP ${inr(b.mrp)}`;
  const plat = b.platforms.map((p) => `${p.name}${p.available ? "" : " (UNAVAILABLE)"}`).join(", ");
  return `${base} | published ${b.publicationDate ? fmtDate(b.publicationDate) : "n/a"} | MRP ${inr(b.mrp)} | sold ${b.copiesSold} | royalty earned ${inr(b.royaltyEarned)}, paid ${inr(b.royaltyPaid)}, pending ${inr(b.royaltyPending)} | platforms: ${plat || "n/a"}`;
}

/** Offline fallback: policy-accurate skeleton the admin can complete if the LLM is unreachable. */
function templateDraft(i: DraftInput): Draft {
  const first = i.authorName.split(" ")[0];
  const { deadline } = nextPayoutInfo();
  const body: Record<Category, string> = {
    "Royalty & Payments": `Thank you for reaching out, and I understand how frustrating questions about royalties can be. Royalties are calculated quarterly and paid by bank transfer within 45 days of the quarter ending; the next payout deadline is ${fmtDate(deadline)}. Net profit is MRP minus printing cost, platform commission and shipping, and you receive 80% of it. Payouts below Rs 1,000 roll over to the next quarter. [ADMIN: add this author's specific figures and confirm bank details are linked.] We are happy to share a line-by-line royalty breakdown on request.`,
    "ISBN & Metadata Issues": `Thank you for flagging this. An ISBN problem is a serious data issue and we are treating it as high priority. We are escalating it to our production team right away, and you will hear back from us within 48 hours. [ADMIN: add details of the mismatch.]`,
    "Printing & Quality": `I am sorry your copies did not meet the quality you deserve. Could you share a few photos of the affected pages or binding? Once we verify the defect, we will arrange a free reprint, which takes 5-7 business days.`,
    "Distribution & Availability": `Thank you for letting us know. A book showing as unavailable is usually a stock sync issue. We are asking our distribution team to trigger a re-sync, and the listing should be back within 24-48 hours.`,
    "Book Status & Production Updates": `Thank you for checking in on your book. [ADMIN: add current production stage and honest reason for any delay, plus an updated timeline.] We will keep you updated by email at each stage.`,
    "General Inquiry": `Thank you for your question. [ADMIN: add the answer.] Metadata and description updates can be submitted through your dashboard or by email to our team, and typically reflect on platforms within 3-5 business days.`,
  };
  const text = `Hi ${first},\n\n${body[i.category]}\n\nNext step: our team will follow up with you within 48 hours.\n\nWarm regards,\nBookLeaf Author Support Team`;
  return { text, source: "template", model: "template" };
}
