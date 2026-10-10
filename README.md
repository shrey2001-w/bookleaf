# BookLeaf Author Support & Communication Portal

Next.js 14 (App Router) · TypeScript · Tailwind CSS · MongoDB (Mongoose) · Anthropic / OpenAI for AI assist.

Two portals in one app: an **Author portal** (`/author/*`) and an **Admin portal** (`/admin`), both on a REST API (`/api/*`).

> Confidential assignment material. Keep the repository **private**.

## Quick start

```bash
npm install
cp .env.example .env.local      # fill in MONGODB_URI, JWT_SECRET, and an AI key
npm run seed                    # 2 admins, 10 authors, 18 books, 6 demo tickets
npm run dev                     # http://localhost:3000
```

Requires Node 20+ and a MongoDB instance (local, Docker `docker run -p 27017:27017 mongo:7`, or Atlas).

### Test credentials (created by `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@bookleaf.in` | `Admin@123` |
| Admin | `ops@bookleaf.in` | `Admin@123` |
| Author (all 10 share a password) | `priya.sharma@example.com` and the 9 others in `scripts/seed.ts` | `Author@123` |

Edge-case data: `david.collins@example.com` (bank not linked, ₹14,100 pending, zero payouts), `meera.reddy@example.com` and `karan.malhotra@example.com` (books still in production, no ISBN), `arjun.nair@example.com` (book unavailable on Amazon India, zero sales), `ananya.iyer@example.com` (royalty below the ₹1,000 payout threshold).

> **Seed data note:** the provided `bookleaf_sample_data.json` was not included with the PDF I worked from, so `scripts/seed.ts` contains a faithful stand-in (10 authors / 18 books covering published, pending, zero-payout and 2 in-production cases). To use the official file, map it into the `AUTHORS` / `BOOKS` arrays in `scripts/seed.ts`; nothing else in the app depends on the seed format.

### Environment variables

| Var | Purpose |
|---|---|
| `MONGODB_URI` | Mongo connection string |
| `JWT_SECRET` | Signs the session cookie (≥16 chars) |
| `AI_PROVIDER` | `anthropic` (default) or `openai` |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Server-side only. Never exposed to the browser (no `NEXT_PUBLIC_` prefix) |
| `AI_MODEL` | Optional override. Defaults: `claude-haiku-5-5` / `gpt-4o-mini` |
| `AI_TIMEOUT_MS` | Per-call timeout, default 12000 |

With **no key set the app still works fully**: classification uses a keyword fallback and drafts are policy templates.

### Deploy (Vercel + MongoDB Atlas)
Push to a private repo → import into Vercel → set the env vars above → run `npm run seed` once locally against the Atlas URI. Polling (not websockets) was chosen partly so this works on serverless.

## Architecture

```
src/
  app/api/**          REST route handlers (thin: auth → validate → service → serialize)
  app/author/**       Author UI        app/admin/**   Admin UI        app/login
  middleware.ts       Edge auth gate (401 JSON for API, redirect for pages, role-based page access)
  lib/api.ts          route() wrapper, ApiError, zod/Mongo error → structured JSON
  lib/auth.ts         JWT (jose) sign/verify, requireSession(req, ...roles)
  lib/validation.ts   zod schemas for every input
  lib/services/       ticket loading w/ ownership checks + serializers (strip admin-only fields)
  lib/ai/             llm.ts (provider client) · knowledge.ts · classify.ts · draft.ts · heuristics.ts
  models/             Mongoose: User, Book, Ticket (messages + internalNotes embedded)
scripts/seed.ts       Seeder
```

Key decisions
- **Next.js route handlers as the API** keeps one deployable; the API is still a clean REST layer the UI consumes only via `fetch`.
- **Auth:** bcrypt passwords, JWT in an `httpOnly`, `SameSite=Lax` cookie (Bearer header also accepted for Postman/curl). Middleware rejects unauthenticated traffic early; every handler re-checks role and ownership (defence in depth).
- **Ownership:** authors requesting someone else's ticket get **404, not 403**, so ids can't be probed. Authors can only attach tickets to books they own.
- **Data model:** a ticket embeds its `messages` and `internalNotes` (always read together, bounded size). `internalNotes`, `aiDraft` and classification provenance are stripped in `serializeTicket` for authors, so they cannot leak by accident.
- **Real-time:** polling (author ticket list 5s, ticket thread 4s, admin queue 10s, admin ticket 8s), paused when the tab is hidden. Works on serverless hosts; SSE/WebSockets would be the next step at scale.
- **Queue ordering:** open tickets first → priority (Critical→Low) → oldest first. Tickets older than 48h unresolved get an **Overdue** tag; Critical rows are tinted.

## AI integration

**Model choice:** Claude Haiku (default) — fast and inexpensive for short structured classification and ~150-word drafts, follows tone instructions and "don't invent facts" rules well. The client (`lib/ai/llm.ts`) is provider-agnostic, so `AI_PROVIDER=openai` with `gpt-4o-mini` works as a drop-in.

**1. Classification + priority (one call per new ticket)**
- Single call returns JSON `{category, priority, reason}`; labels are validated against the enums, anything invalid → fallback.
- Prompt contains category definitions and a priority rubric (e.g. months without royalty → Critical; ISBN errors / defective prints / unavailable listing → High; "update my bio" → Low).
- Deterministic guardrail: **ISBN issues are floored at High** (per policy), regardless of what the model says.
- Admin can override both; overridden values are marked `admin` and shown as "edited".

**2. Drafted response (when an admin opens a ticket)**
- System prompt: persona, hard rules (use only supplied facts, use `[ADMIN: …]` placeholders for missing data, don't claim actions already done, don't blame the author), format (greeting, 110–200 words, `Next step:` line, fixed sign-off).
- User prompt is assembled per ticket: **only the KB sections for that category** + tone guidelines + the category playbook (distilled from the sample query→response table) + facts for the relevant book(s) (ISBN, stage, sold, earned/paid/pending, platform availability) + author's bank-linked flag + **computed next payout deadline** (quarter end + 45 days) + last 3 thread messages.
- The UI warns if `[ADMIN: …]` placeholders remain when sending.

**3. Graceful degradation**
- Tickets are **persisted before** any AI call; AI failure can never block submission.
- Timeout (12s) + one retry on 429/5xx; then keyword classifier (`heuristics.ts`) and a policy-based template draft. The admin UI says clearly when it's a template, and "Re-run AI triage" / "Regenerate" are available once the AI is back.
- In-memory circuit breaker: 3 consecutive failures → AI skipped for 60s so an outage doesn't slow every submission.

**4. Cost awareness**
- Classification: ~200 input tokens, `max_tokens` 120; no KB, no history.
- Drafts: scoped KB (≈ ¼ of the full KB), compact book facts, truncated thread; `max_tokens` 450.
- **Drafts are cached on the ticket** (`aiDraft`), so reopening costs nothing; invalidated only when the thread, category, or re-triage changes. Template fallbacks are not cached.
- Description input truncated to 1,500 chars. Roughly ≈ ₹0.1–0.3 per ticket on Haiku-class pricing.

**5. Author-facing AI**
- *Instant help while writing a ticket* ("Get instant help" on the New query page) and a standalone *Ask AI* page (`/author/assistant`) both call `POST /api/ai/assist`. Answers are grounded in the KB sections for the (keyword-detected) category plus the author's **own** books only, never anyone else's, max ~110 words. The model also returns `needs_human`, which nudges the author to raise a ticket when staff action is required. No extra LLM call is spent on categorising the question, and calls are rate-limited per user.
- Authors see the AI-assigned **category and priority** on their tickets.

**6. Admin AI extras:** one-click **AI summary** of a ticket (cached until the thread changes) and an **AI status chip** on the queue (shows provider/model, or "AI off" when no key is configured).

**7. Provider auto-detect:** `AI_PROVIDER` is a preference; if only the other provider's key is present, that provider is used, so a mismatched setting can't silently disable AI. A model override that belongs to the other provider is ignored.

**8. Key security:** keys are read only in `lib/ai/llm.ts` on the server from env vars; nothing is hardcoded and no `NEXT_PUBLIC_` variables exist.

## API reference

All routes return JSON. Auth is the `bl_token` cookie (set by login) or `Authorization: Bearer <token>`. Errors: `{ "error": { "code", "message", "details?" } }` with status 400 (bad JSON/id), 401, 403, 404, 409, 422 (validation, `details` lists fields), 503 (DB down).

| Method & path | Role | Description |
|---|---|---|
| `POST /api/auth/login` | public | `{email, password}` → sets cookie, returns `{user}` |
| `POST /api/auth/logout` | public | Clears cookie |
| `GET /api/auth/me` | any | Current user |
| `GET /api/books` | any | Author: own books. Admin: all, optional `?authorId=`. Also returns `nextPayout` |
| `GET /api/tickets` | any | Author: own tickets (newest first). Admin: all, sorted by urgency. Filters (admin + author): `status, category, priority, from, to` (YYYY-MM-DD); admin only: `assigned=me\|unassigned`, `q` |
| `POST /api/tickets` | author | `{bookId?, subject (3–150), description (10–5000), attachments?: [{name}]}` → creates + AI-triages. 201 |
| `GET /api/tickets/:id` | owner / admin | Ticket + thread. Admin view adds internal notes & classification provenance |
| `PATCH /api/tickets/:id` | admin | Any of `{status, category, priority, assignee: "me"\|null}` (category/priority = override) |
| `POST /api/tickets/:id/messages` | owner / admin | `{body, status?}`. Admin: sends response (auto → In Progress unless `status`). Author: follow-up (reopens Resolved; 409 if Closed) |
| `POST /api/tickets/:id/notes` | admin | `{body}` internal note (never shown to authors) |
| `POST /api/tickets/:id/draft` | admin | `{regenerate?: bool}` → `{draft: {text, source: "ai"\|"template", model, cached}}` |
| `POST /api/tickets/:id/classify` | admin | Re-run AI category/priority |
| `POST /api/tickets/:id/summary` | admin | AI summary of the ticket/thread `{summary: {text, source, cached}}`; cached until a new message arrives |
| `POST /api/ai/assist` | author | `{message (5–2000), bookId?}` → `{category, answer, needsHuman, source}`. Instant answer from KB + the author's own books. Rate-limited to 12/min |
| `GET /api/ai/status` | any | `{enabled}`; admins also get `provider` and `model` |

Example:
```bash
curl -c jar -H 'content-type: application/json' -d '{"email":"admin@bookleaf.in","password":"Admin@123"}' localhost:3000/api/auth/login
curl -b jar 'localhost:3000/api/tickets?status=Open&priority=Critical'
```

## Known limitations / next steps
- Attachments are UI-only (names stored, no file upload). Next: S3/R2 signed uploads + virus scan.
- Polling instead of push; move to SSE or Mongo change streams for scale.
- Admin queue sorts in application code over ≤300 rows; at scale, store denormalised `priorityRank/statusRank` and sort in Mongo with cursor pagination.
- No password reset, rate limiting on login, or audit log of AI drafts vs. what was actually sent (valuable for evaluating draft quality).
- Authors are notified in-app only; add email notifications on admin reply.
- No automated test suite yet (AI fallbacks, ownership checks and the payout-date helper are the first candidates).
