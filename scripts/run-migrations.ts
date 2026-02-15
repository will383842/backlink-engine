#!/usr/bin/env tsx
/**
 * ─────────────────────────────────────────────────────────────
 * Migration Runner - Backlink Engine (2026-02-15)
 * ─────────────────────────────────────────────────────────────
 * Executes SQL migrations directly via Prisma (no Docker CLI needed)
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

const MIGRATIONS = [
  {
    name: "1/4 - Timezone + firstName/lastName",
    file: "../prisma/migrations/20260215_add_timezone_firstname_lastname/migration.sql",
  },
  {
    name: "2/4 - Tags System",
    file: "../prisma/migrations/20260215_add_tags_system/migration.sql",
  },
  {
    name: "3/4 - Contact Forms + Message Templates",
    file: "../prisma/migrations/20260215_add_contact_form_detection_and_templates/migration.sql",
  },
  {
    name: "4/4 - Impactful Category Templates",
    file: "../prisma/migrations/20260215_add_impactful_category_templates/migration.sql",
  },
];

async function runMigration(name: string, sqlFilePath: string): Promise<void> {
  console.log(`\n[${name}] Starting...`);

  try {
    const sql = readFileSync(join(__dirname, sqlFilePath), "utf-8");

    // Split by semicolons but keep them for execution
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      if (statement) {
        await prisma.$executeRawUnsafe(statement);
      }
    }

    console.log(`✅ [${name}] Completed successfully`);
  } catch (error: any) {
    console.error(`❌ [${name}] Failed:`);
    console.error(error.message);
    throw error;
  }
}

async function verifyMigrations(): Promise<void> {
  console.log("\n🔍 Verifying new columns and tables...\n");

  try {
    // Verify columns
    const columns = await prisma.$queryRaw<any[]>`
      SELECT column_name, data_type, table_name
      FROM information_schema.columns
      WHERE table_name IN ('prospects', 'contacts')
        AND column_name IN ('timezone', 'firstName', 'lastName', 'contactFormFields', 'hasCaptcha')
      ORDER BY table_name, column_name;
    `;

    console.log("New columns:");
    columns.forEach((col) => {
      console.log(`  - ${col.table_name}.${col.column_name} (${col.data_type})`);
    });

    // Verify message templates
    const templates = await prisma.$queryRaw<any[]>`
      SELECT language, category, LEFT(subject, 40) as subject_preview
      FROM message_templates
      ORDER BY language, category;
    `;

    console.log(`\n📧 Message templates: ${templates.length} total`);
    templates.forEach((t) => {
      const cat = t.category || "general";
      console.log(`  - ${t.language}/${cat}: ${t.subject_preview}...`);
    });

    console.log("\n✅ All verifications passed!");
  } catch (error: any) {
    console.error("⚠️  Verification failed:");
    console.error(error.message);
  }
}

async function main() {
  console.log("🚀 Backlink Engine - Migration 2026-02-15");
  console.log("==========================================");

  try {
    // Test database connection
    await prisma.$connect();
    console.log("\n✅ Database connection successful");

    // Run all migrations sequentially
    for (const migration of MIGRATIONS) {
      await runMigration(migration.name, migration.file);
    }

    // Verify results
    await verifyMigrations();

    console.log("\n✅ MIGRATION COMPLETE!");
    console.log("\nNext steps:");
    console.log("  1. Test adding a prospect with firstName/lastName");
    console.log("  2. Check that timezone is auto-detected");
    console.log("  3. Verify email validation is working");
    console.log("  4. Test contact form auto-detection");
    console.log("  5. Edit message templates in admin UI");
    console.log("\n");
  } catch (error: any) {
    console.error("\n❌ Migration failed!");
    console.error(error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
