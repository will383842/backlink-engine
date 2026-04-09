import { redis } from "../../config/redis.js";
import { getLlmClient } from "../../llm/index.js";
import { createChildLogger } from "../../utils/logger.js";
import type { GeneratedEmail } from "../../llm/types.js";

const log = createChildLogger("variation-cache");

const CACHE_TTL = 7 * 24 * 60 * 60; // 7 days
const DEFAULT_VARIATION_COUNT = 15;

/**
 * Fallback templates used when Claude API fails.
 * Keyed by language, each with 3 basic variations.
 */
const FALLBACK_TEMPLATES: Record<string, GeneratedEmail[]> = {
  fr: [
    { subject: "Proposition de collaboration — SOS Expat", body: "Bonjour {{CONTACT_NAME}},\n\nSOS Expat accompagne les expatriés du monde entier en les connectant avec des professionnels qualifiés.\n\nNous pensons qu'une collaboration avec {{DOMAIN}} pourrait être bénéfique pour nos deux communautés.\n\nSeriez-vous disponible pour un échange ?\n\nCordialement,\nSOS Expat\nhttps://sos-expat.com" },
    { subject: "Partenariat SOS Expat × {{DOMAIN}}", body: "Bonjour {{CONTACT_NAME}},\n\nJe me permets de vous contacter depuis SOS Expat, plateforme d'assistance internationale pour expatriés.\n\nVotre activité sur {{DOMAIN}} rejoint notre mission. Un partenariat pourrait offrir une belle visibilité à nos deux organisations.\n\nÀ bientôt,\nL'équipe SOS Expat\nhttps://sos-expat.com" },
    { subject: "SOS Expat — Opportunité de partenariat", body: "Bonjour {{CONTACT_NAME}},\n\nSOS Expat met en relation les expatriés avec des avocats, consultants et experts dans plus de 50 pays.\n\nNous aimerions explorer une synergie avec {{DOMAIN}} pour mieux servir la communauté expatriée.\n\nBien cordialement,\nSOS Expat\nhttps://sos-expat.com" },
  ],
  en: [
    { subject: "Partnership opportunity — SOS Expat", body: "Hello {{CONTACT_NAME}},\n\nSOS Expat connects expatriates worldwide with qualified professionals: lawyers, consultants, and experts.\n\nWe believe a partnership with {{DOMAIN}} could benefit both our communities.\n\nWould you be open to a brief conversation?\n\nBest regards,\nSOS Expat Team\nhttps://sos-expat.com" },
    { subject: "SOS Expat × {{DOMAIN}} — Collaboration", body: "Hi {{CONTACT_NAME}},\n\nI'm reaching out from SOS Expat, an international assistance platform for expatriates.\n\nYour work at {{DOMAIN}} aligns with our mission. A collaboration could bring valuable exposure to both our audiences.\n\nLooking forward to hearing from you,\nSOS Expat\nhttps://sos-expat.com" },
    { subject: "SOS Expat — Let's partner up", body: "Hello {{CONTACT_NAME}},\n\nSOS Expat helps expatriates find lawyers, consultants, and experts in 50+ countries.\n\nWe'd love to explore synergies with {{DOMAIN}} to better serve the expat community.\n\nKind regards,\nSOS Expat\nhttps://sos-expat.com" },
  ],
  de: [
    { subject: "Partnerschaftsmöglichkeit — SOS Expat", body: "Hallo {{CONTACT_NAME}},\n\nSOS Expat verbindet Expatriates weltweit mit qualifizierten Fachleuten: Anwälte, Berater und Experten.\n\nWir glauben, dass eine Partnerschaft mit {{DOMAIN}} für beide Seiten vorteilhaft wäre.\n\nWären Sie offen für ein kurzes Gespräch?\n\nMit freundlichen Grüßen,\nSOS Expat\nhttps://sos-expat.com" },
  ],
  es: [
    { subject: "Oportunidad de colaboración — SOS Expat", body: "Hola {{CONTACT_NAME}},\n\nSOS Expat conecta a expatriados de todo el mundo con profesionales cualificados: abogados, consultores y expertos.\n\nCreemos que una colaboración con {{DOMAIN}} podría beneficiar a nuestras comunidades.\n\n¿Estaría disponible para una breve conversación?\n\nSaludos cordiales,\nSOS Expat\nhttps://sos-expat.com" },
  ],
  pt: [
    { subject: "Oportunidade de parceria — SOS Expat", body: "Olá {{CONTACT_NAME}},\n\nA SOS Expat conecta expatriados em todo o mundo com profissionais qualificados: advogados, consultores e especialistas.\n\nAcreditamos que uma parceria com {{DOMAIN}} poderia beneficiar ambas as comunidades.\n\nEstaria disponível para uma breve conversa?\n\nAtenciosamente,\nSOS Expat\nhttps://sos-expat.com" },
  ],
  nl: [
    { subject: "Samenwerkingsmogelijkheid — SOS Expat", body: "Beste {{CONTACT_NAME}},\n\nSOS Expat verbindt expatriates wereldwijd met gekwalificeerde professionals: advocaten, consultants en experts.\n\nWij geloven dat een samenwerking met {{DOMAIN}} waardevol kan zijn voor beide gemeenschappen.\n\nZou u openstaan voor een kort gesprek?\n\nMet vriendelijke groet,\nSOS Expat\nhttps://sos-expat.com" },
  ],
  it: [
    { subject: "Opportunità di collaborazione — SOS Expat", body: "Gentile {{CONTACT_NAME}},\n\nSOS Expat mette in contatto gli espatriati di tutto il mondo con professionisti qualificati: avvocati, consulenti ed esperti.\n\nCrediamo che una collaborazione con {{DOMAIN}} possa portare valore a entrambe le nostre comunità.\n\nSarebbe disponibile per un breve scambio?\n\nCordiali saluti,\nSOS Expat\nhttps://sos-expat.com" },
  ],
  ar: [
    { subject: "فرصة شراكة — SOS Expat", body: "{{CONTACT_NAME}} عزيزي/عزيزتي\n\nتربط SOS Expat المغتربين حول العالم بمحترفين مؤهلين: محامين ومستشارين وخبراء.\n\nنعتقد أن الشراكة مع {{DOMAIN}} يمكن أن تعود بالنفع على مجتمعينا.\n\nهل أنتم مستعدون لمحادثة قصيرة؟\n\nمع أطيب التحيات،\nSOS Expat\nhttps://sos-expat.com" },
  ],
  ja: [
    { subject: "パートナーシップのご提案 — SOS Expat", body: "{{CONTACT_NAME}} 様\n\nSOS Expatは、世界中の駐在員と弁護士、コンサルタント、専門家などの有資格専門家をつなぐプラットフォームです。\n\n{{DOMAIN}}とのパートナーシップが、双方のコミュニティに価値をもたらすと考えております。\n\n短いお打ち合わせのお時間をいただけますでしょうか？\n\nよろしくお願いいたします。\nSOS Expat\nhttps://sos-expat.com" },
  ],
  ru: [
    { subject: "Возможность сотрудничества — SOS Expat", body: "Здравствуйте, {{CONTACT_NAME}}!\n\nSOS Expat связывает экспатриантов по всему миру с квалифицированными специалистами: юристами, консультантами и экспертами.\n\nМы считаем, что сотрудничество с {{DOMAIN}} может быть выгодным для обоих наших сообществ.\n\nБыли бы вы открыты для короткой беседы?\n\nС уважением,\nSOS Expat\nhttps://sos-expat.com" },
  ],
  sv: [
    { subject: "Samarbetsmöjlighet — SOS Expat", body: "Hej {{CONTACT_NAME}},\n\nSOS Expat kopplar samman utlandssvenskar världen över med kvalificerade yrkesverksamma: advokater, konsulter och experter.\n\nVi tror att ett samarbete med {{DOMAIN}} kan gynna båda våra gemenskaper.\n\nSkulle du vara öppen för ett kort samtal?\n\nMed vänliga hälsningar,\nSOS Expat\nhttps://sos-expat.com" },
  ],
  pl: [
    { subject: "Możliwość współpracy — SOS Expat", body: "Szanowny/a {{CONTACT_NAME}},\n\nSOS Expat łączy ekspatów na całym świecie z wykwalifikowanymi specjalistami: prawnikami, konsultantami i ekspertami.\n\nWierzymy, że współpraca z {{DOMAIN}} może przynieść korzyści obu naszym społecznościom.\n\nCzy byłby/łaby Pan/Pani otwarty/a na krótką rozmowę?\n\nZ poważaniem,\nSOS Expat\nhttps://sos-expat.com" },
  ],
  ko: [
    { subject: "파트너십 제안 — SOS Expat", body: "{{CONTACT_NAME}} 님께,\n\nSOS Expat는 전 세계 해외 거주자들을 변호사, 컨설턴트, 전문가 등 자격을 갖춘 전문가와 연결하는 플랫폼입니다.\n\n{{DOMAIN}}과의 파트너십이 양측 커뮤니티에 가치를 가져올 수 있다고 생각합니다.\n\n짧은 대화의 기회를 주시겠습니까?\n\n감사합니다.\nSOS Expat\nhttps://sos-expat.com" },
  ],
  da: [
    { subject: "Samarbejdsmulighed — SOS Expat", body: "Kære {{CONTACT_NAME}},\n\nSOS Expat forbinder udlandsdanskere verden over med kvalificerede fagfolk: advokater, konsulenter og eksperter.\n\nVi tror, at et samarbejde med {{DOMAIN}} kan gavne begge vores fællesskaber.\n\nVille du være åben for en kort samtale?\n\nMed venlig hilsen,\nSOS Expat\nhttps://sos-expat.com" },
  ],
  tr: [
    { subject: "İş birliği fırsatı — SOS Expat", body: "Sayın {{CONTACT_NAME}},\n\nSOS Expat, dünya genelindeki gurbetçileri avukatlar, danışmanlar ve uzmanlar gibi nitelikli profesyonellerle buluşturan bir platformdur.\n\n{{DOMAIN}} ile bir iş birliğinin her iki topluluk için de faydalı olabileceğine inanıyoruz.\n\nKısa bir görüşmeye açık olur musunuz?\n\nSaygılarımla,\nSOS Expat\nhttps://sos-expat.com" },
  ],
  no: [
    { subject: "Samarbeidsmulighet — SOS Expat", body: "Hei {{CONTACT_NAME}},\n\nSOS Expat kobler utlandsboende nordmenn verden over med kvalifiserte fagfolk: advokater, konsulenter og eksperter.\n\nVi tror et samarbeid med {{DOMAIN}} kan være gunstig for begge våre miljøer.\n\nVille du vært åpen for en kort samtale?\n\nMed vennlig hilsen,\nSOS Expat\nhttps://sos-expat.com" },
  ],
};

/**
 * Get the Redis cache key for a campaign's variations.
 */
function cacheKey(campaignId: number, language: string, contactType: string): string {
  return `broadcast:${campaignId}:variations:${language}:${contactType}`;
}

/**
 * Get or generate variations for a campaign + language + contactType combo.
 * Caches in Redis for 7 days.
 */
export async function getVariations(
  campaignId: number,
  language: string,
  contactType: string,
  sourceEmail: { subject: string; body: string },
  brief: string,
): Promise<GeneratedEmail[]> {
  const key = cacheKey(campaignId, language, contactType);

  // Try cache first
  try {
    const cached = await redis.get(key);
    if (cached) {
      log.debug({ campaignId, language, contactType }, "Variation cache HIT");
      return JSON.parse(cached) as GeneratedEmail[];
    }
  } catch {
    // Redis error — proceed with generation
  }

  log.info({ campaignId, language, contactType }, "Variation cache MISS — generating...");

  let variations: GeneratedEmail[];
  try {
    const llm = getLlmClient();
    variations = await llm.generateBroadcastVariations({
      sourceSubject: sourceEmail.subject,
      sourceBody: sourceEmail.body,
      brief,
      language,
      contactType,
      count: DEFAULT_VARIATION_COUNT,
    });
  } catch (err) {
    log.warn({ campaignId, language, contactType, error: err instanceof Error ? err.message : String(err) }, "LLM generation failed — using fallback templates.");
    variations = FALLBACK_TEMPLATES[language] ?? FALLBACK_TEMPLATES["en"] ?? [
      { subject: "Partnership proposal — SOS Expat", body: "Hello {{CONTACT_NAME}},\n\nWe would love to discuss a collaboration with {{DOMAIN}}.\n\nBest regards,\nSOS Expat\nhttps://sos-expat.com" },
    ];
  }

  // Store in cache
  try {
    await redis.setex(key, CACHE_TTL, JSON.stringify(variations));
    log.info({ campaignId, language, contactType, count: variations.length }, "Variations cached.");
  } catch {
    // Redis error — variations still usable
  }

  return variations;
}

/**
 * Pick a random variation and personalize it with the recipient's info.
 */
export function pickAndPersonalize(
  variations: GeneratedEmail[],
  contactName: string | null,
  domain: string | null,
): GeneratedEmail {
  if (!variations.length) {
    return { subject: "Partnership proposal", body: "Hello,\n\nWe would love to discuss a collaboration.\n\nBest regards" };
  }
  const idx = Math.floor(Math.random() * variations.length);
  const variation = variations[idx];

  const name = contactName || "";
  const domainStr = domain || "";

  return {
    subject: variation.subject
      .replace(/\{\{CONTACT_NAME\}\}/g, name)
      .replace(/\{\{DOMAIN\}\}/g, domainStr),
    body: variation.body
      .replace(/\{\{CONTACT_NAME\}\}/g, name)
      .replace(/\{\{DOMAIN\}\}/g, domainStr),
  };
}

/**
 * Invalidate all cached variations for a campaign (e.g., when source email changes).
 */
export async function invalidateCampaignVariations(campaignId: number): Promise<void> {
  try {
    const keys = await redis.keys(`broadcast:${campaignId}:variations:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
      log.info({ campaignId, count: keys.length }, "Variation cache invalidated.");
    }
  } catch {
    // Ignore Redis errors
  }
}

/**
 * Get all cached variations for a campaign, grouped by language and contactType.
 */
export async function getAllCampaignVariations(
  campaignId: number,
): Promise<{ language: string; contactType: string; variations: GeneratedEmail[]; count: number }[]> {
  const results: { language: string; contactType: string; variations: GeneratedEmail[]; count: number }[] = [];
  try {
    const keys = await redis.keys(`broadcast:${campaignId}:variations:*`);
    for (const key of keys) {
      const parts = key.split(":");
      const language = parts[3];
      const contactType = parts[4];
      const raw = await redis.get(key);
      if (raw) {
        const variations = JSON.parse(raw) as GeneratedEmail[];
        results.push({ language, contactType, variations, count: variations.length });
      }
    }
  } catch {
    // Redis error
  }
  return results.sort((a, b) => `${a.contactType}:${a.language}`.localeCompare(`${b.contactType}:${b.language}`));
}

/**
 * Set (overwrite) variations for a specific campaign + language + contactType.
 */
export async function setVariations(
  campaignId: number,
  language: string,
  contactType: string,
  variations: GeneratedEmail[],
): Promise<void> {
  const key = cacheKey(campaignId, language, contactType);
  try {
    await redis.setex(key, CACHE_TTL, JSON.stringify(variations));
    log.info({ campaignId, language, contactType, count: variations.length }, "Variations updated.");
  } catch {
    // Redis error
  }
}
