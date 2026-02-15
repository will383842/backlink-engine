import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { preHandlerHookHandler } from "fastify";
import { redis } from "../../config/redis.js";

// ─────────────────────────────────────────────────────────────
// Augment Fastify request with user payload after JWT verification
// ─────────────────────────────────────────────────────────────

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: number; email: string; role: string };
    user: { id: number; email: string; role: string };
  }
}

// ─────────────────────────────────────────────────────────────
// Session-based user authentication (simple cookie-based auth)
// ─────────────────────────────────────────────────────────────

/**
 * Fastify preHandler that validates a user session and populates `request.user`.
 *
 * Usage:
 *   fastify.addHook("preHandler", authenticateUser);
 *   // or per-route:
 *   { preHandler: [authenticateUser] }
 */
export const authenticateUser: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  // Check for session first (preferred method)
  const sessionUser = (request.session as any).user;

  if (sessionUser) {
    // Session exists - attach user to request
    request.user = sessionUser;
    return;
  }

  // Fallback to JWT for backward compatibility
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      await request.jwtVerify();

      // Check JWT blacklist
      const token = authHeader.split(" ")[1];
      if (token) {
        const isBlacklisted = await redis.exists(`jwt:blacklist:${token}`);
        if (isBlacklisted) {
          return reply.status(401).send({
            statusCode: 401,
            error: "Unauthorized",
            message: "Token has been revoked",
          });
        }
      }
      return; // JWT is valid
    } catch (err) {
      // JWT verification failed, continue to 401
    }
  }

  // No valid session or JWT
  return reply.status(401).send({
    statusCode: 401,
    error: "Unauthorized",
    message: "Authentication required",
  });
};

// ─────────────────────────────────────────────────────────────
// API-key authentication for machine-to-machine endpoints (ingest)
// ─────────────────────────────────────────────────────────────

/**
 * Fastify preHandler that validates the X-Api-Key header against
 * the INGEST_API_KEY environment variable.
 *
 * Usage:
 *   { preHandler: [authenticateApiKey] }
 */
export const authenticateApiKey: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const expectedKey = process.env["INGEST_API_KEY"];
  if (!expectedKey) {
    request.log.error("INGEST_API_KEY is not configured on the server");
    return reply.status(500).send({
      statusCode: 500,
      error: "Internal Server Error",
      message: "Ingest API key not configured",
    });
  }

  const providedKey = request.headers["x-api-key"];
  if (!providedKey || providedKey !== expectedKey) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Invalid or missing API key",
    });
  }
};

// ─────────────────────────────────────────────────────────────
// Webhook shared-secret authentication
// ─────────────────────────────────────────────────────────────

/**
 * Fastify preHandler that validates the x-webhook-secret header
 * against the MAILWIZZ_WEBHOOK_SECRET environment variable.
 *
 * Usage:
 *   { preHandler: [authenticateWebhook] }
 */
export const authenticateWebhook: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const expectedSecret = process.env["MAILWIZZ_WEBHOOK_SECRET"];
  if (!expectedSecret) {
    request.log.error("MAILWIZZ_WEBHOOK_SECRET is not configured on the server");
    return reply.status(500).send({
      statusCode: 500,
      error: "Internal Server Error",
      message: "Webhook secret not configured",
    });
  }

  const providedSecret = request.headers["x-webhook-secret"];
  if (!providedSecret || providedSecret !== expectedSecret) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Invalid or missing webhook secret",
    });
  }
};

// ─────────────────────────────────────────────────────────────
// Param parsing helper
// ─────────────────────────────────────────────────────────────

/**
 * Parse a route :id parameter to a number, throwing a 400 if
 * the value is not a valid integer.
 *
 * @example
 *   const id = parseIdParam(request.params.id); // throws 400 on NaN
 */
export function parseIdParam(raw: string): number {
  const id = parseInt(raw, 10);
  if (Number.isNaN(id)) {
    const err = new Error(`Invalid ID parameter: "${raw}"`);
    (err as NodeJS.ErrnoException & { statusCode: number }).statusCode = 400;
    throw err;
  }
  return id;
}

// ─────────────────────────────────────────────────────────────
// Plugin: register @fastify/jwt with the shared JWT_SECRET
// ─────────────────────────────────────────────────────────────

/**
 * Call once during server bootstrap to register the @fastify/jwt plugin.
 *
 * ```ts
 * import { registerJwt } from "./api/middleware/auth.js";
 * await registerJwt(app);
 * ```
 */
export async function registerJwt(app: FastifyInstance): Promise<void> {
  const secret = process.env["JWT_SECRET"];
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  // Validate JWT secret strength (warnings instead of errors for flexibility)
  if (secret.length < 32) {
    console.warn(
      "⚠️  JWT_SECRET is short (" + secret.length + " chars). " +
      "Recommended: min 32 characters for production. " +
      "Generate with: openssl rand -base64 48"
    );
  }

  if (
    secret.includes("change-me") ||
    secret.includes("your-secret") ||
    secret === "secret"
  ) {
    console.warn(
      "⚠️  JWT_SECRET looks like a default value. " +
      "Change it for production! Generate with: openssl rand -base64 48"
    );
  }

  await app.register(import("@fastify/jwt"), {
    secret,
    sign: { expiresIn: "24h" },
  });
}
