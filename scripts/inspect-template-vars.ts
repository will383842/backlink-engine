import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const all = await p.messageTemplate.findMany({ orderBy: { id: "asc" } });
const bad = all.filter((t) => /\{[a-zA-Z_][a-zA-Z0-9_]*\}/.test(t.subject + t.body));
console.log(`Total templates: ${all.length}, with placeholders: ${bad.length}\n`);
for (const t of bad) {
  const matches = (t.subject + t.body).match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g);
  console.log(`  #${t.id} lang=${t.language} cat=${t.category ?? "null"} sct=${t.sourceContactType ?? "null"} placeholders=${[...new Set(matches)].join(",")}`);
}
await p.$disconnect();
