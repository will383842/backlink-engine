import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser } from "../middleware/auth.js";

// ─────────────────────────────────────────────────────────────
// Global settings management
// ─────────────────────────────────────────────────────────────

export default async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // ───── GET / ─── List all settings ──────────────────────────
  app.get("/", async (request, reply) => {
    const settings = await prisma.appSetting.findMany({
      orderBy: { key: "asc" },
    });

    const data: Record<string, unknown> = {};
    for (const setting of settings) {
      data[setting.key] = setting.value;
    }

    return reply.send({ data });
  });

  // ───── GET /:key ─── Get a specific setting ─────────────────
  app.get<{ Params: { key: string } }>("/:key", async (request, reply) => {
    const { key } = request.params;

    const setting = await prisma.appSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: `Setting "${key}" not found`,
      });
    }

    return reply.send({ data: { key: setting.key, value: setting.value } });
  });

  // ───── PUT /:key ─── Update or create a setting ─────────────
  app.put<{
    Params: { key: string };
    Body: { value: unknown };
  }>(
    "/:key",
    {
      schema: {
        params: {
          type: "object",
          required: ["key"],
          properties: { key: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["value"],
          properties: { value: {} },
        },
      },
    },
    async (request, reply) => {
      const { key } = request.params;
      const { value } = request.body;

      // Upsert the setting
      const setting = await prisma.appSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });

      return reply.send({ data: { key: setting.key, value: setting.value } });
    },
  );

  // ───── GET /mailwizz ─── Get MailWizz configuration ──────────
  app.get("/mailwizz", async (request, reply) => {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "mailwizz" },
    });

    const defaultConfig = {
      enabled: false,
      dryRun: true,
      apiUrl: process.env.MAILWIZZ_API_URL || null,
      apiKey: process.env.MAILWIZZ_API_KEY ? "***" : null,
    };

    if (!setting) {
      return reply.send({ data: defaultConfig });
    }

    const config = setting.value as Record<string, unknown>;

    // Mask API key in response
    if (config.apiKey) {
      config.apiKey = "***";
    }

    return reply.send({ data: config });
  });

  // ───── PUT /mailwizz ─── Update MailWizz configuration ───────
  app.put<{
    Body: {
      enabled?: boolean;
      dryRun?: boolean;
      apiUrl?: string;
      apiKey?: string;
    };
  }>(
    "/mailwizz",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
            dryRun: { type: "boolean" },
            apiUrl: { type: "string" },
            apiKey: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const updates = request.body;

      // Get current config
      const setting = await prisma.appSetting.findUnique({
        where: { key: "mailwizz" },
      });

      const currentConfig = setting
        ? (setting.value as Record<string, unknown>)
        : {
            enabled: false,
            dryRun: true,
            apiUrl: process.env.MAILWIZZ_API_URL || null,
            apiKey: process.env.MAILWIZZ_API_KEY || null,
          };

      // Merge updates (don't update apiKey if "***" placeholder)
      if (updates.enabled !== undefined) currentConfig.enabled = updates.enabled;
      if (updates.dryRun !== undefined) currentConfig.dryRun = updates.dryRun;
      if (updates.apiUrl !== undefined) currentConfig.apiUrl = updates.apiUrl;
      if (updates.apiKey !== undefined && updates.apiKey !== "***") {
        currentConfig.apiKey = updates.apiKey;
      }

      // Save to DB
      await prisma.appSetting.upsert({
        where: { key: "mailwizz" },
        create: { key: "mailwizz", value: currentConfig },
        update: { value: currentConfig },
      });

      // Mask API key in response
      const responseConfig = { ...currentConfig };
      if (responseConfig.apiKey) {
        responseConfig.apiKey = "***";
      }

      return reply.send({ data: responseConfig });
    },
  );

  // ───── DELETE /:key ─── Delete a setting ────────────────────
  app.delete<{ Params: { key: string } }>("/:key", async (request, reply) => {
    const { key } = request.params;

    const existing = await prisma.appSetting.findUnique({ where: { key } });
    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: `Setting "${key}" not found`,
      });
    }

    await prisma.appSetting.delete({ where: { key } });

    return reply.status(204).send();
  });
}
