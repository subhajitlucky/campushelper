# CampusHelper 2.0 Implementation Plan

> **For the executing agent:** REQUIRED SUB-SKILL: use superpowers:executing-plans to implement this plan task-by-task.
> Design document: `docs/plans/2026-10-18-campushelper-v2-design.md`

**Goal:** Add 10 features to CampusHelper — smart matching, categories/tags, saved searches, duplicate guard, notifications, handover verification, campus zones/map, reputation, admin audit + bulk moderation, and impact analytics + CSV export.

**Architecture:** Additive Prisma models and forward-only migrations; new logic isolated in pure `src/lib/*` modules with unit tests; API routes follow the existing `checkCSRF → getSession → rate limit → Zod → safeApiHandler` chain; client surfaces fetch through `useAuthFetch` and reuse `getItemDetailForViewer` for every item projection.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 6 / PostgreSQL, Zod 3, Tailwind 4, Vitest 4.

**Repo:** `/home/subhajit/project/campushelper` (npm, Node 20+; local Node is 24).

---

## Task 0: Baseline

Run `npm run verify`. Expected: typecheck clean, lint clean except 3 pre-existing
`no-img-element` warnings, 51/51 tests pass. Record the result before changing anything.

---

# BATCH 1 — Schema, migrations, pure logic

## Task 1.1: Fix the rate-limit error contract

**Files:** Modify `src/lib/errors.ts`, `src/lib/rateLimit.ts`; test `tests/unit/rate-limit.test.ts`.

**Step 1 — failing test.** Add to `tests/unit/rate-limit.test.ts`: importing
`RateLimitError` from `@/lib/rateLimit` is a class extending `Error` with `name`
`'RateLimitError'` and a numeric `retryAfterSeconds`. Add a case to `tests/unit/errors.test.ts`
(new file) asserting `safeApiHandler` turns a thrown `RateLimitError` into a `NextResponse`
with status 429, body `code === 'RATE_LIMIT_EXCEEDED'`, and a `Retry-After` header.

**Step 2 — run, expect failure** (`npx vitest run tests/unit/rate-limit.test.ts tests/unit/errors.test.ts`).

**Step 3 — implement.** In `src/lib/rateLimit.ts` export
`class RateLimitError extends Error { readonly retryAfterSeconds: number }` and throw it
from every limiter (replacing the plain `Error` that contains "Too many requests"). In
`src/lib/errors.ts`, handle `RateLimitError` first inside `safeApiHandler` and return
`createErrorResponse(message, 'RATE_LIMIT_EXCEEDED', 429)` with a `Retry-After` header.

**Step 4 — run, expect pass.**
**Step 5 — commit** `fix(api): return 429 instead of 500 for rate-limited requests`.

## Task 1.2: Extend the Prisma schema

**Files:** Modify `prisma/schema.prisma`.

Add the enums and models from design §4.1–4.3 verbatim: `NotificationType`, `MatchStatus`,
`ReputationKind`, `AuditAction`, `ClaimStatus.COMPLETED`; models `Category`, `CampusZone`,
`Notification`, `SavedSearch`, `MatchSuggestion`, `ReputationEvent`, `AuditLog`; fields on
`Item` (`categoryId`, `tags`, `zoneId`, `latitude`, `longitude`), `User` (`reputation`,
`verifiedStudent`), `Claim` (`handoverCode`, `handoverCodeExpiresAt`, `handoverAttempts`,
`handoverVerifiedAt`, `completedAt`); all indexes and unique constraints listed in §4.

**Verify:** `npx prisma validate` (needs no database) and `npx prisma format`.
**Commit** `feat(db): extend schema for v2 features`.

## Task 1.3: Write the migration

**Files:** Create `prisma/migrations/20261018000000_v2_features/migration.sql`,
Create `prisma/migrations/20261018000001_seed_categories_zones/migration.sql`.

`20261018000000_v2_features` — hand-written forward-only SQL matching the schema:
`ALTER TYPE "ClaimStatus" ADD VALUE IF NOT EXISTS 'COMPLETED'`, `CREATE TYPE` for the four
new enums, `CREATE TABLE` for the seven new models with FKs and indexes, `ALTER TABLE` for
the new columns, and `CREATE INDEX ... USING GIN ("tags")` on `Item`.

`20261018000001_seed_categories_zones` — idempotent seed inserts
(`INSERT ... ON CONFLICT ("slug") DO NOTHING`) for 10 categories and 8 zones using the
normalised `mapX`/`mapY` coordinates from design §4.2.

**Verify:** `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_URL" --exit-code`
when a database is available; otherwise `npx prisma validate` plus a manual read-through
comparing every model to its `CREATE TABLE`.

## Task 1.4: Pure tokenizer and text similarity

**Files:** Create `src/lib/text-similarity.ts`; test `tests/unit/text-similarity.test.ts`.

**Failing tests first:** `normalizeText('Red iPhone 15!!')` → `'red iphone 15'`;
`tokenize` drops stopwords/filler ("lost", "found", "my", "someone") and tokens under 3
chars; `jaccard(['a','b'], ['b','c'])` → `1/3`; identical sets → 1; empty sets → 0.

**Implement** exactly those functions: `normalizeText`, `tokenize`, `jaccard`,
`STOPWORDS` set. No Prisma import.

**Commit** `feat(lib): add text similarity primitives`.

## Task 1.5: Match scoring

**Files:** Create `src/lib/matching.ts`; test `tests/unit/matching.test.ts`.

**Failing tests first:**

- Same-type pairs score 0 (a LOST item never matches another LOST item).
- Two items identical in every signal score ≥ 90.
- Unrelated items (different category/zone, disjoint text, 170 days apart) score < 55.
- `reasons` contains one entry per contributing signal with a `code`, `label`, and `weight`.
- Zone match and location-text similarity are mutually exclusive (both signals never appear
  together).
- Date proximity decays linearly to 0 at 180 days.
- Score is an integer 0–100 and never exceeds 100 even when all signals fire.

**Implement** `scoreMatch(a, b): { score, reasons }` with the weights in design §5-F1 and
`rankMatches(subject, candidates)` returning a descending, threshold-filtered list.
Constants exported: `MATCH_THRESHOLD = 55`, `DUPLICATE_THRESHOLD = 70`,
`MATCH_WINDOW_DAYS = 180`.

**Commit** `feat(lib): add explainable lost/found match scoring`.

## Task 1.6: Reputation rules

**Files:** Create `src/lib/reputation.ts`; test `tests/unit/reputation.test.ts`.

**Failing tests first:** point values match the design table for all five kinds; tier
boundaries are exact at 0/25/75/200/500 and just below each; `reputationTier(499)` is
`Gold`; the daily comment cap is enforced by a `canCreditComment(eventsToday)` predicate
returning false at 10; `tierProgress(total)` returns the fraction toward the next tier and
1 at the top tier.

**Implement** `REPUTATION_POINTS`, `TIERS`, `reputationTier(total)`, `tierProgress(total)`,
`canCreditComment(count)`, `formatReputationDelta(points)`.

**Commit** `feat(lib): add reputation rules and tiers`.

## Task 1.7: CSV serialisation

**Files:** Create `src/lib/csv.ts`; test `tests/unit/csv.test.ts`.

**Failing tests first:** values containing commas, double quotes, CRLF, and leading `=`,
`+`, `-`, `@` are quoted and neutralised; `null`/`undefined` become empty fields; a header
row is always emitted; `toCsv` output ends without a trailing newline; a value already
containing `'` is still safe.

**Implement** `escapeCsvValue(value)` and `toCsv(rows, columns)` per RFC 4180 with
formula-injection neutralisation. Pure, no I/O.

**Commit** `feat(lib): add CSV serialisation with formula-injection guards`.

## Task 1.8: Analytics derivations

**Files:** Create `src/lib/analytics.ts`; test `tests/unit/analytics.test.ts`.

**Failing tests first:** `medianTimeToReturnHours([])` → `null`; a single value returns that
value; even counts average the two middles; odd counts take the middle; a set with one huge
outlier does not move the median the way a mean would (assert the explicit difference);
`resolutionRate(0, 0)` → `0` (no divide-by-zero); `funnelPercentages` returns
`created → approved → completed` percentages relative to created and handles zero created;
`fillDailySeries` emits one bucket per day including zero days and is stable across DST-free
UTC boundaries.

**Implement** `medianTimeToReturnHours`, `resolutionRate`, `funnelPercentages`,
`fillDailySeries`. Takes plain aggregates; no Prisma import.

**Commit** `feat(lib): add analytics derivations`.

## Task 1.9: Notification content formatting

**Files:** Create `src/lib/notification-content.ts`; test `tests/unit/notification-content.test.ts`.

**Failing tests first:** each `NotificationType` produces a non-empty title and body;
bodies exceeding 200 characters are truncated with an ellipsis at a word boundary; a
missing actor name falls back to "Someone"; an item title containing HTML-ish characters is
passed through unchanged (escaping is React's job at render time, not the formatter's);
handover notifications never contain a code.

**Implement** `formatNotification({ type, actorName, itemTitle, extra })` returning
`{ title, body }`.

**Commit** `feat(lib): add notification content formatting`.

## Task 1.10: Zod schemas for the new surfaces

**Files:** Create `src/lib/schemas/{category,zone,match,notification,saved-search,audit,bulk,handover,analytics}.ts`;
Modify `src/lib/schemas/item.ts`; test `src/lib/__tests__/schemas-v2.test.ts`.

**Failing tests first:** tags are normalised to lowercase, deduped, capped at 8, rejected
over 24 chars and on illegal characters; `acknowledgeDuplicates` defaults to false;
saved-search filter payloads reject unknown keys; bulk `ids` reject more than 50 entries and
reject an empty array; `handoverCode` accepts exactly six digits and rejects `'12345'`,
`'1234567'`, `'12a456'`; audit query date range rejects `from > to`; analytics `range` only
accepts the four allowed values.

**Implement** the schemas, then in `item.ts` extend `createItemSchema` with `categorySlug`,
`tags`, `zoneSlug`, `latitude`, `longitude`, `acknowledgeDuplicates` and extend
`updateItemSchema`/`itemsQuerySchema` with `category`, `tags`, `zone`.

**Commit** `feat(schemas): add validation for v2 surfaces`.

---

# BATCH 2 — Services and API routes

Conventions for every task in this batch: CSRF check on mutations, `getSession()` for auth,
`limitCustom` for rate limiting, Zod `.parse()` in a `ZodError` try/catch, `safeApiHandler`
wrapper, `pagination` envelope on lists, and `recordAudit` on every admin mutation.

## Task 2.1: Notification service
**Files:** Create `src/lib/notifications.ts`; test `tests/unit/notifications.test.ts`.
Implement `notify`, `notifyMany`, `notifyItemPoster`, and the dedupe rule (same type + item +
recipient, unread, within 5 minutes → skip). Mock `@/lib/prisma` with `vi.mock` exactly as
`tests/unit/auth-callbacks.test.ts` does. **Commit** `feat(notifications): add notification service`.

## Task 2.2: Audit service
**Files:** Create `src/lib/audit.ts`; test `tests/unit/audit.test.ts`.
Implement `recordAudit(entry)` (never throws — a failed audit write must not fail the
request, but must log) and `recordBulkAudit(entries)`. **Commit** `feat(admin): add audit logging service`.

## Task 2.3: Reputation service
**Files:** Create `src/lib/reputation-service.ts`.
Implement `awardReputation(userId, kind, { itemId, note })` — transactional ledger insert +
`User.reputation` increment, swallowing unique-constraint violations so replays are no-ops.
**Commit** `feat(reputation): add idempotent award service`.

## Task 2.4: Match service
**Files:** Create `src/lib/match-service.ts`.
Implement `computeMatchesForItem(itemId)` (bounded candidate query → `rankMatches` → upsert
above threshold → notify both owners on new suggestions) and `getMatchesForItem(itemId, viewer)`.
**Commit** `feat(matching): add match computation service`.

## Task 2.5: `GET /api/categories` and `GET /api/zones`
**Files:** Create `src/app/api/categories/route.ts`, `src/app/api/zones/route.ts`.
Both: auth required, one `groupBy` for counts, no pagination needed (fixed-size taxonomy).
**Commit** `feat(api): expose categories and campus zones`.

## Task 2.6: Item create/update/list integration
**Files:** Modify `src/app/api/items/route.ts`, `src/app/api/items/[id]/route.ts`.
- Replace the inlined create schema with the shared `createItemSchema`.
- Resolve `categorySlug`/`zoneSlug` to ids, normalise tags, run the duplicate guard
  (409 `DUPLICATE_SUSPECTED` with candidate previews unless `acknowledgeDuplicates`).
- After create: `computeMatchesForItem`, saved-search evaluation, `ITEM_POSTED` reputation,
  audit-free notification fan-out.
- Add `category`, `tags`, `zone` filters to the list query (single where-clause reused by
  `findMany` and `count` — fix the existing duplication while here).
**Commit** `feat(api): integrate categories, tags, zones, duplicate guard, and matching into items`.

## Task 2.7: `GET /api/items/[id]/matches`, `POST /api/matches/[id]`
**Files:** Create those routes. Owner-of-either-item authorization; dismiss/confirm.
**Commit** `feat(api): expose match suggestions`.

## Task 2.8: Saved searches API
**Files:** Create `src/app/api/saved-searches/route.ts`, `src/app/api/saved-searches/[id]/route.ts`.
GET/POST (cap 20)/DELETE, owner-only. **Commit** `feat(api): add saved searches`.

## Task 2.9: Notifications API
**Files:** Create `src/app/api/notifications/route.ts`, `.../unread-count/route.ts`, `.../read/route.ts`.
**Commit** `feat(api): add notification endpoints`.

## Task 2.10: Handover API
**Files:** Create `src/app/api/claims/[id]/handover/route.ts`; modify `src/app/api/claims/[id]/route.ts`.
GET (entitled parties only), POST verify (timing-safe, 5-attempt lockout), POST `{reissue:true}`.
On approve in `claims/[id]`, issue the code + expiry and notify. On verify, complete the claim,
resolve the item, award reputation to both parties.
**Commit** `feat(claims): add handover verification codes`.

## Task 2.11: Admin audit + bulk APIs
**Files:** Create `src/app/api/admin/audit/route.ts`, `src/app/api/admin/items/bulk/route.ts`,
`src/app/api/admin/users/bulk/route.ts`; modify `src/app/api/admin/items/[id]/route.ts` and
`src/app/api/admin/users/[id]/route.ts` to call `recordAudit`.
**Commit** `feat(admin): add audit log, bulk moderation, and audit wiring`.

## Task 2.12: Analytics + export APIs
**Files:** Create `src/app/api/admin/analytics/route.ts`,
`src/app/api/admin/export/items.csv/route.ts`, `src/app/api/admin/export/claims.csv/route.ts`.
Export capped at 10,000 rows, `Content-Disposition: attachment`.
**Commit** `feat(admin): add impact analytics and CSV export`.

## Task 2.13: Backfill script
**Files:** Create `scripts/backfill-matches.ts`; add an npm script `db:backfill-matches`.
**Commit** `chore(scripts): add match backfill`.

---

# BATCH 3 — UI

## Task 3.1: Notification bell + page
**Files:** Create `src/components/NotificationBell.tsx`, `src/app/notifications/page.tsx`;
modify `src/components/Navbar.tsx`. 30s poll, unread badge, mark-all-read, empty state.
**Commit** `feat(ui): add notification bell and inbox`.

## Task 3.2: Possible-matches panel
**Files:** Create `src/components/PossibleMatches.tsx`; modify `src/components/ItemDetail.tsx`.
Score, reasons as chips, counterpart card, dismiss/confirm.
**Commit** `feat(ui): show possible matches on item detail`.

## Task 3.3: Category chips, tag pills, post-form inputs
**Files:** Create `src/components/ui/TagPill.tsx`, `src/components/CategoryFilter.tsx`;
modify `src/components/PostItemForm.tsx`, `src/components/ui/ItemCard.tsx`,
`src/app/search/page.tsx`, `src/app/lost-items/page.tsx`.
**Commit** `feat(ui): add categories, tags, and filters`.

## Task 3.4: Saved searches UI
**Files:** Create `src/components/SavedSearches.tsx`; modify `src/app/search/page.tsx`,
`src/components/dashboard/DashboardStats.tsx` (or the dashboard page).
**Commit** `feat(ui): add saved searches`.

## Task 3.5: Campus map
**Files:** Create `src/components/CampusMap.tsx`, `src/app/map/page.tsx`; modify the post form
for the zone picker. Inline SVG, no dependencies.
**Commit** `feat(ui): add campus zone map`.

## Task 3.6: Reputation badges
**Files:** Create `src/components/ui/ReputationBadge.tsx`; modify `ItemCard.tsx`, `ItemDetail.tsx`,
`UserProfileSection.tsx`. **Commit** `feat(ui): add reputation badges`.

## Task 3.7: Handover panel
**Files:** Create `src/components/HandoverPanel.tsx`; modify `ClaimsModal.tsx`,
`IncomingClaimsSection.tsx`. **Commit** `feat(ui): add handover code panel`.

## Task 3.8: Admin tabs — audit, bulk, analytics
**Files:** Create `src/components/admin/AuditLogTable.tsx`, `BulkActionBar.tsx`,
`AnalyticsPanel.tsx`, `src/components/ui/BarChart.tsx`; modify `AdminDashboard.tsx`.
**Commit** `feat(admin): add audit, bulk actions, and analytics UI`.

---

# BATCH 4 — Verification and docs

## Task 4.1: Full verify
`npm run verify` — all green. Then `npm run build` to prove the production build compiles.

## Task 4.2: Apply migrations
When `DATABASE_URL`/`DIRECT_URL` are present in `.env.local`:
`npm run db:validate`, `npm run db:verify`, `npx prisma migrate deploy`,
`npm run db:backfill-matches`.

## Task 4.3: Docs
Modify `README.md` (features, API table, new env note); create `ROADMAP-V2.md`; add a
superseded header to `COMPLETE-ROADMAP-100-STEPS.md`.

## Task 4.4: Scoped commit
`git add` only the files this work touched; commit with a conventional message. Do not push.

---

## Definition of done

- All 10 features implemented, wired, and reachable from the UI.
- `npm run verify` green; new tests cover every pure module.
- Migrations written, replayable, and applied when a database is available.
- Docs updated; no secrets committed; no push.
- Known limitation stated in the README: no CI database, so DB-touching routes are covered
  by typecheck/lint rather than integration tests.
