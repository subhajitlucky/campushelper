import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * What is actually true about RLS, and what must stay true.
 *
 * `20260106000000_enable_rls` turns RLS **on** for `User`, `Item`, `Comment`,
 * `Claim` and `_prisma_migrations`, and installs **no policies**. RLS enabled
 * with zero policies is fail-closed for any non-owner role — measured on a
 * throwaway 100k-user database, `SET ROLE rls_probe_reader; SELECT count(*)
 * FROM "User"` returns 0.
 *
 * The app is unaffected because it connects with `DATABASE_URL`, which is the
 * table owner, and an owner is exempt from its own RLS. That is also why RLS is
 * currently decorative: application-level authorization is what actually
 * protects the data, and this test does not pretend otherwise.
 *
 * `20260925000002_rls_runtime_policies` contains the real policies, but it
 * returns early with a NOTICE unless a `campushelper_runtime` role exists, so a
 * plain `prisma migrate deploy` cannot switch enforcement on. That early return
 * is the load-bearing safety property, not an accident, and it is what these
 * tests pin.
 *
 * Turning enforcement on is a **two-part change**: provision the role *and*
 * make every Prisma transaction set the session GUCs the policies read
 * (`app.user_id`, `app.user_role`, `app.session_version`, `app.lookup_email`).
 * Nothing under `src/` sets them today. Measured with the role, the policies
 * and FORCE RLS provisioned exactly as written, but the GUCs unset:
 *
 *     SELECT count(*) FROM "User"   -- as the runtime role
 *       0
 *     INSERT INTO "Item" (...)
 *     ERROR:  new row violates row-level security policy for table "Item"
 *
 * Sign-in, every `postedBy` join, and item creation all stop working. So the
 * last test below fails if either half is done without the other.
 */

const REPO_ROOT = new URL("../../", import.meta.url).pathname;
const MIGRATIONS_DIR = join(REPO_ROOT, "prisma/migrations");
const SRC_DIR = join(REPO_ROOT, "src");

const RUNTIME_ROLE = "campushelper_runtime";
const REQUIRED_GUCS = [
  "app.user_id",
  "app.user_role",
  "app.session_version",
  "app.lookup_email",
] as const;

function walk(dir: string, match: (name: string) => boolean, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, match, found);
    } else if (match(entry)) {
      found.push(readFileSync(full, "utf8"));
    }
  }
  return found;
}

const appliedMigrations = walk(MIGRATIONS_DIR, (name) => name.endsWith(".sql")).join("\n");
const policyMigration = readFileSync(
  join(MIGRATIONS_DIR, "20260925000002_rls_runtime_policies/migration.sql"),
  "utf8"
);
const sourceText = walk(SRC_DIR, (name) => /\.tsx?$/.test(name)).join("\n");

describe("RLS safety properties", () => {
  it("installs no policy unless the runtime role has been provisioned", () => {
    // The early return is the whole reason a plain `migrate deploy` is safe.
    const guardIndex = policyMigration.indexOf("IF NOT runtime_role_exists THEN");
    const firstPolicyIndex = policyMigration.indexOf("CREATE POLICY");

    expect(guardIndex).toBeGreaterThan(-1);
    expect(firstPolicyIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(firstPolicyIndex);

    // The guard has to RETURN, not merely notice, or execution falls through.
    const guardBody = policyMigration.slice(guardIndex, firstPolicyIndex);
    expect(guardBody).toMatch(/RETURN;/);
  });

  it("is not enabled by a migration that does not also install the policies", () => {
    // ENABLE and CREATE POLICY must travel together. `enable_rls` is the one
    // file allowed to enable without policies, and it predates the policy work;
    // any *new* migration that enables RLS must ship policies in the same file.
    const enablers = walk(MIGRATIONS_DIR, (name) => name.endsWith(".sql")).filter((sql) =>
      /ENABLE ROW LEVEL SECURITY/i.test(sql)
    );

    for (const sql of enablers) {
      const enables = /ENABLE ROW LEVEL SECURITY/i.test(sql);
      const createsPolicy = /CREATE POLICY/i.test(sql);
      const isEnableOnlyMigration = /Prisma bypasses RLS when connecting as the database owner/.test(sql);

      expect(
        !enables || createsPolicy || isEnableOnlyMigration,
        "A migration enables RLS without creating any policy in the same file. " +
          "RLS with no policies is fail-closed for non-owner roles."
      ).toBe(true);
    }
  });

  it("never points the application at the runtime role", () => {
    // Enforcement only becomes real if the connection switches role. Nothing in
    // src/ should be able to do that implicitly.
    expect(sourceText).not.toContain(RUNTIME_ROLE);
  });

  it("is a two-part switch: policies and GUC plumbing land together, or not at all", () => {
    const policiesNeedGucs = REQUIRED_GUCS.some((guc) => appliedMigrations.includes(guc));
    const appSetsGucs = REQUIRED_GUCS.every((guc) => sourceText.includes(guc));

    if (policiesNeedGucs && sourceText.includes(RUNTIME_ROLE)) {
      // Half-done: the app is wired to the runtime role but does not set what
      // the policies read, so "User" returns 0 rows and INSERT INTO "Item"
      // raises "violates row-level security policy".
      expect(
        appSetsGucs,
        `The runtime role is referenced under src/ but none of ${REQUIRED_GUCS.join(", ")} ` +
          `is set. Add a per-transaction set_config() layer before connecting as ${RUNTIME_ROLE}.`
      ).toBe(true);
    } else {
      // The safe state: policies exist but are dormant, and nothing connects as
      // the runtime role. Assert the dormancy explicitly so a future change that
      // flips one half is caught rather than assumed.
      expect(sourceText.includes(RUNTIME_ROLE)).toBe(false);
    }
  });

  it("keeps FORCE ROW LEVEL SECURITY off, which is what makes the owner exempt", () => {
    const appliedForce = /ALTER TABLE[^;]*FORCE ROW LEVEL SECURITY/i.test(appliedMigrations);
    const appliedInsideGuard = policyMigration.includes("FORCE ROW LEVEL SECURITY");

    // FORCE appears only inside the role-provisioned branch, so it cannot apply
    // while the owner connection is in use.
    expect(appliedForce && !appliedInsideGuard).toBe(false);
  });
});
