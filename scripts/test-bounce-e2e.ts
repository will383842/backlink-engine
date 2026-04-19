// ---------------------------------------------------------------------------
// E2E test: simulate a DSN bounce for an existing contact and verify the
// processBounce() logic marks them invalid + opts them out + stops enrollments.
// Creates ephemeral test data, runs processReply, verifies side effects,
// then cleans up.
// ---------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";
import { processReply } from "../src/services/outreach/imapMonitor.js";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Step 1: create an ephemeral test prospect + contact ===");
  const testEmail = `e2e-bounce-test-${Date.now()}@example-invalid.test`;
  const testDomain = `e2e-bounce-${Date.now()}.test`;

  const prospect = await prisma.prospect.create({
    data: {
      domain: testDomain,
      status: "CONTACTED_EMAIL",
      source: "manual",
      sourceContactType: "scraped",
    },
  });

  const contact = await prisma.contact.create({
    data: {
      prospectId: prospect.id,
      email: testEmail,
      emailNormalized: testEmail.toLowerCase(),
      emailStatus: "verified",
      sourceContactType: "scraped",
      optedOut: false,
    },
  });

  console.log({
    prospectId: prospect.id,
    contactId: contact.id,
    email: contact.email,
    emailStatus: contact.emailStatus,
    optedOut: contact.optedOut,
  });

  console.log("\n=== Step 2: call processReply with a HARD bounce DSN payload ===");
  const dsnBody = `This is the mail system at host mail.example.com.\n\n` +
    `I'm sorry to have to inform you that your message could not\n` +
    `be delivered to one or more recipients.\n\n` +
    `<${testEmail}>: host mail.example-invalid.test[127.0.0.1] said:\n` +
    `550 5.1.1 The email account that you tried to reach does not exist.\n\n` +
    `--- Delivery report follows ---\n` +
    `Final-Recipient: rfc822; ${testEmail}\n` +
    `Action: failed\n` +
    `Status: 5.1.1\n`;

  await processReply({
    from: "MAILER-DAEMON@plane-liberty.com",
    subject: "Undelivered Mail Returned to Sender",
    body: dsnBody,
    messageId: `<bounce-test-${Date.now()}@example.com>`,
    receivedAt: new Date(),
  });

  console.log("processReply returned");

  console.log("\n=== Step 3: verify contact marked invalid + opted out ===");
  const updatedContact = await prisma.contact.findUnique({
    where: { id: contact.id },
  });

  console.log({
    emailStatus: updatedContact?.emailStatus,
    optedOut: updatedContact?.optedOut,
    optedOutAt: updatedContact?.optedOutAt,
    softBounceCount: updatedContact?.softBounceCount,
  });

  const bounceEvent = await prisma.event.findFirst({
    where: { contactId: contact.id, eventType: { in: ["hard_bounce", "soft_bounce"] } },
  });

  console.log("\nBounce event logged:", {
    eventType: bounceEvent?.eventType,
    eventSource: bounceEvent?.eventSource,
  });

  const ok =
    updatedContact?.emailStatus === "invalid" &&
    updatedContact?.optedOut === true &&
    bounceEvent?.eventType === "hard_bounce";

  console.log("\n=== Step 4: cleanup ephemeral data ===");
  await prisma.event.deleteMany({ where: { contactId: contact.id } });
  await prisma.contact.delete({ where: { id: contact.id } });
  await prisma.prospect.delete({ where: { id: prospect.id } });
  console.log("Ephemeral test data removed.");

  if (!ok) {
    console.error("\n❌ Bounce handler did NOT behave as expected");
    process.exit(1);
  }

  console.log("\n✅ Hard-bounce flow OK: contact marked invalid + opted-out + event logged");
  process.exit(0);
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
