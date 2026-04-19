// ---------------------------------------------------------------------------
// Seed CrawlSources — public expat directories, safe (no Google scraping)
// ---------------------------------------------------------------------------
//
// Run with: npx tsx scripts/seed-crawl-sources.ts
//
// Only seeds sources that are safe to crawl (public directories, RSS-style
// listings, competitor backlink analysis, write-for-us detection). Does NOT
// seed any `search_engine` source (Google scraping is disabled).
// ---------------------------------------------------------------------------

import { PrismaClient, type CrawlSourceType } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedSource {
  name: string;
  type: CrawlSourceType;
  baseUrl?: string;
  config?: Record<string, unknown>;
}

const SOURCES: SeedSource[] = [
  // -------------------------------------------------------------------------
  // Blog directories — public listings of expat/travel/lifestyle blogs
  // -------------------------------------------------------------------------
  {
    name: "AllTop — Expat blogs",
    type: "blog_directory",
    baseUrl: "https://alltop.com/topics/expat",
    config: { linkSelector: "h3 a" },
  },
  {
    name: "AllTop — Travel blogs",
    type: "blog_directory",
    baseUrl: "https://alltop.com/topics/travel",
    config: { linkSelector: "h3 a" },
  },
  {
    name: "AllTop — International blogs",
    type: "blog_directory",
    baseUrl: "https://alltop.com/topics/international",
    config: { linkSelector: "h3 a" },
  },
  {
    name: "Blogarama — Travel",
    type: "blog_directory",
    baseUrl: "https://www.blogarama.com/travel-blogs",
    config: { linkSelector: ".blog-title a" },
  },
  {
    name: "Blogarama — Expat",
    type: "blog_directory",
    baseUrl: "https://www.blogarama.com/search?q=expat",
    config: { linkSelector: ".blog-title a" },
  },
  {
    name: "Feedspot — Top Expat Blogs",
    type: "blog_directory",
    baseUrl: "https://blog.feedspot.com/expat_blogs/",
    config: { linkSelector: ".ext-link" },
  },
  {
    name: "Feedspot — Top Travel Blogs",
    type: "blog_directory",
    baseUrl: "https://blog.feedspot.com/travel_blogs/",
    config: { linkSelector: ".ext-link" },
  },
  {
    name: "Feedspot — Digital Nomad Blogs",
    type: "blog_directory",
    baseUrl: "https://blog.feedspot.com/digital_nomad_blogs/",
    config: { linkSelector: ".ext-link" },
  },
  {
    name: "Feedspot — International Students Blogs",
    type: "blog_directory",
    baseUrl: "https://blog.feedspot.com/international_student_blogs/",
    config: { linkSelector: ".ext-link" },
  },
  {
    name: "Feedspot — Retirement Abroad Blogs",
    type: "blog_directory",
    baseUrl: "https://blog.feedspot.com/retirement_blogs/",
    config: { linkSelector: ".ext-link" },
  },
  {
    name: "Expat.com — Blogs index",
    type: "blog_directory",
    baseUrl: "https://www.expat.com/en/blog/",
    config: { linkSelector: "a[href*='/blog/']" },
  },
  {
    name: "InterNations — Expat communities",
    type: "blog_directory",
    baseUrl: "https://www.internations.org/communities",
    config: { linkSelector: "a[href*='/community/']" },
  },
  {
    name: "ExpatExchange — Expat blogs",
    type: "blog_directory",
    baseUrl: "https://www.expatexchange.com/expatblog.html",
    config: { linkSelector: "a[href*='expatblog']" },
  },
  {
    name: "ExpatArrivals — Country guides",
    type: "blog_directory",
    baseUrl: "https://www.expatarrivals.com/",
    config: { linkSelector: "a[href*='/country/']" },
  },
  {
    name: "ExpatFocus — Country guides",
    type: "blog_directory",
    baseUrl: "https://www.expatfocus.com/",
    config: { linkSelector: "a[href*='/expat-']" },
  },
  {
    name: "Just Landed — Country guides",
    type: "blog_directory",
    baseUrl: "https://www.justlanded.com/english/Common/Footer/Destinations",
    config: { linkSelector: "a" },
  },
  {
    name: "NomadList — City guides",
    type: "blog_directory",
    baseUrl: "https://nomadlist.com/",
    config: { linkSelector: "a[href*='/in/']" },
  },
  {
    name: "TravelBloggerCommunity",
    type: "blog_directory",
    baseUrl: "https://travelbloggercommunity.com/list-of-travel-bloggers/",
    config: { linkSelector: "a[target='_blank']" },
  },
  {
    name: "TheExpeditioner — Travel blogs",
    type: "blog_directory",
    baseUrl: "https://www.theexpeditioner.com/travel-blogs/",
    config: { linkSelector: "article a" },
  },
  {
    name: "Travellerspoint — Travel blogs",
    type: "blog_directory",
    baseUrl: "https://www.travellerspoint.com/blogs/",
    config: { linkSelector: "a[href*='/blog/']" },
  },

  // -------------------------------------------------------------------------
  // Competitor backlinks — analyse links pointing to known competitors
  // -------------------------------------------------------------------------
  {
    name: "Competitor backlinks — global expat platforms",
    type: "competitor_backlinks",
    config: {
      competitorDomains: [
        "expat.com",
        "internations.org",
        "expatexchange.com",
        "expatarrivals.com",
        "expatfocus.com",
        "justlanded.com",
      ],
    },
  },
  {
    name: "Competitor backlinks — digital nomad platforms",
    type: "competitor_backlinks",
    config: {
      competitorDomains: [
        "nomadlist.com",
        "remoteyear.com",
        "wifitribe.co",
      ],
    },
  },
  {
    name: "Competitor backlinks — relocation & legal services",
    type: "competitor_backlinks",
    config: {
      competitorDomains: [
        "relocate.world",
        "sojournies.com",
      ],
    },
  },

  // -------------------------------------------------------------------------
  // Write-for-us — auto-detect guest post pages across seeded domains
  // -------------------------------------------------------------------------
  {
    name: "Write-for-us — expat & travel footprints",
    type: "write_for_us",
    config: {
      footprints: [
        "expat \"write for us\"",
        "expat \"guest post\"",
        "expat \"contribute\"",
        "travel \"write for us\"",
        "travel \"guest post\"",
        "travel \"contribute\"",
        "digital nomad \"write for us\"",
        "living abroad \"guest post\"",
        "moving abroad \"write for us\"",
        "relocation \"guest post\"",
      ],
    },
  },
];

async function main(): Promise<void> {
  console.log(`Seeding ${SOURCES.length} crawl sources...`);

  let created = 0;
  let skipped = 0;

  for (const source of SOURCES) {
    const existing = await prisma.crawlSource.findFirst({
      where: { name: source.name },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.crawlSource.create({
      data: {
        name: source.name,
        type: source.type,
        baseUrl: source.baseUrl ?? null,
        config: (source.config ?? {}) as unknown as import("@prisma/client").Prisma.InputJsonValue,
        isActive: true,
      },
    });
    created++;
    console.log(`  + ${source.type.padEnd(22)} ${source.name}`);
  }

  console.log(`\nDone: ${created} created, ${skipped} already existed.`);
  console.log(`Total active crawl sources: ${await prisma.crawlSource.count({ where: { isActive: true } })}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
