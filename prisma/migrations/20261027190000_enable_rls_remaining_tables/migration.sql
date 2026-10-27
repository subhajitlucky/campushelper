-- Enable Row Level Security on the public tables still exposed through
-- Supabase's PostgREST API.
--
-- `20260106000000_enable_rls` covered User, Item, Comment, Claim and
-- _prisma_migrations. Supabase's security advisor still reported
-- `rls_disabled_in_public` for the tables below, whose `anon` and
-- `authenticated` grants allowed anyone with the project URL to read, insert,
-- update or delete rows.
--
-- Prisma bypasses RLS when connecting as the database owner (`postgres`), which
-- is how CampusHelper accesses the database, so runtime behaviour is unchanged.
-- No policies are added: the app does not use supabase-js or PostgREST for data
-- access, and RLS with zero policies is fail-closed for the API roles.

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CampusZone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MatchSuggestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReputationEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedSearch" ENABLE ROW LEVEL SECURITY;
