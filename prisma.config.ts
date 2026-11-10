import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

import { defineConfig, env } from 'prisma/config';

/*
 * Prisma 7 no longer loads .env files itself (dotenv is disabled in
 * @prisma/config), so the CLI environment is populated here instead.
 *
 * The files are read in reverse precedence order and `loadEnvFile` never
 * overwrites a variable that is already set, so shell, CI and Docker values
 * always win and `.env.local` takes precedence over `.env`.
 */
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) {
    loadEnvFile(file);
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
