-- Two indexes for the two queries that were doing sequential scans, measured
-- against a 100k-user / 200k-item seed (see docs/ for the audit).
--
-- Both are additive and safe to re-run: `IF NOT EXISTS` throughout, and the
-- extension install degrades to a NOTICE rather than failing the migration when
-- the connecting role cannot create extensions. That mirrors the conditional
-- pattern already used by 20260925000002_rls_runtime_policies.

-- ---------------------------------------------------------------------------
-- 1. SavedSearch(createdAt)
-- ---------------------------------------------------------------------------
-- evaluateSavedSearchesForItem runs on every item creation and selects the
-- newest N saved searches that predate the new item:
--
--   SELECT ... FROM "SavedSearch" s JOIN "User" u ON s."userId" = u.id
--   WHERE s."createdAt" < $1 AND u."isActive" ORDER BY s."createdAt" DESC LIMIT 500
--
-- There is no userId predicate, so the existing (userId, createdAt) index
-- cannot serve it — the leading column is unconstrained. Measured plan at
-- 100k saved searches:
--
--   Limit (actual time=181.294..187.156 rows=500)
--     -> Gather Merge
--          -> Sort (Sort Key: s."createdAt" DESC, top-N heapsort)
--               -> Parallel Hash Join
--                    -> Parallel Seq Scan on "SavedSearch" (rows=50250 loops=2)
--                    -> Parallel Hash -> Parallel Seq Scan on "User"
--   Execution Time: 187.290 ms
--
-- With this index the same query is an Index Scan Backward:
--
--   -> Index Scan Backward using "SavedSearch_createdAt_idx" (actual time=0.091..0.218 rows=500)
--   Execution Time: 1.552 ms
--
-- 187.3 ms -> 1.43-1.55 ms (~20-57x) for 2,216 kB.

CREATE INDEX IF NOT EXISTS "SavedSearch_createdAt_idx" ON "SavedSearch"("createdAt");

-- ---------------------------------------------------------------------------
-- 2. Trigram indexes for report search
-- ---------------------------------------------------------------------------
-- GET /api/items?search=... is `ILIKE '%term%'` across title, description and
-- location. A leading wildcard cannot use a B-tree index, so every search was a
-- full scan of Item, and there were two of them per request (the page and its
-- COUNT). Measured at 200k items:
--
--   absent term      272.1 ms -> 0.237 ms   (1,148x)   Parallel Seq Scan -> BitmapOr
--   the same COUNT   143.5 ms -> 8.0   ms   (17.9x)
--   rare term        158.2 ms -> 0.079 ms   (2,003x)
--   search @OFFSET 100000  146.5 ms -> 10.2 ms (14.4x)
--
-- PostgreSQL will pick a GIN trigram index for `ILIKE '%x%'` automatically, so
-- no query change is needed. The cost is real: ~46 MB of index on a 79 MB heap,
-- plus write amplification on three columns.
--
-- The extension install is wrapped because it needs superuser (or an allowed
-- extension) and a plain failure here would block every subsequent deploy.
-- On Supabase `pg_trgm` is in the permitted set for the `postgres` role, so it
-- installs; anywhere it cannot, the indexes are skipped and search keeps
-- working exactly as it does today, only slower.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;

  CREATE INDEX IF NOT EXISTS "Item_title_trgm_idx"
    ON "Item" USING gin ("title" gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS "Item_description_trgm_idx"
    ON "Item" USING gin ("description" gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS "Item_location_trgm_idx"
    ON "Item" USING gin ("location" gin_trgm_ops);

  RAISE NOTICE 'pg_trgm installed; trigram indexes created for Item search';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_trgm could not be installed (insufficient privilege); search indexes skipped. Search still works, unindexed.';
  WHEN undefined_file THEN
    RAISE NOTICE 'pg_trgm is not available on this server; search indexes skipped.';
END
$$;
