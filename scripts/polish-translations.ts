// ---------------------------------------------------------------------------
// Native-polish pass over all template translations.
//
// Each entry is a targeted phrase replacement applied to SUBJECT + BODY of
// every template in the given language. Only high-confidence fixes where
// the original wording is demonstrably awkward / a French calque / using
// a wrong collocation.
//
// Issues NOT touched (would need a true native reviewer):
//   - Overall prose rhythm in RU / AR / HI
//   - ZH tone calibration (formal 您 vs 你)
//   - Register consistency AR (MSA vs Levantine / Gulf)
// ---------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Fix {
  language: string;
  from: string;
  to: string;
  reason: string;
}

const FIXES: Fix[] = [
  // ============ Spanish ============
  { language: "es", from: "24h/24", to: "las 24 horas", reason: "'24h/24' is a French calque; Spanish uses 'las 24 horas' or '24/7'" },
  { language: "es", from: "expatriado solidario", to: "expatriado dispuesto a ayudar", reason: "'solidario' sounds stilted here; 'dispuesto a ayudar' is more natural" },
  { language: "es", from: "ingreso pasivo inmediato", to: "ingreso pasivo instantáneo", reason: "stronger collocation in marketing Spanish" },
  { language: "es", from: "cuenta con 82 abogados inscritos", to: "ya tiene 82 abogados registrados", reason: "'registrados' is the natural term; 'inscritos' is a French calque" },

  // ============ Portuguese ============
  { language: "pt", from: "expatriado solidário", to: "expatriado disposto a ajudar", reason: "same calque as ES" },
  { language: "pt", from: "24h por dia", to: "24 horas por dia", reason: "full form reads more natural" },
  { language: "pt", from: "inscritos no mundo todo", to: "registados em todo o mundo", reason: "PT-PT natural phrasing (works for BR too)" },

  // ============ German ============
  { language: "de", from: "Null Verwaltung", to: "Kein zusätzlicher Verwaltungsaufwand", reason: "'Null Verwaltung' is a direct French calque; native phrasing" },
  { language: "de", from: "sofortiges passives Einkommen", to: "sofortiges passives Zusatzeinkommen", reason: "'Zusatzeinkommen' is the standard German marketing term" },

  // ============ Russian ============
  { language: "ru", from: "страховочную сетку", to: "подстраховку", reason: "'страховочная сетка' is literal; 'подстраховка' is the natural Russian term for 'safety net'" },
  { language: "ru", from: "реальную страховочную сетку", to: "реальную подстраховку", reason: "adjective form" },
  { language: "ru", from: "человеческую, мгновенную страховочную сетку", to: "человеческую, мгновенную подстраховку", reason: "adjective form" },
  { language: "ru", from: "уникальную в мире страховочную сетку", to: "уникальную в мире подстраховку", reason: "adjective form" },
  { language: "ru", from: "мгновенный пассивный доход", to: "мгновенный пассивный доход", reason: "no-op (already natural)" },

  // ============ Arabic ============
  { language: "ar", from: "مرحباً،", to: "تحية طيبة،", reason: "more formal business greeting, appropriate for B2B outreach" },

  // ============ Chinese ============
  { language: "zh", from: "全天 24 小时服务", to: "全天候服务", reason: "'全天候' is the idiomatic term for '24/7' in Chinese; avoids redundancy" },

  // ============ Hindi ============
  { language: "hi", from: "24 घंटे।", to: "दिन के 24 घंटे।", reason: "adds natural determiner; '24 घंटे' alone reads incomplete" },
  { language: "hi", from: "24 घंटे,", to: "दिन के 24 घंटे,", reason: "same fix at mid-sentence position" },

  // ============ English ============
  { language: "en", from: "a helpful expat", to: "a fellow expat", reason: "'helpful expat' sounds stilted; 'fellow expat' is the natural collocation" },
];

async function main() {
  let totalFixed = 0;
  const byLang: Record<string, number> = {};

  for (const fix of FIXES) {
    const rows = await prisma.messageTemplate.findMany({
      where: { language: fix.language },
      select: { id: true, subject: true, body: true },
    });
    let changedRows = 0;
    for (const row of rows) {
      const newSubject = row.subject.split(fix.from).join(fix.to);
      const newBody = row.body.split(fix.from).join(fix.to);
      if (newSubject !== row.subject || newBody !== row.body) {
        await prisma.messageTemplate.update({
          where: { id: row.id },
          data: { subject: newSubject, body: newBody },
        });
        changedRows++;
      }
    }
    if (changedRows > 0) {
      console.log(`✓ ${fix.language} | ${changedRows} rows | "${fix.from.slice(0, 40)}" → "${fix.to.slice(0, 40)}"`);
      console.log(`    reason: ${fix.reason}`);
      totalFixed += changedRows;
      byLang[fix.language] = (byLang[fix.language] ?? 0) + changedRows;
    }
  }

  console.log(`\n=== Total: ${totalFixed} row-level fixes ===`);
  for (const [lang, n] of Object.entries(byLang)) {
    console.log(`  ${lang}: ${n} rows touched`);
  }

  process.exit(0);
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
