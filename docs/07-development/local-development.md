# Local Development with Docker

> MySQL 8, Redis 7, Mailpit, MinIO (optional). No native installs of these services required on dev machines.

---

## 1. docker-compose.yml

Full file at repo root. Runs with `pnpm docker:up` alias.

```yaml
# docker-compose.yml
name: mytenant-invoice-dev

services:
  mysql:
    image: mysql:8.0
    platform: linux/amd64
    command:
      - --default-authentication-plugin=mysql_native_password
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --innodb-buffer-pool-size=256M
    environment:
      MYSQL_ROOT_PASSWORD: devpassword
      MYSQL_DATABASE: mytenant_invoice
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql
      - ./.docker/mysql-init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-uroot", "-pdevpassword"]
      interval: 5s
      timeout: 5s
      retries: 20

  redis:
    image: redis:7.2-alpine
    command: ["redis-server", "--appendonly", "yes", "--requirepass", "devpassword"]
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "devpassword", "ping"]
      interval: 3s
      timeout: 2s
      retries: 20

  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI
    environment:
      MP_MAX_MESSAGES: 500
      MP_DATABASE: /data/mailpit.db
    volumes:
      - mailpit-data:/data

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio-data:/data
    profiles:
      - storage   # enable with: docker compose --profile storage up -d

volumes:
  mysql-data:
  redis-data:
  mailpit-data:
  minio-data:
```

MySQL `3306`, Redis `6379`, Mailpit `1025/8025` match `.env.example` defaults.

### 1.1 MySQL Init Script (Shadow DB)

For Drizzle migrations that require a shadow DB:

```sql
-- .docker/mysql-init/01-create-shadow.sql
CREATE DATABASE IF NOT EXISTS mytenant_invoice_shadow CHARACTER SET utf8mb4;
CREATE DATABASE IF NOT EXISTS mytenant_invoice_test   CHARACTER SET utf8mb4;
GRANT ALL PRIVILEGES ON mytenant_invoice_shadow.* TO 'root'@'%';
GRANT ALL PRIVILEGES ON mytenant_invoice_test.*   TO 'root'@'%';
FLUSH PRIVILEGES;
```

---

## 2. Package Scripts

```jsonc
// package.json
{
  "scripts": {
    "docker:up":   "docker compose up -d mysql redis mailpit",
    "docker:up:storage": "docker compose --profile storage up -d mysql redis mailpit minio",
    "docker:down": "docker compose down",
    "docker:purge": "docker compose down -v",
    "docker:wait": "wait-on tcp:3306 tcp:6379 tcp:1025 && echo 'Infra ready'",
    "db:migrate":  "drizzle-kit migrate",
    "db:generate": "drizzle-kit generate",
    "db:seed":     "tsx scripts/seed.ts",
    "db:reset":    "pnpm docker:down && pnpm docker:up && pnpm docker:wait && pnpm db:migrate && pnpm db:seed"
  }
}
```

### 2.1 Dev Day-to-Day

```bash
# Start infra first
pnpm docker:up
pnpm docker:wait

# Migrations (only after schema changes)
pnpm db:generate
pnpm db:migrate

# Start Next.js
pnpm dev

# Wipe everything (rare)
pnpm docker:purge
pnpm db:reset
```

---

## 3. Drizzle Config

```ts
// drizzle.config.ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./lib/db/schema/**/*.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  migrations: { prefix: "timestamp" },
  breakpoints: true,
  verbose: true,
});
```

---

## 4. Seed Script

```ts
// scripts/seed.ts
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { hash } from "@node-rs/bcrypt";
import { createId } from "@paralleldrive/cuid2";
import {
  organizations, users, memberships, customers, tariffs, invoices, invoiceLineItems,
} from "@/lib/db/schema";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(conn);
  const pwd = await hash("Testpass1!", 12);

  const [acmeId, cromstelId] = [createId(), createId()];
  await db.insert(organizations).values([
    { id: acmeId,      name: "Acme Property Group",    slug: "acme-property-group", currency: "USD" },
    { id: cromstelId,  name: "CromStel Commercial",    slug: "cromstel-commercial", currency: "ZAR" },
  ]);

  const usersData = [
    { email: "owner@acme.test",      name: "Kai Owen",    orgId: acmeId,     role: "OWNER"   },
    { email: "admin@acme.test",      name: "Ami Admin",    orgId: acmeId,     role: "ADMIN"   },
    { email: "billing@cromstel.test",name: "Busi Ntuli",   orgId: cromstelId, role: "BILLING" },
  ];
  for (const u of usersData) {
    const userId = createId();
    await db.insert(users).values({ id: userId, email: u.email, name: u.name, passwordHash: pwd, emailVerified: true });
    await db.insert(memberships).values({ userId, organizationId: u.orgId, role: u.role });
  }

  // seed customers, tariffs, 2 invoices with 3 lines each...
  console.log("✅ Seed complete");
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
```

---

## 5. Vitest Integration Tests with Testcontainers

For integration tests that require the real DB, spin up per-worker ephemeral containers:

```ts
// tests/integration/setup-db.ts
import { beforeAll, afterAll } from "vitest";
import { MySqlContainer, StartedMySqlContainer } from "@testcontainers/mysql";
import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";

let mysql: StartedMySqlContainer;
let redis: StartedRedisContainer;

beforeAll(async () => {
  [mysql, redis] = await Promise.all([
    new MySqlContainer("mysql:8.0")
      .withDatabase("test")
      .withUsername("root")
      .withUserPassword("test")
      .withExposedPorts(3306)
      .start(),
    new RedisContainer("redis:7.2-alpine").start(),
  ]);
  process.env.DATABASE_URL = mysql.getConnectionUri();
  process.env.REDIS_URL    = redis.getConnectionUrl();
}, 120_000);

afterAll(async () => {
  await Promise.all([mysql?.stop(), redis?.stop()]);
});
```

```ts
// vitest.workspace.ts
import { defineWorkspace } from "vitest/config";
export default defineWorkspace([
  "./vitest.unit.config.ts",
  "./vitest.integration.config.ts", // includes setup-db.ts above
]);
```

---

## 6. Troubleshooting

| Symptom                                            | Fix                                                                 |
|----------------------------------------------------|---------------------------------------------------------------------|
| MySQL port 3306 is already used                    | `sudo lsof -ti:3306 | xargs kill -9` or change local port map.    |
| Drizzle shadow DB connection failed                | `pnpm docker:purge` to re-init, or manually run `01-create-shadow.sql` |
| Redis AUTH error after env update                  | Restart container with env change applied, or `docker compose restart redis` |
| Emails aren't arriving in Mailpit UI               | Check SMTP port `1025` is not blocked; test via `telnet 127.0.0.1 1025`. |
| M1/M2 Mac — MySQL fails to start                   | Ensure colima/docker is running amd64 emulation; `docker run --platform linux/amd64 hello-world` works? |
