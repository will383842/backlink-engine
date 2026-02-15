/**
 * Tags Management Routes
 * CRUD operations for tags + assignment to prospects/campaigns
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { TagCategory } from '@prisma/client';
import { authenticateUser } from '../middleware/auth.js';

// ─────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────

const CreateTagSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, 'Name must be lowercase alphanumeric with underscores'),
  label: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Must be valid hex color').default('#3B82F6'),
  category: z.nativeEnum(TagCategory).default('other'),
  isAutoTag: z.boolean().default(false),
});

const UpdateTagSchema = CreateTagSchema.partial();

const AssignTagsSchema = z.object({
  tagIds: z.array(z.number().int().positive()),
});

// ─────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────

export const tagsRoutes: FastifyPluginAsync = async (fastify) => {
  // Authentication required for all routes
  fastify.addHook("preHandler", authenticateUser);

  // ──────────────────────────────────────────────────────
  // GET /api/tags - List all tags
  // ──────────────────────────────────────────────────────
  fastify.get('/', {
    schema: {
      querystring: z.object({
        category: z.nativeEnum(TagCategory).optional(),
        search: z.string().optional(),
        includeStats: z.boolean().default(false),
      }),
    },
  }, async (request, reply) => {
    const { category, search, includeStats } = request.query as any;

    const where: any = {};
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { label: { contains: search, mode: 'insensitive' } },
      ];
    }

    const tags = await prisma.tag.findMany({
      where,
      include: includeStats ? {
        _count: {
          select: {
            prospects: true,
            campaigns: true,
          },
        },
      } : undefined,
      orderBy: [
        { category: 'asc' },
        { label: 'asc' },
      ],
    });

    return reply.send({
      tags,
      total: tags.length,
    });
  });

  // ──────────────────────────────────────────────────────
  // GET /api/tags/:id - Get single tag with details
  // ──────────────────────────────────────────────────────
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const tag = await prisma.tag.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            prospects: true,
            campaigns: true,
          },
        },
      },
    });

    if (!tag) {
      return reply.status(404).send({ error: 'Tag not found' });
    }

    return reply.send(tag);
  });

  // ──────────────────────────────────────────────────────
  // POST /api/tags - Create new tag
  // ──────────────────────────────────────────────────────
  fastify.post('/', {
    schema: {
      body: CreateTagSchema,
    },
  }, async (request, reply) => {
    const data = request.body as z.infer<typeof CreateTagSchema>;

    // Check if tag name already exists
    const existing = await prisma.tag.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      return reply.status(409).send({
        error: 'Tag name already exists',
        field: 'name',
      });
    }

    const tag = await prisma.tag.create({
      data: {
        name: data.name,
        label: data.label,
        description: data.description,
        color: data.color,
        category: data.category,
        isAutoTag: data.isAutoTag,
      },
    });

    return reply.status(201).send(tag);
  });

  // ──────────────────────────────────────────────────────
  // PATCH /api/tags/:id - Update tag
  // ──────────────────────────────────────────────────────
  fastify.patch('/:id', {
    schema: {
      body: UpdateTagSchema,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as z.infer<typeof UpdateTagSchema>;

    // Check if new name conflicts with existing
    if (data.name) {
      const existing = await prisma.tag.findFirst({
        where: {
          name: data.name,
          id: { not: parseInt(id) },
        },
      });

      if (existing) {
        return reply.status(409).send({
          error: 'Tag name already exists',
          field: 'name',
        });
      }
    }

    const tag = await prisma.tag.update({
      where: { id: parseInt(id) },
      data,
    });

    return reply.send(tag);
  });

  // ──────────────────────────────────────────────────────
  // DELETE /api/tags/:id - Delete tag
  // ──────────────────────────────────────────────────────
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Check if tag exists
    const tag = await prisma.tag.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            prospects: true,
            campaigns: true,
          },
        },
      },
    });

    if (!tag) {
      return reply.status(404).send({ error: 'Tag not found' });
    }

    // Warn if tag is in use
    const inUse = tag._count.prospects > 0 || tag._count.campaigns > 0;
    if (inUse) {
      // Could add a ?force=true query param to allow deletion anyway
      return reply.status(409).send({
        error: 'Tag is in use',
        usage: {
          prospects: tag._count.prospects,
          campaigns: tag._count.campaigns,
        },
        message: 'Remove tag from all prospects and campaigns before deleting',
      });
    }

    await prisma.tag.delete({
      where: { id: parseInt(id) },
    });

    return reply.status(204).send();
  });

  // ──────────────────────────────────────────────────────
  // POST /api/tags/prospects/:prospectId - Assign tags to prospect
  // ──────────────────────────────────────────────────────
  fastify.post('/prospects/:prospectId', {
    schema: {
      body: AssignTagsSchema,
    },
  }, async (request, reply) => {
    const { prospectId } = request.params as { prospectId: string };
    const { tagIds } = request.body as z.infer<typeof AssignTagsSchema>;

    // Verify prospect exists
    const prospect = await prisma.prospect.findUnique({
      where: { id: parseInt(prospectId) },
    });

    if (!prospect) {
      return reply.status(404).send({ error: 'Prospect not found' });
    }

    // Delete existing tags and create new ones (replace strategy)
    await prisma.$transaction([
      prisma.prospectTag.deleteMany({
        where: { prospectId: parseInt(prospectId) },
      }),
      prisma.prospectTag.createMany({
        data: tagIds.map(tagId => ({
          prospectId: parseInt(prospectId),
          tagId,
          assignedBy: 'manual', // Could be enhanced with user tracking
        })),
        skipDuplicates: true,
      }),
    ]);

    // Return updated tags
    const updatedTags = await prisma.prospectTag.findMany({
      where: { prospectId: parseInt(prospectId) },
      include: { tag: true },
    });

    return reply.send({
      prospectId: parseInt(prospectId),
      tags: updatedTags.map(pt => pt.tag),
    });
  });

  // ──────────────────────────────────────────────────────
  // POST /api/tags/campaigns/:campaignId - Assign tags to campaign
  // ──────────────────────────────────────────────────────
  fastify.post('/campaigns/:campaignId', {
    schema: {
      body: AssignTagsSchema,
    },
  }, async (request, reply) => {
    const { campaignId } = request.params as { campaignId: string };
    const { tagIds } = request.body as z.infer<typeof AssignTagsSchema>;

    // Verify campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: parseInt(campaignId) },
    });

    if (!campaign) {
      return reply.status(404).send({ error: 'Campaign not found' });
    }

    // Delete existing tags and create new ones (replace strategy)
    await prisma.$transaction([
      prisma.campaignTag.deleteMany({
        where: { campaignId: parseInt(campaignId) },
      }),
      prisma.campaignTag.createMany({
        data: tagIds.map(tagId => ({
          campaignId: parseInt(campaignId),
          tagId,
        })),
        skipDuplicates: true,
      }),
    ]);

    // Return updated tags
    const updatedTags = await prisma.campaignTag.findMany({
      where: { campaignId: parseInt(campaignId) },
      include: { tag: true },
    });

    return reply.send({
      campaignId: parseInt(campaignId),
      tags: updatedTags.map(ct => ct.tag),
    });
  });

};

export default tagsRoutes;
