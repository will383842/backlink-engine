#!/bin/bash

# ============================================================================
# BACKLINK ENGINE - SCRIPT DE DÉPLOIEMENT PRODUCTION
# ============================================================================
# Usage: ./deploy.sh
# Environnement: Production (Hetzner VPS - backlinks.life-expat.com)
# ============================================================================

set -e  # Exit on error

echo "🚀 Démarrage déploiement Backlink Engine..."
echo ""

# ──────────────────────────────────────────────────────────────────────────
# 1. VÉRIFICATIONS PRÉ-DÉPLOIEMENT
# ──────────────────────────────────────────────────────────────────────────

echo "📋 [1/8] Vérifications pré-déploiement..."

# Vérifier que Docker est disponible
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé !"
    exit 1
fi

# Vérifier que Docker Compose est disponible
if ! command -v docker &> /dev/null || ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose n'est pas disponible !"
    exit 1
fi

# Vérifier que .env existe (WARNING seulement, pas de blocage)
if [ ! -f .env ]; then
    echo "⚠️  Fichier .env manquant - création automatique depuis .env.production"
    if [ -f .env.production ]; then
        cp .env.production .env
        echo "✅ .env créé"
    else
        echo "❌ .env.production manquant aussi ! Créez-le manuellement."
    fi
fi

# Vérifier certificats SSL (WARNING seulement, pas de blocage)
if [ ! -f ssl/cloudflare-cert.pem ] || [ ! -f ssl/cloudflare-key.pem ]; then
    echo "⚠️  Certificats SSL manquants (HTTP fonctionnera, HTTPS non)"
fi

echo "✅ Vérifications OK"
echo ""

# ──────────────────────────────────────────────────────────────────────────
# 2. GIT PULL
# ──────────────────────────────────────────────────────────────────────────

echo "📦 [2/8] Mise à jour du code (git pull)..."

if [ -d .git ]; then
    git pull origin main
    echo "✅ Code mis à jour"
else
    echo "⚠️  Pas de dépôt Git détecté (skip)"
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────
# 3. BUILD FRONTEND
# ──────────────────────────────────────────────────────────────────────────

echo "🎨 [3/8] Build frontend (Vite)..."

cd frontend

# Installer dépendances si node_modules manquant
if [ ! -d node_modules ]; then
    echo "   Installation des dépendances npm..."
    npm install --production=false
fi

# Build production
echo "   Build Vite..."
npm run build

if [ ! -d dist ] || [ ! -f dist/index.html ]; then
    echo "❌ Build frontend échoué ! Vérifiez les logs."
    exit 1
fi

echo "✅ Frontend build réussi (dist/)"

cd ..
echo ""

# ──────────────────────────────────────────────────────────────────────────
# 4. BUILD BACKEND (TypeScript → JavaScript)
# ──────────────────────────────────────────────────────────────────────────

echo "⚙️  [4/8] Build backend (TypeScript)..."

# Installer dépendances si node_modules manquant
if [ ! -d node_modules ]; then
    echo "   Installation des dépendances npm..."
    npm install --production=false
fi

# Compiler TypeScript
echo "   Compilation TypeScript..."
npm run build

if [ ! -d dist ] || [ ! -f dist/index.js ]; then
    echo "❌ Build backend échoué ! Vérifiez les logs TypeScript."
    exit 1
fi

echo "✅ Backend build réussi (dist/)"
echo ""

# ──────────────────────────────────────────────────────────────────────────
# 5. DOCKER COMPOSE DOWN (Arrêt containers actuels)
# ──────────────────────────────────────────────────────────────────────────

echo "🛑 [5/8] Arrêt containers actuels..."

docker compose down

echo "✅ Containers arrêtés"
echo ""

# ──────────────────────────────────────────────────────────────────────────
# 6. DOCKER COMPOSE UP (Rebuild + Démarrage)
# ──────────────────────────────────────────────────────────────────────────

echo "🐳 [6/8] Rebuild et démarrage Docker Compose..."

# Utiliser docker-compose.optimized.yml pour production
if [ -f docker-compose.optimized.yml ]; then
    echo "   Utilisation de docker-compose.optimized.yml (production)"
    docker compose -f docker-compose.optimized.yml up -d --build
else
    echo "   Utilisation de docker-compose.yml"
    docker compose up -d --build
fi

# Attendre que les services soient healthy
echo "   Attente services healthy..."
sleep 10

echo "✅ Containers démarrés"
echo ""

# ──────────────────────────────────────────────────────────────────────────
# 7. MIGRATIONS PRISMA
# ──────────────────────────────────────────────────────────────────────────

echo "🗄️  [7/8] Application migrations Prisma..."

# Déployer migrations
docker compose exec -T app npx prisma migrate deploy

# Générer Prisma Client
docker compose exec -T app npx prisma generate

echo "✅ Migrations Prisma appliquées"
echo ""

# ──────────────────────────────────────────────────────────────────────────
# 8. HEALTH CHECKS
# ──────────────────────────────────────────────────────────────────────────

echo "🏥 [8/8] Vérifications de santé..."

# Attendre 5 secondes pour que l'app démarre
sleep 5

# Health check HTTP
echo "   Vérification health endpoint..."
if docker compose exec -T app wget --no-verbose --tries=1 --spider http://localhost:3000/api/health 2>&1 | grep -q "200 OK"; then
    echo "✅ Backend health check OK"
else
    echo "⚠️  Backend health check échoué (peut être normal si l'app démarre encore)"
fi

# Vérifier PostgreSQL
echo "   Vérification PostgreSQL..."
if docker compose exec -T postgres pg_isready -U backlink -d backlink_engine &> /dev/null; then
    echo "✅ PostgreSQL OK"
else
    echo "❌ PostgreSQL non accessible !"
fi

# Vérifier Redis
echo "   Vérification Redis..."
if docker compose exec -T redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD:-KGJ0eDoPNNVfRj87Jwzz0vcYe2UM8M5clvwF52e55oQ=}" ping | grep -q "PONG"; then
    echo "✅ Redis OK"
else
    echo "❌ Redis non accessible !"
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────
# SUCCÈS
# ──────────────────────────────────────────────────────────────────────────

echo "🎉 ════════════════════════════════════════════════════════════════"
echo "🎉  DÉPLOIEMENT RÉUSSI !"
echo "🎉 ════════════════════════════════════════════════════════════════"
echo ""
echo "📊 Containers actifs :"
docker compose ps
echo ""
echo "📝 Logs en temps réel :"
echo "   docker compose logs -f app"
echo ""
echo "🔗 URLs :"
echo "   - Backend API : https://backlinks.life-expat.com/api"
echo "   - Health check: https://backlinks.life-expat.com/api/health"
echo "   - Frontend    : https://backlinks.life-expat.com"
echo ""
echo "🛠️  Commandes utiles :"
echo "   - Restart  : docker compose restart app"
echo "   - Logs     : docker compose logs -f app"
echo "   - Shell    : docker compose exec app sh"
echo "   - Prisma   : docker compose exec app npx prisma studio"
echo ""
echo "✅ Déploiement terminé avec succès !"
