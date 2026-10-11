# CampusHelper Comprehensive Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remediate the audited CampusHelper security, data-integrity, workflow, storage, API-contract, UI, tooling, testing, and documentation issues without overwriting existing uncommitted upload work.

**Architecture:** Preserve Next.js App Router, NextAuth, Prisma/PostgreSQL, Tailwind, and Vercel Blob. Add shared server-side authorization, validation, lifecycle, error, and upload services; use forward-only migrations and configurable production adapters with safe local fallbacks.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 6, PostgreSQL, NextAuth 4, Zod, Tailwind CSS 4, Vercel Blob, Vitest, ESLint flat config, Playwright where browser coverage is available.

---

### Task 1: Establish a reproducible baseline and test harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `eslint.config.mjs`
- Modify: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/smoke/project-config.test.ts`

**Steps:**
1. Record the current `git status --short` and preserve the existing upload-related modifications.
2. Add explicit `type-check`, `test`, `test:watch`, `db:validate`, `db:generate`, and `verify` scripts without removing existing scripts.
3. Add Node/package-manager metadata matching the locked Next and Blob requirements.
4. Configure Vitest with TypeScript path aliases, a server-safe test environment, and deterministic setup.
5. Configure real Next.js and TypeScript ESLint rules; retain generated and build-directory ignores.
6. Add a smoke test proving the test runner and path aliases resolve.
7. Run `npm run db:validate`, `npm run type-check`, `npm run lint`, and `npm test`; record any pre-existing failures before changing application code.

### Task 2: Reconcile the database schema and migration history

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_complete_item_and_auth_schema/migration.sql`
- Create: `prisma/migrations/<timestamp>_claim_integrity_and_indexes/migration.sql`
- Create: `scripts/verify-migrations.ts`
- Modify: `package.json`

**Steps:**
1. Add the missing `DELETED` enum value and authentication lockout columns in a forward migration.
2. Add moderation and deletion metadata fields needed to separate lifecycle, spam, and deletion state.
3. Backfill required image arrays and add safe defaults/constraints after checking existing rows.
4. Add relationship/status/date indexes and conditional uniqueness for pending and approved claims.
5. Add a `DIRECT_URL` datasource configuration and document separate runtime/migration credentials.
6. Define a safe migration verification script that replays migrations against a disposable PostgreSQL database and compares the resulting schema.
7. Run `npx prisma validate`, `npx prisma generate`, and the migration verification script when a test database is available.
8. Do not alter the already-applied initial migration; reconcile manually if a live catalog already contains equivalent changes.

### Task 3: Establish trusted request, session, and CSRF primitives

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/csrf.ts`
- Modify: `src/lib/csrf-middleware.ts`
- Modify: `src/lib/auth-fetch.ts`
- Create: `src/lib/authorization.ts`
- Create: `src/lib/request-security.ts`
- Modify: `src/app/api/auth/[...nextauth]/route.ts`
- Modify: `src/app/api/auth/signup/route.ts`
- Create: `src/lib/schemas/auth.ts`
- Add tests under `tests/security/`

**Steps:**
1. Normalize emails and enforce one server-side password policy.
2. Reject unverified or inactive OAuth identities and stop client session updates from changing trusted identity fields.
3. Add database-backed active-user and current-role resolution for protected requests.
4. Add session-version invalidation for suspension, activation, and role changes.
5. Validate the configured canonical origin and remove header-derived trusted origins.
6. Bind/rotate CSRF tokens, use secure cookie flags outside local development, and return 403 on failure.
7. Apply CSRF/Origin checks to signup and every custom mutation route.
8. Add tests for privilege escalation, stale role/session state, inactive OAuth login, origin mismatch, and missing/mismatched CSRF.

### Task 4: Replace weak validation and error handling with shared contracts

**Files:**
- Modify: `src/lib/schemas/item.ts`
- Modify: `src/lib/schemas/comment.ts`
- Modify: `src/lib/schemas/claim.ts`
- Modify: `src/lib/schemas/claim-update.ts`
- Modify: `src/lib/schemas/user.ts`
- Modify: `src/lib/security.ts`
- Modify: `src/lib/errors.ts`
- Modify: `src/lib/errorHandler.ts`
- Create: `src/lib/validation.ts`
- Create: `src/lib/response.ts`
- Add tests under `tests/validation/` and `tests/security/`

**Steps:**
1. Add strict schemas for top-level JSON, bounded strings, arrays, pagination, dates, and enums.
2. Make image references application-owned or explicitly allowlisted legacy URLs.
3. Normalize date ranges and reject invalid combinations with 400 responses.
4. Centralize sanitized error responses with request IDs and typed status codes.
5. Remove route-local duplicate schemas and ensure malformed primitives never reach Prisma.
6. Add tests for null/array bodies, unknown fields, oversized values, unsafe schemes, private hosts, and text payloads.

### Task 5: Centralize item lifecycle and visibility rules

**Files:**
- Create: `src/lib/services/items.ts`
- Create: `src/lib/services/item-visibility.ts`
- Modify: `src/app/api/items/route.ts`
- Modify: `src/app/api/items/[id]/route.ts`
- Modify: `src/app/api/comments/route.ts`
- Modify: `src/app/api/comments/[id]/route.ts`
- Modify: `src/lib/schemas/item.ts`
- Add tests under `tests/api/items/` and `tests/services/items/`

**Steps:**
1. Define owner, moderator, admin, and anonymous visibility rules for every item status.
2. Exclude deleted items from public lists and return 404 for unauthorized detail reads.
3. Restrict arbitrary poster filters to authorized roles and cap all pagination.
4. Remove status, claimant, and lifecycle timestamps from generic content edits.
5. Implement atomic soft deletion, comment redaction/tombstoning, and pending-claim invalidation.
6. Enforce identical active/resolved/deleted rules for comment create, update, and delete.
7. Apply the same created date bounds to list data and counts.
8. Add tests for public deleted visibility, invalid direct updates, deletion rollback, and state-locked comments.

### Task 6: Make claims atomic and consistent

**Files:**
- Create: `src/lib/services/claims.ts`
- Modify: `src/app/api/claims/route.ts`
- Modify: `src/app/api/claims/[id]/route.ts`
- Modify: `src/lib/schemas/claim.ts`
- Modify: `src/lib/schemas/claim-update.ts`
- Add tests under `tests/api/claims/` and `tests/services/claims/`

**Steps:**
1. Derive expected claim type from the locked item and reject claims on inactive/claimed/resolved items.
2. Prevent duplicate pending claims and add conditional uniqueness handling.
3. Move claim reads, item checks, and terminal updates into one transaction with deterministic conflict errors.
4. Use conditional claim transitions and ensure only one approved claim can set the item claimant.
5. Set timestamps only for the correct lifecycle state and reject approval after deletion.
6. Implement pending-claim cancellation restricted to the claimant.
7. Close competing pending claims when a winner is approved.
8. Add concurrent approval, approve/reject race, cancellation, and deleted-item tests.

### Task 7: Harden admin authorization, moderation, and CSRF

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/app/api/admin/items/route.ts`
- Modify: `src/app/api/admin/items/[id]/route.ts`
- Modify: `src/app/api/admin/users/route.ts`
- Modify: `src/app/api/admin/users/[id]/route.ts`
- Modify: `src/app/api/admin/claims/route.ts`
- Modify: `src/app/api/admin/stats/route.ts`
- Create: `src/lib/services/moderation.ts`
- Add tests under `tests/api/admin/`

**Steps:**
1. Replace prefix matching for `/` with exact and segment-aware public-route matching.
2. Centralize current-user role checks and require current database authorization for every admin operation.
3. Add CSRF, Origin, rate-limit, and request validation to all admin mutations.
4. Separate spam moderation from item lifecycle state and preserve the original state on unflag.
5. Restrict role changes to administrators and record actor/reason metadata where the schema permits.
6. Bound admin pagination and return the same DTO names as the UI.
7. Add tests for anonymous proxy access, moderator boundaries, stale roles, spam state restoration, and tokenless mutations.

### Task 8: Add reliable rate limiting and security headers

**Files:**
- Modify: `src/lib/rateLimit.ts`
- Modify: `src/app/api/auth/[...nextauth]/route.ts`
- Modify: `src/app/api/user/profile/route.ts`
- Modify: `src/app/api/upload/route.ts`
- Modify: `next.config.ts`
- Modify: `src/proxy.ts`
- Create: `src/lib/config.ts`
- Add tests under `tests/security/rate-limit.test.ts` and `tests/security/headers.test.ts`

**Steps:**
1. Define stable limiter policies at module scope and wire login, profile, admin, item, comment, claim, and upload limits.
2. Add an optional Redis-compatible adapter selected by environment configuration and retain an explicit local fallback.
3. Stop trusting arbitrary forwarding headers; use a configured trusted identity source.
4. Return typed 429 responses with `Retry-After` and preserve typed validation/auth errors.
5. Centralize CSP and security headers, remove production `unsafe-eval`, and restrict image/connect origins to required hosts.
6. Add tests for repeated limits, configured distributed-store selection, 429 headers, and deployed header values.

### Task 9: Secure uploads and support legacy images

**Files:**
- Modify: `src/app/api/upload/route.ts`
- Create: `src/app/api/upload/[id]/route.ts`
- Create: `src/lib/services/uploads.ts`
- Modify: `src/lib/upload.ts`
- Modify: `src/components/ImageUpload.tsx`
- Modify: `src/components/ui/ItemImage.tsx`
- Modify: `src/components/ItemDetail.tsx`
- Modify: `next.config.ts`
- Add tests under `tests/api/upload/`

**Steps:**
1. Require authentication, CSRF, Origin, and a rate limit before parsing uploads.
2. Enforce a bounded request body and inspect image bytes/magic signatures.
3. Allow only fixed raster MIME types, fixed extensions, safe pixel limits, and explicit Blob content type.
4. Track provisional uploads by owner and validate that item images reference the owner’s completed upload.
5. Add authorized delete/finalize behavior and clean up removed/replaced uploads.
6. Keep the legacy Supabase image pattern until a verified data migration is complete.
7. Add a safe image fallback and tests for forged MIME, HTML/SVG/polyglots, oversized images, unauthorized references, and cleanup.

### Task 10: Fix API contracts, pagination, and product workflows

**Files:**
- Modify: `src/app/api/items/route.ts`
- Modify: `src/app/api/items/[id]/route.ts`
- Modify: `src/app/api/claims/route.ts`
- Modify: `src/app/api/comments/route.ts`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/components/UserItemsSection.tsx`
- Modify: `src/components/UserClaimsSection.tsx`
- Modify: `src/components/IncomingClaimsSection.tsx`
- Modify: `src/components/ItemDetail.tsx`
- Modify: `src/components/CommentsSection.tsx`
- Modify: `src/components/UserProfileSection.tsx`
- Modify: `src/components/EditProfileModal.tsx`
- Modify: `src/app/lost-items/page.tsx`
- Modify: `src/app/resolved/page.tsx`
- Modify: `src/app/search/page.tsx`
- Add tests under `tests/contracts/`

**Steps:**
1. Standardize item, comment, claim, count, pagination, and error DTOs.
2. Add bounded/cursor-capable collection reads and eliminate N+1 request patterns.
3. Wire lost/resolved filters, search, pagination, profile updates, claim cancellation, and admin controls to server operations.
4. Remove duplicate and stale search requests with a single fetch owner and cancellation.
5. Return correct resolved statistics and display server errors instead of silently ignoring them.
6. Add tests for response field names, date ranges, pagination, and workflow request payloads.

### Task 11: Fix accessibility and front-end interaction defects

**Files:**
- Modify: `src/components/ClaimsModal.tsx`
- Modify: `src/components/EditProfileModal.tsx`
- Modify: `src/components/AdminDashboard.tsx`
- Modify: `src/components/ImageUpload.tsx`
- Modify: `src/components/forms/ValidationInput.tsx`
- Modify: `src/components/forms/FieldError.tsx`
- Modify: `src/components/CommentsSection.tsx`
- Modify: `src/components/ProtectedRoute.tsx`
- Modify: `src/app/layout.tsx`
- Add tests under `tests/ui/`

**Steps:**
1. Use accessible dialog semantics, names, Escape handling, focus trapping, and focus restoration.
2. Associate labels, controls, errors, and live status messages.
3. Make upload, filters, admin tabs, and action controls keyboard operable.
4. Add correct loading, disabled, success, and failure states.
5. Run keyboard and automated accessibility smoke tests on the primary flows.

### Task 12: Add tests, CI, environment, and accurate documentation

**Files:**
- Create: `tests/**` for all completed domains
- Create: `playwright.config.ts` if browser tests are enabled
- Create: `.env.example`
- Create: `LICENSE`
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `src/app/layout.tsx`
- Create: `src/app/robots.ts`
- Create: `src/app/sitemap.ts`
- Create: `public/manifest.webmanifest`

**Steps:**
1. Add unit tests for pure schemas, security helpers, auth policy helpers, and DTOs.
2. Add route/integration tests for authentication, authorization, CSRF, lifecycle, uploads, moderation, and visibility.
3. Add focused browser tests for login, post, search/filter, claim, comment, profile, and admin flows.
4. Add clean-install, Prisma, lint, type-check, test, build, and migration checks to CI.
5. Add a secret-free environment template and runtime configuration validation.
6. Rewrite stale README claims to match the actual stack, Blob migration, routes, scripts, environment variables, and test matrix.
7. Add metadata, robots, sitemap, manifest, and license information.
8. Run the complete verification sequence and document any checks that require production credentials.

### Task 13: Final verification and improvement handoff

**Files:**
- No application changes unless verification exposes a regression.
- Modify: `docs/plans/2026-09-25-campushelper-hardening-design.md` only if the implementation deviates from the approved design.

**Steps:**
1. Run `git diff --check` and inspect the complete diff for accidental secrets or generated artifacts.
2. Run `npm run db:validate`, `npm run db:generate`, `npm run type-check`, `npm run lint`, `npm test`, and `npm run build`.
3. Run focused browser smoke tests if the environment supports them.
4. Verify migration replay, privilege escalation, stale sessions, CSRF, rate limits, deleted visibility, claim races, and upload spoofing.
5. Record the ten highest-value improvements not included in the remediation, with impact, effort, and acceptance criteria.
6. Do not commit, push, or alter unrelated worktree changes unless explicitly requested.
