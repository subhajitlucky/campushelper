ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Claim" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."User" FROM PUBLIC;
REVOKE ALL ON TABLE public."Item" FROM PUBLIC;
REVOKE ALL ON TABLE public."Comment" FROM PUBLIC;
REVOKE ALL ON TABLE public."Claim" FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public."User" FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public."Item" FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public."Comment" FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public."Claim" FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public."User" FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE public."Item" FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE public."Comment" FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE public."Claim" FROM authenticated';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('User', 'Item', 'Comment', 'Claim')
      AND policyname NOT LIKE 'campushelper_%'
  ) THEN
    RAISE EXCEPTION 'Existing non-CampusHelper RLS policies require operator review before the runtime policy migration can proceed';
  END IF;
END $$;

DO $$
DECLARE
  runtime_role_exists boolean;
  runtime_role_bypasses_rls boolean;
  runtime_role_owns_tables boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'campushelper_runtime') INTO runtime_role_exists;
  IF NOT runtime_role_exists THEN
    RAISE NOTICE 'RLS runtime role campushelper_runtime is not provisioned; no runtime policies or FORCE RLS were installed. Provision the role and apply prisma/operator/20260925000002_rls_runtime_policies.sql before using a non-owner runtime connection.';
    RETURN;
  END IF;

  SELECT rolsuper OR rolbypassrls
  INTO runtime_role_bypasses_rls
  FROM pg_roles
  WHERE rolname = 'campushelper_runtime';
  IF runtime_role_bypasses_rls THEN
    RAISE EXCEPTION 'RLS runtime role campushelper_runtime must not have SUPERUSER or BYPASSRLS';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_roles r ON r.oid = c.relowner
    WHERE r.rolname = 'campushelper_runtime'
      AND c.relname IN ('User', 'Item', 'Comment', 'Claim')
      AND c.relnamespace = 'public'::regnamespace
  ) INTO runtime_role_owns_tables;
  IF runtime_role_owns_tables THEN
    RAISE EXCEPTION 'RLS runtime role campushelper_runtime must not own protected tables';
  END IF;

  EXECUTE 'GRANT USAGE ON SCHEMA public TO campushelper_runtime';
  EXECUTE 'REVOKE ALL ON TABLE public."User" FROM campushelper_runtime';
  EXECUTE 'REVOKE ALL ON TABLE public."Item" FROM campushelper_runtime';
  EXECUTE 'REVOKE ALL ON TABLE public."Comment" FROM campushelper_runtime';
  EXECUTE 'REVOKE ALL ON TABLE public."Claim" FROM campushelper_runtime';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE public."User" TO campushelper_runtime';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE public."Item" TO campushelper_runtime';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Comment" TO campushelper_runtime';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE public."Claim" TO campushelper_runtime';

  EXECUTE 'ALTER TABLE public."User" FORCE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public."Item" FORCE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public."Comment" FORCE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public."Claim" FORCE ROW LEVEL SECURITY';
  RAISE NOTICE 'CampusHelper runtime policies use app.user_id, app.session_version, app.user_role, app.lookup_email, and app.allow_registration request settings.';

  EXECUTE 'DROP POLICY IF EXISTS campushelper_user_select ON public."User"';
  EXECUTE 'DROP POLICY IF EXISTS campushelper_user_insert ON public."User"';
  EXECUTE 'DROP POLICY IF EXISTS campushelper_user_update ON public."User"';
  EXECUTE 'DROP POLICY IF EXISTS campushelper_user_delete ON public."User"';
  EXECUTE 'DROP POLICY IF EXISTS campushelper_item_select ON public."Item"';
  EXECUTE 'DROP POLICY IF EXISTS campushelper_item_insert ON public."Item"';
  EXECUTE 'DROP POLICY IF EXISTS campushelper_item_update ON public."Item"';
  EXECUTE 'DROP POLICY IF EXISTS campushelper_item_delete ON public."Item"';
  EXECUTE 'DROP POLICY IF EXISTS campushelper_comment_select ON public."Comment"';
  EXECUTE 'DROP POLICY IF EXISTS campushelper_comment_insert ON public."Comment"';
  EXECUTE 'DROP POLICY IF EXISTS campushelper_comment_update ON public."Comment"';
  EXECUTE 'DROP POLICY IF EXISTS campushelper_comment_delete ON public."Comment"';
  EXECUTE 'DROP POLICY IF EXISTS campushelper_claim_select ON public."Claim"';
  EXECUTE 'DROP POLICY IF EXISTS campushelper_claim_insert ON public."Claim"';
  EXECUTE 'DROP POLICY IF EXISTS campushelper_claim_update ON public."Claim"';
  EXECUTE 'DROP POLICY IF EXISTS campushelper_claim_delete ON public."Claim"';

  EXECUTE $policy$
    CREATE POLICY campushelper_user_select
    ON public."User"
    FOR SELECT
    TO campushelper_runtime
    USING (
      (
        "id" = NULLIF(current_setting('app.user_id', true), '')
        AND "sessionVersion" = NULLIF(current_setting('app.session_version', true), '')::integer
      )
      OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
      OR LOWER("email") = LOWER(NULLIF(current_setting('app.lookup_email', true), ''))
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY campushelper_user_insert
    ON public."User"
    FOR INSERT
    TO campushelper_runtime
    WITH CHECK (
      (
        "id" = NULLIF(current_setting('app.user_id', true), '')
        AND "sessionVersion" = NULLIF(current_setting('app.session_version', true), '')::integer
        AND "role" = 'USER'
        AND "isActive" = true
      )
      OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
      OR (
        NULLIF(current_setting('app.allow_registration', true), '') = 'true'
        AND "role" = 'USER'
        AND "isActive" = true
      )
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY campushelper_user_update
    ON public."User"
    FOR UPDATE
    TO campushelper_runtime
    USING (
      (
        "id" = NULLIF(current_setting('app.user_id', true), '')
        AND "sessionVersion" = NULLIF(current_setting('app.session_version', true), '')::integer
      )
      OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
    )
    WITH CHECK (
      (
        "id" = NULLIF(current_setting('app.user_id', true), '')
        AND "sessionVersion" = NULLIF(current_setting('app.session_version', true), '')::integer
        AND "role" = 'USER'
        AND "isActive" = true
      )
      OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY campushelper_user_delete
    ON public."User"
    FOR DELETE
    TO campushelper_runtime
    USING (NULLIF(current_setting('app.user_role', true), '') = 'ADMIN')
  $policy$;

  EXECUTE $policy$
    CREATE POLICY campushelper_item_select
    ON public."Item"
    FOR SELECT
    TO campushelper_runtime
    USING (
      ("status" <> 'DELETED' AND "deletedAt" IS NULL AND "moderationStatus" <> 'REMOVED')
      OR "postedById" = NULLIF(current_setting('app.user_id', true), '')
      OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY campushelper_item_insert
    ON public."Item"
    FOR INSERT
    TO campushelper_runtime
    WITH CHECK (
      "postedById" = NULLIF(current_setting('app.user_id', true), '')
      OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY campushelper_item_update
    ON public."Item"
    FOR UPDATE
    TO campushelper_runtime
    USING (
      "postedById" = NULLIF(current_setting('app.user_id', true), '')
      OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
    )
    WITH CHECK (
      "postedById" = NULLIF(current_setting('app.user_id', true), '')
      OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY campushelper_item_delete
    ON public."Item"
    FOR DELETE
    TO campushelper_runtime
    USING (
      "postedById" = NULLIF(current_setting('app.user_id', true), '')
      OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY campushelper_comment_select
    ON public."Comment"
    FOR SELECT
    TO campushelper_runtime
    USING (
      EXISTS (
        SELECT 1
        FROM public."Item" AS item
        WHERE item."id" = "Comment"."itemId"
          AND (
            (item."status" <> 'DELETED' AND item."deletedAt" IS NULL AND item."moderationStatus" <> 'REMOVED')
            OR item."postedById" = NULLIF(current_setting('app.user_id', true), '')
            OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
          )
      )
      OR "userId" = NULLIF(current_setting('app.user_id', true), '')
      OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY campushelper_comment_insert
    ON public."Comment"
    FOR INSERT
    TO campushelper_runtime
    WITH CHECK (
      (
        "userId" = NULLIF(current_setting('app.user_id', true), '')
        OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
      )
      AND EXISTS (
        SELECT 1
        FROM public."Item" AS item
        WHERE item."id" = "Comment"."itemId"
          AND item."status" <> 'DELETED'
          AND item."deletedAt" IS NULL
          AND item."moderationStatus" <> 'REMOVED'
      )
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY campushelper_comment_update
    ON public."Comment"
    FOR UPDATE
    TO campushelper_runtime
    USING (
      "userId" = NULLIF(current_setting('app.user_id', true), '')
      OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
    )
    WITH CHECK (
      (
        "userId" = NULLIF(current_setting('app.user_id', true), '')
        OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
      )
      AND EXISTS (
        SELECT 1
        FROM public."Item" AS item
        WHERE item."id" = "Comment"."itemId"
          AND item."status" <> 'DELETED'
          AND item."deletedAt" IS NULL
          AND item."moderationStatus" <> 'REMOVED'
      )
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY campushelper_comment_delete
    ON public."Comment"
    FOR DELETE
    TO campushelper_runtime
    USING (
      "userId" = NULLIF(current_setting('app.user_id', true), '')
      OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY campushelper_claim_select
    ON public."Claim"
    FOR SELECT
    TO campushelper_runtime
    USING (
      "userId" = NULLIF(current_setting('app.user_id', true), '')
      OR EXISTS (
        SELECT 1
        FROM public."Item" AS item
        WHERE item."id" = "Claim"."itemId"
          AND item."postedById" = NULLIF(current_setting('app.user_id', true), '')
      )
      OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY campushelper_claim_insert
    ON public."Claim"
    FOR INSERT
    TO campushelper_runtime
    WITH CHECK (
      "userId" = NULLIF(current_setting('app.user_id', true), '')
      AND "status" = 'PENDING'
      AND EXISTS (
        SELECT 1
        FROM public."Item" AS item
        WHERE item."id" = "Claim"."itemId"
          AND item."status" IN ('LOST', 'FOUND')
          AND item."deletedAt" IS NULL
          AND item."moderationStatus" <> 'REMOVED'
      )
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY campushelper_claim_update
    ON public."Claim"
    FOR UPDATE
    TO campushelper_runtime
    USING (
      (
        "userId" = NULLIF(current_setting('app.user_id', true), '')
        AND "status" = 'PENDING'
      )
      OR EXISTS (
        SELECT 1
        FROM public."Item" AS item
        WHERE item."id" = "Claim"."itemId"
          AND item."postedById" = NULLIF(current_setting('app.user_id', true), '')
      )
      OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
    )
    WITH CHECK (
      (
        "userId" = NULLIF(current_setting('app.user_id', true), '')
        AND "status" IN ('PENDING', 'REJECTED')
      )
      OR EXISTS (
        SELECT 1
        FROM public."Item" AS item
        WHERE item."id" = "Claim"."itemId"
          AND item."postedById" = NULLIF(current_setting('app.user_id', true), '')
      )
      OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY campushelper_claim_delete
    ON public."Claim"
    FOR DELETE
    TO campushelper_runtime
    USING (
      (
        "userId" = NULLIF(current_setting('app.user_id', true), '')
        AND "status" = 'PENDING'
      )
      OR EXISTS (
        SELECT 1
        FROM public."Item" AS item
        WHERE item."id" = "Claim"."itemId"
          AND item."postedById" = NULLIF(current_setting('app.user_id', true), '')
      )
      OR NULLIF(current_setting('app.user_role', true), '') IN ('ADMIN', 'MODERATOR')
    )
  $policy$;
END $$;
