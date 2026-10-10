import { Types } from "mongoose";
import { Ticket } from "@/models/Ticket";
import { Book } from "@/models/Book";
import { User } from "@/models/User";
import { Session } from "../auth";
import { notFound, objectId } from "../api";
import { Role } from "../constants";
import type { BookFacts, DraftInput } from "../ai/draft";

const POPULATE = [
  { path: "author", select: "name email packageType country bankDetailsLinked" },
  { path: "book", select: "title isbn status" },
  { path: "assignedTo", select: "name" },
];

/**
 * Loads a ticket enforcing ownership: authors get a 404 (not 403) for other people's tickets
 * so ticket ids can't be probed. Admins can load anything.
 */
export async function loadTicket(id: string, session: Session) {
  const ticket = await Ticket.findById(objectId(id, "ticket id")).populate(POPULATE);
  if (!ticket) throw notFound("Ticket not found");
  if (session.role === "author" && String((ticket.author as any)._id) !== session.sub) throw notFound("Ticket not found");
  return ticket;
}

export async function populateTicket(ticket: InstanceType<typeof Ticket>) {
  return ticket.populate(POPULATE);
}

/** Shape sent over the wire. Internal notes, AI draft and classification provenance never reach authors. */
export function serializeTicket(t: any, role: Role) {
  const base = {
    id: String(t._id),
    ref: `BL-${String(t._id).slice(-6).toUpperCase()}`,
    subject: t.subject,
    description: t.description,
    attachments: t.attachments ?? [],
    status: t.status,
    category: t.category,
    priority: t.priority,
    author: t.author?._id ? { id: String(t.author._id), name: t.author.name, email: t.author.email } : null,
    book: t.book?._id ? { id: String(t.book._id), title: t.book.title, isbn: t.book.isbn } : null,
    assignedTo: t.assignedTo?._id ? { id: String(t.assignedTo._id), name: t.assignedTo.name } : null,
    messages: (t.messages ?? []).map((m: any) => ({
      id: String(m._id),
      sender: m.sender,
      senderName: m.senderName,
      body: m.body,
      createdAt: m.createdAt,
    })),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
  if (role !== "admin") return base;
  return {
    ...base,
    categorySource: t.categorySource,
    prioritySource: t.prioritySource,
    classificationReason: t.classificationReason,
    internalNotes: (t.internalNotes ?? []).map((n: any) => ({
      id: String(n._id),
      authorName: n.authorName,
      body: n.body,
      createdAt: n.createdAt,
    })),
  };
}

export function serializeBook(b: any) {
  return {
    id: String(b._id),
    title: b.title,
    isbn: b.isbn,
    genre: b.genre,
    publicationDate: b.publicationDate,
    status: b.status,
    productionStage: b.productionStage,
    mrp: b.mrp,
    copiesSold: b.copiesSold,
    royaltyEarned: b.royaltyEarned,
    royaltyPaid: b.royaltyPaid,
    royaltyPending: b.royaltyPending,
    platforms: b.platforms ?? [],
  };
}

/** Gathers the facts the draft prompt needs. Account-level tickets get a compact view of all the author's books. */
export async function buildDraftInput(ticket: any): Promise<DraftInput> {
  const authorId = ticket.author._id as Types.ObjectId;
  const [author, books] = await Promise.all([
    User.findById(authorId).lean(),
    ticket.book?._id ? Book.find({ _id: ticket.book._id }).lean() : Book.find({ author: authorId }).lean(),
  ]);
  return {
    authorName: author?.name ?? ticket.author.name,
    authorPackage: author?.packageType ?? "Standard Free",
    bankDetailsLinked: author?.bankDetailsLinked ?? false,
    category: ticket.category,
    priority: ticket.priority,
    subject: ticket.subject,
    description: ticket.description,
    ticketAgeDays: Math.max(0, Math.floor((Date.now() - new Date(ticket.createdAt).getTime()) / 86400000)),
    books: books as unknown as BookFacts[],
    thread: (ticket.messages ?? []).map((m: any) => ({ sender: m.sender, body: m.body })),
  };
}
