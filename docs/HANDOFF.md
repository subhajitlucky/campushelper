# CampusHelper — Handoff Brief

**Repo:** `/home/subhajit/project/campushelper`
**Branch:** `ui-premium` (local commits only — **nothing pushed**, `origin/main` is still `6ca8a7f`)
**Written:** 2026-10-18, end of a long session

---

## READ THIS FIRST — 2026-10-19 session

The sections below describe the state *before* 2026-10-19. Three commits were
added on top of `2d56652`; read them in order. Nothing has been pushed, so
production is still the old build.

| Commit | What |
|---|---|
| `3ad9a2b` | Every file in `public/` was behind the auth middleware (verified: production `GET /next.svg` → 307). Fixed. |
| `bb882a1` | Art direction + layout pass. Closed most of §2's "why it does not look good" list. |
| `e2f7adc` | Scale work: silent match-pair loss fixed, item creation 16× cheaper, indexes, cohort bugs, pooling. |

Two documents hold the evidence, and both are worth reading before changing
anything in their area:

- **`docs/plans/2026-10-19-visual-audit.md`** — what the rendered product
  actually looked like, from 52 screenshots, *before* any change. §2 below is
  superseded by it.
- **`docs/plans/2026-10-19-scale-audit.md`** — measurements on a 100k-user /
  200k-item database, every before/after number, and what was deliberately left
  undone. §3 below is superseded by it.

### Corrections to the sections below

- §2's premise is right but its hypotheses are now measured. The real problem was
  not "no art direction" in the abstract: `--background` and `--card` were both
  pure white, so a card could only be distinguished by a hairline border — which
  is why cutting 42 bordered containers to 6 changed nothing visible.
- §3 is no longer "never audited". Items 1, 2, 4, 5, 7, 8, 9, 12, 13 and 14 are
  CONFIRMED with numbers; 10 is PARTIAL (the cost claim is **refuted** — the
  Prisma route is faster than a single-SQL rewrite; the cohort bug is real); 11
  is a non-issue with ISR verified (`○ / 5m 1y`); 3 and 6 confirmed as described.
- §3-9 was worse than described: **4 of 6 concurrent item creations lost
  144–169 of their 200 match pairs**, silently, with no error surfaced.

### Traps this session added to the list

1. **`next build` is the only check that catches middleware/route-config
   errors.** Moving the matcher into a shared constant broke the proxy with
   `Entry \`matcher[0]\` need to be static strings` — `typecheck`, `lint` and
   `test` all passed. `src/proxy.ts` now carries a comment saying so, and
   `tests/unit/public-routes.test.ts` reads the literal out of the file as text.
   **Run the production build after touching proxy/middleware/route config.**
2. **`rm -rf .next` while `next dev` is running** deletes the dev server's own
   `.next/dev` and every page 500s afterwards. Stop the server first.
3. **`pkill -f "next dev"` in the same command that starts the server** kills its
   own shell (this one bit again, from §2.2). Kill and start in separate commands.
4. **Extracting a JS regex from source text needs unescaping.** `[^']+` on
   `favicon\\.ico` yields two backslashes; `new RegExp` then reads `\\.` as
   "backslash, then any char". And `\s*\]` does not match past a trailing comma.
5. **Sweep scripts need a self-test.** A `\bmr-(?:1|1\.5)\b` pattern matched `mr-1`
   inside `mr-1.5` and left a stray `.5` in 26 `className`s — an invalid utility
   Tailwind drops silently, i.e. exactly §2.4's trap again. The fix asserts the
   pattern against the strings that broke it before it runs.

### What is verified, and how

- `npm run typecheck && npm run lint && npm test` → 0 errors, 305 passing.
- `npm run build` with `DATABASE_URL` pointing at a closed port → **exit 0**, 13
  static routes prerendered, homepage logs its degraded state. Run it that way;
  a build against a reachable database proves nothing about the regression that
  shipped once.
- Production-mode behaviour of the built artifact (`next start`): `/seed/x.jpg`
  200, `/dashboard` 307 → signin, `/api/items` 307, `/logo.png` 404 (bypasses
  auth, which is the fix).

### Still open

- The list API still uses offset pagination; `page` is now bounded at 200 as a
  stopgap. Keyset needs a contract change across every client.
- Everything is still synchronous in the request path (16× cheaper, not queued).
- Rate limiting is still per-instance, with no shared store.
- No retention policy: 809 MB at 200k items against a 500 MB recommended cap for
  the free plan, and ~501 notifications + ~200 match rows per item creation.
- RLS is guarded, not enabled — see `tests/unit/rls-guard.test.ts`. Enabling it
  as written returns 0 `User` rows and breaks `INSERT INTO "Item"`.
- `public/` still contains five unused Next.js starter SVGs. Nothing references
  them; they were useful once as a proof that the asset fix works.

---

## 0. Copy-paste prompt for the new session

> Work in `/home/subhajit/project/campushelper`. Read `docs/HANDOFF.md` first — it has the
> full state, the known problems, and the traps that cost time last session.
>
> Two jobs, in this order:
>
> **1. Make it actually look premium.** Not "consistent" — premium. The previous session
> tokenised the design system, loaded real typography, and cut bordered containers from 42 to 6,
> and the owner's verdict is still **"it doesn't look good."** Nobody has ever looked at the
> rendered result. **Start by taking screenshots of every page in both themes at 375px and
> 1440px, look at them, and write down what is actually wrong** before changing anything. Use
> `tools/ui-verify/capture.mjs`. Do not delegate this step — look at the images yourself.
>
> **2. Make it survive 100k users.** This has never been audited. `docs/HANDOFF.md` §3 lists the
> specific bottlenecks already identified with evidence. Audit, then fix in priority order.
> Measure before and after — do not assert performance.
>
> Verify every change with `npm run typecheck && npm run lint && npm test` (expect 0 errors,
> 270 passing) and a production build against a **deliberately unreachable database** (the build
> must still generate all pages — that regression already shipped once). Look at screenshots
> after every batch. Do not commit without chaining `&&`, and do not push to `main` without
> saying so first.

---

## 1. Where the code is

**Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4 (**CSS-first — there is no
`tailwind.config.js`**), shadcn/ui new-york/zinc, Prisma 6 → PostgreSQL (Supabase), NextAuth 4
(JWT), Vercel Blob for images, Vitest, Playwright for verification only.

**State:** typecheck clean, lint 0 errors (3 pre-existing `<img>` warnings), 270 tests pass,
build generates 34/34 pages. Working tree clean.

**Live:** `campushelper.vercel.app` — real users, real data. Vercel's GitHub integration is
connected, so **pushing `main` deploys to production automatically.**

**Database:** 31 users, 19 items, 6 resolved — the data is the owner's own test content
(`batmobile`, `iqoo 1`, `ihone x`), except ~4 real accounts.

### Credentials and environment
- `/home/subhajit/project/.secrets/deploy.env` — `SUPABASE_ACCESS_TOKEN` (600, outside any git repo)
- `/home/subhajit/project/.secrets/.direct.env` — `DIRECT_URL` (IPv6 direct connection)
- `campushelper/.env.vercel` — pulled Vercel env (gitignored); copy to `.env.local` for local dev
- `vercel` CLI is installed globally and **logged in** as `subhajitlucky`
- Supabase project `vjdtfdbyleyxqxyogyfy` ("campus-helper", Mumbai, free plan). It was **paused**
  and was restored this session — its data survived.
- The DB is now **9 migrations** in, including a widened partial unique index on `Claim` and
  `Item_createdAt_idx`.

---

## 2. Job 1 — it does not look premium

### What has already been done (and why it wasn't enough)
| Metric | Before | Now |
|---|---|---|
| Hardcoded palette classes | 1,058 | ~0 |
| Bordered containers | 42 | 6 |
| `font-bold` | 35 | 0 |
| `text-base`+ | 5 | 142 |
| `text-sm`/`xs` share | 83% | 56% |
| Font loaded | generic system fallback | Geist + Geist Mono |

That is a **foundation**, and the owner's verdict on the result is that it still doesn't look
good. Reasonable hypotheses for why, which the new session should test rather than assume:
- It is still a form-and-card CRUD app. Consistent spacing and colour do not create a point of
  view. There is no art direction: no imagery, no scale contrast, no focal point, no personality.
- 6 bordered containers is better than 42, but the information architecture is unchanged — the
  same dense label/value dumps, just quieter.
- Premium products usually have: generous whitespace, one clear focal point per screen, real
  photography, restraint in chrome, and a distinctive typographic voice. None of that exists yet.

### The process failure to avoid repeating
Last session ran **seven design agents** and **never once put a screenshot in front of the
owner**. Every claim of improvement was a metric. The owner's actual experience was unchanged.
**Look at the rendered pages first, form a judgement, then fix.** If you cannot see it, you
cannot design it.

### Hard-won traps (each cost real time last session)
1. **Look at screenshots.** An automated WCAG contrast audit reported "18/18 pass" while a
   dark-mode card was near-invisible. The audit measures text legibility, **not whether a surface
   belongs in the theme**. Only the screenshot caught it.
2. **Verify your verifier.** A `\b` regex counted fixed classes as broken; a wrong CSS path
   (`.next/static/css/` vs `.next/static/chunks/`) reported every token `MISSING`; a
   `pkill -f "next dev"` killed its own shell; `git push <branch>` said "Everything up-to-date"
   while pushing a stale ref — use `git push origin HEAD:branch` and **verify with
   `git rev-parse`**, never the message.
3. **Tailwind purges unused utilities** — grepping the built CSS for a class proves nothing until
   something actually uses it.
4. **`sed` without a negative lookahead corrupted 22 classes** (`hover:bg-primary/90/90`), which
   Tailwind silently drops. Invalid utilities fail *silently*. Prefer Python with explicit
   patterns, and re-verify after a sweep.
5. **Chain commands with `&&`, not `;`**, or you will commit a failed build (that happened).
6. `networkidle` never settles (the notification bell polls every 30s) — use `load` + a delay.
7. **8 of 13 routes redirect to sign-in when anonymous.** A meaningful visual baseline needs a
   session. Create a temporary credentials account, and **delete it afterwards**.

---

## 3. Job 2 — 100k users. This has never been audited.

The previous session's audit covered correctness, security, and data integrity — **not scale.**
The following are known from the code and from measurements taken during other work. Treat as a
starting list to verify, not a complete audit.

### Measured, first-hand
1. **Saved-search fan-out is sequential on the item-create path.** Measured **1,043 ms for 200
   matching saved searches** (5.2 ms each) — a `findFirst` + `create` + `update` per search, in a
   loop, inside `POST /api/items`. Cost scales linearly with adoption. Fix: one `findMany` for
   dedupe, one `createMany`, one `updateMany`.
2. **Match computation is N+1.** `computeMatchesForItem` does `findUnique` then `create`/`update`
   per ranked pair (bounded at 200), plus two `notify()` calls per new pair (~2 queries each).
   Worst case ≈1,200 sequential awaits before the 201 response. Fix: `upsert` + batched
   `createMany`.
3. **The items list was doing a sequential scan** until `Item_createdAt_idx` was added this
   session (14.69 ms → 0.173 ms at 20k rows). Confirm it is actually used under the real
   multi-filter query, and check the other list routes.

### Structural, high confidence — verify each
4. **Search is `ILIKE '%term%'`** with no trigram or `tsvector` index. Sequential scan per
   keystroke-throttled query. At 100k items this is the first thing to fall over. Needs
   `pg_trgm` GIN or a `tsvector` column + GIN, plus a real search query.
5. **Offset pagination** (`skip`/`take`) everywhere. `skip: 50000` is O(offset) in Postgres.
   Needs keyset/cursor pagination for the deep pages.
6. **Rate limiting is in-memory per serverless instance** — `rate-limiter-flexible` with
   `RateLimiterMemory`. There is no shared store, so limits are per-instance and reset on cold
   start. At 100k users this is not a rate limiter. Needs Redis/Upstash or Vercel's WAF.
7. **Every side effect is synchronous in the request path** — matching, saved-search evaluation,
   notifications, reputation. There is no queue. Item creation does all of it before responding.
   Needs a job queue (QStash, Inngest, or a `pg-boss`-style table) with the write committed first.
8. **Notification dedupe is `findFirst` + `create` per notification**, and `notify()` is called
   in loops elsewhere. Batch it.
9. **Match `upsert` is a `findUnique`-then-`create`.** Concurrent item creation raises P2002,
   which the outer `catch` swallows — abandoning the rest of that item's matches *and* their
   notifications permanently. Needs a real `upsert`.
10. **Analytics loads up to 10,000 rows into memory** and mixes three different populations
    (the median cohort is the *oldest* 10k because an unordered `take` makes Prisma order by PK;
    the daily series takes the *newest* 10k; the totals count everything). Needs `date_trunc` +
    `percentile_cont` in SQL.
11. **Homepage runs 5 queries including a 2,000-row `findMany`** for the median return time, on
    ISR 300s. Fine at 100k *if* ISR holds; verify it is not silently dynamic.
12. **Unbounded growth tables:** `Notification`, `ReputationEvent`, `AuditLog`, `MatchSuggestion`,
    `Comment`. No archival, no partitioning, no retention policy.
13. **Connection pooling.** Supabase pooler + Prisma in serverless needs an explicit
    `connection_limit` (typically 1 with pgbouncer) or Prisma Accelerate. Verify the current
    config doesn't exhaust connections under concurrency. Check the free-plan connection cap.
14. **RLS is not enforced.** Policies exist, but the README states they only apply under a
    `campushelper_runtime` operator role that was never provisioned — the app connects as the
    table owner. So RLS is currently decorative, *and* nobody has measured whether enabling it
    would add per-row cost at scale. Decide: provision it properly, or drop it and rely on
    application-level authorization (which is currently what actually protects data).

### How to verify scale work
- Use `EXPLAIN (ANALYZE, BUFFERS)` against a **seeded** database. There is a throwaway Postgres
  pattern used last session: `docker run -d --name ch-verify-pg -e POSTGRES_PASSWORD=verify
  -e POSTGRES_USER=verify -e POSTGRES_DB=campushelper_verify -p 55432:5432 postgres:16-alpine`,
  then `prisma migrate deploy`. Seed 100k–1M rows with `generate_series` (one session seeded
  20k items this way).
- **Never** run load tests against production or against the real Supabase project.
- Report before/after numbers from real measurements. "Should be faster" is not a result.

---

## 4. Known open items (smaller, from the earlier audits)

- **Claim approve/reject on the admin console are disabled** — no admin claim-review endpoint
  exists (only GET at `/api/admin/claims`). Wiring point: `PUT /api/claims/[id]`.
- **`ui/badge.tsx` spreads `props` after `className`**, so any caller passing a `className`
  silently loses the variant's base classes. Affects `StatusBadge` (worked around).
- **`forms/ValidationInput.tsx`, `FieldError.tsx`, `FormError.tsx` are unused** — `ValidationInput`
  erased focus rings. Delete or repair.
- **Matching is inert for Odia filler words** (Devanagari is handled). Stopword coverage is
  English + Hindi only.
- **e2e flows have never been exercised against a preview deploy** — login, image upload, claim,
  approve, handover. The Blob upload path in particular has never been tested end-to-end.
- `docs/audit/2026-10-18-v2-adversarial-review.md` holds 33 minor findings, mostly unfixed.

---

## 5. Working rules the owner expects

- **Verify, don't assert.** Every claim needs a command, a measurement, or a screenshot.
- **Chain with `&&`.** Don't commit a failed build.
- **Don't push to `main` without asking** — it deploys to production.
- **Don't commit secrets.** The workspace root holds `.git-credentials`, `.github-token`,
  `.ssh/`, and `.secrets/`. Never print or commit them.
- **Say when something is unverified.** Two claims in the previous session were wrong because the
  *check* was wrong, not the code.
- Prefer formatting/lint to be automated and **judgement to be explicit**.
