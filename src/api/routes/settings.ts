import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser } from "../middleware/auth.js";
import { resetLlmClient } from "../../llm/index.js";

// ─────────────────────────────────────────────────────────────
// AppSetting – key/value JSON store
// ─────────────────────────────────────────────────────────────

const DEFAULTS: Record<string, unknown> = {
  mailwizz: { apiUrl: "", apiKey: "", listUids: {} },
  imap: { host: "", port: 993, user: "", pass: "" },
  scoring: { minScoreForContact: 40, minDaForContact: 10, neighborhoodThreshold: 30 },
  recontact: { delayMonths: 6, maxRecontacts: 3, minScoreForRecontact: 50 },
  ai: { enabled: true, provider: "openai", apiKey: "" },
};

export default async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // ───── GET / ─── Return all settings ──────────────────────
  app.get("/", async (_request, reply) => {
    const rows = await prisma.appSetting.findMany();

    const settings: Record<string, unknown> = { ...DEFAULTS };
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    return reply.send({ data: settings });
  });

  // ───── PUT / ─── Upsert settings ─────────────────────────
  app.put(
    "/",
    {
      schema: {
        body: { type: "object" },
      },
    },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;

      const ops = Object.entries(body).map(([key, value]) =>
        prisma.appSetting.upsert({
          where: { key },
          create: { key, value: value as import("@prisma/client").Prisma.InputJsonValue },
          update: { value: value as import("@prisma/client").Prisma.InputJsonValue },
        }),
      );

      await prisma.$transaction(ops);

      // Reset LLM client if AI settings changed
      if (body.ai) {
        const ai = body.ai as Record<string, unknown>;
        resetLlmClient({
          apiKey: (ai.apiKey as string) || undefined,
          enabled: ai.enabled !== false,
        });
      }

      return reply.send({ data: body });
    },
  );
}
