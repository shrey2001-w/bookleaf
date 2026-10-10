/**
 * Seeds MongoDB with 2 admins, 10 authors, 18 books and a few demo tickets.
 * Idempotent: wipes the three collections first.   Run: npm run seed
 *
 * To use the official bookleaf_sample_data.json instead, adapt the AUTHORS / BOOKS constants below
 * (or map the JSON into them) - everything else in the app reads from MongoDB only.
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../src/models/User";
import { Book } from "../src/models/Book";
import { Ticket } from "../src/models/Ticket";
import { heuristicCategory, heuristicPriority, applyPriorityFloor } from "../src/lib/ai/heuristics";

const AUTHOR_PASSWORD = "Author@123";
const ADMIN_PASSWORD = "Admin@123";

const ADMINS = [
  { name: "Neha Kapoor (Ops)", email: "admin@bookleaf.in" },
  { name: "Rahul Verma (Ops)", email: "ops@bookleaf.in" },
];

const AUTHORS = [
  { name: "Priya Sharma", email: "priya.sharma@example.com", packageType: "Standard Free", country: "IN", bank: true },
  { name: "Rohan Mehta", email: "rohan.mehta@example.com", packageType: "Bestseller Breakthrough", country: "IN", bank: true },
  { name: "Ananya Iyer", email: "ananya.iyer@example.com", packageType: "Standard Free", country: "IN", bank: true },
  { name: "David Collins", email: "david.collins@example.com", packageType: "Bestseller Breakthrough", country: "US", bank: false },
  { name: "Sneha Kulkarni", email: "sneha.kulkarni@example.com", packageType: "Standard Free", country: "IN", bank: true },
  { name: "Arjun Nair", email: "arjun.nair@example.com", packageType: "Standard Free", country: "IN", bank: true },
  { name: "Emily Carter", email: "emily.carter@example.com", packageType: "Bestseller Breakthrough", country: "US", bank: true },
  { name: "Vikram Singh", email: "vikram.singh@example.com", packageType: "Standard Free", country: "IN", bank: false },
  { name: "Meera Reddy", email: "meera.reddy@example.com", packageType: "Standard Free", country: "IN", bank: true },
  { name: "Karan Malhotra", email: "karan.malhotra@example.com", packageType: "Standard Free", country: "IN", bank: false },
] as const;

const ALL = ["Amazon India", "Flipkart", "Amazon US", "Amazon UK", "BookLeaf Store"];
const plat = (...unavailable: string[]) => ALL.map((name) => ({ name, available: !unavailable.includes(name) }));

// [authorIdx, title, isbn, genre, pubDate, status, stage, mrp, sold, earned, paid, platforms]
type Row = [number, string, string | null, string, string | null, "Published" | "In Production", string | null, number, number, number, number, ReturnType<typeof plat>];
const BOOKS: Row[] = [
  [0, "The Monsoon Ledger", "978-93-90000-01-1", "Fiction", "2025-03-15", "Published", null, 349, 412, 28840, 21000, plat()],
  [0, "Letters to Jaipur", "978-93-90000-02-8", "Poetry", "2026-02-10", "Published", null, 199, 96, 5200, 0, plat()],
  [1, "Startup Sutras", "978-93-90000-03-5", "Business", "2024-11-20", "Published", null, 499, 780, 71200, 71200, plat()],
  [1, "Code & Chai", "978-93-90000-04-2", "Technology", "2025-05-10", "Published", null, 399, 205, 18900, 12000, plat()],
  [2, "Threads of Silk", "978-93-90000-05-9", "Historical Fiction", "2025-01-25", "Published", null, 299, 200, 3000, 3000, plat()],
  [2, "Banyan Season", "978-93-90000-06-6", "Children", "2025-08-12", "Published", null, 249, 44, 780, 0, plat()],
  [3, "Midnight in Maple Falls", "978-93-90000-07-3", "Mystery", "2024-12-05", "Published", null, 599, 321, 41200, 41200, plat("BookLeaf Store")],
  [3, "Unfinished Coastline", "978-93-90000-08-0", "Memoir", "2026-05-18", "Published", null, 449, 150, 14100, 0, plat()],
  [4, "Kitchen Chronicles of Pune", "978-93-90000-09-7", "Cooking", "2025-02-02", "Published", null, 549, 530, 52300, 40000, plat()],
  [5, "Beyond the Backwaters", "978-93-90000-10-3", "Travel", "2026-06-22", "Published", null, 379, 87, 4100, 0, plat()],
  [5, "The Last Lighthouse Keeper", "978-93-90000-11-0", "Fiction", "2026-09-20", "Published", null, 299, 0, 0, 0, plat("Amazon India")],
  [6, "Prairie Hearts", "978-93-90000-12-7", "Romance", "2024-10-14", "Published", null, 399, 640, 66000, 66000, plat()],
  [6, "Whispers of the Rockies", "978-93-90000-13-4", "Fiction", "2025-05-30", "Published", null, 349, 188, 15300, 9000, plat()],
  [7, "Dharma in the Boardroom", "978-93-90000-14-1", "Self-Help", "2025-03-03", "Published", null, 299, 310, 22400, 22400, plat()],
  [7, "Echoes of Kargil", "978-93-90000-15-8", "History", "2026-04-28", "Published", null, 449, 120, 9800, 0, plat()],
  [8, "Neon Monsoon", null, "Science Fiction", null, "In Production", "Typesetting", 349, 0, 0, 0, []],
  [8, "Garden of Small Mercies", "978-93-90000-17-2", "Poetry", "2025-01-10", "Published", null, 199, 63, 1900, 0, plat()],
  [9, "The Quiet Algorithm", null, "Technology", null, "In Production", "Cover Design (awaiting author approval)", 399, 0, 0, 0, []],
];

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set (see .env.local)");
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([User.deleteMany({}), Book.deleteMany({}), Ticket.deleteMany({})]);

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const authorHash = await bcrypt.hash(AUTHOR_PASSWORD, 10);
  const admins = await User.insertMany(ADMINS.map((a) => ({ ...a, passwordHash: adminHash, role: "admin" })));
  const authors = await User.insertMany(
    AUTHORS.map((a) => ({
      name: a.name, email: a.email, passwordHash: authorHash, role: "author",
      packageType: a.packageType, country: a.country, bankDetailsLinked: a.bank,
    }))
  );

  const books = await Book.insertMany(
    BOOKS.map(([ai, title, isbn, genre, date, status, stage, mrp, sold, earned, paid, platforms]) => ({
      author: authors[ai]._id, title, isbn, genre,
      publicationDate: date ? new Date(date) : null,
      status, productionStage: stage, mrp, copiesSold: sold,
      royaltyEarned: earned, royaltyPaid: paid, royaltyPending: earned - paid, platforms,
    }))
  );
  const bookByTitle = (t: string) => books.find((b) => b.title === t)!;

  // Demo tickets mirroring the sample queries; classified with the offline heuristics so seeding needs no API key.
  const DEMO = [
    { a: 7, b: "Echoes of Kargil", s: "No royalty received after 5 months", d: "I published my book about 5 months ago and still haven't received any royalty. What's going on? I have also not seen any payment in my bank account.", age: 5 },
    { a: 2, b: "Threads of Silk", s: "Royalty amount seems too low", d: "My royalty amount seems too low. I sold 200 copies but only received Rs 3,000. Can you explain how it is calculated?", age: 3 },
    { a: 5, b: "The Last Lighthouse Keeper", s: "Showing Currently Unavailable on Amazon", d: "My book is published but it's showing as 'Currently Unavailable' on Amazon India.", age: 1 },
    { a: 3, b: "Midnight in Maple Falls", s: "ISBN mismatch on Amazon", d: "My book is showing a different ISBN on Amazon than what's printed on the physical copy.", age: 2 },
    { a: 8, b: "Neon Monsoon", s: "Still in typesetting after 3 weeks", d: "It's been 3 weeks and my book is still in typesetting. When will it be done?", age: 4 },
    { a: 0, b: null, s: "Can I update my author bio?", d: "Can I update the description of my book and my author bio on Amazon after it's already live?", age: 0 },
  ];
  for (const t of DEMO) {
    const text = `${t.s}\n${t.d}`;
    const category = heuristicCategory(text);
    const priority = applyPriorityFloor(category, heuristicPriority(text, category));
    await Ticket.create({
      author: authors[t.a]._id, book: t.b ? bookByTitle(t.b)._id : null, subject: t.s, description: t.d,
      category, priority, categorySource: "fallback", prioritySource: "fallback",
      classificationReason: "Seeded demo ticket (keyword triage).",
      createdAt: daysAgo(t.age), updatedAt: daysAgo(t.age),
    });
  }
  void admins;

  console.log(`Seeded ${admins.length} admins, ${authors.length} authors, ${books.length} books, ${DEMO.length} tickets.`);
  console.log(`Admin login:  admin@bookleaf.in / ${ADMIN_PASSWORD}`);
  console.log(`Author login: priya.sharma@example.com / ${AUTHOR_PASSWORD} (all authors share this password)`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
