DO $$
DECLARE
  duplicate_count bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE "email" IS NULL) THEN
    RAISE EXCEPTION 'User.email contains NULL values; resolve them before creating case-insensitive email uniqueness';
  END IF;
  SELECT count(*)
  INTO duplicate_count
  FROM (
    SELECT LOWER("email")
    FROM "User"
    GROUP BY LOWER("email")
    HAVING count(*) > 1
  ) AS duplicate_emails;
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Case-insensitive User.email uniqueness cannot be created: % duplicate email group(s) require operator resolution', duplicate_count;
  END IF;
  SELECT count(*)
  INTO duplicate_count
  FROM (
    SELECT "itemId", "userId"
    FROM "Claim"
    WHERE "status" = 'PENDING'
    GROUP BY "itemId", "userId"
    HAVING count(*) > 1
  ) AS duplicate_pending_claims;
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Pending claim uniqueness cannot be created: % duplicate item/user group(s) require operator resolution', duplicate_count;
  END IF;
  SELECT count(*)
  INTO duplicate_count
  FROM (
    SELECT "itemId"
    FROM "Claim"
    WHERE "status" = 'APPROVED'
    GROUP BY "itemId"
    HAVING count(*) > 1
  ) AS duplicate_approved_claims;
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Approved claim uniqueness cannot be created: % duplicate item group(s) require operator resolution', duplicate_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_lower_key" ON "User" (LOWER("email"));

CREATE UNIQUE INDEX IF NOT EXISTS "Claim_pending_item_user_key"
  ON "Claim" ("itemId", "userId")
  WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX IF NOT EXISTS "Claim_approved_item_key"
  ON "Claim" ("itemId")
  WHERE "status" = 'APPROVED';

CREATE INDEX IF NOT EXISTS "User_isActive_createdAt_idx" ON "User" ("isActive", "createdAt");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User" ("role");
CREATE INDEX IF NOT EXISTS "User_lockedUntil_idx" ON "User" ("lockedUntil");
CREATE INDEX IF NOT EXISTS "Item_postedById_createdAt_idx" ON "Item" ("postedById", "createdAt");
CREATE INDEX IF NOT EXISTS "Item_claimedById_idx" ON "Item" ("claimedById");
CREATE INDEX IF NOT EXISTS "Item_status_createdAt_idx" ON "Item" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Item_itemType_status_createdAt_idx" ON "Item" ("itemType", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Item_location_createdAt_idx" ON "Item" ("location", "createdAt");
CREATE INDEX IF NOT EXISTS "Item_moderationStatus_createdAt_idx" ON "Item" ("moderationStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "Item_moderatedById_idx" ON "Item" ("moderatedById");
CREATE INDEX IF NOT EXISTS "Item_deletedById_idx" ON "Item" ("deletedById");
CREATE INDEX IF NOT EXISTS "Item_deletedAt_idx" ON "Item" ("deletedAt");
CREATE INDEX IF NOT EXISTS "Comment_itemId_createdAt_idx" ON "Comment" ("itemId", "createdAt");
CREATE INDEX IF NOT EXISTS "Comment_userId_createdAt_idx" ON "Comment" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Claim_itemId_status_createdAt_idx" ON "Claim" ("itemId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Claim_userId_status_createdAt_idx" ON "Claim" ("userId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Claim_status_createdAt_idx" ON "Claim" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Claim_resolvedAt_idx" ON "Claim" ("resolvedAt");

DO $$
DECLARE
  index_definition text;
BEGIN
  SELECT indexdef
  INTO index_definition
  FROM pg_indexes
  WHERE schemaname = current_schema()
    AND indexname = 'User_email_lower_key';
  IF index_definition IS NULL
     OR lower(index_definition) NOT LIKE '%lower%'
     OR lower(index_definition) NOT LIKE '%email%'
     OR lower(index_definition) NOT LIKE '%unique%' THEN
    RAISE EXCEPTION 'User_email_lower_key exists with a conflicting definition';
  END IF;

  SELECT indexdef
  INTO index_definition
  FROM pg_indexes
  WHERE schemaname = current_schema()
    AND indexname = 'Claim_pending_item_user_key';
  IF index_definition IS NULL
     OR lower(index_definition) NOT LIKE '%unique%'
     OR lower(index_definition) NOT LIKE '%itemid%'
     OR lower(index_definition) NOT LIKE '%userid%'
     OR lower(index_definition) NOT LIKE '%pending%' THEN
    RAISE EXCEPTION 'Claim_pending_item_user_key exists with a conflicting definition';
  END IF;

  SELECT indexdef
  INTO index_definition
  FROM pg_indexes
  WHERE schemaname = current_schema()
    AND indexname = 'Claim_approved_item_key';
  IF index_definition IS NULL
     OR lower(index_definition) NOT LIKE '%unique%'
     OR lower(index_definition) NOT LIKE '%itemid%'
     OR lower(index_definition) NOT LIKE '%approved%' THEN
    RAISE EXCEPTION 'Claim_approved_item_key exists with a conflicting definition';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class index_class ON index_class.oid = i.indexrelid
    JOIN pg_class table_class ON table_class.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = table_class.relnamespace
    WHERE n.nspname = current_schema()
      AND index_class.relname = 'User_email_lower_key'
      AND i.indisunique
      AND i.indisvalid
      AND i.indpred IS NULL
      AND i.indexprs IS NOT NULL
      AND lower(pg_get_indexdef(i.indexrelid)) LIKE '%lower%'
      AND lower(pg_get_indexdef(i.indexrelid)) LIKE '%email%'
  ) THEN
    RAISE EXCEPTION 'User_email_lower_key is not a valid unique lower(email) expression index';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class index_class ON index_class.oid = i.indexrelid
    JOIN pg_class table_class ON table_class.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = table_class.relnamespace
    WHERE n.nspname = current_schema()
      AND index_class.relname = 'Claim_pending_item_user_key'
      AND i.indisunique
      AND i.indisvalid
      AND i.indpred IS NOT NULL
      AND lower(pg_get_expr(i.indpred, i.indrelid)) LIKE '%status%'
      AND lower(pg_get_expr(i.indpred, i.indrelid)) LIKE '%pending%'
  ) THEN
    RAISE EXCEPTION 'Claim_pending_item_user_key is not a valid unique pending partial index';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class index_class ON index_class.oid = i.indexrelid
    JOIN pg_class table_class ON table_class.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = table_class.relnamespace
    WHERE n.nspname = current_schema()
      AND index_class.relname = 'Claim_approved_item_key'
      AND i.indisunique
      AND i.indisvalid
      AND i.indpred IS NOT NULL
      AND lower(pg_get_expr(i.indpred, i.indrelid)) LIKE '%status%'
      AND lower(pg_get_expr(i.indpred, i.indrelid)) LIKE '%approved%'
  ) THEN
    RAISE EXCEPTION 'Claim_approved_item_key is not a valid unique approved partial index';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public."campushelper_claim_immutable_fields"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."itemId" IS DISTINCT FROM OLD."itemId"
     OR NEW."userId" IS DISTINCT FROM OLD."userId"
     OR NEW."claimType" IS DISTINCT FROM OLD."claimType" THEN
    RAISE EXCEPTION 'Claim item, user, and type fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Claim_immutable_fields_trigger" ON "Claim";
CREATE TRIGGER "Claim_immutable_fields_trigger"
BEFORE UPDATE ON "Claim"
FOR EACH ROW
EXECUTE FUNCTION public."campushelper_claim_immutable_fields"();
