export const dynamic = "force-dynamic";
import { route, json, parseBody, parseQuery, objectId, notFound } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { createTicketSchema, ticketQuerySchema } from "@/lib/validation";
import { Ticket } from "@/models/Ticket";
import { Book } from "@/models/Book";
import { classifyTicket } from "@/lib/ai/classify";
import { populateTicket, serializeTicket } from "@/lib/services/tickets";
import { PRIORITY_RANK, isClosedStatus } from "@/lib/constants";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Authors: their own tickets, newest first.
 * Admins: all tickets, sorted so unresolved + highest priority + oldest come first.
 */
export const GET = route(async (req) => {
  const s = await requireSession(req);
  const q = parseQuery(req, ticketQuerySchema);

  const filter: Record<string, any> = {};
  if (s.role === "author") filter.author = objectId(s.sub);
  if (q.status) filter.status = q.status;
  if (q.category) filter.category = q.category;
  if (q.priority) filter.priority = q.priority;
  if (q.from || q.to) {
    filter.createdAt = {};
    if (q.from) filter.createdAt.$gte = new Date(`${q.from}T00:00:00.000Z`);
    if (q.to) filter.createdAt.$lte = new Date(`${q.to}T23:59:59.999Z`);
  }
  if (s.role === "admin") {
    if (q.assigned === "me") filter.assignedTo = objectId(s.sub);
    if (q.assigned === "unassigned") filter.assignedTo = null;
    if (q.q) filter.subject = { $regex: escapeRegex(q.q), $options: "i" };
  }

  const docs = await Ticket.find(filter)
    .populate([
      { path: "author", select: "name email" },
      { path: "book", select: "title isbn" },
      { path: "assignedTo", select: "name" },
    ])
    .sort({ createdAt: -1 })
    .limit(300);

  if (s.role === "admin") {
    docs.sort((a, b) => {
      const closed = Number(isClosedStatus(a.status)) - Number(isClosedStatus(b.status));
      if (closed) return closed;
      const prio = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (prio) return prio;
      return a.createdAt.getTime() - b.createdAt.getTime(); // oldest first
    });
  }
  const tickets = docs.map((d) => serializeTicket(d, s.role));

  // Status counts across the whole queue (ignoring filters) for the admin summary chips.
  const counts =
    s.role === "admin"
      ? Object.fromEntries((await Ticket.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }])).map((r) => [r._id, r.n]))
      : undefined;

  return json({ tickets, counts });
});

/** Authors create tickets. The ticket is persisted FIRST; AI triage is best-effort and can never block creation. */
export const POST = route(async (req) => {
  const s = await requireSession(req, "author");
  const body = await parseBody(req, createTicketSchema);

  let bookContext = "General / Account Level";
  let bookId = null;
  if (body.bookId) {
    const book = await Book.findOne({ _id: objectId(body.bookId, "bookId"), author: objectId(s.sub) }).lean();
    if (!book) throw notFound("That book was not found on your account");
    bookId = book._id;
    bookContext = `"${book.title}" (${book.status}${book.productionStage ? `, stage: ${book.productionStage}` : ""})`;
  }

  const ticket = await Ticket.create({
    author: objectId(s.sub),
    book: bookId,
    subject: body.subject,
    description: body.description,
    attachments: body.attachments ?? [],
  });

  const result = await classifyTicket({ subject: body.subject, description: body.description, bookContext });
  ticket.set({
    category: result.category,
    priority: result.priority,
    categorySource: result.source,
    prioritySource: result.source,
    classificationReason: result.reason,
  });
  await ticket.save();
  await populateTicket(ticket);

  return json({ ticket: serializeTicket(ticket, s.role) }, 201);
});
