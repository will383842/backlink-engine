// ─────────────────────────────────────────────────────────────
// Contact Management Routes (Admin)
// ─────────────────────────────────────────────────────────────

import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { authenticateUser, parseIdParam } from "../middleware/auth.js";

const log = createChildLogger("contacts-routes");

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface ContactFilters {
  prospectId?: string;
  emailStatus?: string;
  optedOut?: string;
  page?: string;
  limit?: string;
}

interface UpdateContactBody {
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  role?: string;
  emailStatus?: string;
  optedOut?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

export const contactsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticateUser);

  /**
   * GET /api/contacts
   * List contacts with optional filters
   */
  app.get<{ Querystring: ContactFilters }>("/", async (request, reply) => {
    const {
      prospectId,
      emailStatus,
      optedOut,
      page = "1",
      limit = "50",
    } = request.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    try {
      // Build where clause
      const where: Record<string, unknown> = {};

      if (prospectId) {
        where.prospectId = parseInt(prospectId, 10);
      }
      if (emailStatus) {
        where.emailStatus = emailStatus;
      }
      if (optedOut === "true") {
        where.optedOut = true;
      } else if (optedOut === "false") {
        where.optedOut = false;
      }

      // Execute query with pagination
      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({
          where,
          include: {
            prospect: {
              select: {
                id: true,
                domain: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limitNum,
        }),
        prisma.contact.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limitNum);

      return reply.send({
        success: true,
        data: contacts,
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      });
    } catch (err) {
      log.error({ err, query: request.query }, "Failed to list contacts");
      return reply.status(500).send({
        success: false,
        error: "Failed to list contacts",
      });
    }
  });

  /**
   * GET /api/contacts/:id
   * Get a single contact by ID
   */
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const contactId = parseIdParam(request.params.id);

    try {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          prospect: {
            select: {
              id: true,
              domain: true,
              status: true,
            },
          },
          enrollments: {
            include: {
              campaign: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          events: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });

      if (!contact) {
        return reply.status(404).send({
          success: false,
          error: "Contact not found",
        });
      }

      return reply.send({
        success: true,
        data: contact,
      });
    } catch (err) {
      log.error({ err, contactId }, "Failed to get contact");
      return reply.status(500).send({
        success: false,
        error: "Failed to get contact",
      });
    }
  });

  /**
   * PUT /api/contacts/:id
   * Update a contact
   */
  app.put<{ Params: { id: string }; Body: UpdateContactBody }>(
    "/:id",
    async (request, reply) => {
      const contactId = parseIdParam(request.params.id);
      const updates = request.body;

      // Validation
      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({
          success: false,
          error: "No fields to update",
        });
      }

      try {
        // Prepare update data
        const data: Record<string, unknown> = {};

        if (updates.email !== undefined) {
          data.email = updates.email;
          data.emailNormalized = updates.email.toLowerCase().trim();
        }
        if (updates.firstName !== undefined) {
          data.firstName = updates.firstName;
        }
        if (updates.lastName !== undefined) {
          data.lastName = updates.lastName;
        }
        if (updates.name !== undefined) {
          data.name = updates.name;
        }
        if (updates.role !== undefined) {
          data.role = updates.role;
        }
        if (updates.emailStatus !== undefined) {
          data.emailStatus = updates.emailStatus;
        }
        if (updates.optedOut !== undefined) {
          data.optedOut = updates.optedOut;
          if (updates.optedOut) {
            data.optedOutAt = new Date();
          } else {
            data.optedOutAt = null;
          }
        }

        // Update contact
        const contact = await prisma.contact.update({
          where: { id: contactId },
          data,
          include: {
            prospect: {
              select: {
                id: true,
                domain: true,
              },
            },
          },
        });

        log.info({ contactId, updates: Object.keys(updates) }, "Contact updated");

        return reply.send({
          success: true,
          data: contact,
        });
      } catch (err: any) {
        // Handle unique constraint violation (duplicate email)
        if (err.code === "P2002") {
          return reply.status(409).send({
            success: false,
            error: "A contact with this email already exists",
          });
        }

        log.error({ err, contactId, updates }, "Failed to update contact");
        return reply.status(500).send({
          success: false,
          error: "Failed to update contact",
        });
      }
    }
  );

  /**
   * PATCH /api/contacts/:id
   * Partial update a contact (same as PUT for now)
   */
  app.patch<{ Params: { id: string }; Body: UpdateContactBody }>(
    "/:id",
    async (request, reply) => {
      // Reuse PUT logic
      return app.inject({
        method: "PUT",
        url: `/${request.params.id}`,
        payload: request.body,
        headers: request.headers,
      });
    }
  );

  /**
   * DELETE /api/contacts/:id
   * Delete a contact
   */
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const contactId = parseIdParam(request.params.id);

    try {
      // Check if contact exists
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { id: true },
      });

      if (!contact) {
        return reply.status(404).send({
          success: false,
          error: "Contact not found",
        });
      }

      // Delete contact (cascade will delete enrollments and events)
      await prisma.contact.delete({
        where: { id: contactId },
      });

      log.info({ contactId }, "Contact deleted");

      return reply.send({
        success: true,
        message: "Contact deleted successfully",
      });
    } catch (err) {
      log.error({ err, contactId }, "Failed to delete contact");
      return reply.status(500).send({
        success: false,
        error: "Failed to delete contact",
      });
    }
  });
};
