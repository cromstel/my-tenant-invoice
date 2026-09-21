import NextAuth, { type DefaultSession, type Session } from "next-auth";
import type { JWT } from "@auth/core/jwt";
import Credentials from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import env from "@/lib/config/env";
import { AuthenticationError } from "@/lib/errors";
import logger from "@/lib/logging/logger";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      activeTenantId: string | null;
      roles: Record<string, string[]>;
      impersonatedTenantId: string | null;
      impersonatedBy: string | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    activeTenantId?: string | null;
    roles?: Record<string, string[]>;
    impersonatedTenantId?: string | null;
    impersonatedBy?: string | null;
    cacheVersion?: number;
  }
}

const loginSchema: z.ZodSchema<{ email: string; password: string }> = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: "database",
    maxAge: 7 * 24 * 60 * 60,
    updateAge: 60 * 60,
  },
  secret: env.AUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/auth/error",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(
        credentials: Partial<Record<"email" | "password", unknown>> | undefined
      ): Promise<{ id: string; email: string; name: string | null; image: string | null } | null> {
        if (!credentials) {
          throw new AuthenticationError("Invalid input");
        }
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          throw new AuthenticationError("Invalid input");
        }
        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            organizationMembers: {
              include: { role: true },
            },
          },
        });
        if (!user) {
          throw new AuthenticationError("Invalid credentials");
        }
        if (!user.passwordHash) {
          throw new AuthenticationError("Invalid credentials");
        }
        const pwOk: boolean = await bcrypt.compare(password, user.passwordHash);
        if (!pwOk) {
          throw new AuthenticationError("Invalid credentials");
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
        };
      },
    }),
    env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET
      ? GitHubProvider({
          clientId: env.AUTH_GITHUB_ID,
          clientSecret: env.AUTH_GITHUB_SECRET,
        })
      : null,
    env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET
      ? Google({
          clientId: env.AUTH_GOOGLE_ID,
          clientSecret: env.AUTH_GOOGLE_SECRET,
        })
      : null,
  ].filter(
    (
      p
    ): p is
      | ReturnType<typeof Credentials>
      | ReturnType<typeof GitHubProvider>
      | ReturnType<typeof Google> => p !== null
  ),
  callbacks: {
    async session({
      session,
      user,
      token,
    }: {
      session: Session;
      user: { id: string };
      token: JWT;
    }): Promise<Session> {
      if (token && token.roles && token.activeTenantId !== undefined && token.cacheVersion !== undefined) {
        return {
          ...session,
          user: {
            ...session.user,
            id: user.id,
            activeTenantId: token.activeTenantId ?? null,
            roles: token.roles ?? {},
            impersonatedTenantId: token.impersonatedTenantId ?? null,
            impersonatedBy: token.impersonatedBy ?? null,
          },
        };
      }

      const memberships = await prisma.organizationMember.findMany({
        where: { userId: user.id },
        include: { role: true },
      });

      const roles: Record<string, string[]> = {};
      for (const member of memberships) {
        const existing: string[] = roles[member.organizationId] ?? [];
        roles[member.organizationId] = [...existing, member.role.name];
      }

      const activeTenantId: string | null =
        memberships.length > 0 ? memberships[0]!.organizationId : null;

      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          activeTenantId,
          roles,
          impersonatedTenantId: null,
          impersonatedBy: null,
        },
      };
    },
    async jwt({
      token,
      user,
      account,
    }: {
      token: JWT;
      user?: { id: string; email?: string | null; name?: string | null; image?: string | null };
      account?: unknown;
    }): Promise<JWT> {
      if (user) {
        token.id = user.id;
        const memberships = await prisma.organizationMember.findMany({
          where: { userId: user.id },
          include: { role: true },
        });
        const roles: Record<string, string[]> = {};
        for (const member of memberships) {
          const existing: string[] = roles[member.organizationId] ?? [];
          roles[member.organizationId] = [...existing, member.role.name];
        }
        token.activeTenantId = memberships.length > 0 ? memberships[0]!.organizationId : null;
        token.roles = roles;
        token.impersonatedTenantId = null;
        token.impersonatedBy = null;
        token.cacheVersion = 1;
      }
      return token;
    },
    async signIn({
      user: _user,
      account: _account,
      profile: _profile,
    }: {
      user: unknown;
      account: unknown;
      profile?: unknown;
    }): Promise<boolean> {
      return true;
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }): Promise<string> {
      return url.startsWith(baseUrl) ? url : baseUrl;
    },
  },
  events: {
    async createUser({ user }: { user: { id: string; email?: string | null } }): Promise<void> {
      logger.info({ userId: user.id, email: user.email }, "User created via auth");
    },
    async linkAccount({
      user,
      account,
    }: {
      user: { id: string };
      account: { provider: string; providerAccountId: string };
    }): Promise<void> {
      logger.info(
        { userId: user.id, provider: account.provider, providerAccountId: account.providerAccountId },
        "OAuth account linked"
      );
    },
    async session({ session: _session, user }: { session: Session; user: { id: string } }): Promise<void> {
      void prisma.user
        .update({
          where: { id: user.id },
          data: { updatedAt: new Date() },
        })
        .catch((err: unknown): void => {
          logger.warn({ err, userId: user.id }, "Failed to update user lastActive");
        });
    },
  },
});

export async function requireSession(): Promise<Session> {
  const session: Session | null = await auth();
  if (!session) {
    throw new AuthenticationError("Authentication required");
  }
  return session;
}

export async function getCurrentUser(): Promise<Session["user"] | null> {
  const session: Session | null = await auth();
  return session?.user ?? null;
}
