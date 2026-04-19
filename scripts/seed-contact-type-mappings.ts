// ---------------------------------------------------------------------------
// Seed contact_type_mappings — initial table of sourceContactType → category
// ---------------------------------------------------------------------------
//
// Run with: npx tsx scripts/seed-contact-type-mappings.ts
//
// Idempotent: uses upsert on typeKey so re-running leaves existing rows
// untouched (except isSystem is kept true).
//
// Source: extraction of the former CATEGORY_MAP (webhooks.ts) + common FR/EN
// synonyms. All seeded rows are marked `isSystem: true` so they cannot be
// deleted from the admin UI — only their category/label can be edited.
// ---------------------------------------------------------------------------

import { PrismaClient, type ProspectCategory } from "@prisma/client";

const prisma = new PrismaClient();

interface Seed {
  typeKey: string;
  category: ProspectCategory;
  label: string;
}

const SEEDS: Seed[] = [
  // ── blogger ────────────────────────────────────────────────
  { typeKey: "blog", category: "blogger", label: "Blog" },
  { typeKey: "blogger", category: "blogger", label: "Blogger (EN)" },
  { typeKey: "blogueur", category: "blogger", label: "Blogueur" },
  { typeKey: "blogueuse", category: "blogger", label: "Blogueuse" },
  { typeKey: "backlink", category: "blogger", label: "Site backlink" },

  // ── media ──────────────────────────────────────────────────
  { typeKey: "presse", category: "media", label: "Presse" },
  { typeKey: "media", category: "media", label: "Média" },
  { typeKey: "medias", category: "media", label: "Médias" },
  { typeKey: "journaliste", category: "media", label: "Journaliste" },
  { typeKey: "journalist", category: "media", label: "Journalist (EN)" },
  { typeKey: "redaction", category: "media", label: "Rédaction" },
  { typeKey: "magazine", category: "media", label: "Magazine" },
  { typeKey: "podcast-radio", category: "media", label: "Podcast / Radio" },

  // ── influencer ─────────────────────────────────────────────
  { typeKey: "influencer", category: "influencer", label: "Influencer (EN)" },
  { typeKey: "influenceur", category: "influencer", label: "Influenceur" },
  { typeKey: "influenceuse", category: "influencer", label: "Influenceuse" },
  { typeKey: "youtubeur", category: "influencer", label: "Youtubeur" },
  { typeKey: "youtuber", category: "influencer", label: "Youtuber" },
  { typeKey: "instagrammeur", category: "influencer", label: "Instagrammeur" },
  { typeKey: "tiktokeur", category: "influencer", label: "TikTokeur" },
  { typeKey: "twitcheur", category: "influencer", label: "Twitcheur" },
  { typeKey: "createur", category: "influencer", label: "Créateur de contenu" },
  { typeKey: "content-creator", category: "influencer", label: "Content creator" },

  // ── podcast ────────────────────────────────────────────────
  { typeKey: "podcast", category: "podcast", label: "Podcast" },
  { typeKey: "podcaster", category: "podcast", label: "Podcaster (EN)" },
  { typeKey: "podcasteur", category: "podcast", label: "Podcasteur" },

  // ── association ────────────────────────────────────────────
  { typeKey: "association", category: "association", label: "Association" },
  { typeKey: "asso", category: "association", label: "Asso" },
  { typeKey: "ong", category: "association", label: "ONG" },
  { typeKey: "ngo", category: "association", label: "NGO" },
  { typeKey: "consulat", category: "association", label: "Consulat" },
  { typeKey: "institut-culturel", category: "association", label: "Institut culturel" },
  { typeKey: "chambre-commerce", category: "association", label: "Chambre de commerce" },
  { typeKey: "alliance-francaise", category: "association", label: "Alliance française" },
  { typeKey: "ufe", category: "association", label: "UFE" },
  { typeKey: "communaute-expat", category: "association", label: "Communauté expat" },
  { typeKey: "lieu-communautaire", category: "association", label: "Lieu communautaire" },

  // ── education ──────────────────────────────────────────────
  { typeKey: "ecole", category: "education", label: "École" },
  { typeKey: "school", category: "education", label: "School (EN)" },
  { typeKey: "universite", category: "education", label: "Université" },
  { typeKey: "university", category: "education", label: "University (EN)" },
  { typeKey: "formation", category: "education", label: "Formation" },
  { typeKey: "training", category: "education", label: "Training" },

  // ── partner ────────────────────────────────────────────────
  { typeKey: "partner", category: "partner", label: "Partner" },
  { typeKey: "partenaire", category: "partner", label: "Partenaire" },
  { typeKey: "affilie", category: "partner", label: "Affilié" },
  { typeKey: "affiliate", category: "partner", label: "Affiliate" },

  // ── agency ─────────────────────────────────────────────────
  { typeKey: "agence", category: "agency", label: "Agence" },
  { typeKey: "agency", category: "agency", label: "Agency (EN)" },
  { typeKey: "studio", category: "agency", label: "Studio" },

  // ── corporate (services B2B) ───────────────────────────────
  { typeKey: "entreprise", category: "corporate", label: "Entreprise" },
  { typeKey: "corporate", category: "corporate", label: "Corporate" },
  { typeKey: "societe", category: "corporate", label: "Société" },
  { typeKey: "company", category: "corporate", label: "Company" },
  { typeKey: "business", category: "corporate", label: "Business" },
  { typeKey: "b2b", category: "corporate", label: "B2B" },
  { typeKey: "avocat", category: "corporate", label: "Avocat" },
  { typeKey: "immobilier", category: "corporate", label: "Immobilier" },
  { typeKey: "assurance", category: "corporate", label: "Assurance" },
  { typeKey: "banque-fintech", category: "corporate", label: "Banque / Fintech" },
  { typeKey: "traducteur", category: "corporate", label: "Traducteur" },
  { typeKey: "agence-voyage", category: "corporate", label: "Agence de voyage" },
  { typeKey: "emploi", category: "corporate", label: "Emploi / RH" },
  { typeKey: "coworking-coliving", category: "corporate", label: "Coworking / Coliving" },
  { typeKey: "logement", category: "corporate", label: "Logement" },

  // ── ecommerce ──────────────────────────────────────────────
  { typeKey: "ecommerce", category: "ecommerce", label: "E-commerce" },
  { typeKey: "e-commerce", category: "ecommerce", label: "E-commerce" },
  { typeKey: "shop", category: "ecommerce", label: "Shop" },
  { typeKey: "boutique", category: "ecommerce", label: "Boutique" },
  { typeKey: "store", category: "ecommerce", label: "Store" },

  // ── forum ──────────────────────────────────────────────────
  { typeKey: "forum", category: "forum", label: "Forum" },
  { typeKey: "community", category: "forum", label: "Community" },
  { typeKey: "reddit", category: "forum", label: "Reddit" },
  { typeKey: "discord", category: "forum", label: "Discord" },
  { typeKey: "groupe-whatsapp-telegram", category: "forum", label: "Groupe WhatsApp / Telegram" },

  // ── directory ──────────────────────────────────────────────
  { typeKey: "annuaire", category: "directory", label: "Annuaire" },
  { typeKey: "directory", category: "directory", label: "Directory (EN)" },
  { typeKey: "listing", category: "directory", label: "Listing" },
  { typeKey: "plateforme-nomad", category: "directory", label: "Plateforme nomade" },
];

async function main(): Promise<void> {
  console.log(`Seeding ${SEEDS.length} contact type mappings...`);

  let created = 0;
  let skipped = 0;

  for (const seed of SEEDS) {
    const existing = await prisma.contactTypeMapping.findUnique({
      where: { typeKey: seed.typeKey },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.contactTypeMapping.create({
      data: {
        typeKey: seed.typeKey,
        category: seed.category,
        label: seed.label,
        isSystem: true,
      },
    });
    created++;
    console.log(`  + ${seed.category.padEnd(11)} ${seed.typeKey.padEnd(26)} ${seed.label}`);
  }

  const total = await prisma.contactTypeMapping.count();
  console.log(`\nDone: ${created} created, ${skipped} already existed. Total: ${total}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
