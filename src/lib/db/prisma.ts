import { PrismaClient } from "@prisma/client";
import env from "@/lib/config/env";
import logger from "@/lib/logging/logger";
import { InternalError } from "@/lib/errors";
import { applyRls } from "@/lib/db/rls-extension";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export function createPrismaClient(): PrismaClient {
  const warnMs = env.SLOW_QUERY_WARN_MS;
  const errorMs = env.SLOW_QUERY_ERROR_MS;

  const client = new PrismaClient({
    log: [
      { level: "error", emit: "event" },
      { level: "warn", emit: "event" },
      { level: "info", emit: "event" },
      { level: "query", emit: "event" },
    ],
    errorFormat: env.NODE_ENV === "development" ? "pretty" : "minimal",
  });

  client.$on("error" as never, (e: { message: string; target: string }) => {
    logger.error(
      { err: new Error(e.message), target: e.target },
      "Prisma client error"
    );
  });

  client.$on("warn" as never, (e: { message: string; target: string }) => {
    logger.warn({ target: e.target }, `Prisma warn: ${e.message}`);
  });

  client.$on("info" as never, (e: { message: string; target: string }) => {
    logger.info({ target: e.target }, `Prisma info: ${e.message}`);
  });

  client.$on(
    "query" as never,
    (e: {
      query: string;
      params: string;
      duration: number;
      target: string;
    }) => {
      const duration = e.duration;
      if (duration >= errorMs) {
        logger.error(
          {
            durationMs: duration,
            target: e.target,
            query: e.query,
            thresholdMs: errorMs,
          },
          `Prisma slow query (ERROR): ${duration}ms`
        );
      } else if (duration >= warnMs) {
        logger.warn(
          {
            durationMs: duration,
            target: e.target,
            query: e.query,
            thresholdMs: warnMs,
          },
          `Prisma slow query (WARN): ${duration}ms`
        );
      } else {
        logger.debug(
          { durationMs: duration, target: e.target },
          `Prisma query: ${duration}ms`
        );
      }
    }
  );

  return client;
}

let prismaInstance: PrismaClient;

if (env.NODE_ENV === "production") {
  prismaInstance = createPrismaClient();
} else {
  if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = createPrismaClient();
  }
  prismaInstance = globalThis.prismaGlobal;
}

const prisma = applyRls(prismaInstance) as unknown as PrismaClient;

let shutdownRegistered = false;

function registerShutdown(): void {
  if (shutdownRegistered) return;
  shutdownRegistered = true;

  process.on("beforeExit", async () => {
    try {
      await prisma.$disconnect();
      logger.info("Prisma client disconnected on beforeExit");
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err : new InternalError(String(err)) },
        "Error disconnecting Prisma client on beforeExit"
      );
    }
  });

  const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];
  for (const signal of signals) {
    process.once(signal, async () => {
      try {
        await prisma.$disconnect();
        logger.info(`Prisma client disconnected on ${signal}`);
      } catch (err) {
        logger.error(
          { err: err instanceof Error ? err : new InternalError(String(err)) },
          `Error disconnecting Prisma client on ${signal}`
        );
      }
    });
  }
}

registerShutdown();

export default prisma;
