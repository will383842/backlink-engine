#!/bin/bash

# ============================================================================
# BACKLINK ENGINE - VÉRIFICATION CONFIGURATION SERVEUR
# ============================================================================
# Usage: ./check-server.sh
# Objectif: Vérifier que le serveur est prêt pour déploiement
# ============================================================================

echo "🔍 Vérification configuration serveur Hetzner..."
echo ""

ERRORS=0
WARNINGS=0

# ──────────────────────────────────────────────────────────────────────────
# 1. SYSTÈME D'EXPLOITATION
# ──────────────────────────────────────────────────────────────────────────

echo "📋 [1/12] Système d'exploitation..."

if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "   OS: $NAME $VERSION"

    if [[ "$ID" == "ubuntu" ]] || [[ "$ID" == "debian" ]]; then
        echo "   ✅ OS supporté ($ID)"
    else
        echo "   ⚠️  OS non testé: $ID (peut fonctionner quand même)"
        ((WARNINGS++))
    fi
else
    echo "   ❌ Impossible de déterminer l'OS"
    ((ERRORS++))
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────
# 2. RESSOURCES SERVEUR
# ──────────────────────────────────────────────────────────────────────────

echo "💻 [2/12] Ressources serveur..."

# RAM
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
echo "   RAM totale: ${TOTAL_RAM}MB"

if [ "$TOTAL_RAM" -ge 3800 ]; then
    echo "   ✅ RAM suffisante (≥4GB recommandé pour CPX22)"
elif [ "$TOTAL_RAM" -ge 1900 ]; then
    echo "   ⚠️  RAM limitée (${TOTAL_RAM}MB), 4GB recommandé"
    ((WARNINGS++))
else
    echo "   ❌ RAM insuffisante (${TOTAL_RAM}MB < 2GB)"
    ((ERRORS++))
fi

# CPU
CPU_CORES=$(nproc)
echo "   CPU cores: $CPU_CORES"

if [ "$CPU_CORES" -ge 2 ]; then
    echo "   ✅ CPU suffisant (≥2 cores recommandé)"
else
    echo "   ⚠️  CPU limité ($CPU_CORES core), 2+ recommandé"
    ((WARNINGS++))
fi

# Disk
DISK_AVAIL=$(df -h / | awk 'NR==2 {print $4}')
echo "   Disque disponible: $DISK_AVAIL"
echo "   ✅ Disque OK"

echo ""

# ──────────────────────────────────────────────────────────────────────────
# 3. DOCKER
# ──────────────────────────────────────────────────────────────────────────

echo "🐳 [3/12] Docker..."

if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | awk '{print $3}' | sed 's/,//')
    echo "   Docker version: $DOCKER_VERSION"
    echo "   ✅ Docker installé"

    # Vérifier que Docker daemon tourne
    if docker info &> /dev/null; then
        echo "   ✅ Docker daemon actif"
    else
        echo "   ❌ Docker daemon non démarré"
        echo "      Lancer: systemctl start docker"
        ((ERRORS++))
    fi
else
    echo "   ❌ Docker NON installé"
    echo "      Installer: curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh"
    ((ERRORS++))
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────
# 4. DOCKER COMPOSE
# ──────────────────────────────────────────────────────────────────────────

echo "🐙 [4/12] Docker Compose..."

if docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version | awk '{print $4}')
    echo "   Docker Compose version: $COMPOSE_VERSION"
    echo "   ✅ Docker Compose installé (v2)"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version | awk '{print $3}' | sed 's/,//')
    echo "   Docker Compose version: $COMPOSE_VERSION"
    echo "   ⚠️  Docker Compose v1 (ancien), v2 recommandé"
    ((WARNINGS++))
else
    echo "   ❌ Docker Compose NON installé"
    echo "      (Installé automatiquement avec Docker moderne)"
    ((ERRORS++))
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────
# 5. GIT
# ──────────────────────────────────────────────────────────────────────────

echo "📦 [5/12] Git..."

if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | awk '{print $3}')
    echo "   Git version: $GIT_VERSION"
    echo "   ✅ Git installé"
else
    echo "   ⚠️  Git NON installé (optionnel si upload manuel)"
    echo "      Installer: apt-get install -y git"
    ((WARNINGS++))
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────
# 6. CURL & WGET
# ──────────────────────────────────────────────────────────────────────────

echo "🌐 [6/12] Outils réseau..."

if command -v curl &> /dev/null; then
    echo "   ✅ curl installé"
else
    echo "   ❌ curl NON installé (requis pour healthchecks)"
    echo "      Installer: apt-get install -y curl"
    ((ERRORS++))
fi

if command -v wget &> /dev/null; then
    echo "   ✅ wget installé"
else
    echo "   ⚠️  wget NON installé (requis pour healthchecks Docker)"
    echo "      Installer: apt-get install -y wget"
    ((WARNINGS++))
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────
# 7. PORTS DISPONIBLES
# ──────────────────────────────────────────────────────────────────────────

echo "🔌 [7/12] Ports réseau..."

check_port() {
    PORT=$1
    if netstat -tuln 2>/dev/null | grep -q ":$PORT " || ss -tuln 2>/dev/null | grep -q ":$PORT "; then
        echo "   ⚠️  Port $PORT déjà utilisé"
        ((WARNINGS++))
        return 1
    else
        echo "   ✅ Port $PORT disponible"
        return 0
    fi
}

check_port 80
check_port 443
check_port 3000
check_port 5432
check_port 6379

echo ""

# ──────────────────────────────────────────────────────────────────────────
# 8. FIREWALL
# ──────────────────────────────────────────────────────────────────────────

echo "🔥 [8/12] Firewall..."

if command -v ufw &> /dev/null; then
    UFW_STATUS=$(ufw status | head -1)
    echo "   UFW: $UFW_STATUS"

    if [[ "$UFW_STATUS" == *"active"* ]]; then
        echo "   ⚠️  UFW actif - Vérifier que ports 80/443 sont autorisés"
        echo "      Commandes: ufw allow 80/tcp && ufw allow 443/tcp"
        ((WARNINGS++))
    else
        echo "   ✅ UFW inactif (Hetzner firewall cloud recommandé)"
    fi
else
    echo "   ℹ️  UFW non installé (normal sur Hetzner)"
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────
# 9. PROJET BACKLINK-ENGINE
# ──────────────────────────────────────────────────────────────────────────

echo "📂 [9/12] Projet backlink-engine..."

if [ -d "/app" ]; then
    echo "   ✅ Dossier /app existe"

    if [ -f "/app/.env" ]; then
        echo "   ✅ Fichier .env existe"
    else
        echo "   ⚠️  Fichier .env manquant"
        echo "      Créer: cp /app/.env.production /app/.env"
        ((WARNINGS++))
    fi

    if [ -f "/app/docker-compose.yml" ] || [ -f "/app/docker-compose.optimized.yml" ]; then
        echo "   ✅ Docker Compose config existe"
    else
        echo "   ❌ Docker Compose config manquant"
        ((ERRORS++))
    fi

    if [ -f "/app/deploy.sh" ]; then
        echo "   ✅ Script deploy.sh existe"
        if [ -x "/app/deploy.sh" ]; then
            echo "   ✅ deploy.sh est exécutable"
        else
            echo "   ⚠️  deploy.sh pas exécutable"
            echo "      Rendre exécutable: chmod +x /app/deploy.sh"
            ((WARNINGS++))
        fi
    else
        echo "   ❌ Script deploy.sh manquant"
        ((ERRORS++))
    fi
else
    echo "   ❌ Dossier /app n'existe pas"
    echo "      Cloner projet: git clone URL /app"
    ((ERRORS++))
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────
# 10. CERTIFICATS SSL
# ──────────────────────────────────────────────────────────────────────────

echo "🔐 [10/12] Certificats SSL..."

if [ -d "/app/ssl" ]; then
    echo "   ✅ Dossier /app/ssl existe"

    if [ -f "/app/ssl/cloudflare-cert.pem" ]; then
        echo "   ✅ Certificat Cloudflare présent"
    else
        echo "   ⚠️  Certificat Cloudflare manquant"
        echo "      HTTPS ne fonctionnera pas (HTTP OK sur port 80)"
        ((WARNINGS++))
    fi

    if [ -f "/app/ssl/cloudflare-key.pem" ]; then
        echo "   ✅ Clé privée Cloudflare présente"
    else
        echo "   ⚠️  Clé privée Cloudflare manquante"
        ((WARNINGS++))
    fi
else
    echo "   ⚠️  Dossier /app/ssl n'existe pas"
    echo "      HTTPS ne fonctionnera pas (HTTP OK)"
    echo "      Créer: mkdir -p /app/ssl"
    ((WARNINGS++))
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────
# 11. NODE.JS (optionnel, utilisé via Docker)
# ──────────────────────────────────────────────────────────────────────────

echo "📦 [11/12] Node.js (optionnel)..."

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "   Node.js version: $NODE_VERSION"
    echo "   ✅ Node.js installé (optionnel car Docker)"
else
    echo "   ℹ️  Node.js non installé (pas nécessaire, utilisé via Docker)"
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────
# 12. CONTAINERS DOCKER ACTIFS
# ──────────────────────────────────────────────────────────────────────────

echo "🐋 [12/12] Containers Docker..."

if command -v docker &> /dev/null && docker info &> /dev/null; then
    RUNNING_CONTAINERS=$(docker ps --format "{{.Names}}" 2>/dev/null | wc -l)
    echo "   Containers actifs: $RUNNING_CONTAINERS"

    if [ "$RUNNING_CONTAINERS" -gt 0 ]; then
        echo "   Containers en cours:"
        docker ps --format "   - {{.Names}} ({{.Status}})" 2>/dev/null
    fi

    if docker ps --format "{{.Names}}" | grep -q "bl-app"; then
        echo "   ✅ Application backlink-engine déjà déployée"
    else
        echo "   ℹ️  Application pas encore déployée"
    fi
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────
# RÉSUMÉ
# ──────────────────────────────────────────────────────────────────────────

echo "════════════════════════════════════════════════════════════════"
echo "📊 RÉSUMÉ VÉRIFICATION"
echo "════════════════════════════════════════════════════════════════"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "🎉 SERVEUR 100% PRÊT POUR DÉPLOIEMENT !"
    echo ""
    echo "Prochaine étape:"
    echo "   cd /app"
    echo "   ./deploy.sh"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "✅ SERVEUR PRÊT (avec quelques warnings)"
    echo ""
    echo "⚠️  Warnings: $WARNINGS"
    echo "   (Ces warnings ne bloquent pas le déploiement)"
    echo ""
    echo "Vous pouvez déployer:"
    echo "   cd /app"
    echo "   ./deploy.sh"
    exit 0
else
    echo "❌ SERVEUR PAS PRÊT - Corrections requises"
    echo ""
    echo "🔴 Erreurs: $ERRORS (à corriger)"
    echo "⚠️  Warnings: $WARNINGS"
    echo ""
    echo "Corrigez les erreurs ci-dessus puis relancez:"
    echo "   ./check-server.sh"
    exit 1
fi
