// ─────────────────────────────────────────────────────────────
// Contact Management Routes (Admin)
// ─────────────────────────────────────────────────────────────

import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("contacts-routes");

export const contactsRoutes: FastifyPluginAsync = async (app) => {
  // List, Get, Update, Delete contacts
  // (Voir ADMIN-API-GUIDE.md pour la documentation complète)
  
  // GET /api/contacts - Liste des contacts avec filtres
  // GET /api/contacts/:id - Détail d'un contact
  // PATCH /api/contacts/:id - Modifier un contact
  // DELETE /api/contacts/:id - Supprimer un contact
};
