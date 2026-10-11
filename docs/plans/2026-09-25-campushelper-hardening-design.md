# CampusHelper Comprehensive Hardening Design

**Date:** 2026-09-25  
**Status:** Approved for implementation

## Goal

Fix the audited security, data-integrity, workflow, API-contract, storage, accessibility, tooling, testing, and documentation defects in CampusHelper while preserving the Next.js App Router architecture and existing user-facing product direction.

## Constraints and assumptions

- Preserve unrelated uncommitted work, especially the current Vercel Blob migration work.
- Do not require secrets or external services for local development or type-checking.
- Database migrations must be forward-only and safe for deployments that may have manually patched production schemas.
- The application continues to use NextAuth, Prisma/PostgreSQL, Tailwind, and Vercel Blob.
- Rate limiting has a local fallback, but production deployments can configure a distributed Redis-compatible store.
- No commit is created unless explicitly requested.

## Architecture

Create small shared server-side policy and service modules instead of duplicating authorization, validation, and lifecycle logic in route handlers. Route handlers will authenticate the request, apply centralized authorization and CSRF/Origin checks, parse strict schemas, call a domain service, and return stable JSON response shapes. UI code will consume those contracts and remain responsible for presentation and accessibility only.

The remediation is expand/contract:

1. Add database columns, enum values, indexes, and migration-compatible state metadata.
2. Deploy code that can operate with the expanded schema and legacy image URLs.
3. Backfill/validate data.
4. Remove only legacy compatibility after operational verification.

## Authentication and authorization

- Never copy client-provided session fields such as `id`, `email`, or `role` into the JWT.
- Resolve the current user and role from PostgreSQL for every protected mutation and privileged read; reject inactive users immediately.
- Require verified email claims for OAuth and prevent automatic linking of an unverified credentials account to an OAuth identity.
- Normalize email addresses and enforce a case-insensitive uniqueness strategy.
- Add a token/session version or equivalent database-backed revocation check so suspension and role changes invalidate existing sessions.
- Validate the exact request origin from configuration; do not derive trusted origins from request headers.
- Remove or tightly protect the development auth-debug route.

## Request security

- Apply CSRF and Origin validation to every state-changing custom route, including admin routes and signup.
- Use a host-prefixed, secure production cookie and bind the CSRF value to the authenticated session where possible.
- Return typed errors: 400 validation, 401 authentication, 403 authorization/CSRF, 404 invisible resources, 413 upload size, 429 rate limit, and 5xx sanitized internal errors.
- Use stable module-level limiter definitions and a configurable distributed store. Do not trust spoofable forwarding headers without a deployment-specific trusted-proxy policy.
- Wire login, profile, admin, upload, and custom mutation limits; return `Retry-After` for 429 responses.
- Tighten CSP and centralize security headers without breaking Next.js, OAuth, or Blob requests.

## Data model and lifecycle

Add a forward migration for the current schema drift, including `failedLoginAttempts`, `lockedUntil`, and `ItemStatus.DELETED`. Add moderation metadata and deletion metadata rather than using `RESOLVED` or title prefixes for spam. Add indexes for relationships and common status/date queries, plus conditional uniqueness for pending/approved claims.

Define a single item/claim transition policy:

- Generic item edits may change content only and may not set status, claimant, or resolution timestamps.
- Claims derive the allowed claim type from the item type.
- Claims can only be created against active items.
- Approval/rejection/cancellation use a transaction, conditional status updates, and deterministic conflict handling so only one claim can win.
- Deletion locks the item, transitions pending claims, redacts or tombstones comments according to the selected policy, and updates the item atomically.
- Deleted resources are invisible to ordinary callers; authorized moderation paths receive explicit DTOs.
- Spam moderation preserves the original business lifecycle state.

## Validation and API contracts

- Replace route-local schemas with strict shared Zod schemas, bounded strings, bounded image arrays, trimmed plain text, safe object shapes, and capped pagination.
- Normalize date ranges so both lower and upper bounds are applied.
- Return standard DTOs with consistent names for comments/claims counts and list metadata.
- Use one query owner for list, detail, and dashboard data; avoid unbounded `findMany` calls and N+1 requests.
- Reject malformed top-level JSON, unknown lifecycle fields, invalid enum values, oversized page sizes, and unsafe image references with 400 responses.
- Treat all user text as text at the storage boundary and encode at output sinks.

## Uploads and images

- Keep compatibility with existing Supabase-hosted URLs during the Vercel Blob transition.
- Validate bytes rather than trusting multipart MIME or filename; allow only raster image formats, fixed extensions/content types, safe size/pixel limits, and explicit Blob content type.
- Enforce request/body limits and authentication, CSRF, and rate limits.
- Track provisional uploads by owner and add authorized delete/finalize behavior with cleanup for abandoned uploads.
- Restrict stored image references to application-owned upload identifiers or an explicit legacy-host allowlist; do not accept arbitrary public URLs.
- Add a safe image fallback for legacy or failed images.

## UI and accessibility

- Wire lost/resolved filters, search requests, pagination, profile updates, claim cancellation, and admin controls to real server operations.
- Eliminate duplicate/racy requests with a single effect/data-fetch owner and cancellation or stale-response protection.
- Standardize list/detail/dashboard response contracts and correct counts and pagination.
- Enforce item-state locking consistently in the server and reflect it in the UI.
- Add dialog semantics, focus management, keyboard-operable upload controls, associated labels/errors, live status messages, and meaningful loading/error states.
- Replace fabricated home-page activity with real data or clearly labeled demo content.

## Tooling, tests, and documentation

- Add explicit `type-check`, `test`, database validation/generation, and verification scripts.
- Configure real Next.js/TypeScript ESLint coverage and add Node/Prisma runtime declarations.
- Add Vitest unit/integration tests for schemas, security utilities, auth callbacks, CSRF, rate limiting, route authorization, lifecycle transitions, deleted-resource visibility, and upload validation. Add focused browser tests for critical journeys.
- Add CI for clean install, Prisma validation/generation, migration replay, lint, type-check, tests, build, and security-header checks.
- Add a secret-free environment template and update the README to match the actual stack, Blob configuration, scripts, routes, and test coverage.
- Add application metadata, robots/sitemap configuration, and a real license file.

## Error handling and observability

Use shared error response helpers with request IDs and sanitized messages. Log structured server-side details without passwords, tokens, connection strings, or provider secrets. Do not swallow OAuth or database failures. Keep analytics separate from error monitoring and make error-reporting integration configurable.

## Verification and rollout

- Run Prisma schema validation and migration replay against a disposable PostgreSQL database.
- Run focused tests before the full suite, then lint, type-check, build, and browser smoke tests.
- Test privilege escalation, stale sessions, deleted visibility, invalid transitions, concurrent claims, CSRF failures, rate-limit responses, upload spoofing, and legacy image rendering.
- Use a production clone for migration preflight and back up before applying schema changes.
- Do not remove legacy image support or the old RLS migration until runtime-role and persisted-data checks pass.

## Deferred external work

The implementation can provide adapters and configuration for distributed rate limiting, transactional email verification, production image moderation, and error reporting. Deployment-specific secrets, database roles/policies, email delivery, and monitoring accounts must be provisioned outside the repository before those capabilities can be enabled in production.
