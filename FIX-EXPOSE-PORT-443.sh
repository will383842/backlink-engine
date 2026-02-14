#!/bin/bash
# =============================================================================
# FIX : Exposer le port 443 dans Docker Compose
# =============================================================================
# Problème : nginx écoute sur 443 mais le port n'est pas exposé
# Solution : Modifier docker-compose.yml et redémarrer
# =============================================================================

set -euo pipefail

echo "============================================="
echo " FIX : Exposer le port 443 dans Docker"
echo "============================================="
echo ""

cd /opt/backlink-engine

# ────────────────────────────────────────────────────────────
# 1. Backup du docker-compose.yml actuel
# ────────────────────────────────────────────────────────────

echo "[1/4] Backup de docker-compose.yml..."
cp docker-compose.yml docker-compose.yml.backup
echo "  ✅ Backup créé : docker-compose.yml.backup"

# ────────────────────────────────────────────────────────────
# 2. Modifier docker-compose.yml pour exposer le port 443
# ────────────────────────────────────────────────────────────

echo ""
echo "[2/4] Modification de docker-compose.yml..."

# Vérifier si le port 443 est déjà exposé
if grep -q '"443:443"' docker-compose.yml; then
    echo "  ⚠️  Port 443 déjà exposé, skip"
else
    # Ajouter le port 443 après le port 80
    sed -i '/- "80:80"/a \      - "443:443"' docker-compose.yml
    echo "  ✅ Port 443 ajouté"
fi

# Vérifier si le volume SSL est déjà monté
if grep -q './ssl:/etc/nginx/ssl:ro' docker-compose.yml; then
    echo "  ⚠️  Volume SSL déjà monté, skip"
else
    # Ajouter le volume SSL après le volume nginx.conf
    sed -i '/- \.\/deploy\/nginx\.conf:/a \      - ./ssl:/etc/nginx/ssl:ro' docker-compose.yml
    echo "  ✅ Volume SSL ajouté"
fi

# ────────────────────────────────────────────────────────────
# 3. Redémarrer les containers
# ────────────────────────────────────────────────────────────

echo ""
echo "[3/4] Redémarrage des containers..."

docker compose down
docker compose up -d

# Attendre que les containers démarrent
sleep 10

# ────────────────────────────────────────────────────────────
# 4. Vérifications
# ────────────────────────────────────────────────────────────

echo ""
echo "[4/4] Vérifications..."

# Vérifier que tous les containers sont up
echo ""
echo "Containers :"
docker ps --format "table {{.Names}}\t{{.Status}}"

# Vérifier que nginx écoute sur 443
echo ""
echo -n "Port 443 dans container nginx : "
if docker exec bl-nginx netstat -tuln 2>/dev/null | grep -q ":443"; then
    echo "✅ OK"
else
    echo "❌ ÉCHEC"
fi

# Vérifier que le port 443 est ouvert sur l'hôte
echo -n "Port 443 sur l'hôte : "
if sudo lsof -i :443 | grep -q docker; then
    echo "✅ OK"
else
    echo "❌ ÉCHEC"
fi

# Test HTTPS local
echo ""
echo "Tests HTTP/HTTPS :"
echo -n "  HTTP (http://localhost/api/health) : "
if curl -sf http://localhost/api/health > /dev/null 2>&1; then
    echo "✅ OK"
else
    echo "❌ ÉCHEC"
fi

echo -n "  HTTPS (https://localhost/api/health) : "
if curl -sfk https://localhost/api/health > /dev/null 2>&1; then
    echo "✅ OK"
else
    echo "❌ ÉCHEC"
fi

# Test externe (Cloudflare)
echo -n "  HTTPS externe (https://backlinks.life-expat.com/api/health) : "
if curl -sf https://backlinks.life-expat.com/api/health > /dev/null 2>&1; then
    echo "✅ OK - PROBLÈME RÉSOLU !"
else
    echo "⚠️  ÉCHEC (attendre 1-2 min pour Cloudflare)"
fi

# ────────────────────────────────────────────────────────────
# Résumé
# ────────────────────────────────────────────────────────────

echo ""
echo "============================================="
echo " FIX TERMINÉ"
echo "============================================="
echo ""
echo "Changements appliqués :"
echo "  ✅ Port 443 exposé dans docker-compose.yml"
echo "  ✅ Volume SSL monté (/opt/backlink-engine/ssl → /etc/nginx/ssl)"
echo "  ✅ Containers redémarrés"
echo ""
echo "Vérifications finales :"
echo "  docker logs bl-nginx --tail 30"
echo "  curl -k https://localhost/api/health"
echo "  curl https://backlinks.life-expat.com/api/health"
echo ""
echo "Si l'erreur 521 persiste :"
echo "  1. Vider le cache Cloudflare (Dashboard > Caching > Purge Everything)"
echo "  2. Attendre 2 minutes pour propagation"
echo ""
echo "============================================="
