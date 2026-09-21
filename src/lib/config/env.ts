import { z } from "zod";
import { ValidationError, type ValidationIssue } from "@/lib/errors";

const AppEnvSchema = z.enum(["development", "test", "staging", "production"]);
const NodeEnvSchema = z.enum(["development", "test", "production"]);
const LogLevelSchema = z.enum([
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
  "silent",
]);

const coerceBooleanOptional = z
  .union([z.string(), z.boolean(), z.number()])
  .optional()
  .transform((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val === 1;
    const lower = String(val).trim().toLowerCase();
    return lower === "true" || lower === "1" || lower === "yes";
  });

const coerceNumberOptional = z
  .union([z.string(), z.number()])
  .optional()
  .transform((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    const parsed = typeof val === "number" ? val : parseInt(String(val), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  });

const envSchema = z.object({
  APP_URL: z.string().url().optional().default("http://localhost:3000"),
  APP_ENV: AppEnvSchema.optional().default("development"),
  NODE_ENV: NodeEnvSchema.optional().default("development"),

  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  AUTH_URL: z.string().url().optional().default("http://localhost:3000/api/auth"),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().optional(),

  EMAIL_FROM: z.string().optional(),
  EMAIL_FROM_NAME: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: coerceNumberOptional,
  SMTP_SECURE: coerceBooleanOptional,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),

  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().optional().default("us-east-1"),
  STORAGE_BUCKET: z.string().optional().default("mytenant-invoice"),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_PUBLIC_ENDPOINT: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  ENCRYPTION_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().optional().default("http://localhost:3000"),
  LOG_LEVEL: LogLevelSchema.optional().default("info"),
  SLOW_QUERY_WARN_MS: coerceNumberOptional.pipe(
    z.number().int().positive().optional().default(1000)
  ),
  SLOW_QUERY_ERROR_MS: coerceNumberOptional.pipe(
    z.number().int().positive().optional().default(5000)
  ),
  SENTRY_DSN: z.string().optional(),

  PLATFORM_ADMIN_EMAIL: z
    .string()
    .email()
    .optional()
    .default("admin@example.com"),
  PLATFORM_ADMIN_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues: ValidationIssue[] = parsed.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  throw new ValidationError(issues);
}

export const env: Env = parsed.data;

export const isDev: boolean = env.NODE_ENV === "development";
export const isProd: boolean = env.NODE_ENV === "production";
export const isTest: boolean = env.NODE_ENV === "test";

export default env;
