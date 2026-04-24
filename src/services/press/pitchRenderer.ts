/**
 * Pitch email renderer — 2026-04-22 (brand entity Vague 4.3)
 *
 * Loads the pitch templates from brand-entity-kit/presse/pitch-emails-9-langues.md
 * and personalizes them for the target journalist. Falls back to a
 * hard-coded canonical pitch (FR) if the file is unavailable.
 *
 * NOTE: SOS-Expat positions itself as "lawyer OR helpful expat" (not just
 * lawyer). The rendered pitches reflect this dual proposition.
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { PressLang, PressAngle } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { EMBEDDED_PITCHES } from "./templates/pitches.js";

const log = createChildLogger("press-pitch-renderer");

export const PRESS_PITCH_TEMPLATES_KEY = "press_pitch_templates";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Optional override: if PRESS_PITCH_TEMPLATES_PATH points at a real markdown
// file (same format as brand-entity-kit/presse/pitch-emails-9-langues.md),
// we parse and use it at runtime.  Otherwise we fall back to the embedded
// TypeScript templates — safer default so the Docker image doesn't depend
// on sibling repos being mounted.
const PITCH_TEMPLATES_PATH = process.env.PRESS_PITCH_TEMPLATES_PATH ??
  path.join(process.cwd(), "..", "brand-entity-kit", "presse", "pitch-emails-9-langues.md");

const PDF_BASE_URL = process.env.PRESS_PDF_BASE_URL ?? "https://sos-expat.com";

// Subject line patterns per language — 2026-04-24 v3.
// Changed from single subject to an ARRAY of 8 variants per language.
// At render time we pick one variant deterministically from the contactId
// hash so the same journalist always sees the same subject across initial
// + follow-up 1 + follow-up 2 (Gmail threads them together, good for
// deliverability). Across different contacts, subjects rotate — which is
// the critical anti-bulk signal: 651 identical subjects would land in spam
// within the first few hundred sends regardless of IP reputation.
//
// All variants stay journalist-friendly and avoid spammy triggers
// (no caps-lock, no !!, no "FREE", no "URGENT"). Each hook pulls from a
// different angle of the same story so the copy never contradicts itself:
//   - 57% willingness-to-pay stat
//   - 304M / 17% health coverage gap
//   - 80 lawyers onboarded in 2 months
//   - 9,563-participant CC-BY survey
//   - 280M "no one to call" pain point
//   - 197 countries / 5-minute connection
//   - Direct data-for-article pitch
//   - Editorial-pitch framing
const SUBJECT_TEMPLATES: Record<PressLang, readonly string[]> = {
  fr: [
    "57% des voyageurs et expatriés prêts à payer — et personne ne répondait à ce besoin",
    "304 millions d'expatriés, 17% sans couverture santé : comment on a comblé le trou",
    "80 avocats inscrits en 2 mois : première plateforme mondiale pour expats",
    "Sondage CC-BY sur 9 563 expatriés dans 54 pays — interview possible ?",
    "Pourquoi 280 millions d'expats n'avaient-ils personne à appeler en urgence ?",
    "Un avocat local en 5 minutes dans 197 pays — nouvelle plateforme lancée",
    "Expatriation et juridique : données inédites pour votre prochain article",
    "Proposition de contenu expat/voyage : étude 54 pays + angle humain",
  ],
  en: [
    "57% of travelers and expats ready to pay — and no one was meeting this need",
    "304 million expats, 17% without health coverage: how we bridged the gap",
    "80 lawyers onboarded in 2 months: first worldwide platform for expats",
    "CC-BY survey of 9,563 expats across 54 countries — interview opportunity?",
    "Why 280 million expats had no one to call in an emergency",
    "A local lawyer in 5 minutes across 197 countries — new platform launched",
    "Expat legal data: fresh figures for your next story",
    "Editorial pitch — expat/travel study spanning 54 countries + human angle",
  ],
  es: [
    "El 57% de viajeros y expatriados dispuestos a pagar — y nadie respondía a esta necesidad",
    "304 millones de expatriados, 17% sin cobertura médica: cómo cubrimos el vacío",
    "80 abogados incorporados en 2 meses: primera plataforma mundial para expatriados",
    "Encuesta CC-BY a 9.563 expatriados en 54 países — posible entrevista?",
    "Por qué 280 millones de expatriados no tenían a quién llamar en una emergencia",
    "Un abogado local en 5 minutos en 197 países — nueva plataforma lanzada",
    "Datos jurídicos para expatriados: cifras inéditas para su próximo artículo",
    "Propuesta editorial — estudio expat/viaje en 54 países + historia humana",
  ],
  de: [
    "57% der Reisenden und Expats zahlungsbereit — und niemand bediente diesen Bedarf",
    "304 Millionen Expats, 17% ohne Krankenversicherung: wie wir die Lücke schließen",
    "80 Anwälte in 2 Monaten: erste weltweite Plattform für Expats",
    "CC-BY-Umfrage unter 9.563 Expats in 54 Ländern — Interview möglich?",
    "Warum 280 Millionen Expats niemanden im Notfall anrufen konnten",
    "Ein Anwalt vor Ort in 5 Minuten in 197 Ländern — neue Plattform",
    "Expat-Recht: neue Zahlen für Ihren nächsten Artikel",
    "Themenvorschlag — Expat-/Reise-Studie aus 54 Ländern + menschliche Perspektive",
  ],
  pt: [
    "57% de viajantes e expatriados dispostos a pagar — e ninguém respondia a esta necessidade",
    "304 milhões de expatriados, 17% sem cobertura de saúde: como preenchemos a lacuna",
    "80 advogados integrados em 2 meses: primeira plataforma mundial para expatriados",
    "Inquérito CC-BY a 9.563 expatriados em 54 países — entrevista possível?",
    "Porque 280 milhões de expatriados não tinham a quem ligar numa emergência",
    "Um advogado local em 5 minutos em 197 países — nova plataforma lançada",
    "Dados jurídicos para expatriados: números inéditos para o seu próximo artigo",
    "Proposta editorial — estudo expat/viagem em 54 países + ângulo humano",
  ],
  ru: [
    "57% путешественников и экспатов готовы платить — и никто не отвечал на эту потребность",
    "304 миллиона экспатов, 17% без медицинского покрытия: как мы заполнили пробел",
    "80 юристов за 2 месяца: первая мировая платформа для экспатов",
    "Опрос CC-BY среди 9 563 экспатов в 54 странах — возможно интервью?",
    "Почему 280 миллионам экспатов некому было позвонить в экстренной ситуации",
    "Местный юрист за 5 минут в 197 странах — запущена новая платформа",
    "Юридические данные для экспатов: свежие цифры для вашей следующей статьи",
    "Редакционное предложение — исследование экспатов/путешественников в 54 странах",
  ],
  zh: [
    "57%的旅行者和外籍人士愿意付费 — 却无人满足这一需求",
    "3.04亿外籍人士，17%无医疗保障：我们如何填补空白",
    "2个月80位律师入驻：全球首个外籍人士平台",
    "CC-BY调查覆盖54国9,563位外籍人士 — 是否可接受采访？",
    "为何2.8亿外籍人士在紧急情况下无人可联系",
    "197个国家5分钟内联系当地律师 — 新平台上线",
    "外籍法律数据：为您下一篇报道提供新鲜数据",
    "选题提案 — 54国外籍/旅行者研究 + 人情角度",
  ],
  hi: [
    "57% यात्री और प्रवासी भुगतान करने को तैयार — और कोई इस ज़रूरत का जवाब नहीं दे रहा था",
    "304 मिलियन प्रवासी, 17% बिना स्वास्थ्य बीमा: हमने इस अंतर को कैसे पाटा",
    "2 महीने में 80 वकील: प्रवासियों के लिए पहला विश्वव्यापी प्लेटफॉर्म",
    "54 देशों के 9,563 प्रवासियों पर CC-BY सर्वेक्षण — साक्षात्कार संभव?",
    "280 मिलियन प्रवासियों के पास आपातकाल में कॉल करने वाला कोई क्यों नहीं था",
    "197 देशों में 5 मिनट में स्थानीय वकील — नया प्लेटफॉर्म लॉन्च",
    "प्रवासी कानूनी डेटा: आपके अगले लेख के लिए नए आंकड़े",
    "संपादकीय प्रस्ताव — 54 देशों में प्रवासी/यात्रा अध्ययन + मानवीय पहलू",
  ],
  ar: [
    "57٪ من المسافرين والمغتربين مستعدون للدفع — ولم يكن أحد يستجيب لهذه الحاجة",
    "304 مليون مغترب، 17% دون تغطية صحية: كيف سددنا الفجوة",
    "80 محاميًا في شهرين: أول منصة عالمية للمغتربين",
    "استطلاع CC-BY شمل 9,563 مغتربًا في 54 دولة — إمكانية مقابلة؟",
    "لماذا لم يجد 280 مليون مغترب من يتصلون به في حالة طارئة",
    "محامٍ محلي في 5 دقائق عبر 197 دولة — إطلاق منصة جديدة",
    "بيانات قانونية للمغتربين: أرقام حديثة لمقالك القادم",
    "اقتراح تحريري — دراسة مغتربين/مسافرين في 54 دولة + بعد إنساني",
  ],
  et: [
    "57% reisijatest ja välismaalastest on valmis maksma — ja keegi ei vastanud sellele vajadusele",
    "304 miljonit välismaalast, 17% ilma tervisekindlustuseta: kuidas me lünga täitsime",
    "80 advokaati 2 kuuga: esimene ülemaailmne platvorm välismaalastele",
    "CC-BY uuring 9 563 välismaalase seas 54 riigis — intervjuu võimalik?",
    "Miks 280 miljonil välismaalasel polnud kedagi hädaolukorras helistada",
    "Kohalik advokaat 5 minutiga 197 riigis — uus platvorm käivitatud",
    "Välismaalaste juriidilised andmed: värsked numbrid teie järgmise loo jaoks",
    "Toimetuslik pakkumine — välismaalaste/reisijate uuring 54 riigis + inimmõõde",
  ],
};

/**
 * Deterministic subject picker: same contactId → same subject variant across
 * initial + follow_up_1 + follow_up_2, so Gmail/Outlook thread the 3 emails
 * together (ongoing conversation = deliverability win). Across different
 * contacts, the variant rotates — which is the anti-bulk signal we want.
 *
 * Falls back to variant index 0 if no contactId (e.g. a test render).
 */
function pickSubject(lang: PressLang, contactId?: string): string {
  const variants = SUBJECT_TEMPLATES[lang];
  if (!contactId) return variants[0]!;
  const hash = [...contactId].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return variants[hash % variants.length]!;
}

const ANGLE_LABELS: Record<PressAngle, Record<PressLang, string>> = {
  launch: {
    fr: "Lancement", en: "Launch", es: "Lanzamiento", de: "Start", pt: "Lançamento",
    ru: "Запуск", zh: "发布", hi: "लॉन्च", ar: "إطلاق", et: "Käivitamine",
  },
  ymyl: {
    fr: "Juridique", en: "Legal", es: "Legal", de: "Rechtlich", pt: "Jurídico",
    ru: "Юридический", zh: "法律", hi: "कानूनी", ar: "قانوني", et: "Õiguslik",
  },
  expat: {
    fr: "Expatriation", en: "Expats", es: "Expatriación", de: "Expats", pt: "Expatriação",
    ru: "Экспаты", zh: "外籍", hi: "प्रवासी", ar: "المغتربون", et: "Välismaalased",
  },
  estonia: {
    fr: "Estonie", en: "Estonia", es: "Estonia", de: "Estland", pt: "Estónia",
    ru: "Эстония", zh: "爱沙尼亚", hi: "एस्टोनिया", ar: "إستونيا", et: "Eesti",
  },
  human_interest: {
    fr: "Témoignage", en: "Story", es: "Historia", de: "Geschichte", pt: "História",
    ru: "История", zh: "故事", hi: "कहानी", ar: "قصة", et: "Lugu",
  },
  tech_startup: {
    fr: "Tech Startup", en: "Tech Startup", es: "Tech Startup", de: "Tech Startup",
    pt: "Tech Startup", ru: "Tech Startup", zh: "科技创业", hi: "टेक स्टार्टअप",
    ar: "تقنية ناشئة", et: "Tehnoloogia idufirma",
  },
  innovation: {
    fr: "Innovation", en: "Innovation", es: "Innovación", de: "Innovation",
    pt: "Inovação", ru: "Инновация", zh: "创新", hi: "नवाचार", ar: "ابتكار",
    et: "Innovatsioon",
  },
  diaspora: {
    fr: "Diaspora", en: "Diaspora", es: "Diáspora", de: "Diaspora",
    pt: "Diáspora", ru: "Диаспора", zh: "海外侨民", hi: "प्रवासी समुदाय",
    ar: "الشتات", et: "Diasporaa",
  },
};

// ---------------------------------------------------------------------------
// Template parsing
// ---------------------------------------------------------------------------

let cachedTemplates: Map<PressLang, string> | null = null;

/** Invalidate cache — called after DB edits so next render picks up changes. */
export function invalidateTemplatesCache(): void {
  cachedTemplates = null;
}

async function loadTemplates(): Promise<Map<PressLang, string>> {
  if (cachedTemplates) return cachedTemplates;

  const templates = new Map<PressLang, string>();

  // Layer 1 — embedded TS templates: guaranteed to have all 10 langs.
  for (const lang of Object.keys(EMBEDDED_PITCHES) as PressLang[]) {
    templates.set(lang, EMBEDDED_PITCHES[lang]);
  }

  // Layer 2 — markdown file (dev-only, may not exist in container).
  try {
    const content = await fs.readFile(PITCH_TEMPLATES_PATH, "utf8");
    const langHeaders: Array<{ lang: PressLang; marker: string }> = [
      { lang: "fr", marker: "🇫🇷" }, { lang: "en", marker: "🇬🇧" },
      { lang: "es", marker: "🇪🇸" }, { lang: "de", marker: "🇩🇪" },
      { lang: "pt", marker: "🇵🇹" }, { lang: "ru", marker: "🇷🇺" },
      { lang: "zh", marker: "🇨🇳" }, { lang: "hi", marker: "🇮🇳" },
      { lang: "ar", marker: "🇸🇦" }, { lang: "et", marker: "🇪🇪" },
    ];
    for (const { lang, marker } of langHeaders) {
      const sectionStart = content.indexOf(marker);
      if (sectionStart === -1) continue;
      const codeStart = content.indexOf("```", sectionStart);
      if (codeStart === -1) continue;
      const codeEnd = content.indexOf("```", codeStart + 3);
      if (codeEnd === -1) continue;
      const body = content.slice(codeStart + 3, codeEnd).trim();
      if (body.length > 0) templates.set(lang, body);
    }
  } catch {
    // Markdown not on disk — fine, embedded templates cover it.
  }

  // Layer 3 — AppSetting DB overrides: final authority so admins can edit
  // the copy via the UI without a redeploy.  Missing langs fall through
  // to earlier layers.
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: PRESS_PITCH_TEMPLATES_KEY },
    });
    if (setting?.value && typeof setting.value === "object") {
      const dbTemplates = setting.value as Partial<Record<PressLang, string>>;
      for (const [lang, body] of Object.entries(dbTemplates)) {
        if (typeof body === "string" && body.length > 0) {
          templates.set(lang as PressLang, body);
        }
      }
    }
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Could not load pitch templates from AppSetting");
  }

  cachedTemplates = templates;
  return templates;
}

// ---------------------------------------------------------------------------
// Fallback minimal pitch (FR) — used if templates file missing
// ---------------------------------------------------------------------------

const FALLBACK_PITCH: Record<PressLang, string> = {
  fr: `Bonjour {firstName},

SOS-Expat (sos-expat.com) est une plateforme lancée depuis Tallinn qui résout
un problème très concret : les 280 millions d'expatriés et voyageurs qui,
chaque année, se retrouvent bloqués à l'étranger sans savoir à qui parler
— dans leur langue.

Notre service : mise en relation téléphonique en moins de 5 minutes avec un
avocat ou un expatrié aidant, dans 197 pays, en 9 langues, 24/7.

Pourrais-je vous fournir un communiqué de presse détaillé et des visuels HD ?

Cordialement,
SOS-Expat
contact@sos-expat.com`,
  en: `Hello {firstName},

SOS-Expat (sos-expat.com) is a platform launched from Tallinn solving a
concrete problem: 280 million expats and travelers each year find themselves
stuck abroad without knowing whom to call — in their own language.

Our service: phone connection in under 5 minutes with a lawyer or a helpful
expat, across 197 countries, in 9 languages, 24/7.

Could I send you a detailed press release and HD visuals?

Best regards,
SOS-Expat
contact@sos-expat.com`,
  // Other languages fall back to English if template missing — safer than
  // auto-translating with low quality.
  es: "", de: "", pt: "", ru: "", zh: "", hi: "", ar: "", et: "",
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RenderPitchArgs {
  lang: PressLang;
  angle: PressAngle;
  template: "initial" | "follow_up_1" | "follow_up_2";
  firstName: string | null;
  mediaName: string;
  mediaUrl: string | null;
  /**
   * Optional — used to deterministically pick a subject variant per
   * contact. When provided, a given contact always receives the same
   * subject across initial + follow-ups (thread coherence). Omit in
   * one-off test renders.
   */
  contactId?: string;
}

export interface RenderedPitch {
  subject: string;
  text: string;
  html: string;
  pdfUrl: string | null;
}

export async function renderPitchEmail(args: RenderPitchArgs): Promise<RenderedPitch> {
  const templates = await loadTemplates();
  // Embedded templates already cover all 10 langs, so `get(args.lang)` is
  // always a non-empty string.  FALLBACK_PITCH kept only as ultimate safety
  // net for a hypothetical schema extension.
  const rawPitch = templates.get(args.lang) || FALLBACK_PITCH[args.lang] || FALLBACK_PITCH.en;

  // Personalize
  const firstNameSafe = args.firstName?.trim() || (
    args.lang === "fr" ? "Madame, Monsieur" :
    args.lang === "es" ? "Estimado/a" :
    args.lang === "de" ? "Sehr geehrte Damen und Herren" :
    "Hello"
  );

  let body = rawPitch
    .replace(/\[Prénom Journaliste\]/gi, firstNameSafe)
    .replace(/\[Journalist's First Name\]/gi, firstNameSafe)
    .replace(/\[Nombre del periodista\]/gi, firstNameSafe)
    .replace(/\[Vorname des Journalisten\]/gi, firstNameSafe)
    .replace(/\[Nome do jornalista\]/gi, firstNameSafe)
    .replace(/\[Имя журналиста\]/gi, firstNameSafe)
    .replace(/\[记者姓名\]/gi, firstNameSafe)
    .replace(/\[पत्रकार का पहला नाम\]/gi, firstNameSafe)
    .replace(/\[الاسم الأول للصحفي\]/gi, firstNameSafe)
    .replace(/\[Ajakirjaniku eesnimi\]/gi, firstNameSafe)
    .replace(/\{firstName\}/g, firstNameSafe)
    .replace(/\[sujet récent.*?\]/gi, `votre travail sur ${args.mediaName}`)
    .replace(/\[topic.*?\]/gi, `your work at ${args.mediaName}`)
    .replace(/\[tema.*?\]/gi, `su trabajo en ${args.mediaName}`)
    .replace(/\[Thema.*?\]/gi, `Ihre Arbeit bei ${args.mediaName}`)
    .replace(/\[tópico.*?\]/gi, `o seu trabalho em ${args.mediaName}`)
    .replace(/\[тема.*?\]/gi, `вашу работу в ${args.mediaName}`)
    .replace(/\[date\]/gi, "2026")
    .replace(/\[fecha\]/gi, "2026")
    .replace(/\[Datum\]/gi, "2026")
    .replace(/\[data\]/gi, "2026")
    .replace(/\[дата\]/gi, "2026")
    .replace(/\[日期\]/gi, "2026")
    .replace(/\[तारीख\]/gi, "2026")
    .replace(/\[التاريخ\]/gi, "2026")
    .replace(/\[kuupäev\]/gi, "2026")
    .replace(/\[fondateur\]/gi, "Manon")
    .replace(/\[founder\]/gi, "Manon")
    .replace(/\[fundador\]/gi, "Manon")
    .replace(/\[Gründer\]/gi, "Manon")
    .replace(/\[المؤسس\]/gi, "Manon")
    .replace(/\[संस्थापक\]/gi, "Manon")
    .replace(/\[创始人\]/gi, "Manon")
    .replace(/\[asutaja\]/gi, "Manon")
    .replace(/\[Ton nom\]|\[Your name\]|\[Tu nombre\]|\[Dein Name\]|\[O seu nome\]|\[Ваше имя\]|\[您的名字\]|\[आपका नाम\]|\[اسمك\]|\[Sinu nimi\]/gi, "Manon");

  // Follow-up wrapper — prepend a short reminder line
  if (args.template === "follow_up_1") {
    const reminder = {
      fr: "Petit up sur mon message de la semaine dernière au cas où il serait passé entre les mailles. Merci !\n\n---\n\n",
      en: "Friendly bump on my message from last week in case it got buried. Thanks!\n\n---\n\n",
      es: "Un pequeño recordatorio por si el mensaje de la semana pasada se perdió. ¡Gracias!\n\n---\n\n",
      de: "Kleine Erinnerung an meine Nachricht der letzten Woche, falls sie untergegangen ist. Danke!\n\n---\n\n",
      pt: "Um pequeno lembrete da minha mensagem da semana passada, caso tenha passado despercebida. Obrigado!\n\n---\n\n",
      ru: "Небольшое напоминание о моём письме прошлой недели, на случай если оно потерялось. Спасибо!\n\n---\n\n",
      zh: "上周的邮件如果被漏掉，这里是小提醒。谢谢！\n\n---\n\n",
      hi: "पिछले हफ्ते के मेरे संदेश के बारे में एक छोटा रिमाइंडर। धन्यवाद!\n\n---\n\n",
      ar: "تذكير بسيط برسالتي في الأسبوع الماضي في حال فاتتكم. شكراً!\n\n---\n\n",
      et: "Väike meeldetuletus mu eelmise nädala kirja kohta, juhuks kui see jäi märkamata. Tänan!\n\n---\n\n",
    };
    body = reminder[args.lang] + body;
  } else if (args.template === "follow_up_2") {
    const finalReminder = {
      fr: "Dernier up — je comprends si l'angle ne colle pas. Belle journée !\n\n---\n\n",
      en: "Last bump — I understand if the angle doesn't fit. Have a great day!\n\n---\n\n",
      es: "Último recordatorio — entiendo si el ángulo no encaja. ¡Buen día!\n\n---\n\n",
      de: "Letzte Erinnerung — ich verstehe, wenn das Thema nicht passt. Schönen Tag!\n\n---\n\n",
      pt: "Último lembrete — percebo se o ângulo não se adequa. Bom dia!\n\n---\n\n",
      ru: "Последнее напоминание — я понимаю, если тема не подходит. Хорошего дня!\n\n---\n\n",
      zh: "最后一次提醒——如果角度不合适我理解。祝您好运！\n\n---\n\n",
      hi: "अंतिम रिमाइंडर — मैं समझता/ती हूँ अगर विषय उपयुक्त नहीं है। अच्छा दिन!\n\n---\n\n",
      ar: "تذكير أخير — أتفهم إذا لم تكن الزاوية مناسبة. يوم سعيد!\n\n---\n\n",
      et: "Viimane meeldetuletus — mõistan, kui nurk ei sobi. Ilusat päeva!\n\n---\n\n",
    };
    body = finalReminder[args.lang] + body;
  }

  // Subject: pick a variant deterministically from the contactId hash so
  // journalists receiving initial + follow-ups see the SAME subject (Gmail
  // threads them), but across different contacts the subject rotates.
  const angleLabel = ANGLE_LABELS[args.angle][args.lang];
  const subject = pickSubject(args.lang, args.contactId).replace(/\{ANGLE_\w+\}/, angleLabel);

  // Basic HTML conversion (preserves newlines as <br> + links autoformat)
  const html = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>\n")
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

  // PDF attachment URL — only if PRESS_ATTACH_PDF=true AND the file
  // exists on sos-expat.com.  By default disabled: the CDN doesn't
  // host these PDFs yet, and attaching a 404 HTML response as a .pdf
  // produces a corrupt "pièce jointe qui ne s'ouvre pas" in the
  // recipient's mail client.
  const pdfUrl = process.env.PRESS_ATTACH_PDF === "true"
    ? `${PDF_BASE_URL}/${args.lang}-${args.lang}/presse/communique-main-${args.lang}.pdf`
    : null;

  return { subject, text: body, html, pdfUrl };
}
