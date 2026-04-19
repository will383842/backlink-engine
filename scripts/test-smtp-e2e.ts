// ---------------------------------------------------------------------------
// One-shot end-to-end test of the SMTP direct pipeline.
// Usage: docker exec bl-app npx tsx scripts/test-smtp-e2e.ts <to-email>
// ---------------------------------------------------------------------------

import { sendViaSMTP } from "../src/services/outreach/smtpSender.js";
import { getNextSendingDomain } from "../src/services/outreach/domainRotator.js";

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error("Usage: test-smtp-e2e.ts <to-email>");
    process.exit(1);
  }

  console.log("=== Step 1: resolve next sending domain ===");
  const domain = await getNextSendingDomain();
  console.log(JSON.stringify(domain, null, 2));

  console.log("\n=== Step 2: sendViaSMTP ===");
  const result = await sendViaSMTP({
    toEmail: to,
    toName: "E2E Test",
    fromEmail: domain.fromEmail,
    fromName: domain.fromName,
    replyTo: domain.replyTo,
    subject: "[E2E] Backlink Engine SMTP test — ignore",
    bodyText:
      "Ceci est un test end-to-end envoyé directement par le Backlink Engine via Postfix/PMTA.\n\n" +
      "Si tu reçois ce message, toute la chaîne SMTP direct fonctionne :\n" +
      "- domainRotator a choisi un domaine actif\n" +
      "- sendViaSMTP a injecté dans Postfix (172.18.0.1:10025)\n" +
      "- Postfix → OpenDKIM a signé → PMTA a dispatché\n" +
      "- DNS SPF/DKIM/DMARC est configuré correctement\n\n" +
      "Tu peux ignorer ce message.",
  });

  console.log(JSON.stringify(result, null, 2));

  if (!result.success) {
    console.error("\n❌ Send failed");
    process.exit(1);
  }

  console.log("\n✅ Send accepted by Postfix");
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
