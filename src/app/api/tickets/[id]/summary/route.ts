export const dynamic = "force-dynamic";
import { route, json } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { loadTicket } from "@/lib/services/tickets";
import { summarizeTicket } from "@/lib/ai/assist";

/** Admin-only AI summary for long threads. Cached on the ticket until a new message arrives. */
export const POST = route(async (req, { params }) => {
  const s = await requireSession(req, "admin");
  const ticket = await loadTicket(params.id, s);
  const count = ticket.messages.length;

  if (ticket.aiSummary && ticket.aiSummary.messageCount === count) {
    return json({ summary: { text: ticket.aiSummary.text, source: "ai", cached: true } });
  }
  const r = await summarizeTicket({
    subject: ticket.subject,
    category: ticket.category,
    bookTitle: (ticket.book as any)?.title,
    description: ticket.description,
    thread: ticket.messages.map((m) => ({ sender: m.sender, body: m.body })),
  });
  if (r.source === "ai") {
    ticket.aiSummary = { text: r.text, messageCount: count, generatedAt: new Date() };
    await ticket.save();
  }
  return json({ summary: { ...r, cached: false } });
});
