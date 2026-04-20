// ---------------------------------------------------------------------------
// One-shot: set the FR 'blog' template to William's exact copy + translate
// to 8 other languages WITHOUT the phone number line.
// ---------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";
import { getLlmClient } from "../src/llm/index.js";

const prisma = new PrismaClient();

const FR_SUBJECT =
  "Devenez blogueur SOS-Expat — 10$ par appel généré, retrait 24h";

const FR_BODY_WITH_PHONE = `Bonjour,

Imaginez : vous êtes à l'étranger, seul, face à un problème — un accident, un litige, une question urgente — et vous ne savez pas vers qui vous tourner. Pas de contact local, pas de réseau, la barrière de la langue.

C'est la réalité quotidienne de millions d'expats, voyageurs et vacanciers partout dans le monde.

SOS-Expat.com est la première plateforme au monde qui leur apporte une réponse humaine en moins de 5 minutes : un avocat local ou un expat qui connaît le terrain, choisi selon sa langue, son pays, ses avis et ses spécialités, qui les rappelle directement par téléphone. 49€ pour 20 min avec un avocat, 19€ pour 30 min avec un expat aidant. 197 pays, toutes langues, toutes nationalités, 24h/24.

Lancée il y a moins de 2 mois, la plateforme compte déjà 82 avocats inscrits — un chiffre qui devrait tripler dans les prochaines semaines.

En recommandant SOS-Expat à vos lecteurs, vous leur offrez un filet de sécurité réel. Et vous gagnez 10$ par appel généré, disponible dans votre tableau de bord et retiré sous 24h sur simple demande.

Inscrivez-vous ici : sos-expat.com/devenir-blogger

Williams Jullin
SOS-Expat.com
+33 7 43 33 12 01`;

// Translations never include the phone line — only the FR version keeps it
// (William's rule). Stripping the last line is enough because the body only
// has one phone number at the very end.
const FR_BODY_WITHOUT_PHONE = FR_BODY_WITH_PHONE.replace(/\n\+33[^\n]*$/, "");

const TARGET_LANGS = ["en", "es", "de", "pt", "ru", "ar", "zh", "hi"];

async function upsertTemplate(language: string, subject: string, body: string, translatedFromId: number | null) {
  const existing = await prisma.messageTemplate.findFirst({
    where: { language, sourceContactType: "blog" },
  });
  if (existing) {
    return prisma.messageTemplate.update({
      where: { id: existing.id },
      data: { subject, body, ...(translatedFromId !== null && { translatedFromId }) },
    });
  }
  return prisma.messageTemplate.create({
    data: {
      language,
      sourceContactType: "blog",
      subject,
      body,
      translatedFromId,
    },
  });
}

async function main() {
  console.log("=== Step 1: upsert FR 'blog' template (with phone) ===");
  const fr = await upsertTemplate("fr", FR_SUBJECT, FR_BODY_WITH_PHONE, null);
  console.log(`  → id=${fr.id}, language=${fr.language}, sct=${fr.sourceContactType}`);

  console.log("\n=== Step 2: translate FR (no phone) into 8 languages ===");
  const llm = getLlmClient();

  for (const target of TARGET_LANGS) {
    try {
      console.log(`  → ${target}...`);
      const translated = await llm.translateTemplate({
        subject: FR_SUBJECT,
        body: FR_BODY_WITHOUT_PHONE,
        sourceLanguage: "fr",
        targetLanguage: target,
      });
      const saved = await upsertTemplate(target, translated.subject, translated.body, fr.id);
      console.log(`    ✓ id=${saved.id} subject="${translated.subject.slice(0, 60)}"`);
    } catch (err) {
      console.error(`    ✗ FAILED for ${target}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log("\n=== Done ===");
  const all = await prisma.messageTemplate.findMany({
    where: { sourceContactType: "blog" },
    orderBy: { language: "asc" },
  });
  console.log(`blog templates now in DB (${all.length} rows):`);
  for (const t of all) {
    console.log(`  ${t.language} → ${t.subject.slice(0, 60)}`);
  }

  process.exit(0);
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
