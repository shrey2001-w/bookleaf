import type { Category } from "../constants";

/**
 * BookLeaf knowledge base, split into small sections so each LLM call only receives
 * what's relevant to the ticket's category (cost control) instead of the whole document.
 */
export const KB = {
  overview: `BookLeaf Publishing is a self-publishing company in India and the US. Packages: Standard Free (no upfront cost) and Bestseller Breakthrough (paid; marketing and distribution add-ons). We handle cover design, typesetting, ISBN assignment, printing, distribution and royalty management. In-house printing facility and warehouse are in Delhi; print partners are Repro India and Epitome Books.`,

  royalty: `ROYALTY POLICY
- 80/20 split: 80% of net profit per book to the author, 20% to BookLeaf.
- Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart) and shipping charges.
- Royalties are calculated quarterly and paid within 45 days of the quarter ending.
- Minimum payout threshold is Rs 1,000. Below that, royalties roll over to the next quarter.
- Paid by bank transfer to the account linked in the author's dashboard.
- Authors can see a detailed royalty breakdown (sales per platform) in their dashboard.`,

  isbn: `ISBN POLICY
- Every book gets a unique ISBN assigned by BookLeaf, registered under BookLeaf's publisher imprint.
- An author who wants an ISBN under their own imprint must obtain it independently.
- ISBN errors (duplicate, wrong book linked, mismatch between platform and physical copy) are HIGH PRIORITY and escalated to the production team.`,

  printing: `PRINTING & QUALITY
- In-house printing handles most orders; overflow or special formats go to Repro India or Epitome Books.
- Standard print turnaround: 5-7 business days from order confirmation.
- Quality issues (misprints, binding defects, colour inconsistency): BookLeaf arranges a FREE reprint after verification. The author may need to share photos of the defective copy.`,

  distribution: `DISTRIBUTION & AVAILABILITY
- Listed on Amazon India, Flipkart, Amazon US, Amazon UK and the BookLeaf Store.
- New listings usually go live 7-10 business days after publication is complete.
- A book showing "unavailable" on a platform usually means a stock sync issue; the team can trigger a re-sync within 24-48 hours.`,

  production: `PRODUCTION STAGES
Manuscript Received -> Editing (if opted) -> Cover Design -> Typesetting -> Proofreading -> ISBN Assignment -> Printing -> Distribution Setup -> Published & Live.
Authors get an email at each stage. Delays typically occur at Cover Design (waiting for author approval) and Proofreading (revision rounds).`,

  general: `METADATA UPDATES: Book description/metadata changes can be submitted via the dashboard or by emailing the BookLeaf team. Changes typically reflect on platforms within 3-5 business days.`,

  tone: `TONE GUIDELINES
- Empathetic and professional; authors are partners, not customers to be managed.
- Acknowledge the author's concern BEFORE jumping to solutions.
- Be specific: real numbers, dates and statuses instead of vague reassurance.
- If BookLeaf is at fault (delayed royalties, ISBN error) own it directly. No corporate deflection.
- If escalation/investigation is needed, give a clear timeline (e.g. "within 48 hours"), never open-ended promises.
- Always end with a clear next step for the author and/or the BookLeaf team.`,
} as const;

/** Which KB sections each category needs (plus overview + tone, which are always included). */
export const CATEGORY_SECTIONS: Record<Category, (keyof typeof KB)[]> = {
  "Royalty & Payments": ["royalty"],
  "ISBN & Metadata Issues": ["isbn", "general"],
  "Printing & Quality": ["printing"],
  "Distribution & Availability": ["distribution"],
  "Book Status & Production Updates": ["production"],
  "General Inquiry": ["general", "royalty"],
};

/** Few-shot style guidance per category, distilled from BookLeaf's sample query/response table. */
export const CATEGORY_PLAYBOOK: Record<Category, string> = {
  "Royalty & Payments": `If no royalty received: acknowledge the frustration, explain the quarterly cycle and 45-day payout window, check whether bank details are linked, give the specific next payout date. If it is genuinely overdue, own it and escalate with a 48-hour resolution timeline. If the amount looks too low: walk through net profit (MRP minus printing, platform commission, shipping), offer a line-by-line royalty breakdown, never be defensive.`,
  "ISBN & Metadata Issues": `Treat as high priority. Acknowledge it is a serious data issue, confirm you are escalating to the production team immediately, and give a 48-hour resolution timeline.`,
  "Printing & Quality": `Apologise sincerely. Ask for photos of the defective copies. Confirm a free reprint once verified, with a 5-7 business day timeline for the reprint.`,
  "Distribution & Availability": `Explain this is typically a stock sync issue, confirm you are triggering a re-sync with the distribution team, and set a 24-48 hour expectation.`,
  "Book Status & Production Updates": `Use the actual production stage from the book data. If delayed, be honest about why (e.g. waiting on author approval of proofs) without blaming the author; frame it collaboratively. Give a specific updated timeline.`,
  "General Inquiry": `Answer the question directly from policy. For metadata updates: via dashboard or email, reflected on platforms in 3-5 business days.`,
};

export function knowledgeFor(category: Category): string {
  const sections = [KB.overview, ...CATEGORY_SECTIONS[category].map((k) => KB[k])];
  return sections.join("\n\n");
}
