import { describe, expect, it } from "vitest";
import {
  DEFAULT_POOLER_CONNECTION_LIMIT,
  DEFAULT_SESSION_CONNECTION_LIMIT,
  withConnectionDefaults,
} from "@/lib/prisma";

/**
 * A missing `connection_limit` is an outage-class misconfiguration, not a
 * tuning knob: Prisma's default is derived from the CPU count of the machine
 * that built the bundle, and Supabase's free compute caps the database at 60
 * direct connections. These tests pin the values that get filled in — and,
 * more importantly, that an explicit value is never overwritten.
 */

function params(url: string) {
  return new URL(url).searchParams;
}

describe("withConnectionDefaults", () => {
  it("treats the transaction pooler port as a pooler and enables pgbouncer mode", () => {
    const out = withConnectionDefaults(
      "postgresql://u:p@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
    )!;

    expect(params(out).get("pgbouncer")).toBe("true");
    expect(params(out).get("connection_limit")).toBe(String(DEFAULT_POOLER_CONNECTION_LIMIT));
  });

  it("gives a session-mode pooler a small fixed budget, not a CPU-derived one", () => {
    // This is the shape production was actually using: the pooler host, but on
    // port 5432. Session mode cannot multiplex, so it must not get the default.
    const out = withConnectionDefaults(
      "postgresql://u:p@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
    )!;

    expect(params(out).get("connection_limit")).toBe(String(DEFAULT_SESSION_CONNECTION_LIMIT));
    expect(params(out).get("pgbouncer")).toBeNull();
  });

  it("bounds a direct connection too", () => {
    const out = withConnectionDefaults(
      "postgresql://u:p@db.example.supabase.co:5432/postgres?sslmode=require"
    )!;

    expect(params(out).get("connection_limit")).toBe(String(DEFAULT_SESSION_CONNECTION_LIMIT));
    expect(params(out).get("sslmode")).toBe("require");
  });

  it("never overwrites an explicit connection_limit", () => {
    const out = withConnectionDefaults(
      "postgresql://u:p@host:6543/postgres?connection_limit=5"
    )!;

    expect(params(out).get("connection_limit")).toBe("5");
    // pgbouncer mode is still required on the transaction port, and it is not
    // something the pool-size setting expresses.
    expect(params(out).get("pgbouncer")).toBe("true");
  });

  it("never overwrites an explicit pool_timeout", () => {
    const out = withConnectionDefaults(
      "postgresql://u:p@host:5432/postgres?pool_timeout=30"
    )!;

    expect(params(out).get("pool_timeout")).toBe("30");
  });

  it("always bounds the pool wait, so saturation is a retryable error", () => {
    const out = withConnectionDefaults("postgresql://u:p@host:5432/postgres")!;
    expect(params(out).get("pool_timeout")).toBe("10");
  });

  it("passes an absent URL through untouched", () => {
    expect(withConnectionDefaults(undefined)).toBeUndefined();
    expect(withConnectionDefaults("")).toBe("");
  });

  it("passes an unparseable URL through rather than masking the real error", () => {
    expect(withConnectionDefaults("not a url")).toBe("not a url");
  });

  it("preserves the credentials, host and database", () => {
    const out = withConnectionDefaults("postgresql://user:secret@host:5432/mydb")!;
    const parsed = new URL(out);

    expect(parsed.username).toBe("user");
    expect(parsed.password).toBe("secret");
    expect(parsed.hostname).toBe("host");
    expect(parsed.pathname).toBe("/mydb");
  });
});
