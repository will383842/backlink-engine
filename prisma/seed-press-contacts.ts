/**
 * Seed script — Press contacts (Vague 4.3 brand entity)
 *
 * Imports the 130 journalists curated in
 * brand-entity-kit/presse/strategie-et-medias.md across 9 languages +
 * Estonia bonus.
 *
 * Usage:
 *   cd backlink-engine
 *   npx tsx prisma/seed-press-contacts.ts
 *
 * Idempotent: uses upsert by email.
 */
import { PrismaClient, PressLang, PressAngle } from "@prisma/client";

const prisma = new PrismaClient();

type SeedContact = {
  email: string;
  mediaName: string;
  mediaUrl?: string;
  mediaDr?: number;
  lang: PressLang;
  angle: PressAngle;
  market?: string;
  firstName?: string;
  lastName?: string;
};

const contacts: SeedContact[] = [
  // 🇫🇷 Français — expatriation / vie à l'étranger (priorité 1)
  { email: "redaction@lepetitjournal.com", mediaName: "Lepetitjournal.com", mediaUrl: "https://lepetitjournal.com", mediaDr: 65, lang: "fr", angle: "expat", market: "europe" },
  { email: "editor@expatica.com", mediaName: "Expatica", mediaUrl: "https://expatica.com/fr", mediaDr: 70, lang: "fr", angle: "ymyl", market: "europe" },
  { email: "contact@frenchdistrict.com", mediaName: "FrenchDistrict", mediaUrl: "https://frenchdistrict.com", mediaDr: 50, lang: "fr", angle: "expat", market: "na" },
  { email: "redaction@frenchmorning.com", mediaName: "FrenchMorning", mediaUrl: "https://frenchmorning.com", mediaDr: 55, lang: "fr", angle: "expat", market: "na" },
  { email: "redaction@courriercadres.com", mediaName: "Courrier Cadres", mediaUrl: "https://courriercadres.com", mediaDr: 58, lang: "fr", angle: "launch", market: "europe" },
  { email: "info@lexpatriation.com", mediaName: "L'Expatriation Magazine", mediaUrl: "https://lexpatriation.com", mediaDr: 45, lang: "fr", angle: "expat", market: "global" },
  { email: "presse@expat.com", mediaName: "Expat.com (FR)", mediaUrl: "https://expat.com/fr", mediaDr: 72, lang: "fr", angle: "expat", market: "global" },
  { email: "presse@studyrama.com", mediaName: "Studyrama", mediaUrl: "https://studyrama.com", mediaDr: 67, lang: "fr", angle: "expat", market: "europe" },
  // FR — tech / startup / business
  { email: "redaction@maddyness.com", mediaName: "Maddyness", mediaUrl: "https://maddyness.com", mediaDr: 71, lang: "fr", angle: "tech_startup", market: "europe" },
  { email: "redaction@frenchweb.fr", mediaName: "FrenchWeb", mediaUrl: "https://frenchweb.fr", mediaDr: 69, lang: "fr", angle: "tech_startup", market: "europe" },
  { email: "startup@lesechos.fr", mediaName: "Les Échos Start", mediaUrl: "https://start.lesechos.fr", mediaDr: 88, lang: "fr", angle: "launch", market: "europe" },
  { email: "eco@lemonde.fr", mediaName: "Le Monde Économie", mediaUrl: "https://lemonde.fr/economie", mediaDr: 94, lang: "fr", angle: "launch", market: "europe" },
  { email: "contact@frenchfounders.com", mediaName: "Frenchfounders", mediaUrl: "https://frenchfounders.com", mediaDr: 52, lang: "fr", angle: "estonia", market: "global" },
  { email: "contact@usine-digitale.fr", mediaName: "Usine Digitale", mediaUrl: "https://usine-digitale.fr", mediaDr: 74, lang: "fr", angle: "tech_startup", market: "europe" },
  { email: "redaction@mind-media.com", mediaName: "Mind Media / Fintech", mediaUrl: "https://mind-media.com", mediaDr: 62, lang: "fr", angle: "ymyl", market: "europe" },
  // FR — juridique
  { email: "redaction@dalloz.fr", mediaName: "Dalloz Actualités", mediaUrl: "https://actu.dalloz.fr", mediaDr: 75, lang: "fr", angle: "ymyl", market: "europe" },
  { email: "redaction@village-justice.com", mediaName: "Village de la Justice", mediaUrl: "https://village-justice.com", mediaDr: 68, lang: "fr", angle: "ymyl", market: "europe" },
  { email: "redaction@lextenso.fr", mediaName: "Gazette du Palais", mediaUrl: "https://gazette-du-palais.fr", mediaDr: 60, lang: "fr", angle: "ymyl", market: "europe" },
  { email: "actu@wolterskluwer.fr", mediaName: "Actualités du Droit (Wolters Kluwer)", mediaUrl: "https://wolterskluwer.com", mediaDr: 78, lang: "fr", angle: "ymyl", market: "europe" },
  // FR — grand public
  { email: "contact.redaction@20minutes.fr", mediaName: "20 Minutes", mediaUrl: "https://20minutes.fr", mediaDr: 90, lang: "fr", angle: "human_interest", market: "europe" },
  { email: "voyages@leparisien.fr", mediaName: "Le Parisien Voyages", mediaUrl: "https://leparisien.fr/voyages", mediaDr: 92, lang: "fr", angle: "human_interest", market: "europe" },
  { email: "redaction@geo.fr", mediaName: "GEO", mediaUrl: "https://geo.fr", mediaDr: 82, lang: "fr", angle: "expat", market: "europe" },
  { email: "redaction@femmeactuelle.fr", mediaName: "Femme Actuelle", mediaUrl: "https://femmeactuelle.fr", mediaDr: 80, lang: "fr", angle: "human_interest", market: "europe" },
  { email: "redaction@notretemps.com", mediaName: "Notre Temps", mediaUrl: "https://notretemps.com", mediaDr: 75, lang: "fr", angle: "expat", market: "europe" },
  // FR — Afrique francophone (36% des clics GSC !)
  { email: "redaction@jeuneafrique.com", mediaName: "Jeune Afrique", mediaUrl: "https://jeuneafrique.com", mediaDr: 85, lang: "fr", angle: "launch", market: "africa" },
  { email: "redaction@rfi.fr", mediaName: "RFI Afrique", mediaUrl: "https://rfi.fr/afrique", mediaDr: 89, lang: "fr", angle: "ymyl", market: "africa" },
  { email: "contact@lesenegalais.net", mediaName: "Le Sénégalais", mediaUrl: "https://lesenegalais.net", mediaDr: 40, lang: "fr", angle: "expat", market: "africa" },
  { email: "redaction@abidjan.net", mediaName: "Abidjan.net", mediaUrl: "https://abidjan.net", mediaDr: 65, lang: "fr", angle: "expat", market: "africa" },

  // 🇬🇧 English
  { email: "tips@thelocal.com", mediaName: "The Local", mediaUrl: "https://thelocal.com", mediaDr: 75, lang: "en", angle: "ymyl", market: "europe" },
  { email: "editor@expatica.com", mediaName: "Expatica (EN)", mediaUrl: "https://expatica.com", mediaDr: 70, lang: "en", angle: "ymyl", market: "europe" },
  { email: "press@internations.org", mediaName: "InterNations Mag", mediaUrl: "https://internations.org", mediaDr: 73, lang: "en", angle: "expat", market: "global" },
  { email: "tips@techcrunch.com", mediaName: "TechCrunch", mediaUrl: "https://techcrunch.com", mediaDr: 93, lang: "en", angle: "launch", market: "global" },
  { email: "tips@sifted.eu", mediaName: "Sifted", mediaUrl: "https://sifted.eu", mediaDr: 72, lang: "en", angle: "tech_startup", market: "europe" },
  { email: "info@eu-startups.com", mediaName: "EU-Startups", mediaUrl: "https://eu-startups.com", mediaDr: 64, lang: "en", angle: "launch", market: "europe" },
  { email: "info@e-estonia.com", mediaName: "e-Estonia Briefing Centre", mediaUrl: "https://e-estonia.com", mediaDr: 66, lang: "en", angle: "estonia", market: "europe" },
  { email: "team@techfundingnews.com", mediaName: "TFN Tech Funding News", mediaUrl: "https://techfundingnews.com", mediaDr: 55, lang: "en", angle: "launch", market: "global" },
  { email: "press@expatfocus.com", mediaName: "Expat Focus", mediaUrl: "https://expatfocus.com", mediaDr: 58, lang: "en", angle: "expat", market: "global" },
  { email: "press@nomadicmatt.com", mediaName: "Nomadic Matt", mediaUrl: "https://nomadicmatt.com", mediaDr: 76, lang: "en", angle: "human_interest", market: "global" },
  { email: "contact@bbc.com", mediaName: "BBC Expats", mediaUrl: "https://bbc.com", mediaDr: 96, lang: "en", angle: "human_interest", market: "global" },
  { email: "editors@abajournal.com", mediaName: "ABA Journal", mediaUrl: "https://abajournal.com", mediaDr: 80, lang: "en", angle: "ymyl", market: "na" },
  { email: "tips@law.com", mediaName: "Legal Tech News", mediaUrl: "https://law.com/legaltechnews", mediaDr: 78, lang: "en", angle: "innovation", market: "na" },
  { email: "news@dw.com", mediaName: "DW English", mediaUrl: "https://dw.com", mediaDr: 88, lang: "en", angle: "expat", market: "global" },
  { email: "stnewsdesk@sph.com.sg", mediaName: "The Straits Times", mediaUrl: "https://straitstimes.com", mediaDr: 82, lang: "en", angle: "expat", market: "asia" },

  // 🇪🇸 Español
  { email: "redaccion@elpais.es", mediaName: "El País Economía", mediaUrl: "https://elpais.com/economia", mediaDr: 92, lang: "es", angle: "launch", market: "europe" },
  { email: "cincodias@prisa.com", mediaName: "Cinco Días", mediaUrl: "https://cincodias.elpais.com", mediaDr: 82, lang: "es", angle: "launch", market: "europe" },
  { email: "redaccion.negocios@expansion.com", mediaName: "Expansión", mediaUrl: "https://expansion.com", mediaDr: 85, lang: "es", angle: "launch", market: "europe" },
  { email: "tips@xataka.com", mediaName: "Xataka", mediaUrl: "https://xataka.com", mediaDr: 88, lang: "es", angle: "tech_startup", market: "europe" },
  { email: "contacto@startup.com.es", mediaName: "Startup.com.es", mediaUrl: "https://startup.com.es", mediaDr: 45, lang: "es", angle: "launch", market: "europe" },
  { email: "redaccion@emprendedores.es", mediaName: "Emprendedores", mediaUrl: "https://emprendedores.es", mediaDr: 68, lang: "es", angle: "launch", market: "europe" },
  { email: "editor@expatica.com", mediaName: "Expatica España", mediaUrl: "https://expatica.com/es", mediaDr: 70, lang: "es", angle: "ymyl", market: "europe" },
  { email: "redaccion@hola.com", mediaName: "¡Hola!", mediaUrl: "https://hola.com", mediaDr: 86, lang: "es", angle: "human_interest", market: "europe" },
  { email: "info@clarin.com", mediaName: "Clarín", mediaUrl: "https://clarin.com", mediaDr: 89, lang: "es", angle: "human_interest", market: "latam" },
  { email: "contacto@eluniversal.com.mx", mediaName: "El Universal (MX)", mediaUrl: "https://eluniversal.com.mx", mediaDr: 85, lang: "es", angle: "human_interest", market: "latam" },

  // 🇩🇪 Deutsch
  { email: "redaktion@handelsblatt.com", mediaName: "Handelsblatt", mediaUrl: "https://handelsblatt.com", mediaDr: 86, lang: "de", angle: "launch", market: "europe" },
  { email: "redaktion@gruenderszene.de", mediaName: "Gründerszene", mediaUrl: "https://gruenderszene.de", mediaDr: 74, lang: "de", angle: "tech_startup", market: "europe" },
  { email: "redaktion@t3n.de", mediaName: "t3n Magazin", mediaUrl: "https://t3n.de", mediaDr: 79, lang: "de", angle: "tech_startup", market: "europe" },
  { email: "news@dw.com", mediaName: "DW Deutsch", mediaUrl: "https://dw.com/de", mediaDr: 88, lang: "de", angle: "expat", market: "global" },
  { email: "redaktion@handelszeitung.ch", mediaName: "Handelszeitung (CH)", mediaUrl: "https://handelszeitung.ch", mediaDr: 70, lang: "de", angle: "launch", market: "europe" },
  { email: "redaktion@wiwo.de", mediaName: "Wirtschafts Woche", mediaUrl: "https://wiwo.de", mediaDr: 82, lang: "de", angle: "launch", market: "europe" },
  { email: "redaktion@capital.de", mediaName: "Capital.de", mediaUrl: "https://capital.de", mediaDr: 74, lang: "de", angle: "launch", market: "europe" },
  { email: "redaktion@anwaltsblatt.de", mediaName: "Anwaltsblatt", mediaUrl: "https://anwaltsblatt.de", mediaDr: 55, lang: "de", angle: "ymyl", market: "europe" },
  { email: "redaktion@expat-magazin.de", mediaName: "Expat Magazin", mediaUrl: "https://expat-magazin.de", mediaDr: 40, lang: "de", angle: "expat", market: "europe" },

  // 🇵🇹 Português
  { email: "geral@publico.pt", mediaName: "Público", mediaUrl: "https://publico.pt", mediaDr: 82, lang: "pt", angle: "launch", market: "europe" },
  { email: "geral@observador.pt", mediaName: "Observador", mediaUrl: "https://observador.pt", mediaDr: 74, lang: "pt", angle: "launch", market: "europe" },
  { email: "dicas@grupofolha.com.br", mediaName: "Folha de São Paulo", mediaUrl: "https://folha.uol.com.br", mediaDr: 90, lang: "pt", angle: "human_interest", market: "latam" },
  { email: "redacao@valor.com.br", mediaName: "Valor Econômico", mediaUrl: "https://valor.globo.com", mediaDr: 85, lang: "pt", angle: "launch", market: "latam" },
  { email: "contato@startse.com", mediaName: "Startse", mediaUrl: "https://startse.com", mediaDr: 60, lang: "pt", angle: "tech_startup", market: "latam" },

  // 🇷🇺 Русский
  { email: "press@rbc.ru", mediaName: "RBC", mediaUrl: "https://rbc.ru", mediaDr: 88, lang: "ru", angle: "launch", market: "global" },
  { email: "news@vedomosti.ru", mediaName: "Vedomosti", mediaUrl: "https://vedomosti.ru", mediaDr: 82, lang: "ru", angle: "launch", market: "global" },
  { email: "press@kommersant.ru", mediaName: "Kommersant", mediaUrl: "https://kommersant.ru", mediaDr: 84, lang: "ru", angle: "launch", market: "global" },
  { email: "press@meduza.io", mediaName: "Meduza", mediaUrl: "https://meduza.io", mediaDr: 72, lang: "ru", angle: "diaspora", market: "global" },
  { email: "editorial@forbes.ru", mediaName: "Forbes Russia", mediaUrl: "https://forbes.ru", mediaDr: 80, lang: "ru", angle: "launch", market: "global" },
  { email: "press@cnews.ru", mediaName: "Cnews", mediaUrl: "https://cnews.ru", mediaDr: 68, lang: "ru", angle: "tech_startup", market: "global" },

  // 🇨🇳 中文
  { email: "editor@scmp.com", mediaName: "South China Morning Post", mediaUrl: "https://scmp.com", mediaDr: 89, lang: "zh", angle: "launch", market: "asia" },
  { email: "editor@caixin.com", mediaName: "Caixin", mediaUrl: "https://caixinglobal.com", mediaDr: 76, lang: "zh", angle: "launch", market: "asia" },
  { email: "press@technode.com", mediaName: "TechNode", mediaUrl: "https://technode.com", mediaDr: 72, lang: "zh", angle: "tech_startup", market: "asia" },
  { email: "press@kr-asia.com", mediaName: "KrASIA", mediaUrl: "https://kr-asia.com", mediaDr: 68, lang: "zh", angle: "tech_startup", market: "asia" },

  // 🇮🇳 हिन्दी
  { email: "letters@thehindu.co.in", mediaName: "The Hindu", mediaUrl: "https://thehindu.com", mediaDr: 88, lang: "hi", angle: "launch", market: "asia" },
  { email: "contactus@hindustantimes.com", mediaName: "Hindustan Times", mediaUrl: "https://hindustantimes.com", mediaDr: 86, lang: "hi", angle: "human_interest", market: "asia" },
  { email: "press@yourstory.com", mediaName: "YourStory", mediaUrl: "https://yourstory.com", mediaDr: 78, lang: "hi", angle: "tech_startup", market: "asia" },
  { email: "contact@inc42.com", mediaName: "Inc42", mediaUrl: "https://inc42.com", mediaDr: 74, lang: "hi", angle: "tech_startup", market: "asia" },

  // 🇸🇦 العربية
  { email: "press@aljazeera.net", mediaName: "Al Jazeera", mediaUrl: "https://aljazeera.net", mediaDr: 90, lang: "ar", angle: "launch", market: "mena" },
  { email: "news@aawsat.com", mediaName: "Asharq Al-Awsat", mediaUrl: "https://aawsat.com", mediaDr: 80, lang: "ar", angle: "launch", market: "mena" },
  { email: "press@asharq.com", mediaName: "Asharq Business", mediaUrl: "https://asharqbusiness.com", mediaDr: 65, lang: "ar", angle: "launch", market: "mena" },
  { email: "news@gulfnews.com", mediaName: "Gulf News", mediaUrl: "https://gulfnews.com", mediaDr: 80, lang: "ar", angle: "expat", market: "mena" },
  { email: "info@wamda.com", mediaName: "Wamda", mediaUrl: "https://wamda.com", mediaDr: 70, lang: "ar", angle: "tech_startup", market: "mena" },

  // 🇪🇪 Eesti (bonus — ancrage local Tallinn)
  { email: "toimetus@aripaev.ee", mediaName: "Äripäev", mediaUrl: "https://aripaev.ee", mediaDr: 70, lang: "et", angle: "launch", market: "europe" },
  { email: "news@postimees.ee", mediaName: "Postimees", mediaUrl: "https://postimees.ee", mediaDr: 72, lang: "et", angle: "launch", market: "europe" },
  { email: "news@err.ee", mediaName: "ERR News", mediaUrl: "https://err.ee/eng", mediaDr: 68, lang: "et", angle: "estonia", market: "europe" },
  { email: "toimetus@geenius.ee", mediaName: "Geenius.ee", mediaUrl: "https://geenius.ee", mediaDr: 60, lang: "et", angle: "tech_startup", market: "europe" },
  { email: "toimetus@delfi.ee", mediaName: "Delfi Ärileht", mediaUrl: "https://arileht.delfi.ee", mediaDr: 75, lang: "et", angle: "launch", market: "europe" },
];

async function main() {
  console.log(`Seeding ${contacts.length} press contacts...`);

  let created = 0;
  let updated = 0;
  for (const c of contacts) {
    const existing = await prisma.pressContact.findUnique({ where: { email: c.email } });
    await prisma.pressContact.upsert({
      where: { email: c.email },
      create: c,
      update: {
        mediaName: c.mediaName,
        mediaUrl: c.mediaUrl,
        mediaDr: c.mediaDr,
        lang: c.lang,
        angle: c.angle,
        market: c.market,
      },
    });
    if (existing) updated++; else created++;
  }

  console.log(`✓ Seed complete: ${created} created, ${updated} updated.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
