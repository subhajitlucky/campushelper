# Scale audit — 2026-10-19

Measured against a throwaway PostgreSQL 16 container seeded to **100,000 users /
200,420 items / 150k notifications / 100k saved searches / 300k match
suggestions / 500k reputation events / 500k audit rows** (809 MB), with
`ANALYZE` run on all 11 tables. Every number below is a real measurement from
`EXPLAIN (ANALYZE, BUFFERS)` or a timing harness driving the real source modules.

Nothing was measured against production, Vercel, or the real Supabase project.

A note on measurement hygiene: the first `EXPLAIN` batch, taken ~2 minutes after
a 2.1M-row load, was contaminated by post-seed writeback and read **2–10× high**
(`OFFSET 100000` reported 317 ms against a settled 38.5 ms). Every figure here is
from a settled, repeated run. Where a figure varies between runs the range is
given.

## Verdicts on the previously identified bottlenecks

| # | Claim | Verdict | The number |
|---|---|---|---|
| 1 | Saved-search fan-out is sequential | **Confirmed, worse** | 1,735.9 ms for 200 matches (8.68 ms each); 4,078.2 ms at the 500 cap |
| 2 | Match computation is N+1 | **Confirmed** | 1,950.4 ms, 1,004 SQL statements per item |
| 3 | `Item_createdAt_idx` used under the real filter shape | **Confirmed** | 0.036–0.293 ms, `Index Scan Backward` in every variant |
| 4 | Search is unindexed `ILIKE '%term%'` | **Confirmed** | absent term 272.1 ms → 0.237 ms with a trigram GIN |
| 5 | Offset pagination is O(offset) | **Confirmed** | `OFFSET 100000` = 38.5–68.4 ms, 100,388 buffers; keyset 0.058 ms, 28 buffers |
| 6 | In-memory rate limiting | **Confirmed** (code reading) | 7 `RateLimiterMemory` limiters, no shared store |
| 7 | Every side effect synchronous | **Confirmed** | 2,862.6 ms and ≈2,311 statements before the 201 |
| 8 | `notify()` is findFirst+create in loops | **Confirmed** | 902 SELECT + 501 INSERT on Notification per create |
| 9 | P2002 swallowed, match pairs abandoned | **Confirmed and reproduced** | 4 of 6 concurrent races lost 144–169 of 200 pairs, silently |
| 10 | Analytics loads 10k rows, mixes cohorts | **Partial** | Cost *refuted* (53 ms); cohort truncation **confirmed** — 56 of 1,095 days |
| 11 | Homepage 5 queries on ISR | **Non-issue, ISR verified** | 55–63 ms per 5-minute revalidation; `○ / 5m 1y` |
| 12 | Unbounded growth | **Confirmed** | 809 MB vs Supabase Nano's 500 MB recommended max |
| 13 | Connection pooling | **Confirmed, worse** | no `connection_limit`; session-mode pooler on :5432; caps 60/200 |
| 14 | RLS not enforced | **Confirmed** | 0 policies; enabling as designed returns 0 `User` rows and breaks `INSERT` |

## New findings

- **N1 — a second, larger saved-search cost.** The selection query itself
  (`SavedSearch` newest-first joined to `User`) had no usable index and was a
  parallel seq scan + top-N heapsort, **187.3 ms on every item creation**, before
  the per-search loop even began. `(userId, createdAt)` cannot serve it because
  the leading column is unconstrained.
- **N3 — a partial index on the live predicate** makes deep paging 6.4× cheaper.
  Not applied: Prisma cannot model partial indexes without drift, and realistic
  page depths are already under 1 ms.
- **N5 — `deletedAt` is written by only 1 of 3 delete paths**, and the list API
  ignores it. Two representations of "deleted" can drift.
- **N6 — `/api/comments` fetches every comment with no `take`.** 20,000 comments
  on one item returned 20,000 rows in one response.
- **N9 — the homepage median was the median of the two thousand *oldest*
  resolved items**, because an unordered `take` returns heap order. 265.392 h
  against a true 253.026 h (+4.9%), frozen on that cohort forever.
- **N10 — `/api/notifications/unread-count`**, polled every 30 s by every open
  tab, had no rate limiter at all.

## What was fixed, with before/after

All measured with the same harnesses against the same 200k-row database.

| Fix | Before | After | |
|---|---|---|---|
| Match pairs lost under concurrency | 4 of 6 races lost 144–169 of 200 pairs | **0 of 6; all 399 pairs persisted** | data loss |
| Item-create side effects (`Promise.all`) | 2,862.6 ms, ≈2,311 statements | **178.2 ms** | 16.1× |
| Saved-search fan-out, 200 matches | 1,735.9 ms | **104.6 ms** | 16.6× |
| Saved-search fan-out, 500 (cap) | 4,078.2 ms | **134.6 ms** | 30.3× |
| Match computation | 1,950.4 ms, 1,004 statements | **125.3 ms** | 15.6× |
| Search, absent term | 272.1 ms | **0.621 ms** | 438× |
| Homepage median | 265.392 h (wrong cohort) | **30 h exactly, matches SQL truth** | correctness |
| Analytics daily series, `range=all` | 56 of 1,095 days | **1,099 days, exact** | correctness |
| Pool config | no `connection_limit`, CPU-derived | **1 behind a transaction pooler, 3 otherwise; explicit values win** | outage class |

### How each was done

1. **Match persistence** — the existence check is now one indexed `findMany`
   (every ranked pair shares the subject, so it is a single-side lookup), writes
   are `createMany({ skipDuplicates: true })`, and score refreshes are grouped
   into `updateMany` per distinct value. `skipDuplicates` is what makes this
   concurrency-safe: the old `findUnique` then `create` raised P2002, and the
   throw escaped the whole loop into a catch that logged and returned 0.
2. **Notifications** — new `notifyMany()` does one dedupe `findMany` and one
   `createMany` for a whole batch. It preserves `notify()`'s two rules
   (never self-notify; collapse an identical unread notification inside the
   five-minute window) and additionally collapses duplicates *within* a batch,
   which the per-call version structurally could not.
3. **Saved searches** — collect matching searches first, then `notifyMany` and a
   single `updateMany({ lastNotifiedAt })` instead of three round trips each.
4. **Indexes** (`20261019000000_scale_indexes`) — `SavedSearch(createdAt)`, plus
   `pg_trgm` GIN indexes on `Item.title`, `description` and `location`. The
   extension install is wrapped so that a role without the privilege gets a
   NOTICE and skips the indexes rather than failing every subsequent deploy.
5. **Analytics and homepage** — `percentile_cont` for the median and
   `date_trunc` grouping for the daily series, replacing capped in-memory
   bucketing. Both are exact over the whole population and return fewer rows than
   the fetches they replace.
6. **Pooling** — `withConnectionDefaults()` fills in `connection_limit`,
   `pool_timeout` and (on the transaction pooler) `pgbouncer=true` only when the
   environment does not specify them; the client is now cached on `globalThis` in
   production as well as development.

## Deliberately not done

- **Keyset pagination.** The real fix for `OFFSET`, but it changes the public API
  contract and every client. Instead the offset is now bounded (`page <= 200`,
  i.e. 20,000 rows deep) so a crawler cannot turn a cheap public endpoint into a
  table scan per request. The equivalent keyset query is 0.058 ms — the work is
  understood, not forgotten.
- **A job queue.** The fan-out is 16× cheaper but still synchronous. Committing
  the write and enqueuing matching/saved-search/notification work would remove
  it from the request path entirely. This needs an infrastructure decision
  (QStash, Inngest, or a `pg-boss`-style table) that is not mine to make.
- **A shared rate-limit store.** Per-instance limiting cannot be verified without
  a second instance, and moving to Redis/Upstash is a dependency and cost
  decision.
- **Retention / partitioning.** The database is already 1.6× over the free
  plan's recommended ceiling and item creation writes ~501 notifications and
  ~200 match rows. A retention policy is a product decision about how much
  history to keep.
- **Enabling RLS.** Documented and guarded instead — see
  `tests/unit/rls-guard.test.ts`. Every policy depends on session GUCs that no
  code sets; measured with the role and policies provisioned, `User` returns 0
  rows and `INSERT INTO "Item"` raises a policy violation. Applying the operator
  migration without a per-transaction `set_config()` layer takes sign-in, every
  `postedBy` join and item creation offline.

## Reproducing

The throwaway database and harnesses are in `.tmp-scale/` (gitignored).
`docker rm -f ch-scale-pg` drops it. The harnesses drive the real modules:

```
npx tsx .tmp-scale/harness/run.ts combined 500
npx tsx .tmp-scale/harness/run.ts savedsearch 200 300
npx tsx .tmp-scale/harness/run.ts matches hit_418
npx tsx .tmp-scale/harness/race3.ts
```
