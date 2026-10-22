import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma CLI operations (migrations, introspection) need a direct connection.
// Runtime queries use DATABASE_URL through the pg adapter in src/lib/prisma.ts.
const migrationUrl = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: migrationUrl ?? '',
  },
});
