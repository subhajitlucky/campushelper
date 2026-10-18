-- Fix: the default items list had no usable index.
--
-- GET /api/items filters `status <> 'DELETED'` and orders by `createdAt desc`
-- with skip/take. None of the twelve existing Item indexes leads with
-- `createdAt`, and none is partial on the status predicate, so nothing could
-- supply the ORDER BY: every page view was a sequential scan of Item plus a
-- top-N heapsort, measured at 37 ms for a 20-row page over 20,000 rows.
--
-- A plain index on (createdAt) lets the planner walk backwards and apply the
-- status filter as it goes. A partial index on `status <> 'DELETED'` would be
-- marginally tighter, but Prisma cannot model partial indexes and would report
-- schema drift, so the portable form is used here deliberately.

CREATE INDEX "Item_createdAt_idx" ON "Item"("createdAt");
