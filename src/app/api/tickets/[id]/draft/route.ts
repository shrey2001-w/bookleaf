export const dynamic = "force-dynamic";
import { route, json } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { draftSchema } from "@/lib/validation";
import { loadTicket, buildDraftInput } from "@/lib/services/tickets";
import { generateDraft } from "@/lib/ai/draft";

/**
 * Admin-only. Returns the cached AI draft if there is one (zero LLM cost when an admin reopens a ticket);
 * generates a new one on first open or when { regenerate: true } is passed.
 * If the LLM is unavailable, a policy-based template is returned with source: "template".
 */
export const POST = route(async (req, { params }) => {
  const s = await requireSession(req, "admin");
  const raw = await req.json().catch(() => ({}));
  const { regenerate } = draftSchema.parse(raw ?? {});
  const ticket = await loadTicket(params.id, s);

  if (ticket.aiDraft && !regenerate) {
    return json({ draft: { text: ticket.aiDraft.text, source: ticket.aiDraft.source, model: ticket.aiDraft.model, cached: true } });
  }
  const draft = await generateDraft(await buildDraftInput(ticket));
  // Only cache genuine AI output; template fallbacks should be retried once the AI is back.
  ticket.aiDraft = draft.source === "ai" ? { ...draft, generatedAt: new Date() } : null;
  await ticket.save();
  return json({ draft: { ...draft, cached: false } });
});
