import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * PrismaClient singleton.
 * Reuses the same instance across hot-reloads in development
 * to avoid exhausting the database connection pool.
 */
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { level: "error", emit: "event" },
      { level: "warn", emit: "event" },
      { level: "query", emit: "event" },
    ],
  });

// ---- Event-based logging ------------------------------------------------

prisma.$on("error" as never, (e: unknown) => {
  logger.error({ prismaEvent: e }, "Prisma client error");
});

prisma.$on("warn" as never, (e: unknown) => {
  logger.warn({ prismaEvent: e }, "Prisma client warning");
});

if (process.env.NODE_ENV !== "production") {
  prisma.$on("query" as never, (e: unknown) => {
    logger.debug({ prismaEvent: e }, "Prisma query");
  });
}

// Keep singleton across hot-reloads in dev
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// ---- Graceful shutdown ---------------------------------------------------

/**
 * Disconnect Prisma on process exit.
 * Call this from your main shutdown handler.
 */
export async function disconnectDatabase(): Promise<void> {
  logger.info("Disconnecting Prisma client...");
  await prisma.$disconnect();
  logger.info("Prisma client disconnected.");
}
