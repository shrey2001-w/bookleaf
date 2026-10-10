# Write-up: BookLeaf Author Support Portal

**What I prioritised.** The core ticket lifecycle and the AI layer, since they carry the most weight: author submits → ticket saved → AI classifies and scores priority → admin opens it and gets a policy-grounded draft → edits and sends → author sees the reply within seconds. Ownership/role enforcement and failure handling came next; UI polish last.

**AI approach.** Two small, separate calls instead of one big one: a cheap classifier (no KB, ~120 output tokens) and a draft generator that receives only the KB sections for the ticket's category plus real figures from the author's book record (royalty earned/paid/pending, ISBN, production stage, platform availability) and a computed next-payout date. That lets drafts be specific ("₹14,100 pending, next payout deadline 14 Nov 2026") instead of generic, and the prompt forbids invented facts, using `[ADMIN: …]` placeholders instead. Drafts are cached per ticket so reopening is free.

**Trade-offs.**
- *Polling over WebSockets:* near-real-time (4–10s) with zero infrastructure and full serverless compatibility.
- *Embedded messages/notes in the ticket document:* simple reads and atomic updates; fine at ticket-sized volumes.
- *Keyword fallback + templates:* more code than failing outright, but the support team is never blocked by an AI outage, which matters more than draft polish.
- *Policy guardrails in code* (ISBN ≥ High) rather than only in the prompt, because a policy should not depend on model compliance.
- Attachments are UI-only, as the brief allowed.

**Evolving to production.**
1. Human-in-the-loop metrics: log AI draft vs. sent text (edit distance) and classification overrides to measure accuracy and tune prompts; build an eval set from real tickets.
2. Retrieval over a versioned KB (and the author's royalty statements) instead of static sections; tool-calling for live royalty/order lookups.
3. Queue + workers for AI jobs, SSE/change-streams for push, email/WhatsApp notifications, SLA timers and auto-escalation of overdue Critical tickets.
4. Real file uploads, rate limiting, audit logs, password reset/SSO, monitoring (token spend per ticket, AI error rate), and automated tests in CI.
