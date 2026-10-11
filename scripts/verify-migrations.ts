import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

type RawClient = {
  $queryRawUnsafe: (query: string) => Promise<unknown>;
  $disconnect: () => Promise<void>;
};

type ColumnSpec = {
  table: string;
  name: string;
  udtName: string;
  nullable: boolean;
  requiresDefault?: boolean;
  defaultFragments?: string[];
};

type IndexRow = {
  indexName: string;
  tableName: string;
  isUnique: boolean;
  isValid: boolean;
  definition: string;
};

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = join(projectRoot, 'prisma', 'schema.prisma');
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const runtimeUrl = process.env.DATABASE_URL?.trim();
const directUrl = process.env.DIRECT_URL?.trim();
const migrationUrl = directUrl || runtimeUrl;

const expectedColumns: ColumnSpec[] = [
  { table: 'User', name: 'failedLoginAttempts', udtName: 'int4', nullable: false, requiresDefault: true, defaultFragments: ['0'] },
  { table: 'User', name: 'lockedUntil', udtName: 'timestamp', nullable: true },
  { table: 'User', name: 'sessionVersion', udtName: 'int4', nullable: false, requiresDefault: true, defaultFragments: ['0'] },
  { table: 'Item', name: 'images', udtName: '_text', nullable: false, requiresDefault: true, defaultFragments: ['array[]', "'{}'"] },
  { table: 'Item', name: 'moderationStatus', udtName: 'ItemModerationStatus', nullable: false, requiresDefault: true, defaultFragments: ['NONE'] },
  { table: 'Item', name: 'moderatedAt', udtName: 'timestamp', nullable: true },
  { table: 'Item', name: 'moderatedById', udtName: 'text', nullable: true },
  { table: 'Item', name: 'moderationReason', udtName: 'text', nullable: true },
  { table: 'Item', name: 'deletedAt', udtName: 'timestamp', nullable: true },
  { table: 'Item', name: 'deletedById', udtName: 'text', nullable: true },
  { table: 'Item', name: 'deletionReason', udtName: 'text', nullable: true },
  { table: 'Comment', name: 'images', udtName: '_text', nullable: false, requiresDefault: true, defaultFragments: ['array[]', "'{}'"] },
];

const expectedIndexes = [
  'User_email_key',
  'User_googleId_key',
  'User_isActive_createdAt_idx',
  'User_role_idx',
  'User_lockedUntil_idx',
  'Item_postedById_createdAt_idx',
  'Item_claimedById_idx',
  'Item_status_createdAt_idx',
  'Item_itemType_status_createdAt_idx',
  'Item_location_createdAt_idx',
  'Item_moderationStatus_createdAt_idx',
  'Item_moderatedById_idx',
  'Item_deletedById_idx',
  'Item_deletedAt_idx',
  'Comment_itemId_createdAt_idx',
  'Comment_userId_createdAt_idx',
  'Claim_itemId_status_createdAt_idx',
  'Claim_userId_status_createdAt_idx',
  'Claim_status_createdAt_idx',
  'Claim_resolvedAt_idx',
];

const expectedMigrations = [
  '20251022141305_init',
  '20260106000000_enable_rls',
  '20260925000000_complete_item_and_auth_schema',
  '20260925000001_claim_integrity_and_indexes',
  '20260925000002_rls_runtime_policies',
];

const protectedTables = ['User', 'Item', 'Comment', 'Claim'];
const expectedPolicyNames = [
  'campushelper_user_select',
  'campushelper_user_insert',
  'campushelper_user_update',
  'campushelper_user_delete',
  'campushelper_item_select',
  'campushelper_item_insert',
  'campushelper_item_update',
  'campushelper_item_delete',
  'campushelper_comment_select',
  'campushelper_comment_insert',
  'campushelper_comment_update',
  'campushelper_comment_delete',
  'campushelper_claim_select',
  'campushelper_claim_insert',
  'campushelper_claim_update',
  'campushelper_claim_delete',
];

function fail(message: string): never {
  throw new Error(`Migration verification failed: ${message}`);
}

function prismaEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: runtimeUrl || migrationUrl || '',
    DIRECT_URL: migrationUrl || runtimeUrl || '',
  };
}

function runPrisma(args: string[]): void {
  const result = spawnSync(npxCommand, ['prisma', ...args], {
    cwd: projectRoot,
    env: prismaEnvironment(),
    stdio: 'inherit',
  });

  if (result.error) {
    fail(`Prisma command could not start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(`Prisma ${args.join(' ')} failed`);
  }
}

function capturePrisma(args: string[]): { status: number | null; output: string } {
  const result = spawnSync(npxCommand, ['prisma', ...args], {
    cwd: projectRoot,
    env: prismaEnvironment(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    fail(`Prisma command could not start: ${result.error.message}`);
  }

  return {
    status: result.status,
    output: `${result.stdout || ''}\n${result.stderr || ''}`,
  };
}

async function query<T>(client: RawClient, sql: string): Promise<T[]> {
  return (await client.$queryRawUnsafe(sql)) as T[];
}

function assertEnumValues(labels: string[], expected: string[], enumName: string): void {
  for (const value of expected) {
    if (!labels.includes(value)) {
      fail(`${enumName} is missing required value ${value}`);
    }
  }
}

function assertIndexes(indexes: IndexRow[]): void {
  const byName = new Map(indexes.map((index) => [index.indexName, index]));

  for (const name of expectedIndexes) {
    const index = byName.get(name);
    if (!index || !index.isValid) {
      fail(`required index ${name} is missing or invalid`);
    }
  }

  const emailIndex = byName.get('User_email_lower_key');
  if (!emailIndex || !emailIndex.isUnique || !emailIndex.definition.toLowerCase().includes('lower')) {
    fail('User_email_lower_key must be a valid unique lower(email) index');
  }

  const pendingIndex = byName.get('Claim_pending_item_user_key');
  if (
    !pendingIndex ||
    !pendingIndex.isUnique ||
    !pendingIndex.definition.toLowerCase().includes('itemid') ||
    !pendingIndex.definition.toLowerCase().includes('userid') ||
    !pendingIndex.definition.toLowerCase().includes('pending')
  ) {
    fail('Claim_pending_item_user_key must be a valid unique pending item/user partial index');
  }

  const approvedIndex = byName.get('Claim_approved_item_key');
  if (
    !approvedIndex ||
    !approvedIndex.isUnique ||
    !approvedIndex.definition.toLowerCase().includes('itemid') ||
    !approvedIndex.definition.toLowerCase().includes('approved')
  ) {
    fail('Claim_approved_item_key must be a valid unique approved item partial index');
  }
}

function isAllowedPrismaDiffLine(line: string): boolean {
  const normalized = line.trim().toLowerCase();
  if (normalized.length === 0 || normalized.startsWith('--') || normalized === 'begin;' || normalized === 'commit;') {
    return true;
  }
  return [
    'user_email_lower_key',
    'claim_pending_item_user_key',
    'claim_approved_item_key',
    'row level security',
    'force row level security',
    'policy ',
  ].some((fragment) => normalized.includes(fragment));
}

async function verifyCatalog(client: RawClient): Promise<void> {
  const columnRows = await query<{
    table_name: string;
    column_name: string;
    udt_name: string;
    is_nullable: string;
    column_default: string | null;
  }>(client, `
    SELECT table_name, column_name, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name IN ('User', 'Item', 'Comment')
  `);
  const columns = new Map(columnRows.map((column) => [`${column.table_name}.${column.column_name}`, column]));

  for (const expected of expectedColumns) {
    const actual = columns.get(`${expected.table}.${expected.name}`);
    if (!actual) {
      fail(`${expected.table}.${expected.name} is missing`);
    }
    if (actual.udt_name !== expected.udtName) {
      fail(`${expected.table}.${expected.name} has type ${actual.udt_name}; expected ${expected.udtName}`);
    }
    if (actual.is_nullable !== (expected.nullable ? 'YES' : 'NO')) {
      fail(`${expected.table}.${expected.name} has incompatible nullability`);
    }
    if (expected.requiresDefault && !actual.column_default) {
      fail(`${expected.table}.${expected.name} is missing its default`);
    }
    if (expected.defaultFragments && !expected.defaultFragments.some((fragment) => actual.column_default?.toLowerCase().includes(fragment.toLowerCase()))) {
      fail(`${expected.table}.${expected.name} has an unexpected default`);
    }
  }

  const itemStatusRows = await query<{ enumlabel: string }>(client, `
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'ItemStatus'
      AND n.nspname = current_schema()
    ORDER BY e.enumsortorder
  `);
  assertEnumValues(itemStatusRows.map((row) => row.enumlabel), ['LOST', 'FOUND', 'CLAIMED', 'RESOLVED', 'DELETED'], 'ItemStatus');

  const moderationRows = await query<{ enumlabel: string }>(client, `
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'ItemModerationStatus'
      AND n.nspname = current_schema()
    ORDER BY e.enumsortorder
  `);
  assertEnumValues(moderationRows.map((row) => row.enumlabel), ['NONE', 'FLAGGED', 'REMOVED'], 'ItemModerationStatus');

  const invalidImageRows = await query<{ invalid: boolean }>(client, `
    SELECT EXISTS (
      SELECT 1 FROM "Item" WHERE "images" IS NULL OR array_position("images", NULL::text) IS NOT NULL
    ) AS invalid
  `);
  if (invalidImageRows[0]?.invalid) {
    fail('Item.images contains null values');
  }

  const invalidCommentImageRows = await query<{ invalid: boolean }>(client, `
    SELECT EXISTS (
      SELECT 1 FROM "Comment" WHERE "images" IS NULL OR array_position("images", NULL::text) IS NOT NULL
    ) AS invalid
  `);
  if (invalidCommentImageRows[0]?.invalid) {
    fail('Comment.images contains null values');
  }

  const indexRows = await query<{
    index_name: string;
    table_name: string;
    is_unique: boolean;
    is_valid: boolean;
    definition: string;
  }>(client, `
    SELECT ic.relname AS index_name,
           tc.relname AS table_name,
           i.indisunique AS is_unique,
           i.indisvalid AS is_valid,
           pg_get_indexdef(i.indexrelid) AS definition
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_class tc ON tc.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = tc.relnamespace
    WHERE n.nspname = current_schema()
      AND tc.relname IN ('User', 'Item', 'Comment', 'Claim')
  `);
  assertIndexes(indexRows.map((row) => ({
    indexName: row.index_name,
    tableName: row.table_name,
    isUnique: row.is_unique,
    isValid: row.is_valid,
    definition: row.definition,
  })));

  const foreignKeyRows = await query<{ conname: string; confdeltype: string; confupdtype: string }>(client, `
    SELECT conname, confdeltype, confupdtype
    FROM pg_constraint
    WHERE conrelid = to_regclass('public."Item"')
      AND conname IN ('Item_moderatedById_fkey', 'Item_deletedById_fkey')
  `);
  const foreignKeys = new Map(foreignKeyRows.map((row) => [row.conname, row]));
  for (const name of ['Item_moderatedById_fkey', 'Item_deletedById_fkey']) {
    const constraint = foreignKeys.get(name);
    if (!constraint || constraint.confdeltype !== 'n' || constraint.confupdtype !== 'c') {
      fail(`${name} is missing or has incompatible delete/update actions`);
    }
  }

  const triggerRows = await query<{ trigger_name: string }>(client, `
    SELECT tgname AS trigger_name
    FROM pg_trigger
    WHERE tgrelid = to_regclass('public."Claim"')
      AND tgname = 'Claim_immutable_fields_trigger'
      AND NOT tgisinternal
  `);
  if (triggerRows.length !== 1) {
    fail('Claim_immutable_fields_trigger is missing');
  }

  const migrationRows = await query<{ migration_name: string; finished: boolean; rolled_back: boolean }>(client, `
    SELECT migration_name,
           finished_at IS NOT NULL AS finished,
           rolled_back_at IS NOT NULL AS rolled_back
    FROM "_prisma_migrations"
  `);
  const migrations = new Map(migrationRows.map((row) => [row.migration_name, row]));
  for (const name of expectedMigrations) {
    const migration = migrations.get(name);
    if (!migration || !migration.finished || migration.rolled_back) {
      fail(`migration ${name} is not recorded as successfully applied`);
    }
  }

  const rlsRows = await query<{ relname: string; rls: boolean; force: boolean }>(client, `
    SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS force
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('User', 'Item', 'Comment', 'Claim')
  `);
  const rls = new Map(rlsRows.map((row) => [row.relname, row]));
  for (const table of protectedTables) {
    const state = rls.get(table);
    if (!state?.rls) {
      fail(`RLS is not enabled on ${table}`);
    }
  }

  const runtimeRoleRows = await query<{ exists: boolean; bypasses: boolean; ownsTables: boolean }>(client, `
    SELECT
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'campushelper_runtime') AS exists,
      COALESCE((SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = 'campushelper_runtime'), false) AS bypasses,
      EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_roles r ON r.oid = c.relowner
        WHERE r.rolname = 'campushelper_runtime'
          AND c.relname IN ('User', 'Item', 'Comment', 'Claim')
          AND c.relnamespace = 'public'::regnamespace
      ) AS owns_tables
  `);
  const runtimeRole = runtimeRoleRows[0];
  if (!runtimeRole?.exists) {
    fail('RLS runtime role campushelper_runtime is not provisioned; provision it and apply prisma/operator/20260925000002_rls_runtime_policies.sql before rerunning verification');
  } else {
    if (runtimeRole.bypasses || runtimeRole.ownsTables) {
      fail('campushelper_runtime must be a non-bypass role that does not own protected tables');
    }
    const grantRows = await query<{ table_name: string; privilege_type: string }>(client, `
      SELECT table_name, privilege_type
      FROM information_schema.role_table_grants
      WHERE grantee = 'campushelper_runtime'
        AND table_schema = 'public'
        AND table_name IN ('User', 'Item', 'Comment', 'Claim')
    `);
    const expectedGrants: Record<string, string[]> = {
      User: ['INSERT', 'SELECT', 'UPDATE'],
      Item: ['INSERT', 'SELECT', 'UPDATE'],
      Comment: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
      Claim: ['INSERT', 'SELECT', 'UPDATE'],
    };
    for (const table of protectedTables) {
      const actual = new Set(grantRows.filter((grant) => grant.table_name === table).map((grant) => grant.privilege_type));
      const expected = new Set(expectedGrants[table]);
      if (actual.size !== expected.size || [...expected].some((privilege) => !actual.has(privilege))) {
        fail(`campushelper_runtime grants on ${table} do not match the least-privilege contract`);
      }
    }
    for (const table of protectedTables) {
      if (!rls.get(table)?.force) {
        fail(`FORCE ROW LEVEL SECURITY is not enabled on ${table}`);
      }
    }
    const policyRows = await query<{ policyname: string; roles: string | null; qual: string; with_check: string }>(client, `
      SELECT
        policyname,
        array_to_string(roles, ',') AS roles,
        COALESCE(qual, '') AS qual,
        COALESCE(with_check, '') AS with_check
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('User', 'Item', 'Comment', 'Claim')
    `);
    const policyMap = new Map(policyRows.map((row) => [row.policyname, row]));
    for (const name of expectedPolicyNames) {
      const policy = policyMap.get(name);
      if (!policy) {
        fail(`RLS policy ${name} is missing`);
      }
      if (!policy.roles?.split(',').includes('campushelper_runtime')) {
        fail(`RLS policy ${name} is not restricted to campushelper_runtime`);
      }
      if (!`${policy.qual} ${policy.with_check}`.includes('current_setting')) {
        fail(`RLS policy ${name} does not use request-context settings`);
      }
    }
    for (const policy of policyRows) {
      if (!expectedPolicyNames.includes(policy.policyname)) {
        fail(`unexpected RLS policy ${policy.policyname} is present`);
      }
    }
  }

  const diff = capturePrisma([
    'migrate',
    'diff',
    '--from-schema-datasource',
    schemaPath,
    '--to-schema-datamodel',
    schemaPath,
    '--script',
    '--exit-code',
  ]);
  if (diff.status !== 0 && diff.status !== 2) {
    fail('Prisma migrate diff could not compare the replayed database');
  }
  if (diff.status === 2) {
    const unexpectedLines = diff.output
      .split(/\r?\n/)
      .filter((line) => !isAllowedPrismaDiffLine(line));
    if (unexpectedLines.length > 0) {
      fail('Prisma schema diff contains changes outside the documented raw database objects');
    }
  }
}

async function main(): Promise<void> {
  if (!migrationUrl) {
    console.log('DATABASE_URL and DIRECT_URL are not set; migration verification skipped.');
    return;
  }
  if (!existsSync(schemaPath)) {
    fail(`schema file not found at ${schemaPath}`);
  }

  console.log('DATABASE_URL is used as the runtime/client URL; DIRECT_URL is preferred for migration replay and catalog checks. If only one is supplied, it is used for both. Connection strings will not be printed.');
  runPrisma(['generate', '--schema', schemaPath]);
  runPrisma(['migrate', 'deploy', '--schema', schemaPath]);

  const generated = await import('../src/generated/prisma/index.js');
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousDirectUrl = process.env.DIRECT_URL;
  process.env.DATABASE_URL = runtimeUrl || migrationUrl;
  process.env.DIRECT_URL = migrationUrl;
  const client = new generated.PrismaClient({ datasources: { db: { url: migrationUrl } } });

  try {
    await verifyCatalog(client);
    console.log('Migration replay and schema verification passed.');
  } finally {
    await client.$disconnect();
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousDirectUrl === undefined) delete process.env.DIRECT_URL;
    else process.env.DIRECT_URL = previousDirectUrl;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Migration verification failed.');
  process.exitCode = 1;
});
