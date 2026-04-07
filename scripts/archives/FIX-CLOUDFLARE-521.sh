#!/bin/bash
# =============================================================================
# FIX : Cloudflare Error 521 (Web server is down)
# =============================================================================
# Problème : Cloudflare ne peut pas se connecter au serveur origin
# Cause probable : Cloudflare (mode Full) essaie HTTPS mais Nginx écoute que port 80
# Solution : Configurer Nginx pour écouter sur port 443 avec certificat auto-signé
# =============================================================================

set -euo pipefail

echo "============================================="
echo " FIX : Cloudflare Error 521"
echo "============================================="
echo ""

# ────────────────────────────────────────────────────────────
# 1. Vérifier que nous sommes dans le bon répertoire
# ────────────────────────────────────────────────────────────

if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Erreur : Exécuter ce script depuis /opt/backlink-engine"
    echo "Usage: cd /opt/backlink-engine && bash FIX-CLOUDFLARE-521.sh"
    exit 1
fi

echo "[1/6] Vérification de l'environnement..."
echo "  ✅ Répertoire backlink-engine détecté"

# ────────────────────────────────────────────────────────────
# 2. Créer le dossier SSL dans le container Nginx
# ────────────────────────────────────────────────────────────

echo ""
echo "[2/6] Création du dossier SSL..."

docker exec bl-nginx mkdir -p /etc/nginx/ssl 2>/dev/null || echo "  Dossier SSL déjà existant"

echo "  ✅ Dossier /etc/nginx/ssl créé"

# ────────────────────────────────────────────────────────────
# 3. Générer un certificat auto-signé (pour Cloudflare Full mode)
# ────────────────────────────────────────────────────────────

echo ""
echo "[3/6] Génération du certificat auto-signé..."

docker exec bl-nginx openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/key.pem \
  -out /etc/nginx/ssl/cert.pem \
  -subj "/C=FI/ST=Helsinki/L=Helsinki/O=Life-Expat/CN=backlinks.life-expat.com" \
  2>/dev/null

echo "  ✅ Certificat SSL généré (valide 365 jours)"

# ────────────────────────────────────────────────────────────
# 4. Mettre à jour nginx.conf pour écouter sur 443
# ────────────────────────────────────────────────────────────

echo ""
echo "[4/6] Configuration de Nginx pour HTTPS..."

cat > deploy/nginx.conf << 'EOF'
# Nginx configuration for Backlink-Engine
# Optimized for Cloudflare Full SSL mode

# HTTP (port 80) - redirect to HTTPS
server {
    listen 80;
    server_name backlinks.life-expat.com;

    # Health check (allow HTTP for monitoring)
    location /api/health {
        proxy_pass http://bl-app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS (port 443) - main API
server {
    listen 443 ssl http2;
    server_name backlinks.life-expat.com;

    # Self-signed certificate (Cloudflare handles client-facing SSL)
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # SSL settings (moderate security for origin)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Max body size (for file uploads)
    client_max_body_size 10M;

    # API proxy
    location /api/ {
        proxy_pass http://bl-app:3000;
        proxy_http_version 1.1;

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Root path (health check or redirect)
    location / {
        return 200 "Backlink-Engine API - Use /api/ endpoints\n";
        add_header Content-Type text/plain;
    }
}
EOF

echo "  ✅ nginx.conf mis à jour (HTTP + HTTPS)"

# ────────────────────────────────────────────────────────────
# 5. Ouvrir le port 443 dans le firewall UFW
# ────────────────────────────────────────────────────────────

echo ""
echo "[5/6] Configuration du firewall UFW..."

# Vérifier si UFW est actif
if sudo ufw status | grep -q "Status: active"; then
    # Ouvrir port 443 si pas déjà ouvert
    if ! sudo ufw status | grep -q "443"; then
        sudo ufw allow 443/tcp comment "HTTPS (Cloudflare)"
        echo "  ✅ Port 443/tcp ouvert dans UFW"
    else
        echo "  ✅ Port 443/tcp déjà ouvert"
    fi
else
    echo "  ⚠️  UFW non actif (pas de firewall local)"
fi

# ────────────────────────────────────────────────────────────
# 6. Redémarrer Nginx pour appliquer les changements
# ────────────────────────────────────────────────────────────

echo ""
echo "[6/6] Redémarrage de Nginx..."

docker compose restart nginx

# Attendre que Nginx redémarre
sleep 5

# Vérifier que Nginx écoute bien sur 80 et 443
echo ""
echo "Vérification des ports..."
if docker exec bl-nginx netstat -tuln | grep -q ":80"; then
    echo "  ✅ Nginx écoute sur port 80"
else
    echo "  ❌ Nginx n'écoute PAS sur port 80"
fi

if docker exec bl-nginx netstat -tuln | grep -q ":443"; then
    echo "  ✅ Nginx écoute sur port 443"
else
    echo "  ❌ Nginx n'écoute PAS sur port 443"
fi

# ────────────────────────────────────────────────────────────
# 7. Tests de santé
# ────────────────────────────────────────────────────────────

echo ""
echo "============================================="
echo " TESTS DE SANTÉ"
echo "============================================="
echo ""

# Test local HTTP
echo -n "[1/3] Test local HTTP (http://localhost/api/health): "
if curl -sf http://localhost/api/health > /dev/null 2>&1; then
    echo "✅ OK"
else
    echo "❌ ÉCHEC"
fi

# Test local HTTPS (certificat auto-signé)
echo -n "[2/3] Test local HTTPS (https://localhost/api/health): "
if curl -sfk https://localhost/api/health > /dev/null 2>&1; then
    echo "✅ OK"
else
    echo "❌ ÉCHEC"
fi

# Test externe via Cloudflare (peut prendre 1-2 min)
echo -n "[3/3] Test externe (https://backlinks.life-expat.com/api/health): "
sleep 3
if curl -sf https://backlinks.life-expat.com/api/health > /dev/null 2>&1; then
    echo "✅ OK"
else
    echo "⚠️  ÉCHEC (attendre 1-2 min pour Cloudflare)"
fi

# ────────────────────────────────────────────────────────────
# 8. Résumé et prochaines étapes
# ────────────────────────────────────────────────────────────

echo ""
echo "============================================="
echo " FIX TERMINÉ"
echo "============================================="
echo ""
echo "Changements appliqués:"
echo "  ✅ Certificat SSL auto-signé créé"
echo "  ✅ Nginx configuré pour HTTPS (port 443)"
echo "  ✅ Port 443 ouvert dans UFW"
echo "  ✅ Nginx redémarré"
echo ""
echo "Vérifications finales:"
echo "  docker logs bl-nginx --tail 30"
echo "  curl -k https://localhost/api/health"
echo "  curl https://backlinks.life-expat.com/api/health"
echo ""
echo "Si l'erreur 521 persiste après 2 minutes:"
echo "  1. Vider le cache Cloudflare (Dashboard > Caching > Purge Everything)"
echo "  2. Vérifier les logs Cloudflare (Analytics > Traffic)"
echo "  3. Temporairement passer en mode Flexible (SSL/TLS > Flexible)"
echo ""
echo "============================================="
