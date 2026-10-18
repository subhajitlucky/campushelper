# CampusHelper 2.0 — Adversarial Review

**Date:** 2026-10-18
**Scope:** everything added in the v2 work (88 files, ~11.7k lines) plus the modules it touched.
**Method:** five independent adversarial audits over non-overlapping areas, then every reported
finding re-verified here before being accepted. Findings are backed by an executed probe against a
real PostgreSQL 16, a runtime probe of the real code, or freshly-read code with a concrete trigger.
Two of my own initial suspicions were disproved and are recorded under *Checked and clean*.

---

## Critical

### C0. `[prisma/migrations/20260925000001_claim_integrity_and_indexes/migration.sql:51-53]` One item can be "returned" twice — the partial unique index was never widened for `COMPLETED`

The pre-existing constraint that enforces "one active claim per item" is partial on the *old*
status set:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "Claim_approved_item_key"
  ON "Claim" ("itemId") WHERE "status" = 'APPROVED';
```

v2 added `ClaimStatus.COMPLETED` and the handover flow moves a claim `APPROVED → COMPLETED`, which
takes it **out** of the indexed set. The predicate was never widened. Proved with rolled-back
inserts on the migrated schema: after `c1: APPROVED → COMPLETED`, a second claim `c2: APPROVED` on
the **same item** was accepted (`approved_or_completed_claims_on_one_item = 2`). The positive
control in the same run — a duplicate `PENDING` claim — was correctly rejected, so the mechanism
works and simply excludes the new status.

Consequence: once a return is complete, another claim can be filed and approved. Approval re-issues
a handover code, overwrites `Item.claimedById` with the second claimant, and re-awards
`RETURN_COMPLETED` — which the ledger does **not** dedupe, because its key is
`(userId, kind, itemId)` and the second claimant is a different user. Both parties are therefore
credited a second time for one physical return. The creation path's only item-state gate is
`status === 'DELETED'`, so a `RESOLVED` item still accepts claims.

**This is the most serious defect of the review, and it is mine:** adding a status without updating
the partial index that keys off status. **Fix:** widen to
`WHERE "status" IN ('APPROVED','COMPLETED')`.

### C1. `[src/app/api/items/route.ts:155-172]` `GET /api/items` leaks moderation notes, moderator identity, and precise coordinates

The query uses `include` (no `select`) and the response spreads `...item`, so Prisma returns **every
scalar**. Verified by calling the real handler:

```
SENSITIVE FIELDS PRESENT WITH VALUES:
  moderationReason = "suspected scam, escalate to warden"
  latitude/longitude = 20.123456 85.654321
  + moderatedById, moderatedAt, moderationStatus, deletedById, deletionReason
```

This is a public-ish list: any signed-in student can read it, and anonymous callers get it for
`?status=RESOLVED` (allowlisted in `proxy.ts`).

The leak is deliberate elsewhere: the admin-only, audited CSV export selects only
`moderationStatus` and never `moderationReason`; the single-item projection omits coordinates and
all moderation fields. So the list endpoint contradicts the project's own privacy decisions — and a
moderator's note ("suspected scam, escalate to warden") plus the moderator's user id are disclosed
to the person being investigated.

My work made this materially worse: `latitude`/`longitude` are new columns, and bulk `FLAG` is what
populates `moderationReason`. **Fix:** replace `include` with an explicit `select` of public fields.

### C2. `[src/app/lost-items/page.tsx:81-82]` Pagination is dead on `/lost-items` — items 13+ are unreachable

```js
setTotalPages(Math.ceil(data.total / limit));
setTotal(data.total);
```

`GET /api/items` returns `{ items, pagination: { total, totalPages } }` — there is no top-level
`total`. `Math.ceil(undefined / 12)` is `NaN`, so the `{totalPages > 1 && <Pagination/>}` guard is
never true. The response is `any`, so TypeScript cannot catch it. Pre-existing, but the page is one I
modified. **Fix:** read `data.pagination.total` / `.totalPages`.

---

## Major

### M0. `[prisma/schema.prisma:117-129]` The busiest endpoint has no usable index: full table scan plus a sort on every page view

The default items list filters `status: { not: 'DELETED' }` and orders by `createdAt desc` with
`skip`/`take`. Grepping every migration for `ON "Item"` shows twelve indexes, none of which leads
with `createdAt` alone and none partial on `status <> 'DELETED'` — so nothing can supply the sort.

Measured at 20,000 items with the exact SQL Prisma emits:

```
Seq Scan on "Item" (actual time=0.145..27.357 rows=18801)  ->  top-N heapsort
Execution Time: 37.259 ms   (for a 20-row page; + 6.14 ms index-only count)
```

For contrast the audit log, which *does* have `@@index([createdAt])`, serves its page in **0.594 ms**
via a backward index scan. The public items list is the most frequently hit endpoint in the app.
**Fix:** add `@@index([createdAt])` to `Item`, ideally a raw partial index
`ON "Item"("createdAt" DESC) WHERE "status" <> 'DELETED'`.

---

## Major

### M1. `[src/lib/matching.ts:47 + src/app/api/items/route.ts]` The duplicate guard cannot fire for uncategorised items

`DUPLICATE_THRESHOLD = 70`, but the maximum score two *identical* reports can reach without a
category and tags is **68**. Verified by probe:

```
identical items, no category/zone/tags -> {"score":68, ...}
duplicate threshold                    -> 70
max achievable without category        -> 68
guard fires? NO — 409 is unreachable for this payload
same but WITH a category               -> 86 (fires: true)
```

Confirmed through the real route: posting the same payload twice returns **201**, and the item count
grows. The headline duplicate-post guard silently does nothing for the exact case it exists for — a
double-submitted form, which has no category unless the user picked one.

**Why the tests missed it:** the unit-test fixture sets `categoryId` and `tags`, giving the scorer 24
extra points. The fixture did not match the payload the form actually sends. **Fix:** score
similarity relative to the weight achievable for that pair, or use a dedicated rule (title ≥ 0.8
**and** description ≥ 0.6).

### M2. `[src/lib/notifications.ts:47-58]` Dedupe drops a *different* person's notification

The dedupe predicate matches `(userId, type, itemId, readAt: null, createdAt ≥ since)` and **not**
`actorId`. Verified by probe:

```
first  notify() returned: cmvdfx87l00016lxug1o854yl
second notify() returned: null <-- SUPPRESSED
notifications actually stored: 1
BUG CONFIRMED: 1 claim notification(s) were silently dropped.
```

Two different people claiming one item within five minutes: the poster hears about only the first.
Found independently by two auditors and by me. Losing a claim notification can mean an item is never
reunited. **Fix:** add `actorId` to the dedupe `where`.

### M3. `[src/lib/text-similarity.ts:62]` Matching and duplicate detection are dead for Hindi, Odia, and every non-Latin script

`normalizeText` strips everything outside `[a-z0-9]`, so Devanagari normalises to the empty string:

```
normalize hi ""                 tokenize hi []
normalize odia ""
jaccard hi vs hi 0              <- two identical Devanagari strings
disjoint text, same cat/zone/date/tags -> score 46
threshold 55
```

Two reports written in Hindi with *identical* text score at most 46 — below both the 55 match
threshold and the 70 duplicate threshold. No wrong match is produced (jaccard is correctly 0 for
empty sets); the failure is a total false negative. For an Indian campus where students plausibly
report in Hindi or Odia, the flagship feature is inert for those users.

My own test asserted only `expect(() => normalizeText("मेरा बैग")).not.toThrow()` — it checked the
function does not crash, never that it retains meaning. **Fix:** keep `\p{L}\p{N}` and strip only
punctuation/symbols under the `u` flag.

### M4. `[src/app/api/claims/[id]/route.ts:174-183]` Approving a claim resolves the item *before* any handover is verified

```js
const newItemStatus = claim.claimType === 'OWN_IT' ? 'RESOLVED' : 'CLAIMED';
```

Verified through the real handler:

```
PUT /api/claims/[id] status: 200
  item.status = RESOLVED          (CLAIMED would be correct)
  item.resolvedAt = SET
  claim.status = APPROVED
  claim.handoverCode = issued
  claim.handoverVerifiedAt = null
```

This contradicts the handover module's own stated invariant ("Only then is the item marked
resolved") and design §F6.4. Because analytics counts `status='RESOLVED'` as returned, resolution
rate and median time-to-return are inflated by unverified approvals. `OWN_IT` is the *primary* flow,
so the feature is bypassed on its main path. **Fix:** set `CLAIMED` at approval and let
`verifyHandover` set `RESOLVED`.

### M5. `[src/lib/handover-service.ts:158-169]` The 5-attempt cap is defeated by concurrency

Read-modify-write on `handoverAttempts`. Verified by probe:

```
submitted 5 concurrent wrong codes
recorded attempts: 1 (expected 5)
code burned: false
```

**Honest severity: the practical risk is low** and an auditor was right to push back on my initial
rating — only the claimer, the poster, or a moderator can reach the endpoint, and both parties can
read the code via `GET` anyway, plus the route is rate-limited to 10/hour. So this is a broken
control rather than an exploitable brute force. It is still a correctness bug in a security control.
**Fix:** `{ increment: 1 }` and branch on the returned value.

### M6. `[src/app/api/matches/[id]/route.ts]` The only mutating route with no CSRF check

Grep shows `checkCSRF` in 16 other mutating routes; this one has no `csrf-middleware` import. Honest
caveat: the session cookie is `SameSite=Lax` and the token is httpOnly double-submit, so a plain
cross-site POST is unauthenticated today. It is a missing defence-in-depth guard, not a demonstrated
exploit. **Fix:** call `checkCSRF` first, like every sibling route.

### M7. `[src/components/PostItemForm.tsx:262-282]` Edit mode can open blank (prefill wiped by a stale validator)

The prefill effect calls `setFieldValue(...)` then `setTimeout(() => validateForm(), 0)`. That
`validateForm` is the render-1 closure, and its failure branch writes a **snapshot**:
`const newState = { ...formState }` (`useFormValidation.ts:133-146`). If validation fails, the
pre-prefill empty state overwrites all four just-set fields. Reproduced by an auditor running the
real hook: `values: {"title":"","description":"","itemType":"LOST","location":""}` where the stored
item had a real title and location. The sync effect then writes the blank values back to
`localStorage`, so the corruption persists. Reachable when the stored `editItem` is stale or
partially edited (the write effect runs on every keystroke). **Fix:** functional update in the
validator, or validate from the fresh render.

### M8. `[src/components/PostItemForm.tsx:627 + src/hooks/useFormValidation.ts:261-271]` Submitting an invalid form silently does nothing

`handleSubmit` sets all fields touched, then calls `validateForm()`, which writes a snapshot taken
before those touched flags — discarding them. Since `errors` only surfaces entries for touched
fields, nothing renders. Reproduced: `submitted: 0, errors: {}, isValid: true` with an empty
Location. Trigger: fill Title and Description, never focus Location, click "Post Item" — no request,
no message, no red border; the button looks dead. **Fix:** validate the all-touched snapshot.

### M9. `[src/components/admin/…, src/app/api/admin/items/bulk/route.ts:55-63]` Bulk RESTORE mislabels FOUND items as LOST

Verified through the real handler:

```
after RESTORE:  itemType = FOUND   status = LOST   (LOST is wrong)
```

The sibling single-item route derives status from `itemType`
(`item.itemType === 'FOUND' ? 'FOUND' : 'LOST'`); the bulk route hardcodes `'LOST'` — a bug in the
spec I wrote for that route. The integration test only restores a LOST item, so it missed this.
**Fix:** derive status from `itemType`.

### M10. `[src/lib/match-service.ts:133-157]` The "upsert" is find-then-create; a P2002 loses matches and notifications permanently

Two complementary items posted concurrently both insert the same pair; one throws P2002, which
propagates to the outer `catch`, so the rest of the ranked loop is skipped **and** `notifyMatchOwners`
never runs for pairs created earlier in that loop. Because later runs treat existing rows as
`existing` and `continue` without adding them to `newlyCreated`, those notifications can never be
sent. The module doc and the backfill script both call this an upsert; it is not one. **Fix:** use
`prisma.matchSuggestion.upsert`.

### M11. `[src/app/api/categories/route.ts]` + `[src/components/CategoryFilter.tsx]` Guests see a dead "Authentication required" box on public pages

`/search` and `/lost-items` are public routes; I wired `CategoryFilter` into both, but
`GET /api/categories` requires a session and `fetchWithAuth` throws before fetching. A signed-out
visitor sees only `Authentication required` with a "Try again" that can never succeed. A regression
from my wiring. **Fix:** make the taxonomy public (it is non-sensitive and read-only), or hide the
facet for guests.

### M12. `[src/lib/schemas/notification.ts:38-46]` The "exclusive" mark-read union is not exclusive — marking all as read wins

Proven with the installed Zod: `{ all: true, ids: ["n1"] }` → `{ all: true }`. Zod objects strip
unknown keys, so the first union member matches and **discards** `ids`; the route then marks the
entire inbox read. Even `{ all: true, ids: "not-an-array" }` is accepted. The doc comment claims this
"cannot happen". Found independently by two auditors. **Fix:** `.strict()` members, or a single
object with `refine`.

### M13. `[src/lib/saved-search-service.ts:110-137]` Saved-search fan-out is sequential on the item-create path

Each matching search costs a `notify` (`findFirst` + `create`) plus an `update`, awaited in a loop
inside `POST /api/items`. Measured:

```
200 matching saved searches -> 200 notified in 1043 ms
(5.2 ms per matching search, added to the POST latency)
```

A campus with 200 broad alerts adds ~1s to every post, growing linearly. `notifyMatchOwners` has the
same shape (up to ~400 sequential notifies). **Fix:** batch with one `findMany` + `createMany` +
`updateMany`.

---

## Minor

| # | Location | Issue |
|---|---|---|
| m1 | `src/lib/match-service.ts:253-256` | Pair orientation derives from mutable `item.itemType`. `PUT /api/items/[id]` lets an owner flip it, after which the suggestion vanishes from their list, the counterpart's type label is falsified, and flipping both sides then re-running the backfill inserts a reversed pair under a new key — **resurrecting a dismissed match**. |
| m2 | `src/lib/reputation-service.ts:42-60` | The `(userId, kind, itemId)` unique index is a plain unique index (no `NULLS NOT DISTINCT`), so `itemId = NULL` defeats idempotency. Proven live: two identical NULL-itemId awards both inserted. Latent today — no caller omits `itemId`, and the API doc invites it. |
| m3 | `src/lib/schemas/taxonomy.ts:47-66` | `tagsSchema` de-duplicates *before* enforcing the 8-tag cap, so 20 raw tags collapsing to 8 unique are **accepted**, contradicting the documented "reject rather than silently truncate". My test used 9 distinct tags and passed. |
| m4 | `src/lib/schemas/saved-search.ts:17-32` | Doc claims the filter shape matches `GET /api/items`; it strictly rejects `location`, `status`, and `postedById`, which the item list accepts. So a location-filtered search cannot be saved, and `tags` is an array here vs a comma-string there. Contract/doc gap, not a crash. |
| m5 | `src/lib/notification-content.ts:48` | `truncateAtWord` slices UTF-16 code units, so a cut can split a surrogate pair and emit a lone surrogate (stored as U+FFFD). Reachable via an unvalidated ≥200-char Google OAuth display name. Also `max ≤ 0` breaks the "never exceeds max" invariant. |
| m6 | `src/app/api/claims/[id]/route.ts:214-233` | Side effects sit inside the `try` whose `catch` returns **500 "Failed to update claim in database"**; `issueHandoverCode` can throw, so the client is told the update failed when the claim *was* approved and committed with no code issued. |
| m7 | `src/app/api/claims/[id]/handover/route.ts:61-72, 146-149` | `verifiedAt` is hardcoded `null` (`loadHandoverClaim` never selects `handoverVerifiedAt`), so a completed handover reads back unverified; the reissue reply reports `expiresAt: null` although a 72-hour expiry was just written. |
| m8 | `src/lib/match-service.ts` (`getMatchesForItem`) | The suggestion query filters the *suggestion* status but not the counterpart's `deletedAt`/`status`, so a moderated-away item can still appear as a live "possible match". |
| m9 | `src/components/PossibleMatches.tsx:117,173` | A dismissed suggestion stays on screen: the optimistic update sets `DISMISSED` but the render maps all `matches` without filtering. |
| m10 | `src/components/NotificationBell.tsx:53-57,71` | `isSignedOut` is a one-way latch — nothing resets it on a later successful poll, so one transient 401 hides the bell (the only notifications entry point) until a hard reload. |
| m11 | `src/app/search/page.tsx:147-155` | Applying a saved search merges into existing filters, so a stale Status/Location persists and the applied search is not what runs — often an empty list that looks broken. (Mine.) |
| m12 | `src/app/search/page.tsx:62-122` | A request per keystroke with no cancellation or request guard, so the last-*applied* response wins; plus `onPageChange` fires a duplicate GET. Pre-existing. |
| m13 | `src/app/search/page.tsx`, `src/app/lost-items/page.tsx` | Filter `<select>`s have no `id`/`htmlFor`/`aria-label` — unnamed comboboxes for screen readers. |
| m14 | `src/lib/schemas/item.ts:97-101`, `admin.ts:44-48`, `notification.ts:8-21` | `page` is unbounded and `parseInt`-truncated: `page=99999999999999999999` yields `skip = 2e21` (not a safe integer, likely a Prisma 500 — inferred, not reproduced), and `page=1abc` silently means page 1. |
| m15 | `src/lib/schemas/item.ts:144-152` (+ admin, saved-search) | `from`/`to` accept impossible and bare dates: `2024-02-30` silently becomes 1 March; `"1"` becomes the year 2001. |
| m16 | `src/lib/schemas/taxonomy.ts:69-75` | `slugSchema` accepts `--` and `-`. Harmless (consumers treat unknown slugs as no-match) but nonsense. |
| m17 | `src/lib/match-service.ts:181-217` | Sequential notification fan-out: up to ~800 queries before the 201 response, risking a timeout after the item row is already committed. |
| m18 | `src/lib/saved-search-service.ts:95-100` | LIFO `take: 500` permanently starves the oldest saved searches once the table exceeds the cap. |
| m19 | `src/lib/saved-search-service.ts:117-138` | A saved search notifies its owner about **their own** new item: no `actorId` is passed and the input interface has no `postedById`, so it is structurally unfixable inside the module. |
| m20 | `src/lib/audit.ts:93-98` | `AuditLog.ip` is stored verbatim with no `net.isIP` validation and no length cap (contrast the 500-char cap on `reason` next to it). |
| m21 | `src/app/api/claims/route.ts:232-238` | Only `DELETED` is rejected, so claims can be filed against `RESOLVED`/`CLAIMED` items; approval then hits an inner guard and returns a misleading 500. |
| m22 | `src/components/ui/BarChart.tsx:43-46` | The `Math.max(1, …)` floor makes the footer read "peak 1" when every bar is zero. |
| m23 | `src/components/HandoverPanel.tsx:189-193` | After a wrong code, "N attempts remaining" is not refreshed (only reloaded on success). |
| m24 | `src/components/admin/AnalyticsPanel.tsx:89-111` (+ AuditLogTable, notifications page) | No cancellation when rapidly switching range/filter, so a stale payload can render under the new selection. |
| m25 | `src/app/api/saved-searches/route.ts:66`, `notifications/read:31`, `admin/items/bulk:93`, `admin/users/bulk:81` | `await request.json()` without a try/catch: an empty body rejects and becomes a **500** instead of 400. Four other routes handle it correctly. |
| m26 | many | **Dead code / unwired features.** No caller anywhere: `notifyMany`, `notifyItemPoster`, `awardReputationMany`, `countCommentsCreditedToday`. Tests only: `tierProgress`, `nextTier`, `formatReputationDelta`. Unused Zod exports: `matchesQuerySchema`, `reissueHandoverSchema`, `duplicateCandidateSchema` (which also requires a `similarity` field the API never emits), `duplicateGuardFieldsSchema`, `matchIdParamSchema`. |
| m27 | `prisma/schema.prisma` | `COMMENT_ON_ITEM` and `ITEM_RESOLVED` are never emitted; `COMMENT_POSTED` and `MODERATION_UPHELD` are never awarded. The comments route has no `notify` and no `awardReputation` call, so the documented comment notification, comment reputation, and the daily comment cap (four passing tests) are all unreachable. |
| m28 | `src/components/HandoverPanel.tsx:174-193` + `handover-service.ts:106` | The code is returned to **both** parties, so either can read and then enter it, completing the handover alone. The service comment claims "neither is ever told the code itself" — the code contradicts it. The design permits both parties to read it (§F6.2) while intending the code to prove a physical exchange; as built it proves only that someone typed six digits they could see. |
| m29 | `src/components/SavedSearches.tsx:60-70,162` | Dead 401 branch: `fetchWithAuth` throws, so `response.status === 401` is unreachable and the signed-out guard can never fire (masked because `/search` only renders it when signed in). |
| m30 | `src/app/api/admin/analytics/route.ts:117-137` | The capped analytics samples are **three different populations**: `durationRows` has no `orderBy`, so Prisma injects the primary key and takes the **oldest** 10,000, while the daily-series queries order by `createdAt desc` and take the **newest** 10,000, and the totals count everything. Above 10,000 rows per window the median describes one cohort, the chart another, and the headline a third. (I checked this area and wrongly cleared it — I verified the *rate's* numerator and denominator, not the capped sample cohorts.) |
| m31 | `src/app/api/zones/route.ts:37`, `analytics/route.ts:91`, `items/[id]/route.ts:344` | "Deleted" has two representations. The user delete path sets `status: 'DELETED'` and **never** `deletedAt`, but zones and analytics filter `deletedAt: null` only, while the list filters `status: { not: 'DELETED' }` and RLS checks both. So user-deleted items are counted on the campus map and in `posted`/top-zone totals while being invisible in every list — the map shows N items for a zone and the drill-down shows fewer. |
| m32 | `src/app/api/admin/export/[report]/route.ts:46-47,84-85` | The 10,000-row cap silently keeps only the newest rows and the response carries no truncation signal (the cap appears only in the audit metadata), so a truncated export is indistinguishable from a complete one. |
| m33 | `prisma/schema.prisma:292`, `src/lib/saved-search-service.ts:92-101` | The only `SavedSearch` index is `(userId, createdAt)`, so the evaluation query — which filters on `createdAt` and joins `User` — cannot use it and sorts the whole table on every item POST. Combined with the LIFO `take: 500`, installs with more than 500 searches stop evaluating the oldest permanently. |

---

## Checked and clean

Recorded so coverage is auditable. Two entries are my own initial suspicions that verification
disproved — I would have filed both as false positives.

- **Analytics `resolutionRate`** — I suspected numerator and denominator covered different cohorts
  and could exceed 100%. They do not: `resolved` is `{...itemWhere, status:'RESOLVED'}`, sharing the
  `createdAt` range filter. **False positive, dropped.**
- **Match threshold sanity** — probed: two items with disjoint titles *and* descriptions can never
  clear 55 on category/zone/date/tags alone (measured maximum 46). At least one text signal must
  contribute, which is the intended design.
- **`csv.ts`** — exhaustively probed: leading `'`, a bare `=`, nested arrays, `Symbol`, `BigInt`,
  `1e21`, `-0`, `±Infinity`, `NaN`, `Map`, functions, headers containing commas/quotes/backslashes.
  No malformed row, no ragged row, no throw. Round-trips as parseable CSV.
- **`reputation.ts`** — every integer 0..600 swept: exactly three progress decreases, all at tier
  boundaries, and those are the documented reset semantics. No unintended non-monotonicity.
- **`analytics.ts`** — probed under `TZ=America/New_York`: DST spring-forward and fall-back ranges
  produce exactly one bucket per calendar day; a 10-year range yields 3654 unique days with correct
  endpoints. `medianTimeToReturnHours` filters non-finite/negative correctly.
- **`handover.ts` schema** — full-width digits, Arabic-Indic digits, trailing newline, and a
  zero-width-space injection are all rejected; exactly six ASCII digits is enforced.
- **Handover code confidentiality** — absent from the item projection and from every notification
  body (the formatter has no code parameter). Confined to `handover-service.ts` and its route.
  (See m28 for the *both-parties* issue, which is a design gap rather than a leak.)
- **Handover bypass via the claim endpoint** — `updateClaimStatusSchema` permits only
  `APPROVED | REJECTED`, so a client cannot set `COMPLETED`; the handler also rejects any claim not
  currently `PENDING`.
- **IDOR sweep** over every Prisma row operation in all 18 routes — all user-owned access is scoped
  by `userId`/ownership. No IDOR found.
- **Privilege escalation** — both bulk routes filter the caller's own id and, for non-ADMIN callers,
  every ADMIN target; the action set cannot change another user's role; self-verification is
  unreachable.
- **CSRF ordering** — present and before any DB work in every mutating route except M6.
- **`items/[id]` PUT authorization** — owner or ADMIN/MODERATOR only, checked before any write.
- **`Item.tags` GIN index** — `USING GIN ("tags" array_ops)`, which supports the `@>` that Prisma's
  `hasEvery` emits.
- **Email/select hygiene** — the items list, claims, notifications, and matches responses exclude
  emails; export is admin-gated and audited.
- **No raw SQL** (`$queryRaw`/`$executeRaw`) and no outbound fetch in any route; no
  `dangerouslySetInnerHTML` anywhere — React escapes notification and item text.
- **`countCommentsCreditedToday` fails closed** (returns `MAX_SAFE_INTEGER` → no credit) — correct
  reasoning, even though the function is currently unreachable.
- **`CampusMap`, `map/page.tsx`, `BulkActionBar`, `ItemCard`, `ReputationBadge`, `VerifiedStudentBadge`,
  `TagPill`, `AuditLogTable` shapes, `AnalyticsPanel` math, `AdminDashboard` hook order and selection
  handlers** — read in full, no defects found.

---

### Additional clean results (database layer, measured not assumed)

- **Migration ↔ schema fidelity** — `prisma migrate diff --from-url <migrated db> --to-schema-datamodel`
  reports an empty migration: types, defaults, nullability, the GIN method/ops, and every index,
  unique, and FK name correspond exactly.
- **`ALTER TYPE … ADD VALUE` is safe as written** — all seven migration files applied inside a single
  transaction on PG 16; `COMPLETED` is never referenced in the file that adds it.
- **Populated-database safety** — no `NOT NULL` column added without a default; the seeds are
  idempotent.
- **Tag filtering is properly indexed** — `hasEvery` compiles to `"tags" @> $8` and measured
  `BitmapAnd(Item_categoryId_createdAt_idx, Item_tags_idx)` at 0.83 ms.
- **Audit filters are indexed** — actor+action 0.54 ms, targetType+range 0.24 ms, unfiltered page
  0.59 ms. The notification dedupe query is served exactly by `(userId, readAt, createdAt)`.
- **`onDelete` audit** over every foreign key — cascades and set-nulls are correct; the single
  `Restrict` is never hit because user deletion is a soft delete.
- **Analytics populations and UTC bucketing** — `resolutionRate`'s numerator is a subset of its
  denominator, and the route's `utcDayKey` matches `fillDailySeries`' `Date.UTC` bucketing, so there
  is no local/UTC mixing.

## Themes

1. **Tests proved helpers, not features.** The duplicate guard, the comment cap, tier progress, and
   the tag cap each have passing tests while being unreachable or defeated in production. Two
   fixtures supplied optional fields the real form omits, and one test asserted "does not throw"
   where it should have asserted meaning. Integration tests that post the payload the UI actually
   sends would have caught M1 and C1.
2. **Optional signals must not gate a fixed threshold** (M1) — 24 of 96 points depend on fields the
   user may leave blank.
3. **Non-Latin input was never considered** (M3), in a product where the input is likely to be
   Hindi or Odia.
4. **"Never fails the request" swallowed real failures** — correct for side effects, but it also hid
   M10 and turned a committed approval into a 500 (m6).
5. **Check-then-act without atomicity** appears four times (M2 dedupe, M5 counter, M10 upsert, m2
   NULL idempotency). All correct single-threaded, all wrong under concurrency.
6. **Built but unwired surface** — ~14 exports and 4 enum values have no production caller, and the
   README/ROADMAP describe the features they imply as shipped.

## Suggested fix order

1. **C1** (data exposure) and **M4** (feature bypassed on its main path) — highest impact.
2. **M1**, **M2**, **M12**, **M9** — small, contained fixes to broken behaviour.
3. **M3** — unicode-aware normalisation plus a non-Latin fixture.
4. **C2**, **M7**, **M8** — UI correctness; M8 in particular makes the post form look broken.
5. **M4/M5/M6/M10** — concurrency and guard integrity.
6. The remaining minor items, and a decision on m26/m27 (wire or delete).
