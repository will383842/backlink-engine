import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "../../config/database.js";
import { authenticateUser } from "../middleware/auth.js";
import { redis } from "../../config/redis.js";

// ─────────────────────────────────────────────────────────────
// Request types
// ─────────────────────────────────────────────────────────────

interface LoginBody {
  email: string;
  password: string;
}

interface RegisterBody {
  email: string;
  password: string;
  name: string;
}

// ─────────────────────────────────────────────────────────────
// Plugin
// ─────────────────────────────────────────────────────────────

export default async function authRoutes(app: FastifyInstance): Promise<void> {

  // ───── POST /login ─── Authenticate and return JWT ───────
  app.post<{ Body: LoginBody }>(
    "/login",
    {
      config: {
        rateLimit: { max: 10, timeWindow: "1 minute" },
      },
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              token: { type: "string" },
              user: {
                type: "object",
                properties: {
                  id: { type: "integer" },
                  email: { type: "string" },
                  name: { type: "string" },
                  role: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (!user) {
        return reply.status(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "Invalid email or password",
        });
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        return reply.status(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "Invalid email or password",
        });
      }

      const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      const token = app.jwt.sign(payload);

      return reply.send({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    },
  );

  // ───── POST /logout ─── Logout (JWT blacklist) ──────────
  app.post(
    "/logout",
    {
      preHandler: [authenticateUser],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // FIX: Implement JWT blacklist with Redis
      const token = request.headers.authorization?.split(" ")[1];

      if (token) {
        try {
          // Decode token to get expiration time
          const decoded = app.jwt.decode(token) as { exp: number } | null;

          if (decoded?.exp) {
            const ttl = decoded.exp - Math.floor(Date.now() / 1000);

            // Only blacklist if token hasn't expired yet
            if (ttl > 0) {
              await redis.setex(`jwt:blacklist:${token}`, ttl, "1");
            }
          }
        } catch (err) {
          // Token decode failed, skip blacklisting
        }
      }

      return reply.send({ message: "Logged out successfully" });
    },
  );

  // ───── POST /register ─── Register a new user ──────────
  // Allowed only if no users exist yet (first-user setup)
  // or if the caller is an authenticated admin.
  app.post<{ Body: RegisterBody }>(
    "/register",
    {
      config: {
        rateLimit: { max: 5, timeWindow: "1 minute" },
      },
      schema: {
        body: {
          type: "object",
          required: ["email", "password", "name"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            name: { type: "string", minLength: 1, maxLength: 200 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => {
      const { email, password, name } = request.body;

      const userCount = await prisma.user.count();
      const isFirstUser = userCount === 0;

      if (!isFirstUser) {
        // Require admin authentication for subsequent registrations
        try {
          await request.jwtVerify();
        } catch {
          return reply.status(401).send({
            statusCode: 401,
            error: "Unauthorized",
            message: "Authentication required to register new users",
          });
        }

        if (request.user.role !== "admin") {
          return reply.status(403).send({
            statusCode: 403,
            error: "Forbidden",
            message: "Only admins can register new users",
          });
        }
      }

      // Check if email already taken
      const existing = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });
      if (existing) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: "A user with that email already exists",
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          name,
          passwordHash,
          role: isFirstUser ? "admin" : "ops",
        },
      });

      const payload = { id: user.id, email: user.email, role: user.role };
      const token = app.jwt.sign(payload);

      return reply.status(201).send({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    },
  );

  // ───── GET /me ─── Return current user info ────────────
  app.get(
    "/me",
    { preHandler: [authenticateUser] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user.id },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      });

      if (!user) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "User not found",
        });
      }

      return reply.send({ data: user });
    },
  );
}
