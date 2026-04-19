// ---------------------------------------------------------------------------
// E2E test: form-message generation for real prospects in the DB.
// Picks one prospect with contactFormUrl, runs the same logic the API route
// uses, and prints the generated subject + body. No DB writes, no emails.
// ---------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Step 1: pick a prospect with a contact form ===");
  const prospect = await prisma.prospect.findFirst({
    where: {
      contactFormUrl: { not: null },
      status: { in: ["READY_TO_CONTACT", "NEW", "ENRICHING"] },
    },
    include: { contacts: { take: 1 } },
  });

  if (!prospect) {
    console.error("No prospect with a contact form found");
    process.exit(1);
  }

  const contact = prospect.contacts[0];
  const sct =
    (contact as unknown as { sourceContactType?: string | null })?.sourceContactType ??
    prospect.sourceContactType ??
    null;

  console.log({
    id: prospect.id,
    domain: prospect.domain,
    language: prospect.language,
    category: prospect.category,
    sourceContactType: sct,
    contactFormUrl: prospect.contactFormUrl,
  });

  console.log("\n=== Step 2: template lookup (same fallback chain as API) ===");
  const lang = prospect.language ?? "en";
  const cat = prospect.category;

  const candidates = await prisma.messageTemplate.findMany({
    where: {
      OR: [
        { language: lang, sourceContactType: sct },
        { language: lang, category: cat },
        { language: lang, category: null, sourceContactType: null },
        { language: "en", sourceContactType: sct },
        { language: "en", category: cat },
        { language: "en", category: null, sourceContactType: null },
      ],
    },
  });

  const byScore = (t: typeof candidates[number]) => {
    let score = 0;
    if (t.language === lang) score += 100;
    if (sct && t.sourceContactType === sct) score += 20;
    if (t.category === cat) score += 10;
    return score;
  };
  const template = candidates.sort((a, b) => byScore(b) - byScore(a))[0];

  if (!template) {
    console.error("\n❌ No template found — fallback chain returned nothing");
    process.exit(1);
  }

  console.log({
    id: template.id,
    language: template.language,
    sourceContactType: template.sourceContactType,
    category: template.category,
    translatedFromId: template.translatedFromId,
  });

  console.log("\n=== Step 3: variable substitution ===");
  const contactName =
    (contact as unknown as { firstName?: string | null })?.firstName ??
    (contact as unknown as { name?: string | null })?.name ??
    "";

  let senderSettings = { yourWebsite: "https://life-expat.com", yourCompany: "Life Expat", yourName: "" };
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: "sender" } });
    if (row) Object.assign(senderSettings, row.value as Record<string, unknown>);
  } catch {
    /* ignore */
  }

  const substitute = (text: string): string =>
    text
      .replace(/\{siteName\}/g, prospect.domain)
      .replace(/\{domain\}/g, prospect.domain)
      .replace(/\{contactName\}/g, contactName ? ` ${contactName}` : "")
      .replace(/\{yourName\}/g, senderSettings.yourName || "")
      .replace(/\{yourCompany\}/g, senderSettings.yourCompany)
      .replace(/\{yourWebsite\}/g, senderSettings.yourWebsite);

  console.log("\n--- Subject ---");
  console.log(substitute(template.subject));
  console.log("\n--- Body ---");
  console.log(substitute(template.body));

  console.log("\n✅ Form message generation flow OK");
  process.exit(0);
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
