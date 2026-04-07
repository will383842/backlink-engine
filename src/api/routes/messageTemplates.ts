// ─────────────────────────────────────────────────────────────
// Message Templates API Routes
// ─────────────────────────────────────────────────────────────

import { FastifyInstance } from "fastify";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { selectMessageTemplate } from "../../services/outreach/messageTemplateSelector.js";
import { authenticateUser } from "../middleware/auth.js";

const log = createChildLogger("message-templates-api");

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface UpdateTemplateBody {
  subject: string;
  body: string;
  category?: string | null;
  isDefault?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

export async function messageTemplatesRoutes(app: FastifyInstance) {
  // Require authentication for all message template routes
  app.addHook("preHandler", authenticateUser);

  /**
   * GET /
   * Get all message templates (9 languages)
   */
  app.get("/", async (request, reply) => {
    try {
      const templates = await prisma.messageTemplate.findMany({
        orderBy: { language: "asc" },
      });

      return reply.send({
        success: true,
        data: templates,
      });
    } catch (err) {
      log.error({ err }, "Failed to fetch message templates");
      return reply.status(500).send({
        success: false,
        error: "Failed to fetch message templates",
      });
    }
  });

  /**
   * GET /:language
   * Get templates for a specific language (all categories + general)
   * Query param: ?category=blogger (optional) to get specific category template
   */
  app.get<{ Params: { language: string }; Querystring: { category?: string } }>(
    "/:language",
    async (request, reply) => {
      const { language } = request.params;
      const { category } = request.query;

      try {
        if (category) {
          // Get specific category template
          const template = await prisma.messageTemplate.findUnique({
            where: {
              language_category: {
                language: language as any,
                category: category as any,
              },
            },
          });

          if (!template) {
            return reply.status(404).send({
              success: false,
              error: `Template not found for language: ${language}, category: ${category}`,
            });
          }

          return reply.send({
            success: true,
            data: template,
          });
        } else {
          // Get all templates for this language (general + all categories)
          const templates = await prisma.messageTemplate.findMany({
            where: { language: language as any },
            orderBy: [
              { category: "asc" },  // NULL (general) first
            ],
          });

          return reply.send({
            success: true,
            data: templates,
          });
        }
      } catch (err) {
        log.error({ err, language, category }, "Failed to fetch template");
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch template",
        });
      }
    }
  );

  /**
   * PUT /:language
   * Create or update template for a specific language + category
   * Query param: ?category=blogger (optional) to update category-specific template
   */
  app.put<{
    Params: { language: string };
    Querystring: { category?: string };
    Body: UpdateTemplateBody;
  }>(
    "/:language",
    async (request, reply) => {
      const { language } = request.params;
      const { category: queryCategory } = request.query;
      const { subject, body, category: bodyCategory, isDefault } = request.body;

      // Category from query OR body (query takes precedence)
      const category = queryCategory || bodyCategory || null;

      // Validation
      if (!subject || !body) {
        return reply.status(400).send({
          success: false,
          error: "Subject and body are required",
        });
      }

      if (subject.length < 3 || subject.length > 200) {
        return reply.status(400).send({
          success: false,
          error: "Subject must be between 3 and 200 characters",
        });
      }

      if (body.length < 10 || body.length > 5000) {
        return reply.status(400).send({
          success: false,
          error: "Body must be between 10 and 5000 characters",
        });
      }

      try {
        const updated = await prisma.messageTemplate.upsert({
          where: {
            language_category: {
              language: language as any,
              category: category as any,
            },
          },
          update: {
            subject,
            body,
            isDefault: isDefault ?? false,
          },
          create: {
            language: language as any,
            category: category as any,
            subject,
            body,
            isDefault: isDefault ?? false,
          },
        });

        log.info({ language, category }, "Message template updated");

        return reply.send({
          success: true,
          data: updated,
        });
      } catch (err) {
        log.error({ err, language, category }, "Failed to update template");
        return reply.status(500).send({
          success: false,
          error: "Failed to update template",
        });
      }
    }
  );

  /**
   * POST /render
   * Render a template with variables
   */
  app.post<{
    Body: {
      language: string;
      variables: {
        siteName: string;
        yourName: string;
        yourCompany: string;
        yourWebsite: string;
      };
    };
  }>("/render", async (request, reply) => {
    const { language, variables } = request.body;

    if (!language || !variables) {
      return reply.status(400).send({
        success: false,
        error: "Language and variables are required",
      });
    }

    try {
      const template = await prisma.messageTemplate.findFirst({
        where: { language: language as any },
      });

      if (!template) {
        return reply.status(404).send({
          success: false,
          error: `Template not found for language: ${language}`,
        });
      }

      // Replace variables
      let renderedSubject = template.subject;
      let renderedBody = template.body;

      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{${key}}`;
        renderedSubject = renderedSubject.replaceAll(placeholder, value);
        renderedBody = renderedBody.replaceAll(placeholder, value);
      }

      return reply.send({
        success: true,
        data: {
          subject: renderedSubject,
          body: renderedBody,
        },
      });
    } catch (err) {
      log.error({ err, language }, "Failed to render template");
      return reply.status(500).send({
        success: false,
        error: "Failed to render template",
      });
    }
  });

  /**
   * POST /select
   * Intelligent template selection based on language, category, and tags
   */
  app.post<{
    Body: {
      language: string;
      prospectCategory?: string;
      prospectTags?: number[];
    };
  }>("/select", async (request, reply) => {
    const { language, prospectCategory, prospectTags } = request.body;

    if (!language) {
      return reply.status(400).send({
        success: false,
        error: "Language is required",
      });
    }

    try {
      const template = await selectMessageTemplate(language, {
        prospectCategory,
        prospectTags,
      });

      if (!template) {
        return reply.status(404).send({
          success: false,
          error: "No template found for the given criteria",
        });
      }

      return reply.send({
        success: true,
        template,
      });
    } catch (err) {
      log.error({ err, language, prospectCategory }, "Failed to select template");
      return reply.status(500).send({
        success: false,
        error: "Failed to select template",
      });
    }
  });
}
