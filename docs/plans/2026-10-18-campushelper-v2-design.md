# CampusHelper 2.0 — Design

**Date:** 2026-10-18
**Status:** Approved
**Scope:** 10 new features on top of the shipped campus lost-and-found platform.

---

## 1. Context

CampusHelper is live: Next.js 16 (App Router), React 19, TypeScript, Prisma 6 over
PostgreSQL (Supabase), NextAuth 4 (JWT), Tailwind 4, Zod 3, Vitest 4, Vercel Blob uploads.

Shipped surface: item CRUD, search/filter/pagination, claims (approve/reject), comments,
admin moderation and user management, user dashboard, RLS policies, CSRF synchronizer
tokens, in-memory rate limiting, upload hardening, CI.

The Prisma schema contains exactly four models — `User`, `Item`, `Comment`, `Claim`.
Everything below adds new surface area; nothing here replaces existing behaviour.

### Baseline verified before starting

`npm run verify` — typecheck clean, lint clean (3 pre-existing `@next/next/no-img-element`
warnings), 51/51 tests passing.

---

## 2. Goals and non-goals

**Goals**

1. Make it materially faster to reunite people with lost property (discovery).
2. Close the loop: prove a handover actually happened, not just that a claim was approved.
3. Give moderators accountability and scale (audit trail, bulk actions, impact metrics).
4. Keep every addition verifiable without third-party credentials.

**Non-goals (YAGNI)**

- Email/SMS/push transport. Notifications are in-app only; an outbound adapter is a
  deliberate future seam, not part of this work.
- Real-time websockets. The notification bell polls.
- Google Maps or any tile provider. The campus map is schematic SVG drawn from seeded
  zone coordinates, so it renders offline and needs no API key.
- Machine-learned matching. The scorer is deterministic, explainable, and unit-tested.
- Multi-tenancy / multiple campuses. One implicit campus.

---

## 3. Conventions every new feature follows

These are lifted from the existing codebase, not invented:

| Concern | Convention |
|---|---|
| CSRF | `checkCSRF(request)` from `@/lib/csrf-middleware`, first statement in mutating handlers |
| Session | `getSession()` from `@/lib/auth`; read `session.user.id` / `.role` |
| Authorization | Existing error factories: `AuthenticationRequired()`, `AdminAccessRequired()`, `ForbiddenError()`, `NotFound()`, `ValidationError()` |
| Validation | Zod schema in `src/lib/schemas/*`, `.parse()` in try/catch on `error.name === 'ZodError'` |
| Rate limiting | `limitCustom(key, points, durationSeconds, name)` from `@/lib/rateLimit` |
| Errors | `safeApiHandler(handler)` wrapper; `createErrorResponse(message, code, status, details)` |
| Lists | `{ <collection>, pagination: { page, limit, total, totalPages } }` |
| Item projection | Always `getItemDetailForViewer(itemId, viewer)` — the single place privacy lives |
| Client fetch | `useAuthFetch()` from `@/lib/auth-fetch` (handles CSRF header + 401) |
| Pure logic | Isolated in `src/lib/*.ts` with no Prisma import, so it is unit-testable |

### Inherited bugs fixed as part of this work

The new code sits on top of two defects found during the audit; both are fixed here.

1. **Rate-limit errors surface as HTTP 500.** `limitCustom` and friends throw a plain
   `Error` containing "Too many requests"; only `/api/auth/signup` maps it to 429. Add a
   typed `RateLimitError` and map it in `safeApiHandler` to 429 with
   `code: 'RATE_LIMIT_EXCEEDED'` and a `Retry-After` header.
2. **Duplicate create schema drift.** `src/app/api/items/route.ts` inlines its own create
   schema instead of importing `createItemSchema`, so form and API validation have
   diverged. Consolidate on the shared schema (extended for the new fields).

---

## 4. Data model

All migrations are forward-only and additive: new tables, new nullable columns, new enum
values, new indexes. No column is dropped or narrowed.

### 4.1 New enums

```
NotificationType  CLAIM_CREATED | CLAIM_STATUS_CHANGED | COMMENT_ON_ITEM | MATCH_FOUND
                  | SAVED_SEARCH_HIT | HANDOVER_CODE_ISSUED | HANDOVER_VERIFIED
                  | ITEM_RESOLVED | MODERATION_ACTION

MatchStatus       SUGGESTED | DISMISSED | CONFIRMED

ReputationKind    ITEM_POSTED | COMMENT_POSTED | CLAIM_APPROVED | RETURN_COMPLETED
                  | MODERATION_UPHELD

AuditAction       ITEM_FLAG | ITEM_REMOVE | ITEM_RESTORE | ITEM_DELETE
                  | USER_ROLE_CHANGE | USER_DEACTIVATE | USER_REACTIVATE
                  | CLAIM_OVERRIDE | BULK_ITEM_ACTION | BULK_USER_ACTION

ClaimStatus       (add) COMPLETED
```

Adding `COMPLETED` to the existing `ClaimStatus` enum is safe: PostgreSQL
`ALTER TYPE ... ADD VALUE` is append-only and does not rewrite existing rows.

### 4.2 New models

**Category** — seeded taxonomy, not user-editable.

| Field | Type | Notes |
|---|---|---|
| id | String cuid | |
| slug | String unique | `electronics`, `id-cards`, `books`, `keys`, `bags`, `clothing`, `accessories`, `documents`, `sports`, `other` |
| name | String | Display name |
| icon | String | lucide icon name |
| sortOrder | Int | Deterministic ordering |
| items | Item[] | |

**CampusZone** — schematic campus geography.

| Field | Type | Notes |
|---|---|---|
| id, slug (unique), name, description | | e.g. `central-library`, `hostel-block-a`, `canteen`, `sports-complex`, `academic-block-1`, `parking`, `auditorium`, `admin-block` |
| mapX, mapY | Float | Normalised 0–100 coordinates on the schematic map |
| sortOrder | Int | |
| items | Item[] | |

Coordinates are normalised percentages rather than lat/lng, because the map is a schematic
drawing of one campus. `Item.latitude/longitude` are added as optional precise pins so real
coordinates can be layered on later without another migration.

**Notification**

| Field | Type | Notes |
|---|---|---|
| id | String cuid | |
| userId | String | Recipient |
| actorId | String? | Who caused it, null for system |
| type | NotificationType | |
| title, body | String | Pre-rendered at write time — the inbox stays readable even if the source item is later deleted |
| link | String? | In-app path |
| itemId | String? | Loose reference, `onDelete: SetNull` |
| readAt | DateTime? | |
| createdAt | DateTime | |

Indexes: `[userId, readAt, createdAt]`, `[userId, createdAt]`.

**SavedSearch**

| Field | Type | Notes |
|---|---|---|
| id, userId, name | | |
| filters | Json | Validated against `savedSearchFiltersSchema` on write |
| lastNotifiedAt | DateTime? | Guards against re-notifying the same post |
| createdAt, updatedAt | | |

Index: `[userId, createdAt]`. Cap: 20 saved searches per user.

**MatchSuggestion**

| Field | Type | Notes |
|---|---|---|
| id | String cuid | |
| lostItemId, foundItemId | String | `onDelete: Cascade` |
| score | Int | 0–100 |
| reasons | Json | `[{code, label, weight}]` — explainability is a product requirement |
| status | MatchStatus | default `SUGGESTED` |
| createdAt, updatedAt | | |

Constraint: `@@unique([lostItemId, foundItemId])` so recomputation upserts rather than
duplicates. Indexes on both item columns and `[status, score]`.

**ReputationEvent** — append-only ledger.

| Field | Type | Notes |
|---|---|---|
| id, userId | | |
| kind | ReputationKind | |
| points | Int | Signed |
| itemId | String? | `onDelete: SetNull` |
| note | String? | |
| createdAt | DateTime | |

Constraint: `@@unique([userId, kind, itemId])` makes awards idempotent — replaying a
lifecycle transition cannot double-credit. This is the anti-abuse mechanism.

**AuditLog**

| Field | Type | Notes |
|---|---|---|
| id | String cuid | |
| actorId | String? | `onDelete: SetNull` — deleting a moderator must not erase history |
| actorEmail | String | Denormalised at write time for exactly that reason |
| action | AuditAction | |
| targetType | String | `Item` / `User` / `Claim` |
| targetId | String | |
| reason | String? | |
| metadata | Json? | Before/after values |
| ip | String? | |
| createdAt | DateTime | |

Indexes: `[createdAt]`, `[actorId, createdAt]`, `[action, createdAt]`,
`[targetType, targetId, createdAt]`.

### 4.3 Modified models

**Item** — add `categoryId String?`, `tags String[] @default([])`,
`zoneId String?`, `latitude Float?`, `longitude Float?`, plus relations and indexes on
`[categoryId, createdAt]`, `[zoneId, createdAt]`, and a GIN index on `tags` for array
containment queries. `location` (free text) is retained; `zoneId` is the structured facet
and the display name falls back to `location` when no zone is set.

**User** — add `reputation Int @default(0)` (denormalised sum of the ledger, for cheap
sorting) and `verifiedStudent Boolean @default(false)`.

**Claim** — add `handoverCode String?`, `handoverCodeExpiresAt DateTime?`,
`handoverAttempts Int @default(0)`, `handoverVerifiedAt DateTime?`, `completedAt DateTime?`.
`status` gains `COMPLETED`.

---

## 5. Feature specifications

### F1 — Smart match engine

**Pure module `src/lib/matching.ts`.** No Prisma import; takes plain objects, returns a
score and reasons. Signals and weights:

| Signal | Weight | Rule |
|---|---|---|
| Title token overlap | 34 | Jaccard over normalised, stopword-stripped token sets |
| Description token overlap | 16 | Same tokenisation |
| Category match | 18 | Both non-null and equal |
| Zone match | 14 | Both non-null and equal |
| Location string similarity | 10 | Token overlap on `location` text when zone is absent — zone and location are mutually exclusive so they cannot double-count |
| Date proximity | 8 | Linear decay to zero at 180 days apart |
| Tag overlap | 6 | Jaccard over tag sets |
| Complementary type | gate | A LOST item only matches FOUND items and vice versa; otherwise score 0 |

Normalisation: lowercase, strip punctuation and diacritics, drop a small English stopword
list plus filler words ("lost", "found", "my", "someone"), collapse whitespace. Tokens
shorter than 3 characters are dropped.

Threshold: a suggestion is stored at **score ≥ 55**. The scorer returns
`{ score, reasons }` where each reason is `{ code, label, weight }` so the UI can render
*why* two reports are paired ("same category · posted 2 days apart").

**Computation:** on item create and on material update, query a bounded candidate set —
complementary `itemType`, status not `RESOLVED`/`DELETED`, created within ±180 days,
`take: 200`, ordered by recency — score each, upsert those above threshold. The work is
synchronous but bounded; it never scans the table.

**Backfill:** `scripts/backfill-matches.ts` reuses the same lib for pre-existing items,
idempotent by virtue of the unique constraint.

**API**

- `GET /api/items/[id]/matches` — auth required; returns suggestions for one item, each
  with the counterpart item summarised through the shared projection.
- `POST /api/matches/[id]` — `{ action: 'dismiss' | 'confirm' }`, CSRF + owner-of-either-item
  check; rate limited.

**UI:** "Possible matches" panel on item detail showing score, reasons, and the counterpart
card; a count badge in the dashboard.

### F2 — Categories and tags

- Seeded taxonomy via migration; `GET /api/categories` returns categories with live item
  counts (single `groupBy`, cached per request).
- `Item.tags`: normalised lowercase, trimmed, deduped, max 8 tags, each 2–24 chars,
  `[a-z0-9-]` only.
- `GET /api/items` gains `category` (slug) and `tags` (comma-separated) filters; tag
  filtering uses array containment, AND semantics.
- UI: category chips as filter facets on browse/search, tag pills on cards and item detail,
  category select + tag input in the post form.

### F3 — Saved searches and alerts

- `GET|POST /api/saved-searches`, `DELETE /api/saved-searches/[id]` (owner only).
- Filter payload validated by `savedSearchFiltersSchema` — the same shape the item list
  query accepts, so a saved search can always be replayed against `/api/items`.
- On item create, each saved search is evaluated against the new item in memory (no extra
  query per search — the item is already loaded, and the user's searches are loaded once).
  A hit creates a `SAVED_SEARCH_HIT` notification and stamps `lastNotifiedAt`.
- Cap 20 per user; rate limited on create.
- UI: "Save this search" on the search page; saved-search list with delete on the dashboard.

### F4 — Duplicate-post guard

Reuses the F1 tokenizer. On `POST /api/items`, before insert:

- Candidates: same `itemType`, same poster, created within 30 days, `take: 25`.
- If the best score ≥ 70, respond **409** with
  `{ error, code: 'DUPLICATE_SUSPECTED', details: { candidates: [...] } }`.
- The client may resend with `acknowledgeDuplicates: true` to proceed.
- UI: post form surfaces the candidates with a "Post anyway" affordance.

This is a guard against accidental double-submission and near-identical re-posts, not a
hard block — hence the acknowledgement escape hatch.

### F5 — Notification centre

**Service `src/lib/notifications.ts`:**

```
notify(userId, { type, title, body, link?, itemId?, actorId? })  → single insert
notifyMany(userIds, payload)                                     → createMany
```

Rules: never notify the actor about their own action; deduplicate identical
unread notifications of the same type for the same item within a short window; all writes
via `createMany` where fan-out is involved.

Trigger points: claim created (→ item poster), claim approved/rejected (→ claimer),
comment created (→ item poster, or comment author on reply), match found (→ both item
owners), saved-search hit, handover code issued (→ both parties), handover verified
(→ both), item resolved, moderation action (→ item owner).

**API:** `GET /api/notifications` (paginated, `?unread=true`),
`GET /api/notifications/unread-count`, `POST /api/notifications/read`
(`{ ids: string[] }` or `{ all: true }`).

**UI:** `NotificationBell` in the navbar polling `unread-count` every 30 seconds, and a
`/notifications` page with per-item read and mark-all-read.

### F6 — Handover verification

The claim lifecycle becomes: `PENDING → APPROVED → COMPLETED` (or `REJECTED`).

1. On approval, generate a cryptographically random 6-digit code, store it on the claim
   with a 72-hour expiry, reset `handoverAttempts`, and notify both parties.
2. The code is readable **only** through `GET /api/claims/[id]/handover`, restricted to the
   claim owner, the item poster, and admins. It is never placed in the shared item
   projection or in notification body text.
3. `POST /api/claims/[id]/handover` with `{ code }` verifies with a timing-safe compare.
   A wrong code increments `handoverAttempts`; at 5 the code is invalidated and both
   parties are notified to re-issue.
4. On success: claim `COMPLETED` with `completedAt` and `handoverVerifiedAt`, item
   `RESOLVED` with `resolvedAt` and `claimedById` set, reputation awarded to both parties
   (`RETURN_COMPLETED`), and both notified.
5. Expired codes can be re-issued by the poster via `POST /api/claims/[id]/handover`
   with `{ reissue: true }`.

**UI:** a handover panel inside the claims modal — code display for the entitled party,
code entry for the counterparty, attempt/expiry status.

### F7 — Campus zones and schematic map

- Seeded zones (8) with normalised `mapX`/`mapY`.
- `GET /api/zones` — zones with live item counts.
- `GET /api/items` gains a `zone` filter; existing `location` filtering is untouched.
- `/map` page: server component shell plus a client SVG map. Zones render as labelled
  shapes; pin radius scales with report density; clicking a zone filters the list below the
  map. A legend distinguishes LOST from FOUND. No external tiles, no API key.
- Post form gains a zone select and an optional "drop a pin" interaction on a miniature of
  the same SVG, storing `latitude`/`longitude` derived from the schematic coordinates.

### F8 — Reputation and verification badges

**Pure module `src/lib/reputation.ts`** exposing the rule table and tier thresholds:

| Kind | Points |
|---|---|
| ITEM_POSTED | +2 |
| COMMENT_POSTED | +1 (max 10 credited per user per day) |
| CLAIM_APPROVED | +5 |
| RETURN_COMPLETED | +25 (both parties) |
| MODERATION_UPHELD | −10 |

Tiers by total: `0 Newcomer`, `25 Bronze`, `75 Silver`, `200 Gold`, `500 Champion`.
`awardReputation()` writes a `ReputationEvent` and increments `User.reputation`
incrementally inside a transaction; the unique constraint makes it idempotent.

**Verification badge:** `verifiedStudent` is admin-granted (audited), displayed as a badge.
There is no automated student-email verification in this scope — the badge means
"confirmed by a moderator", and the UI says exactly that rather than implying an
automated check.

- `GET /api/users/[id]/reputation` — public summary: total, tier, recent ledger, badges.
- UI: tier badge on item cards and item detail; profile section with ledger history.

### F9 — Admin audit log and bulk moderation

- `recordAudit({ actorId, actorEmail, action, targetType, targetId, reason, metadata, ip })`
  in `src/lib/audit.ts`. Called from every admin mutation: item flag/remove/restore/delete,
  user role change, user deactivate/reactivate, claim override, and both bulk endpoints.
- `GET /api/admin/audit` — filters `actorId`, `action`, `targetType`, `from`, `to`;
  paginated; admin only.
- `POST /api/admin/items/bulk` and `POST /api/admin/users/bulk` — `{ ids: string[], action, reason }`,
  max 50 ids, validated action per target type, executed in a transaction, one audit row per
  target plus a summary row, and a notification to each affected user.
- UI: an "Audit Log" tab (filterable table) and multi-select checkboxes with a bulk action
  bar on the items and users tables.

### F10 — Impact analytics and CSV export

**Pure module `src/lib/analytics.ts`** takes raw aggregates and derives:

- Resolution rate = resolved / total posted in range.
- **Median** time-to-return in hours (not mean — a single stale item would distort a mean).
- Daily report series (posted vs resolved) for the range.
- Top zones and top categories by report volume.
- Claims funnel: created → approved → completed, with conversion percentages.

`GET /api/admin/analytics?range=7d|30d|90d|all`.

**CSV:** `src/lib/csv.ts` — a pure `toCsv(rows, columns)` with RFC 4180 quoting (quotes,
commas, newlines) and spreadsheet-formula-injection neutralisation (`=`, `+`, `-`, `@`
prefixed values are quoted and prefixed with `'`). Export routes:
`GET /api/admin/export/items.csv`, `GET /api/admin/export/claims.csv`, streamed with a
`Content-Disposition: attachment` header and capped at 10,000 rows.

**UI:** analytics tab with hand-rolled inline SVG charts — bar chart for the daily series,
funnel bars, top-zone table — plus export buttons. No charting dependency is added.

---

## 6. Cross-cutting concerns

**Security.** Every new mutating route validates CSRF; every read route requires a session
unless deliberately listed. Handover codes use `crypto.randomInt` and timing-safe compare;
codes never appear in the shared item projection. CSV output is injection-neutralised.
Bulk endpoints cap input size. Audit rows denormalise the actor email so history survives
user deletion. New rate limits: matches (30/hr), saved searches (20/hr), notifications read
(120/hr), handover attempts (10/hr), bulk (10/hr), export (5/hr), analytics (60/hr).

**Performance.** Every new list query is paginated and indexed. Match computation is a
bounded query with a hard cap. Analytics uses `groupBy` and a single bounded raw query
rather than loading rows into memory. Facet counts are one `groupBy` per request.

**Compatibility.** All schema changes are additive, so the currently deployed app keeps
working against the migrated database — no coordinated deploy required. `location`
free-text continues to work with no zone set. Existing API responses are unchanged except
`POST /api/items` (new optional fields, new 409 path) and rate-limited responses (500 → 429,
which is a bug fix).

**Testing.** ~40 new tests, all on pure modules and schemas — matching score ordering and
threshold behaviour, duplicate detection, reputation idempotency and daily caps, tier
boundaries, CSV escaping and formula neutralisation, analytics derivations including the
median, notification title/body formatting, and every new Zod schema. The existing 51 tests
must stay green. New DB-touching routes are exercised by typecheck and lint, not by
integration tests, because there is no test database in CI — this is a known, stated
limitation rather than a silent gap.

**Docs.** README feature and API sections updated; a `ROADMAP-V2.md` records the 10
features and their status; the stale 165-step roadmap gets a header note that it is a
historical in-progress document superseded by the code.

---

## 7. Delivery batches

| Batch | Contents | Verification |
|---|---|---|
| B1 | Schema, migrations, seeds, pure libs (`matching`, `reputation`, `csv`, `analytics`, `notifications` formatting), `RateLimitError` fix, schema consolidation | typecheck, lint, tests |
| B2 | All API routes for F1–F10 + audit wiring + rate limits | typecheck, lint, tests |
| B3 | UI: notification bell + page, matches panel, category/tag inputs, saved searches, map page, reputation badges, admin tabs (audit, bulk, analytics), export buttons | typecheck, lint, tests, production build |
| B4 | Docs, README, roadmap, full `npm run verify`, migrations applied against the provided database, scoped commit | full verify |

Each batch ends with lint + typecheck + tests green. The commit is made at the end of B4,
scoped to the new work.
