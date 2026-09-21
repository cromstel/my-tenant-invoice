import pino, { type Logger, type Level } from "pino";
import { env, isProd } from "@/lib/config/env";
import { redact } from "./redact";

const logLevel: Level = (env.LOG_LEVEL as Level) ?? "info";

function buildLogger(): Logger {
  if (isProd) {
    return pino({
      level: logLevel,
      base: { service: "mytenant-invoice" },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        log(object: Record<string, unknown>): Record<string, unknown> {
          return redact(object) as Record<string, unknown>;
        },
        level(label: string): { level: string } {
          return { level: label };
        },
      },
      transport: {
        targets: [
          {
            target: "pino/file",
            options: { destination: 1 },
          },
        ],
      },
    });
  }

  return pino({
    level: logLevel,
    base: { service: "mytenant-invoice" },
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        singleLine: true,
        timestampKey: "time",
        translateTime: "SYS:standard",
        ignore: "pid,hostname,service",
      },
    },
  });
}

export const logger: Logger = buildLogger();

/**
 * Creates a child logger bound to a fixed context object.
 * The context is merged into every log line emitted by the child.
 *
 * @example
 * const invoiceLogger = createChildLogger({ orgId, invoiceId });
 * invoiceLogger.info("Invoice sent");
 */
export function createChildLogger(
  ctx: Record<string, unknown>
): Logger {
  return logger.child(ctx);
}

export default logger;
