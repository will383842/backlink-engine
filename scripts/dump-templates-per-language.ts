// Dump all templates as JSON files, one per language, for native-speaker review.
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

async function main() {
  const outDir = "/tmp/template-review";
  mkdirSync(outDir, { recursive: true });

  const LANGS = ["fr", "en", "es", "de", "pt", "ru", "ar", "zh", "hi"];
  for (const lang of LANGS) {
    const rows = await prisma.messageTemplate.findMany({
      where: { language: lang },
      select: { id: true, category: true, sourceContactType: true, subject: true, body: true },
      orderBy: [{ category: "asc" }],
    });
    const path = join(outDir, `${lang}.json`);
    writeFileSync(path, JSON.stringify(rows, null, 2));
    console.log(`✓ ${lang}: ${rows.length} templates → ${path}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
