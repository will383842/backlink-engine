#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Migration Script - Backlink Engine (2026-02-15)
# ─────────────────────────────────────────────────────────────

set -e  # Exit on error

echo "🚀 Backlink Engine - Migration 2026-02-15"
echo "=========================================="
echo ""

# Check if docker compose is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker command not found in PATH"
    echo ""
    echo "Please run this script from:"
    echo "  - PowerShell (docker must be installed)"
    echo "  - WSL (docker must be installed)"
    echo "  - Or run the migration manually (see migrate.sql)"
    exit 1
fi

echo "✅ Docker found"
echo ""

# Check if containers are running
if ! docker compose ps | grep -q "bl-postgres"; then
    echo "⚠️  PostgreSQL container not running"
    echo "Starting containers..."
    docker compose up -d postgres
    echo "Waiting 10 seconds for PostgreSQL to be ready..."
    sleep 10
fi

echo "✅ PostgreSQL container is running"
echo ""

# Execute migrations
echo "📝 Executing migrations SQL..."
echo ""

echo "[1/4] Migration timezone + firstName/lastName..."
docker compose exec -T postgres psql -U backlink -d backlink_engine < prisma/migrations/20260215_add_timezone_firstname_lastname/migration.sql

if [ $? -ne 0 ]; then
    echo "❌ Migration 1/4 failed!"
    exit 1
fi

echo "✅ Migration 1/4 completed"
echo ""

echo "[2/4] Migration Tags System..."
docker compose exec -T postgres psql -U backlink -d backlink_engine < prisma/migrations/20260215_add_tags_system/migration.sql

if [ $? -ne 0 ]; then
    echo "❌ Migration 2/4 failed!"
    exit 1
fi

echo "✅ Migration 2/4 completed"
echo ""

echo "[3/4] Migration Contact Forms + Message Templates..."
docker compose exec -T postgres psql -U backlink -d backlink_engine < prisma/migrations/20260215_add_contact_form_detection_and_templates/migration.sql

if [ $? -ne 0 ]; then
    echo "❌ Migration 3/4 failed!"
    exit 1
fi

echo "✅ Migration 3/4 completed"
echo ""

echo "[4/4] Migration Impactful Templates (blogger, media, influencer...)"
docker compose exec -T postgres psql -U backlink -d backlink_engine < prisma/migrations/20260215_add_impactful_category_templates/migration.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All migrations executed successfully!"
    echo ""

    # Verify columns and tables
    echo "🔍 Verifying new columns and tables..."
    docker compose exec -T postgres psql -U backlink -d backlink_engine -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('prospects', 'contacts') AND column_name IN ('timezone', 'firstName', 'lastName', 'contactFormFields', 'hasCaptcha') ORDER BY table_name, column_name;"

    echo ""
    echo "🔍 Verifying message templates..."
    docker compose exec -T postgres psql -U backlink -d backlink_engine -c "SELECT language, LEFT(subject, 40) as subject_preview FROM message_templates ORDER BY language;"

    echo ""
    echo "🔄 Restarting enrichment worker..."
    docker compose restart worker-enrichment || echo "⚠️  worker-enrichment not running (will start on next docker compose up)"

    echo ""
    echo "✅ MIGRATION COMPLETE!"
    echo ""
    echo "Next steps:"
    echo "  1. Test adding a prospect with firstName/lastName"
    echo "  2. Check that timezone is auto-detected"
    echo "  3. Verify email validation is working"
    echo "  4. Test contact form auto-detection"
    echo "  5. Edit message templates in admin UI"
    echo ""
else
    echo ""
    echo "❌ Migration failed!"
    echo "Check the error message above."
    exit 1
fi
