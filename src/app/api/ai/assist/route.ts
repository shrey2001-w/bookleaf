export const dynamic = "force-dynamic";
import { route, json, parseBody, objectId, notFound } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { assistSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { Book } from "@/models/Book";
import { User } from "@/models/User";
import { answerAuthor } from "@/lib/ai/assist";
import type { BookFacts } from "@/lib/ai/draft";

/** Author-only instant help. Grounded in the knowledge base and the caller's OWN books; stateless and rate-limited. */
export const POST = route(async (req) => {
  const s = await requireSession(req, "author");
  rateLimit(`assist:${s.sub}`, 12);
  const { message, bookId } = await parseBody(req, assistSchema);

  const authorId = objectId(s.sub);
  const [user, books] = await Promise.all([
    User.findById(authorId).lean(),
    bookId
      ? Book.find({ _id: objectId(bookId, "bookId"), author: authorId }).lean()
      : Book.find({ author: authorId }).limit(5).lean(),
  ]);
  if (!user) throw notFound("Account not found");
  if (bookId && books.length === 0) throw notFound("That book was not found on your account");

  const result = await answerAuthor({
    message,
    authorName: user.name,
    authorPackage: user.packageType,
    bankDetailsLinked: user.bankDetailsLinked,
    books: books as unknown as BookFacts[],
  });
  return json(result);
});
