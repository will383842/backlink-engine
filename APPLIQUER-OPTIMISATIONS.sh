#!/bin/bash
# ============================================================
# BACKLINK-ENGINE - Script d'optimisation CPX22
# ============================================================
# Ce script applique les optimisations pour CPX22 standalone
# Durée: 2 minutes
# ============================================================

set -euo pipefail

echo "============================================="
echo " Backlink-Engine - Optimisations CPX22"
echo "============================================="
echo ""

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Erreur: docker-compose.yml non trouvé"
    echo "   Lancez ce script depuis le répertoire backlink-engine/"
    exit 1
fi

echo "✅ Répertoire backlink-engine détecté"
echo ""

# ────────────────────────────────────────────────────────────
# ÉTAPE 1: Backup du docker-compose.yml actuel
# ────────────────────────────────────────────────────────────

echo "[1/4] Backup de docker-compose.yml..."
if [ ! -f "docker-compose.yml.backup" ]; then
    cp docker-compose.yml docker-compose.yml.backup
    echo "  ✅ Backup créé: docker-compose.yml.backup"
else
    echo "  ⚠️  Backup existe déjà, skip"
fi

# ────────────────────────────────────────────────────────────
# ÉTAPE 2: Remplacer par la version optimisée
# ────────────────────────────────────────────────────────────

echo "[2/4] Application de docker-compose.optimized.yml..."
if [ -f "docker-compose.optimized.yml" ]; then
    cp docker-compose.optimized.yml docker-compose.yml
    echo "  ✅ docker-compose.yml mis à jour avec limites ressources"
else
    echo "  ❌ Erreur: docker-compose.optimized.yml non trouvé"
    exit 1
fi

# ────────────────────────────────────────────────────────────
# ÉTAPE 3: Vérifier postgresql.conf
# ────────────────────────────────────────────────────────────

echo "[3/4] Vérification de postgresql.conf..."
if [ -f "db/postgresql.conf" ]; then
    echo "  ✅ postgresql.conf détecté (optimisé CPX22)"
else
    echo "  ⚠️  postgresql.conf manquant"
    echo "     Il devrait être dans: db/postgresql.conf"
    exit 1
fi

# ────────────────────────────────────────────────────────────
# ÉTAPE 4: Redémarrer les services Docker
# ────────────────────────────────────────────────────────────

echo "[4/4] Redémarrage des services Docker..."
echo ""
echo "  Cette étape va:"
echo "  - Arrêter tous les containers"
echo "  - Appliquer les nouvelles limites ressources"
echo "  - Redémarrer avec la config PostgreSQL optimisée"
echo ""
read -p "  Continuer? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "  Arrêt des services..."
    docker compose down

    echo "  Redémarrage avec nouvelle config..."
    docker compose up -d

    echo "  Attente du démarrage (15 secondes)..."
    sleep 15

    echo ""
    echo "  ✅ Services redémarrés!"
else
    echo "  ⚠️  Redémarrage annulé"
    echo ""
    echo "  Pour redémarrer manuellement plus tard:"
    echo "    docker compose down"
    echo "    docker compose up -d"
fi

echo ""
echo "============================================="
echo " Optimisations appliquées ✅"
echo "============================================="
echo ""
echo "Vérifications:"
echo "  1. Vérifier que tous les services tournent:"
echo "     docker compose ps"
echo ""
echo "  2. Vérifier l'utilisation ressources:"
echo "     docker stats"
echo ""
echo "  3. Tester l'API:"
echo "     curl http://localhost/api/health"
echo ""
echo "  4. Voir les logs PostgreSQL:"
echo "     docker logs bl-postgres --tail 50"
echo ""
echo "Ressources allouées (CPX22 - 4GB RAM):"
echo "  - PostgreSQL: 1GB RAM, 1.0 CPU"
echo "  - Redis:      256MB RAM, 0.25 CPU"
echo "  - Node.js:    768MB RAM, 1.0 CPU"
echo "  - Nginx:      64MB RAM, 0.1 CPU"
echo "  ─────────────────────────────────────"
echo "  TOTAL:        2.088GB / 4GB (52%)"
echo ""
echo "Rollback si problème:"
echo "  cp docker-compose.yml.backup docker-compose.yml"
echo "  docker compose down && docker compose up -d"
echo "============================================="
