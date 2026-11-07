import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@/lib/db/prisma";
import env from "@/lib/config/env";

const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};

if (env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET) {
  socialProviders.github = {
    clientId: env.AUTH_GITHUB_ID,
    clientSecret: env.AUTH_GITHUB_SECRET,
  };
}

if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  socialProviders.google = {
    clientId: env.AUTH_GOOGLE_ID,
    clientSecret: env.AUTH_GOOGLE_SECRET,
  };
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "mysql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders,
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60, // 1 hour
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL ?? env.AUTH_URL?.replace("/api/auth", "") ?? "http://localhost:6161",
  trustedOrigins: [env.APP_URL ?? "http://localhost:6161"],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
