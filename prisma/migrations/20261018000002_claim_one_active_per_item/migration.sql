-- Fix: an item could be "returned" twice.
--
-- The pre-existing constraint that enforces one active claim per item is a
-- PARTIAL unique index keyed on status = 'APPROVED'. v2 added
-- ClaimStatus.COMPLETED, and the handover flow moves a claim APPROVED ->
-- COMPLETED -- which takes it OUT of the indexed set, so a second claim could
-- be filed and approved on an item that had already been returned. Approval
-- then re-issued a handover code, overwrote Item.claimedById with the second
-- claimant, and re-awarded RETURN_COMPLETED (the ledger key includes userId, so
-- a different claimant is credited again). One physical return, credited twice.
--
-- Widen the predicate to cover both active-return states.

-- Step 1: repair any state the old index permitted, so the new index can be
-- created. A claim is only "active" if it is the single accepted claim for its
-- item; everything else is rejected. This is the corrupt state being fixed, not
-- legitimate data: it can only exist because the constraint did not cover
-- COMPLETED.
--
-- Keep exactly one claim per item, preferring COMPLETED (the one that actually
-- went through a verified handover), then the earliest.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "itemId"
      ORDER BY
        CASE WHEN "status" = 'COMPLETED' THEN 0 ELSE 1 END,
        COALESCE("completedAt", "resolvedAt", "createdAt"),
        "id"
    ) AS rn
  FROM "Claim"
  WHERE "status" IN ('APPROVED', 'COMPLETED')
)
UPDATE "Claim"
SET
  "status" = 'REJECTED',
  "resolvedAt" = COALESCE("resolvedAt", NOW()),
  "updatedAt" = NOW()
WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);

-- Step 2: replace the partial index with one covering both states.
DROP INDEX IF EXISTS "Claim_approved_item_key";

CREATE UNIQUE INDEX "Claim_approved_item_key"
  ON "Claim" ("itemId")
  WHERE "status" IN ('APPROVED', 'COMPLETED');
