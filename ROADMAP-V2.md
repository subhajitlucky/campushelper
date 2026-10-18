# CampusHelper 2.0 — Feature Roadmap

Ten features added on top of the shipped lost-and-found platform. Design and
rationale: [`docs/plans/2026-10-18-campushelper-v2-design.md`](docs/plans/2026-10-18-campushelper-v2-design.md).
Implementation plan: [`docs/plans/2026-10-18-campushelper-v2-plan.md`](docs/plans/2026-10-18-campushelper-v2-plan.md).

**Status legend:** ✅ shipped · 🟨 partial · ☐ not started

---

## Find it faster

### ✅ 1. Smart match engine
Pairs LOST and FOUND reports using weighted, explainable signals: title token overlap (34),
description overlap (16), same category (18), same campus zone (14), location text similarity
(10, used only when a zone is absent so the same fact is never counted twice), date proximity
(8, decaying to zero at 180 days), and shared tags (6). Suggestions are stored above 55 with
their reasons, so the UI can explain each pairing.

Candidates are bounded in SQL (complementary type, open status, ±180-day window, hard cap of
200), so scoring never becomes a table scan. `npm run db:backfill-matches` backfills existing
reports and is idempotent.

### ✅ 2. Categories and tags
A seeded 10-category taxonomy plus free tags (max 8 per item, 2–24 characters, `[a-z0-9-]`).
Tag handling is forgiving about shape — spaces and underscores become hyphens — but strict
about content, so `he!!o` is reported rather than silently rewritten. Category and tag facets
appear on browse and search.

### ✅ 3. Saved searches and alerts
Save a filter set (max 20 per user) and receive a notification when a matching item is posted.
Saved searches only match items posted after they were created, so saving one never floods the
inbox with the existing backlog.

### ✅ 4. Duplicate-post guard
Reuses the match tokenizer. Posting a report that scores ≥70 against the poster's own recent
same-type reports returns `409 DUPLICATE_SUSPECTED` with candidate previews; the client can
resend with `acknowledgeDuplicates: true`. It is a guard, not a block, because legitimate
re-posts happen.

---

## Close the loop

### ✅ 5. Notification centre
Ten notification types are defined; eight are actually emitted — claims, matches, saved-search
hits, the handover lifecycle, and moderation. Content is rendered at write time so the inbox stays
readable after a source item is deleted. Self-notifications are suppressed, and repeats of the same
event from the same actor inside a five-minute window collapse (a *different* actor always notifies).
`COMMENT_ON_ITEM` and `ITEM_RESOLVED` are defined but never emitted.

### ✅ 6. Handover verification
Approving a claim issues a six-digit code with a 72-hour expiry. The item is marked resolved
only when the code is verified, so "approved" is never mistaken for "returned". The code is
readable only by the claimer, the item poster, or a moderator, and only through a dedicated
endpoint — it never enters the shared item projection or a notification body. Comparison is
constant time, and five wrong attempts burn the code and notify both parties.

### ✅ 7. Campus zones and schematic map
Eight seeded zones with normalised coordinates. `/map` renders a dependency-free inline SVG
map — no tiles, no API key — where pin size scales with report density. Zones are a structured
filter alongside the existing free-text location, which is retained for compatibility.

---

## Trust and operations

### ✅ 8. Reputation and verification badges
An append-only ledger. **Three of the five kinds are live**: +2 for posting, +5 for an approved
claim, and +25 for a verified return to both parties. `COMMENT_POSTED` and `MODERATION_UPHELD` are
defined in the rule table but awarded nowhere — the comments route does not credit reputation and
bulk moderation applies no penalty.

A unique constraint on `(userId, kind, itemId)` makes awards idempotent, so replaying a lifecycle
transition cannot double-credit. Note the constraint does **not** protect awards that omit `itemId`,
because PostgreSQL treats NULLs as distinct; every current caller passes one. Tiers: Newcomer,
Bronze, Silver, Gold, Champion.

Student verification is granted by a moderator and audited. The badge says "confirmed by a
moderator", not "verified email", because no automated student-email check exists.

### ✅ 9. Audit log and bulk moderation
Every privileged action records actor, denormalised actor email (so history survives account
deletion), action, target, reason, metadata, and IP. Bulk item and user actions accept up to 50
ids, run in a transaction, write one audit row per target plus a summary row, and notify each
affected user. Deactivating a user also bumps `sessionVersion`, which is what actually
invalidates their existing JWT.

### ✅ 10. Impact analytics and CSV export
Resolution rate, **median** time-to-return (a mean would be dragged by one stale item), daily
posted-vs-returned series, top zones and categories, claims funnel, and active users. Rendered
with a hand-rolled inline SVG chart — no charting dependency was added.

CSV exports are capped at 10,000 rows, neutralise spreadsheet-formula injection, and are
audited as `EXPORT_DOWNLOAD` because a CSV of every item or claim carries student names and
email addresses out of the system.

---

## Fixed along the way

- **Rate-limited requests returned 500.** Limiters threw a plain `Error`, which fell through to
  the generic handler. Now a typed `RateLimitError` maps to `429` with a `Retry-After` header.
- **The item create schema had drifted.** `POST /api/items` inlined its own copy of the
  validation schema, which disagreed with the form's (title 200 vs 100 characters, location 1
  vs 3, and no cap on images). Both now use `createItemSchema`.
- **The item list built its where-clause twice**, once for the page and once for the count, so
  the two could diverge. One clause is now reused.
- **The category seed ids mixed `cat_` and `cat-` prefixes.** The original check only counted
  rows, which is why it passed; ids are now verified by value.

---

## Known gaps (from the 2026-10-18 adversarial review)

See [`docs/audit/2026-10-18-v2-adversarial-review.md`](docs/audit/2026-10-18-v2-adversarial-review.md)
for the full list. The Critical and Major findings have been fixed; these remain:

- **Comment notifications and comment reputation are unwired** (`COMMENT_ON_ITEM`,
  `COMMENT_POSTED`), and so is the daily comment cap that would go with them.
- **`MODERATION_UPHELD` is not applied** — bulk moderation does not deduct reputation.
- **The items list has no index leading with `createdAt`**, so the default listing does a sequential
  scan plus a sort. Measured at 37 ms for a 20-row page at 20,000 items.
- **Matching and duplicate detection are inert for non-Latin scripts.** `normalizeText` keeps only
  `[a-z0-9]`, so a report written in Devanagari or Odia tokenises to nothing and receives no text
  signal.
- **Saved-search fan-out and match notification are sequential** (~5 ms per matching search, on the
  item-create path).
- **"Deleted" has two representations.** The user delete path sets `status = 'DELETED'` but not
  `deletedAt`, while the zone map and analytics filter on `deletedAt` only, so user-deleted items are
  still counted there.
- **The CSV export silently keeps only the newest 10,000 rows** with no truncation signal.
- **`handoverAttempts` is incremented by read-modify-write**, so concurrent wrong guesses consume
  fewer attempts than documented. Low practical impact: only the two parties (who can read the code)
  reach the endpoint.
- **`SavedSearch` has no index leading with `createdAt`**, and the 500-row evaluation cap always takes
  the newest, so with more than 500 saved searches the oldest are never evaluated again.

## Known limitations

- **Notifications are in-app only.** No email, SMS, or push transport. An outbound adapter is a
  deliberate future seam.
- **The notification bell polls** every 30 seconds rather than using websockets.
- **The campus map is schematic**, drawn from seeded zone coordinates, not real geography.
  `Item.latitude`/`longitude` exist so real coordinates can be layered on without a migration.
- **Rate limiting is per serverless instance** (in-memory), so limits are best-effort in a
  multi-instance deployment. A shared store such as Redis would be needed for cluster-wide
  enforcement.
- **CI has no database.** The admin routes have integration tests that skip without
  `DATABASE_URL`; the remaining API routes are covered by typecheck and lint.
- **Reputation tiers are cosmetic.** They are not used for authorization anywhere.
