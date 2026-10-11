\set ON_ERROR_STOP on
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'campushelper_runtime') THEN
    RAISE EXCEPTION 'Provision campushelper_runtime before applying the operator RLS policy migration';
  END IF;
END $$;
BEGIN;
\ir ../migrations/20260925000002_rls_runtime_policies/migration.sql
COMMIT;
