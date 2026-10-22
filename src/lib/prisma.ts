import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma';

/**
 * Prisma client singleton.
 *
 * Two things here are deliberate and load-bearing in serverless.
 *
 * 1. **The client is cached on `globalThis` in every environment.** It used to
 *    be cached only when `NODE_ENV !== 'production'`, so in production every
 *    module evaluation built a fresh client — and with it a fresh connection
 *    pool. A single Next.js serverless bundle can evaluate a module more than
 *    once (separate chunks; the route-handler graph vs. the instrumented
 *    server), so "one client per process" was not actually guaranteed where it
 *    mattered most. This is the shape Prisma documents for Next.js.
 *
 * 2. **`connection_limit` is applied when the caller has not set one.**
 *    Prisma's default is `num_physical_cpus * 2 + 1` — measured at 25 on a
 *    12-CPU host, and computed from the *build* machine's CPU count rather than
 *    from anything the database can serve. Supabase's free (Nano) compute caps
 *    the database at 60 direct connections and 200 pooler clients. The
 *    project's `DATABASE_URL` pointed at the shared pooler in **session mode**
 *    (port 5432, not the transaction port 6543) with no `connection_limit` and
 *    no `pool_timeout`, which at ~12 warm instances already reaches the
 *    60-connection ceiling — and a Vercel deployment runs far more than 12 warm
 *    instances under load. The failure mode is a total outage for every user.
 *
 * The defaults below are chosen for the pooler, not for throughput: behind a
 * transaction-mode pooler one connection per instance is the documented
 * setting, because pgbouncer multiplexes it. Session mode cannot multiplex, so
 * it gets a small fixed budget instead. An explicit `connection_limit` in the
 * environment always wins — this only fills in a value that was missing.
 */

/** Supabase's transaction-mode pooler port. */
const POOLER_TRANSACTION_PORT = '6543';

/** Connections per serverless instance when nothing else is specified. */
export const DEFAULT_POOLER_CONNECTION_LIMIT = 1;
export const DEFAULT_SESSION_CONNECTION_LIMIT = 3;

/**
 * Is this a transaction-mode pooler?
 *
 * Matched on the port and the `pgbouncer` marker rather than on a hostname, so
 * it holds for any Supabase region and for a self-hosted pgbouncer.
 */
function isTransactionPooler(url: URL): boolean {
  if (url.port === POOLER_TRANSACTION_PORT) return true;
  return url.hostname.includes('pooler') && url.searchParams.get('pgbouncer') === 'true';
}

/**
 * Add the connection parameters Prisma needs when they are missing.
 *
 * Pure and exported so the behaviour is testable without a database. Returns
 * the input unchanged when it cannot be parsed: a malformed URL is a different,
 * louder failure and must not be masked here.
 */
export function withConnectionDefaults(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return rawUrl;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  const transactionPooler = isTransactionPooler(url);

  // pgbouncer in transaction mode does not support the prepared statements and
  // session-level features that Prisma uses by default.
  if (transactionPooler && url.searchParams.get('pgbouncer') !== 'true') {
    url.searchParams.set('pgbouncer', 'true');
  }

  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set(
      'connection_limit',
      String(
        transactionPooler ? DEFAULT_POOLER_CONNECTION_LIMIT : DEFAULT_SESSION_CONNECTION_LIMIT
      )
    );
  }

  // Without a timeout a saturated pool leaves requests hanging until the
  // platform's own function timeout kills them, which surfaces as an opaque
  // 504 rather than a retryable error.
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', '10');
  }

  return url.toString();
}

/**
 * Translate the Prisma-era connection URL into `pg` pool options.
 *
 * Prisma ORM 7 uses a driver adapter (`@prisma/adapter-pg`), so the old
 * `connection_limit` and `pool_timeout` query parameters are no longer read by
 * Prisma's Rust engine. They map to `pg`'s `max` and
 * `connectionTimeoutMillis` instead. The parameters are stripped from the
 * connection string so `pg` and Supabase do not have to interpret
 * Prisma-specific keys.
 */
export function toPgPoolConfig(rawUrl: string | undefined): {
  connectionString?: string;
  max: number;
  connectionTimeoutMillis: number;
} {
  const normalized = withConnectionDefaults(rawUrl);

  if (!normalized) {
    return {
      max: DEFAULT_SESSION_CONNECTION_LIMIT,
      connectionTimeoutMillis: 10_000,
    };
  }

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return {
      connectionString: normalized,
      max: DEFAULT_SESSION_CONNECTION_LIMIT,
      connectionTimeoutMillis: 10_000,
    };
  }

  const parsedMax = Number.parseInt(url.searchParams.get('connection_limit') ?? '', 10);
  const parsedTimeout = Number.parseInt(url.searchParams.get('pool_timeout') ?? '', 10);

  url.searchParams.delete('connection_limit');
  url.searchParams.delete('pool_timeout');

  return {
    connectionString: url.toString(),
    max: Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : DEFAULT_SESSION_CONNECTION_LIMIT,
    connectionTimeoutMillis:
      Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout * 1000 : 10_000,
  };
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg(toPgPoolConfig(process.env.DATABASE_URL));

  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Cached in production too — see (1) above.
globalForPrisma.prisma = prisma;
