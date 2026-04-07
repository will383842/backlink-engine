#!/bin/bash
# ═══════════════════════════════════════════════════════════
# VPS Setup Script for Backlink Engine
# Run this ONCE on the VPS via Hetzner Console (web terminal)
#
# Usage: curl -fsSL https://raw.githubusercontent.com/will383842/backlink-engine/main/scripts/setup-vps.sh | bash
# Or paste directly in the Hetzner Console
# ═══════════════════════════════════════════════════════════
set -e

echo "═══ Backlink Engine VPS Setup ═══"

# 1. Open SSH port (firewall)
echo "1/7 Opening SSH port..."
if command -v ufw &> /dev/null; then
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  echo "  ✅ UFW configured"
elif command -v iptables &> /dev/null; then
  iptables -A INPUT -p tcp --dport 22 -j ACCEPT
  echo "  ✅ iptables configured"
else
  echo "  ⚠️ No firewall found, SSH should already be open"
fi

# 2. Add SSH public key for CI/CD
echo "2/7 Adding SSH key..."
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# This is the ed25519 public key from the dev machine
cat >> ~/.ssh/authorized_keys << 'PUBKEY'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGXMGThr+87vr2XgCz5kUOqwG3lkFn4NH3Hw9F0j8tUF ton-email
PUBKEY
chmod 600 ~/.ssh/authorized_keys
echo "  ✅ SSH key added"

# 3. Install Docker
echo "3/7 Installing Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "  ✅ Docker installed"
else
  echo "  ✅ Docker already installed"
fi

# 4. Install Docker Compose plugin
echo "4/7 Installing Docker Compose..."
if ! docker compose version &> /dev/null; then
  apt-get update -qq && apt-get install -y -qq docker-compose-plugin
  echo "  ✅ Docker Compose installed"
else
  echo "  ✅ Docker Compose already installed"
fi

# 5. Clone the project
echo "5/7 Cloning backlink-engine..."
if [ ! -d /opt/backlink-engine ]; then
  git clone https://github.com/will383842/backlink-engine.git /opt/backlink-engine
  echo "  ✅ Project cloned"
else
  cd /opt/backlink-engine && git pull origin main
  echo "  ✅ Project updated"
fi

# 6. Setup nginx reverse proxy (port 80 → 3000)
echo "6/7 Configuring nginx..."
apt-get install -y -qq nginx
cat > /etc/nginx/sites-available/backlink-engine << 'NGINX'
server {
    listen 80;
    server_name backlinks.life-expat.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/backlink-engine /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  ✅ Nginx configured"

# 7. Start the application
echo "7/7 Starting backlink-engine..."
cd /opt/backlink-engine
docker compose up -d --build

# Wait and check
sleep 15
if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
  echo ""
  echo "═══════════════════════════════════════"
  echo "  ✅ BACKLINK ENGINE IS RUNNING!"
  echo "  URL: https://backlinks.life-expat.com"
  echo "  API: https://backlinks.life-expat.com/api/health"
  echo "═══════════════════════════════════════"
else
  echo ""
  echo "  ⚠️ App not responding yet. Check: docker compose logs"
fi
