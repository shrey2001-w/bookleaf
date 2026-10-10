export const dynamic = "force-dynamic";
import { route, json, parseBody } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { updateTicketSchema } from "@/lib/validation";
import { loadTicket, populateTicket, serializeTicket } from "@/lib/services/tickets";
import { objectId } from "@/lib/api";

export const GET = route(async (req, { params }) => {
  const s = await requireSession(req);
  const ticket = await loadTicket(params.id, s);
  return json({ ticket: serializeTicket(ticket, s.role) });
});

/** Admin-only: change status, override AI category/priority, assign/unassign. */
export const PATCH = route(async (req, { params }) => {
  const s = await requireSession(req, "admin");
  const body = await parseBody(req, updateTicketSchema);
  const ticket = await loadTicket(params.id, s);

  if (body.status) ticket.status = body.status;
  if (body.category && body.category !== ticket.category) {
    ticket.category = body.category;
    ticket.categorySource = "admin";
    ticket.aiDraft = null; // draft was written for the old category's policy context
  }
  if (body.priority) {
    ticket.priority = body.priority;
    ticket.prioritySource = "admin";
  }
  if (body.assignee !== undefined) ticket.assignedTo = body.assignee === "me" ? objectId(s.sub) : null;

  await ticket.save();
  await populateTicket(ticket);
  return json({ ticket: serializeTicket(ticket, s.role) });
});
