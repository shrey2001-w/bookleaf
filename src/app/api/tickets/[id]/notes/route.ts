export const dynamic = "force-dynamic";
import { route, json, parseBody } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { noteSchema } from "@/lib/validation";
import { loadTicket, populateTicket, serializeTicket } from "@/lib/services/tickets";

/** Admin-only internal notes. Never serialized for authors. */
export const POST = route(async (req, { params }) => {
  const s = await requireSession(req, "admin");
  const { body } = await parseBody(req, noteSchema);
  const ticket = await loadTicket(params.id, s);
  ticket.internalNotes.push({ authorName: s.name, body } as any);
  await ticket.save();
  await populateTicket(ticket);
  return json({ ticket: serializeTicket(ticket, s.role) }, 201);
});
