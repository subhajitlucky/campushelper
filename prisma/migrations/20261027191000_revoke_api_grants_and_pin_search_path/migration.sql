-- Remove Supabase API-role access from the public schema.
--
-- RLS already blocks row access, but the `anon` and `authenticated` roles still
-- hold table grants. Those grants make every table discoverable through
-- pg_graphql (advisor: pg_graphql_anon_table_exposed /
-- pg_graphql_authenticated_table_exposed), and they are not needed: CampusHelper
-- reaches Postgres through Prisma as the owner (`postgres`), never through
-- supabase-js, PostgREST or GraphQL.
--
-- This mirrors the grant state of User, Item, Comment and Claim, whose public
-- API grants were already removed. The owner and service_role are untouched.
--
-- The trigger function only reads NEW/OLD, so pinning its search_path is safe
-- and clears the function_search_path_mutable advisor warning.

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Stop tables created by future migrations (which run as the `postgres` owner)
-- from re-acquiring the API grants Supabase installs by default.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

ALTER FUNCTION public.campushelper_claim_immutable_fields()
  SET search_path = pg_catalog, public;
