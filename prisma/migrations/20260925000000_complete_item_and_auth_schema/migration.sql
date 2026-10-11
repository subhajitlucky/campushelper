DO $$
BEGIN
  IF to_regclass('"User"') IS NULL OR to_regclass('"Item"') IS NULL OR to_regclass('"Comment"') IS NULL OR to_regclass('"Claim"') IS NULL THEN
    RAISE EXCEPTION 'CampusHelper schema remediation requires User, Item, Comment, and Claim tables';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ItemStatus'
      AND n.nspname = current_schema()
  ) THEN
    RAISE EXCEPTION 'CampusHelper schema remediation requires the ItemStatus enum';
  END IF;
END $$;

ALTER TYPE "ItemStatus" ADD VALUE IF NOT EXISTS 'DELETED';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ItemModerationStatus'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "ItemModerationStatus" AS ENUM ('NONE', 'FLAGGED', 'REMOVED');
  END IF;
END $$;

ALTER TYPE "ItemModerationStatus" ADD VALUE IF NOT EXISTS 'NONE';
ALTER TYPE "ItemModerationStatus" ADD VALUE IF NOT EXISTS 'FLAGGED';
ALTER TYPE "ItemModerationStatus" ADD VALUE IF NOT EXISTS 'REMOVED';

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER,
  ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER;

ALTER TABLE "Item"
  ADD COLUMN IF NOT EXISTS "moderationStatus" "ItemModerationStatus" DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "moderatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "moderatedById" TEXT,
  ADD COLUMN IF NOT EXISTS "moderationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedById" TEXT,
  ADD COLUMN IF NOT EXISTS "deletionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Comment"
  ADD COLUMN IF NOT EXISTS "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'User'
      AND column_name IN ('failedLoginAttempts', 'sessionVersion')
      AND udt_name <> 'int4'
  ) THEN
    RAISE EXCEPTION 'User lockout and session version columns must be integer columns';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'User'
      AND column_name = 'lockedUntil'
      AND udt_name <> 'timestamp'
  ) THEN
    RAISE EXCEPTION 'User.lockedUntil must be a timestamp column';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Item'
      AND column_name = 'moderationStatus'
      AND udt_name <> 'ItemModerationStatus'
  ) THEN
    RAISE EXCEPTION 'Item.moderationStatus must use ItemModerationStatus';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Item'
      AND column_name IN ('moderatedAt', 'deletedAt')
      AND udt_name <> 'timestamp'
  ) THEN
    RAISE EXCEPTION 'Item moderation and deletion timestamps must be timestamp columns';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Item'
      AND column_name IN ('moderatedById', 'moderationReason', 'deletedById', 'deletionReason')
      AND udt_name <> 'text'
  ) THEN
    RAISE EXCEPTION 'Item moderation and deletion metadata columns must be text columns';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name IN ('Item', 'Comment')
      AND column_name = 'images'
      AND udt_name <> '_text'
  ) THEN
    RAISE EXCEPTION 'Item.images and Comment.images must be text arrays';
  END IF;
END $$;

UPDATE "User"
SET "failedLoginAttempts" = 0
WHERE "failedLoginAttempts" IS NULL;

UPDATE "User"
SET "sessionVersion" = 0
WHERE "sessionVersion" IS NULL;

UPDATE "Item"
SET "moderationStatus" = 'NONE'
WHERE "moderationStatus" IS NULL;

UPDATE "Item"
SET "images" = ARRAY[]::TEXT[]
WHERE "images" IS NULL;

UPDATE "Comment"
SET "images" = ARRAY[]::TEXT[]
WHERE "images" IS NULL;

ALTER TABLE "User"
  ALTER COLUMN "failedLoginAttempts" SET DEFAULT 0,
  ALTER COLUMN "failedLoginAttempts" SET NOT NULL,
  ALTER COLUMN "sessionVersion" SET DEFAULT 0,
  ALTER COLUMN "sessionVersion" SET NOT NULL;

ALTER TABLE "Item"
  ALTER COLUMN "moderationStatus" SET DEFAULT 'NONE'::"ItemModerationStatus",
  ALTER COLUMN "moderationStatus" SET NOT NULL,
  ALTER COLUMN "images" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "images" SET NOT NULL;

ALTER TABLE "Comment"
  ALTER COLUMN "images" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "images" SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Item" WHERE array_position("images", NULL) IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Item.images contains null elements; resolve them before applying the schema migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Comment" WHERE array_position("images", NULL) IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Comment.images contains null elements; resolve them before applying the schema migration';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'User'
      AND column_name IN ('failedLoginAttempts', 'sessionVersion')
      AND is_nullable <> 'NO'
  ) THEN
    RAISE EXCEPTION 'User lockout and session version columns must be NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'User'
      AND column_name = 'lockedUntil'
      AND is_nullable <> 'YES'
  ) THEN
    RAISE EXCEPTION 'User.lockedUntil must be nullable';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Item'
      AND column_name IN ('moderatedAt', 'moderatedById', 'moderationReason', 'deletedAt', 'deletedById', 'deletionReason')
      AND is_nullable <> 'YES'
  ) THEN
    RAISE EXCEPTION 'Item moderation and deletion metadata columns must be nullable';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Item'
      AND column_name IN ('moderationStatus', 'images')
      AND is_nullable <> 'NO'
  ) OR EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Comment'
      AND column_name = 'images'
      AND is_nullable <> 'NO'
  ) THEN
    RAISE EXCEPTION 'Item and Comment image arrays and Item.moderationStatus must be NOT NULL';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Item" AS item
    LEFT JOIN "User" AS moderator ON moderator."id" = item."moderatedById"
    LEFT JOIN "User" AS deleter ON deleter."id" = item."deletedById"
    WHERE (item."moderatedById" IS NOT NULL AND moderator."id" IS NULL)
       OR (item."deletedById" IS NOT NULL AND deleter."id" IS NULL)
  ) THEN
    RAISE EXCEPTION 'Item moderation or deletion metadata references a missing User; resolve orphaned actor IDs before applying foreign keys';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = to_regclass('"Item"')
      AND conname IN ('Item_moderatedById_fkey', 'Item_deletedById_fkey')
      AND NOT (
        contype = 'f'
        AND confrelid = to_regclass('"User"')
        AND confdeltype = 'n'
        AND confupdtype = 'c'
      )
  ) THEN
    RAISE EXCEPTION 'Item moderation or deletion foreign key has a conflicting definition';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = to_regclass('"Item"')
      AND c.contype = 'f'
      AND a.attname IN ('moderatedById', 'deletedById')
      AND NOT (
        c.confrelid = to_regclass('"User"')
        AND c.confdeltype = 'n'
        AND c.confupdtype = 'c'
      )
  ) THEN
    RAISE EXCEPTION 'Item moderation or deletion foreign key references an unexpected relation or action';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Item_moderatedById_fkey'
      AND conrelid = to_regclass('"Item"')
      AND contype = 'f'
      AND confrelid = to_regclass('"User"')
      AND confdeltype = 'n'
      AND confupdtype = 'c'
  ) THEN
    ALTER TABLE "Item" ADD CONSTRAINT "Item_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Item_deletedById_fkey'
      AND conrelid = to_regclass('"Item"')
      AND contype = 'f'
      AND confrelid = to_regclass('"User"')
      AND confdeltype = 'n'
      AND confupdtype = 'c'
  ) THEN
    ALTER TABLE "Item" ADD CONSTRAINT "Item_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
