#!/bin/bash
# =============================================================================
# FIX : Conflit port 80 entre Nginx système et Nginx Docker
# =============================================================================
# Problème : Nginx système essaie d'utiliser le port 80 déjà pris par Docker
# Solution : Désactiver Nginx système (on utilise uniquement Nginx Docker)
# =============================================================================

set -euo pipefail

echo "============================================="
echo " FIX : Conflit port 80 (Nginx système)"
echo "============================================="
echo ""

# ────────────────────────────────────────────────────────────
# 1. Arrêter Nginx système
# ────────────────────────────────────────────────────────────

echo "[1/4] Arrêt de Nginx système..."

# Tuer tous les processus nginx système
sudo pkill nginx 2>/dev/null || echo "  Aucun processus nginx à tuer"

# Arrêter le service nginx
sudo systemctl stop nginx 2>/dev/null || echo "  Service nginx déjà arrêté"

echo "  ✅ Nginx système arrêté"

# ────────────────────────────────────────────────────────────
# 2. Désactiver Nginx système (ne démarre plus au boot)
# ────────────────────────────────────────────────────────────

echo "[2/4] Désactivation de Nginx système..."

sudo systemctl disable nginx 2>/dev/null || echo "  Service nginx déjà désactivé"

echo "  ✅ Nginx système désactivé"

# ────────────────────────────────────────────────────────────
# 3. Vérifier que le port 80 est bien utilisé par Docker
# ────────────────────────────────────────────────────────────

echo "[3/4] Vérification du port 80..."

if sudo lsof -i :80 | grep -q docker; then
    echo "  ✅ Port 80 utilisé par Docker (bl-nginx)"
else
    echo "  ⚠️  Port 80 non utilisé par Docker"
    echo ""
    echo "  Redémarrage des containers Docker..."
    cd /opt/backlink-engine
    docker compose restart
    sleep 5
fi

echo ""
sudo lsof -i :80

# ────────────────────────────────────────────────────────────
# 4. Test de santé
# ────────────────────────────────────────────────────────────

echo ""
echo "[4/4] Test de santé..."

sleep 3

# Test local
echo -n "  Test local (http://localhost/api/health): "
if curl -sf http://localhost/api/health > /dev/null; then
    echo "✅ OK"
else
    echo "❌ ÉCHEC"
fi

# Test externe
echo -n "  Test externe (https://backlinks.life-expat.com/api/health): "
if curl -sf https://backlinks.life-expat.com/api/health > /dev/null; then
    echo "✅ OK"
else
    echo "⚠️  ÉCHEC (peut prendre 1-2 min pour Cloudflare)"
fi

echo ""
echo "============================================="
echo " FIX TERMINÉ"
echo "============================================="
echo ""
echo "Vérifications finales:"
echo "  docker ps                # Tous les containers doivent être 'Up'"
echo "  curl http://localhost/api/health"
echo "  curl https://backlinks.life-expat.com/api/health"
echo ""
echo "Si erreur 521 persiste:"
echo "  - Attendre 2 minutes (propagation Cloudflare)"
echo "  - Vider le cache Cloudflare (Dashboard > Caching > Purge Everything)"
echo "============================================="
