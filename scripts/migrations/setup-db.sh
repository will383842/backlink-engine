#!/bin/bash
set -e

echo "🔧 Setting up Backlink Engine database..."

# 1. Push schema to create tables
echo "📋 Creating database tables..."
docker compose run --rm app npx prisma db push --accept-data-loss --skip-generate

# 2. Create admin user
echo "👤 Creating admin user..."
docker compose run --rm app node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

(async () => {
  const prisma = new PrismaClient();

  const passwordHash = await bcrypt.hash('MJMJsblanc19522008/*%\$', 10);

  const user = await prisma.user.upsert({
    where: { email: 'williamsjullin@gmail.com' },
    update: { passwordHash, role: 'admin', name: 'William Jullin' },
    create: {
      email: 'williamsjullin@gmail.com',
      name: 'William Jullin',
      role: 'admin',
      passwordHash
    }
  });

  console.log('✅ Admin user created:', user.email);
  await prisma.\$disconnect();
})();
"

# 3. Start app
echo "🚀 Starting app..."
docker compose up -d app

echo "✅ Setup complete!"
