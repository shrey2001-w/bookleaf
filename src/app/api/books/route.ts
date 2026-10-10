export const dynamic = "force-dynamic";
import { route, json, objectId } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { Book } from "@/models/Book";
import { serializeBook } from "@/lib/services/tickets";
import { nextPayoutInfo } from "@/lib/royalty";

/** Authors: their own books only. Admins: all books, optionally filtered with ?authorId=. */
export const GET = route(async (req) => {
  const s = await requireSession(req);
  const filter: Record<string, unknown> = {};
  if (s.role === "author") filter.author = objectId(s.sub);
  else {
    const authorId = req.nextUrl.searchParams.get("authorId");
    if (authorId) filter.author = objectId(authorId, "authorId");
  }
  const books = await Book.find(filter).sort({ publicationDate: -1, createdAt: -1 }).lean();
  const { quarterEnd, deadline } = nextPayoutInfo();
  return json({ books: books.map(serializeBook), nextPayout: { quarterEnd, deadline } });
});
