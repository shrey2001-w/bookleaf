import { CATEGORIES, Category, Priority } from "../constants";

/**
 * Deterministic keyword classifier. Used (a) when the AI is down/unconfigured and (b) as a
 * guardrail layer on top of the model's output. Intentionally simple and explainable.
 */
const CATEGORY_KEYWORDS: Record<Exclude<Category, "General Inquiry">, RegExp[]> = {
  "ISBN & Metadata Issues": [/isbn/, /barcode/, /metadata/, /wrong (title|author|cover|book)/, /duplicate/, /different (isbn|title)/],
  "Royalty & Payments": [/royalt/, /payout/, /payment/, /paid/, /bank/, /earning/, /commission/, /\bnet profit\b/, /invoice/],
  "Printing & Quality": [/print/, /quality/, /blurry/, /misalign/, /binding/, /defect/, /damaged/, /torn/, /colou?r/, /author copies/, /reprint/],
  "Distribution & Availability": [/amazon/, /flipkart/, /unavailable/, /out of stock/, /listing/, /not (showing|visible|available)/, /bookstore/, /availability/],
  "Book Status & Production Updates": [/status/, /typeset/, /proof/, /cover design/, /editing/, /when will/, /delay/, /production/, /how long/, /manuscript/],
};

export function heuristicCategory(text: string): Category {
  const t = text.toLowerCase();
  let best: Category = "General Inquiry";
  let bestScore = 0;
  for (const cat of CATEGORIES) {
    if (cat === "General Inquiry") continue;
    const score = CATEGORY_KEYWORDS[cat].reduce((n, re) => n + (re.test(t) ? 1 : 0), 0);
    if (score > bestScore) {
      best = cat;
      bestScore = score;
    }
  }
  return best;
}

export function heuristicPriority(text: string, category: Category): Priority {
  const t = text.toLowerCase();
  if (/(legal|lawyer|scam|fraud|cheat|consumer court|refund|never received|not received any|no royalt|haven'?t received)/.test(t) &&
      /(month|year|\d+ (weeks|months))/.test(t)) return "Critical";
  if (/(legal|lawyer|scam|fraud|cheat|consumer court)/.test(t)) return "Critical";
  if (category === "ISBN & Metadata Issues") return "High";
  if (/(urgent|asap|immediately|launch|event|deadline)/.test(t)) return "High";
  if (category === "Royalty & Payments" && /(not received|haven'?t received|missing|too low|wrong amount|overdue)/.test(t)) return "High";
  if (category === "Printing & Quality" && /(blurry|defect|misprint|damaged|terrible|misalign)/.test(t)) return "High";
  if (category === "Distribution & Availability" && /(unavailable|not showing|out of stock)/.test(t)) return "High";
  if (/(update (my )?(bio|description)|can i|how do i|just wanted|curious|general question)/.test(t)) return "Low";
  return "Medium";
}

/** Policy guardrail: ISBN problems are always at least High (per BookLeaf ISBN policy). */
export function applyPriorityFloor(category: Category, priority: Priority): Priority {
  if (category === "ISBN & Metadata Issues" && (priority === "Medium" || priority === "Low")) return "High";
  return priority;
}
