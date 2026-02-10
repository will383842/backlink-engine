import "dotenv/config";

import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { logger } from "./utils/logger.js";
import { prisma, disconnectDatabase } from "./config/database.js";
import { redis, disconnectRedis } from "./config/redis.js";

// ---------------------------------------------------------------------------
// Route plugins
// ---------------------------------------------------------------------------
import prospectsRoutes from "./api/routes/prospects.js";
import campaignsRoutes from "./api/routes/campaigns.js";
import contactsRoutes from "./api/routes/contacts.js";
import backlinksRoutes from "./api/routes/backlinks.js";
import assetsRoutes from "./api/routes/assets.js";
import templatesRoutes from "./api/routes/templates.js";
import dashboardRoutes from "./api/routes/dashboard.js";
import suppressionRoutes from "./api/routes/suppression.js";
import ingestRoutes from "./api/routes/ingest.js";
import webhooksRoutes from "./api/routes/webhooks.js";
import authRoutes from "./api/routes/auth.js";
import { registerJwt } from "./api/middleware/auth.js";

// ---------------------------------------------------------------------------
// BullMQ queues, cron scheduler & workers
// ---------------------------------------------------------------------------
import { setupQueues, closeQueues } from "./jobs/queue.js";
import { setupCronJobs } from "./jobs/schedulers/cronScheduler.js";
import { startEnrichmentWorker } from "./jobs/workers/enrichmentWorker.js";
import { startOutreachWorker } from "./jobs/workers/outreachWorker.js";
import { startReplyWorker } from "./jobs/workers/replyWorker.js";
import { startVerificationWorker } from "./jobs/workers/verificationWorker.js";
import { startReportingWorker } from "./jobs/workers/reportingWorker.js";

// ---------------------------------------------------------------------------
// Fastify instance
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

const app = Fastify({
  logger: false, // we use our own pino instance
  trustProxy: true,
});

// ---- Plugins -------------------------------------------------------------

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? true,
  credentials: true,
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  redis,
});

// JWT authentication
await registerJwt(app);

// ---- Global error handler -------------------------------------------------

app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, request, reply) => {
  // Handle parseIdParam 400 errors
  if (error.statusCode === 400) {
    return reply.status(400).send({
      statusCode: 400,
      error: "Bad Request",
      message: error.message,
    });
  }

  // Prisma P2002: unique constraint violation → 409 Conflict
  if (error.code === "P2002") {
    return reply.status(409).send({
      statusCode: 409,
      error: "Conflict",
      message: "A record with that unique value already exists",
    });
  }

  // Prisma P2025: record not found → 404 Not Found
  if (error.code === "P2025") {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "The requested record was not found",
    });
  }

  // All other errors → 500
  const statusCode = reply.statusCode >= 400 ? reply.statusCode : 500;
  logger.error({ err: error, url: request.url, method: request.method }, "Unhandled error");

  const isProduction = process.env.NODE_ENV === "production";
  return reply.status(statusCode).send({
    statusCode,
    error: "Internal Server Error",
    message: isProduction ? "An internal error occurred" : error.message,
  });
});

// ---- Routes ---------------------------------------------------------------

// Public (no auth)
await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(webhooksRoutes, { prefix: "/api/webhooks" });
await app.register(ingestRoutes, { prefix: "/api/ingest" });

// Protected (require JWT)
await app.register(prospectsRoutes, { prefix: "/api/prospects" });
await app.register(campaignsRoutes, { prefix: "/api/campaigns" });
await app.register(contactsRoutes, { prefix: "/api/contacts" });
await app.register(backlinksRoutes, { prefix: "/api/backlinks" });
await app.register(assetsRoutes, { prefix: "/api/assets" });
await app.register(templatesRoutes, { prefix: "/api/templates" });
await app.register(dashboardRoutes, { prefix: "/api/dashboard" });
await app.register(suppressionRoutes, { prefix: "/api/suppression" });

// Health check
app.get("/api/health", async () => {
  let dbStatus = "connected";
  let redisStatus = "connected";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "disconnected";
  }

  try {
    await redis.ping();
  } catch {
    redisStatus = "disconnected";
  }

  const overallStatus =
    dbStatus === "connected" && redisStatus === "connected"
      ? "ok"
      : "degraded";

  return {
    status: overallStatus,
    db: dbStatus,
    redis: redisStatus,
    timestamp: new Date().toISOString(),
  };
});

// ---- Graceful shutdown ---------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  await app.close();
  await closeQueues();
  await disconnectDatabase();
  await disconnectRedis();
  logger.info("All connections closed. Exiting.");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

// ---- Start server --------------------------------------------------------

try {
  // Verify database connectivity
  await prisma.$connect();
  logger.info("Database connection verified.");

  // Verify Redis connectivity
  await redis.ping();
  logger.info("Redis connection verified.");

  // Initialise BullMQ queues (must happen before cron jobs or workers)
  setupQueues();
  logger.info("BullMQ queues initialised.");

  // Setup BullMQ cron jobs
  await setupCronJobs();
  logger.info("Cron jobs scheduled.");

  // Start all BullMQ workers
  startEnrichmentWorker();
  startOutreachWorker();
  startReplyWorker();
  startVerificationWorker();
  startReportingWorker();
  logger.info("All BullMQ workers started.");

  await app.listen({ port: PORT, host: HOST });
  logger.info(`Backlink Engine server listening on http://${HOST}:${PORT}`);
} catch (err) {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
}

export { app };
