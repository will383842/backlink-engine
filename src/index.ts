import "dotenv/config";

import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import session from "@fastify/session";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import { logger } from "./utils/logger.js";
import { prisma, disconnectDatabase } from "./config/database.js";
import { redis, disconnectRedis } from "./config/redis.js";

const log = logger;  // Alias for convenience

// ---------------------------------------------------------------------------
// Route plugins
// ---------------------------------------------------------------------------
import prospectsRoutes from "./api/routes/prospects.js";
import campaignsRoutes from "./api/routes/campaigns.js";
import { contactsRoutes } from "./api/routes/contacts.js";
import backlinksRoutes from "./api/routes/backlinks.js";
import assetsRoutes from "./api/routes/assets.js";
import templatesRoutes from "./api/routes/templates.js";
import { messageTemplatesRoutes } from "./api/routes/messageTemplates.js";
import dashboardRoutes from "./api/routes/dashboard.js";
import suppressionRoutes from "./api/routes/suppression.js";
import settingsRoutes from "./api/routes/settings.js";
import repliesRoutes from "./api/routes/replies.js";
import reportsRoutes from "./api/routes/reports.js";
import ingestRoutes from "./api/routes/ingest.js";
import webhooksRoutes from "./api/routes/webhooks.js";
import trackingRoutes from "./api/routes/tracking.js";
import mailboxRoutes from "./api/routes/mailbox.js";
import mailboxesRoutes from "./api/routes/mailboxes.js";
import vpsHealthRoutes from "./api/routes/vpsHealth.js";
import authRoutes from "./api/routes/auth.js";
import tagsRoutes from "./api/routes/tags.js";
import crawlingRoutes from "./api/routes/crawling.js";
import contactTypeMappingsRoutes from "./api/routes/contactTypeMappings.js";
import targetPagesRoutes from "./api/routes/targetPages.js";
import sentEmailsRoutes from "./api/routes/sentEmails.js";
import broadcastRoutes from "./api/routes/broadcast.js";
import unsubscribeRoutes from "./api/routes/unsubscribe.js";
import { registerJwt } from "./api/middleware/auth.js";
import { resetLlmClient } from "./llm/index.js";

// ---------------------------------------------------------------------------
// BullMQ queues, cron scheduler & workers
// ---------------------------------------------------------------------------
import { setupQueues, closeQueues } from "./jobs/queue.js";
import { setupCronJobs } from "./jobs/schedulers/cronScheduler.js";
import { startEnrichmentWorker } from "./jobs/workers/enrichmentWorker.js";
import { startAutoEnrollmentWorker } from "./jobs/workers/autoEnrollmentWorker.js";
import { startOutreachWorker } from "./jobs/workers/outreachWorker.js";
import { startReplyWorker } from "./jobs/workers/replyWorker.js";
import { startVerificationWorker } from "./jobs/workers/verificationWorker.js";
import { startReportingWorker } from "./jobs/workers/reportingWorker.js";
import { startSequenceWorker } from "./jobs/workers/sequenceWorker.js";
import { startCrawlingWorker } from "./jobs/workers/crawlingWorker.js";
import { startBroadcastWorker } from "./jobs/workers/broadcastWorker.js";

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

// Strict env-var validation in production — fail fast on misconfig
const isProduction = process.env.NODE_ENV === "production";
const corsOrigin = process.env.CORS_ORIGIN;
const sessionSecret = process.env.SESSION_SECRET;
const jwtSecret = process.env.JWT_SECRET;

if (isProduction) {
  const missing: string[] = [];
  if (!corsOrigin) missing.push("CORS_ORIGIN");
  if (!sessionSecret) missing.push("SESSION_SECRET");
  if (!jwtSecret) missing.push("JWT_SECRET");
  if (missing.length > 0) {
    log.fatal({ missing }, "Refusing to start: missing required env vars in production");
    throw new Error(`Missing required env vars in production: ${missing.join(", ")}`);
  }
}

await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: "same-origin" },
});

await app.register(cors, {
  origin: corsOrigin
    ? (origin, callback) => {
        const allowedOrigins = corsOrigin.split(",").map((o) => o.trim());
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          log.warn({ origin, allowedOrigins }, "CORS request from unauthorized origin");
          callback(new Error("Not allowed by CORS"), false);
        }
      }
    : true, // dev only — in prod we throw above if missing
  credentials: true,
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  redis,
  // Never rate-limit tracking pixel: email clients behind corporate NAT can
  // open many emails from the same IP, and Apple MailPrivacyProtection proxies
  // all opens through a few Apple IPs.
  allowList: (request) =>
    request.url.startsWith("/api/track/") ||
    request.url === "/api/health",
});

// Cookie support
await app.register(cookie);

// Session management with simple in-memory store (Redis store requires connect-redis)
// For production Redis store, install @fastify/session-redis-store
await app.register(session, {
  secret: sessionSecret || "backlink-engine-dev-secret-do-not-use-in-prod",
  cookieName: "sessionId",
  cookie: {
    secure: isProduction,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    sameSite: isProduction ? "strict" : "lax",
  },
  saveUninitialized: false,
});

// JWT authentication (kept for backward compatibility, but sessions are preferred)
await registerJwt(app);

// ---- Global error handler -------------------------------------------------

app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, request, reply) => {
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

  // Any error carrying an explicit HTTP status code (rate-limit 429,
  // validation 400, auth 401, etc.) — forward it unchanged instead of
  // masquerading as 500.
  if (typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 600) {
    const name =
      error.statusCode === 400
        ? "Bad Request"
        : error.statusCode === 401
          ? "Unauthorized"
          : error.statusCode === 403
            ? "Forbidden"
            : error.statusCode === 404
              ? "Not Found"
              : error.statusCode === 429
                ? "Too Many Requests"
                : "Error";
    return reply.status(error.statusCode).send({
      statusCode: error.statusCode,
      error: name,
      message: error.message,
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
await app.register(trackingRoutes, { prefix: "/api/track" }); // Public: email tracking pixel
await app.register(ingestRoutes, { prefix: "/api/ingest" });
await app.register(unsubscribeRoutes, { prefix: "/api" }); // Public: /api/unsubscribe (no auth)

// Protected (require JWT)
await app.register(prospectsRoutes, { prefix: "/api/prospects" });
await app.register(campaignsRoutes, { prefix: "/api/campaigns" });
await app.register(contactsRoutes, { prefix: "/api/contacts" });
await app.register(backlinksRoutes, { prefix: "/api/backlinks" });
await app.register(assetsRoutes, { prefix: "/api/assets" });
await app.register(templatesRoutes, { prefix: "/api/templates" });
await app.register(messageTemplatesRoutes, { prefix: "/api/message-templates" });
await app.register(tagsRoutes, { prefix: "/api/tags" });
await app.register(dashboardRoutes, { prefix: "/api/dashboard" });
await app.register(suppressionRoutes, { prefix: "/api/suppression" });
await app.register(settingsRoutes, { prefix: "/api/settings" });
await app.register(repliesRoutes, { prefix: "/api/replies" });
await app.register(reportsRoutes, { prefix: "/api/reports" });
await app.register(crawlingRoutes, { prefix: "/api/crawl-sources" });
await app.register(contactTypeMappingsRoutes, { prefix: "/api/contact-type-mappings" });
await app.register(targetPagesRoutes, { prefix: "/api/target-pages" });
await app.register(sentEmailsRoutes, { prefix: "/api/sent-emails" });
await app.register(mailboxRoutes, { prefix: "/api/mailbox" });
await app.register(mailboxesRoutes, { prefix: "/api/mailboxes" });
await app.register(vpsHealthRoutes, { prefix: "/api/vps-health" });
await app.register(broadcastRoutes, { prefix: "/api/broadcast" });

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

  // Load AI settings from DB and initialise LLM client
  try {
    const aiRow = await prisma.appSetting.findUnique({ where: { key: "ai" } });
    if (aiRow) {
      const ai = aiRow.value as Record<string, unknown>;
      resetLlmClient({
        apiKey: (ai.apiKey as string) || undefined,
        enabled: ai.enabled !== false,
      });
    }
  } catch {
    // Table might not exist yet (first run before migration)
    logger.warn("Could not load AI settings from DB, using env defaults.");
  }
  logger.info("LLM client initialised.");

  // Verify SMTP connectivity (primary email sender: Postfix → OpenDKIM → PowerMTA)
  try {
    const { checkSmtpHealth } = await import("./services/outreach/smtpSender.js");
    const smtpOk = await checkSmtpHealth();
    if (smtpOk) {
      logger.info("✅ SMTP connected (Postfix → OpenDKIM → PowerMTA) — emails will be sent via SMTP.");
    } else {
      logger.warn("⚠️  SMTP not reachable — will fallback to Email-Engine API or MailWizz.");
    }
  } catch (err) {
    logger.warn({ err }, "Could not verify SMTP connectivity.");
  }

  // Verify Email-Engine connectivity (fallback)
  try {
    const { getEmailEngineClient } = await import("./services/outreach/emailEngineClient.js");
    const emailEngine = getEmailEngineClient();
    if (emailEngine.isConfigured()) {
      const health = await emailEngine.healthCheck();
      if (health.ok) {
        logger.info("✅ Email-Engine API connected (fallback).");
      } else {
        logger.warn({ error: health.error }, "⚠️  Email-Engine API not reachable.");
      }
    } else {
      logger.info("Email-Engine not configured — SMTP is primary.");
    }
  } catch (err) {
    logger.warn({ err }, "Could not verify Email-Engine connectivity.");
  }

  // Verify MailWizz connectivity (fallback)
  try {
    const mwConfig = await import("./config/mailwizz.js");
    if (mwConfig.mailwizzConfig.apiUrl && mwConfig.mailwizzConfig.apiKey) {
      const { MailWizzClient } = await import("./services/outreach/mailwizzClient.js");
      const mw = new MailWizzClient(mwConfig.mailwizzConfig.apiUrl, mwConfig.mailwizzConfig.apiKey);
      const health = await mw.healthCheck();
      if (health.ok) {
        logger.info("MailWizz API connected and healthy.");
      } else {
        logger.warn({ error: health.error }, "⚠️  MailWizz API not reachable — emails will NOT be sent until this is fixed.");
      }
    } else {
      logger.warn("⚠️  MailWizz not configured (MAILWIZZ_API_URL / MAILWIZZ_API_KEY missing). Email sending disabled.");
    }
  } catch (err) {
    logger.warn({ err }, "Could not verify MailWizz connectivity.");
  }

  // Initialise BullMQ queues (must happen before cron jobs or workers)
  setupQueues();
  logger.info("BullMQ queues initialised.");

  // Setup BullMQ cron jobs
  await setupCronJobs();
  logger.info("Cron jobs scheduled.");

  // Start all BullMQ workers
  startEnrichmentWorker();
  startAutoEnrollmentWorker();
  startOutreachWorker();
  startReplyWorker();
  startVerificationWorker();
  startReportingWorker();
  startSequenceWorker();
  startCrawlingWorker();
  startBroadcastWorker();
  logger.info("All BullMQ workers started.");

  await app.listen({ port: PORT, host: HOST });
  logger.info(`Backlink Engine server listening on http://${HOST}:${PORT}`);
} catch (err) {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
}

export { app };
