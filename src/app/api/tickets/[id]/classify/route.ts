export const dynamic = "force-dynamic";
import { route, json } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { loadTicket, populateTicket, serializeTicket } from "@/lib/services/tickets";
import { classifyTicket } from "@/lib/ai/classify";

/** Admin-only: re-run AI classification (e.g. after the AI was down at creation time). */
export const POST = route(async (req, { params }) => {
  const s = await requireSession(req, "admin");
  const ticket = await loadTicket(params.id, s);
  const r = await classifyTicket({
    subject: ticket.subject,
    description: ticket.description,
    bookContext: (ticket.book as any)?.title,
  });
  ticket.set({
    category: r.category,
    priority: r.priority,
    categorySource: r.source,
    prioritySource: r.source,
    classificationReason: r.reason,
    aiDraft: null,
  });
  await ticket.save();
  await populateTicket(ticket);
  return json({ ticket: serializeTicket(ticket, s.role) });
});
