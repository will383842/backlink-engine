import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const total = await p.prospect.count({ where: { status: "READY_TO_CONTACT", homepageTitle: null, language: { not: null } } });
const all = await p.prospect.count({ where: { status: "READY_TO_CONTACT" } });
const withHp = await p.prospect.count({ where: { status: "READY_TO_CONTACT", homepageTitle: { not: null } } });
console.log("Eligible for backfill:", total);
console.log("Total READY_TO_CONTACT:", all);
console.log("Already with homepageTitle:", withHp);
await p.$disconnect();
