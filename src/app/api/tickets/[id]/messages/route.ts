export const dynamic = "force-dynamic";
import { route, json, parseBody, objectId, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { messageSchema } from "@/lib/validation";
import { loadTicket, populateTicket, serializeTicket } from "@/lib/services/tickets";

/**
 * Admin: sends the (edited) response to the author, optionally setting a new status.
 * Author: adds a follow-up on their own ticket (reopens it if it was Resolved).
 */
export const POST = route(async (req, { params }) => {
  const s = await requireSession(req);
  const { body, status } = await parseBody(req, messageSchema);
  const ticket = await loadTicket(params.id, s);

  if (s.role === "admin") {
    ticket.messages.push({ sender: "admin", senderName: s.name, body } as any);
    ticket.status = status ?? (ticket.status === "Open" ? "In Progress" : ticket.status);
    if (!ticket.assignedTo) ticket.assignedTo = objectId(s.sub);
  } else {
    if (ticket.status === "Closed") {
      throw new ApiError(409, "ticket_closed", "This ticket is closed. Please open a new ticket for further questions.");
    }
    ticket.messages.push({ sender: "author", senderName: s.name, body } as any);
    if (ticket.status === "Resolved") ticket.status = "Open"; // author follow-up reopens
  }
  ticket.aiDraft = null; // thread changed -> cached draft is stale
  await ticket.save();
  await populateTicket(ticket);
  return json({ ticket: serializeTicket(ticket, s.role) }, 201);
});
