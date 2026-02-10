import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Application-wide pino logger.
 *
 * - In development: pretty-printed with colours via pino-pretty.
 * - In production: structured JSON for log aggregation.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        },
      }),
  // Always include timestamp
  timestamp: pino.stdTimeFunctions.isoTime,
  // Base bindings included in every log line
  base: {
    service: "backlink-engine",
  },
});

/**
 * Create a child logger scoped to a specific module.
 *
 * @example
 * const log = createChildLogger("enrichment");
 * log.info("Starting enrichment pipeline");
 */
export function createChildLogger(module: string): pino.Logger {
  return logger.child({ module });
}
