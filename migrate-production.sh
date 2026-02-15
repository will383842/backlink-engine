#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Migration Script - Production (Hetzner VPS)
# ─────────────────────────────────────────────────────────────
# Execute migrations on production server without full redeploy
# Usage: ./migrate-production.sh
# ─────────────────────────────────────────────────────────────

set -e

echo "🚀 Backlink Engine - Migration 2026-02-15 (PRODUCTION)"
echo "========================================================="
echo ""

# ──────────────────────────────────────────────────────────────
# 1. VÉRIFICATIONS PRÉ-MIGRATION
# ──────────────────────────────────────────────────────────────

echo "📋 [1/3] Vérifications..."

# Vérifier que Docker Compose est disponible
if ! command -v docker &> /dev/null || ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose n'est pas disponible !"
    exit 1
fi

# Vérifier que le container PostgreSQL tourne
if ! docker compose ps | grep -q "bl-postgres.*running"; then
    echo "❌ Container PostgreSQL non démarré !"
    echo ""
    echo "Démarrez-le avec : docker compose up -d postgres"
    exit 1
fi

echo "✅ Vérifications OK"
echo ""

# ──────────────────────────────────────────────────────────────
# 2. EXÉCUTION DES MIGRATIONS SQL
# ──────────────────────────────────────────────────────────────

echo "📝 [2/3] Exécution des migrations SQL..."
echo ""

# Migration 1/4
echo "[1/4] Migration timezone + firstName/lastName..."
docker compose exec -T postgres psql -U backlink -d backlink_engine < prisma/migrations/20260215_add_timezone_firstname_lastname/migration.sql

if [ $? -ne 0 ]; then
    echo "❌ Migration 1/4 échouée !"
    exit 1
fi
echo "✅ Migration 1/4 complétée"
echo ""

# Migration 2/4
echo "[2/4] Migration Tags System..."
docker compose exec -T postgres psql -U backlink -d backlink_engine < prisma/migrations/20260215_add_tags_system/migration.sql

if [ $? -ne 0 ]; then
    echo "❌ Migration 2/4 échouée !"
    exit 1
fi
echo "✅ Migration 2/4 complétée"
echo ""

# Migration 3/4
echo "[3/4] Migration Contact Forms + Message Templates..."
docker compose exec -T postgres psql -U backlink -d backlink_engine < prisma/migrations/20260215_add_contact_form_detection_and_templates/migration.sql

if [ $? -ne 0 ]; then
    echo "❌ Migration 3/4 échouée !"
    exit 1
fi
echo "✅ Migration 3/4 complétée"
echo ""

# Migration 4/4
echo "[4/4] Migration Impactful Templates (blogger, media, influencer...)"
docker compose exec -T postgres psql -U backlink -d backlink_engine < prisma/migrations/20260215_add_impactful_category_templates/migration.sql

if [ $? -ne 0 ]; then
    echo "❌ Migration 4/4 échouée !"
    exit 1
fi
echo "✅ Migration 4/4 complétée"
echo ""

# ──────────────────────────────────────────────────────────────
# 3. VÉRIFICATIONS POST-MIGRATION
# ──────────────────────────────────────────────────────────────

echo "🔍 [3/3] Vérifications post-migration..."
echo ""

# Vérifier nouvelles colonnes
echo "Vérification des colonnes ajoutées :"
docker compose exec -T postgres psql -U backlink -d backlink_engine -c "SELECT column_name, data_type, table_name FROM information_schema.columns WHERE table_name IN ('prospects', 'contacts') AND column_name IN ('timezone', 'firstName', 'lastName', 'contactFormFields', 'hasCaptcha') ORDER BY table_name, column_name;"

echo ""

# Vérifier templates de messages
echo "Vérification des templates de messages :"
docker compose exec -T postgres psql -U backlink -d backlink_engine -c "SELECT language, category, LEFT(subject, 50) as subject_preview FROM message_templates ORDER BY language, category;"

echo ""

# Redémarrer le worker d'enrichissement
echo "🔄 Redémarrage du worker d'enrichissement..."
docker compose restart worker-enrichment 2>/dev/null || echo "⚠️  worker-enrichment non configuré (OK)"

echo ""

# ──────────────────────────────────────────────────────────────
# SUCCÈS
# ──────────────────────────────────────────────────────────────

echo "✅ ════════════════════════════════════════════════════════"
echo "✅  MIGRATIONS APPLIQUÉES AVEC SUCCÈS !"
echo "✅ ════════════════════════════════════════════════════════"
echo ""
echo "Prochaines étapes :"
echo "  1. Tester l'ajout d'un prospect avec firstName/lastName"
echo "  2. Vérifier la détection de timezone"
echo "  3. Tester la validation d'email"
echo "  4. Tester la détection de formulaires de contact"
echo "  5. Éditer les templates de messages dans l'admin UI"
echo ""
echo "🔗 Interface admin : https://backlinks.life-expat.com/message-templates"
echo ""
