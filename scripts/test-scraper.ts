import { scrapeHomepageContent } from "../src/services/enrichment/homepageScraper.js";

async function main() {
  for (const d of ["curiositesdevoyageuses.com", "nouvellecaledonie-tourisme.com", "globetrotteuse.com", "pvtcanada.com", "greaterdays.fr"]) {
    console.log(`\n=== ${d} ===`);
    const r = await scrapeHomepageContent(d);
    console.log(JSON.stringify(r, null, 2));
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
