// ---------------------------------------------------------------------------
// Agency templates — FR + 8 manual translations.
//
// William's copy (2026-04-20):
//   - sourceContactType = 'agency', category = 'agency'
//   - Audience: travel agencies, mobility agencies, HR agencies
//   - Angle: integrate SOS-Expat into your offer as a differentiator
//   - FR keeps phone number; 8 other languages don't
//   - No variable placeholders
// ---------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface LangTemplate {
  language: string;
  subject: string;
  body: string;
}

const TEMPLATES: LangTemplate[] = [
  {
    language: "fr",
    subject: "Intégrez SOS-Expat à votre offre — un argument différenciateur unique au monde",
    body: `Bonjour,

Imaginez : l'un de vos clients part à l'étranger et se retrouve seul face à un accident, un litige, une urgence administrative — sans contact local, sans réseau, sans parler la langue. C'est la réalité quotidienne de millions d'expats, voyageurs et vacanciers partout dans le monde.

SOS-Expat.com est la première et unique plateforme au monde à résoudre ce problème : en moins de 5 minutes, ils sont rappelés par téléphone par un avocat local ou un expat qui connaît le terrain, dans leur langue, dans leur pays. 197 pays, toutes nationalités, 24h/24.

Notre grand sondage exclusif auprès des expatriés et voyageurs le confirme — les chiffres sont éloquents : sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

En intégrant SOS-Expat à votre offre, vous proposez à vos clients un filet de sécurité unique au monde — un argument différenciateur fort face à vos concurrents, sans aucune gestion supplémentaire de votre côté.

Découvrez la plateforme : sos-expat.com
Devenez partenaire : sos-expat.com/devenir-partenaire

Williams Jullin — Fondateur
SOS-Expat.com
+33 7 43 33 12 01`,
  },
  {
    language: "en",
    subject: "Integrate SOS-Expat into your offer — a unique differentiator worldwide",
    body: `Hello,

Imagine: one of your clients travels abroad and finds themselves alone facing an accident, a dispute, an administrative emergency — with no local contact, no network, without speaking the language. This is the daily reality of millions of expats, travellers and holidaymakers around the world.

SOS-Expat.com is the world's first and only platform to solve this problem: in under 5 minutes, they are called back by phone by a local lawyer or an expat who knows the ground, in their language, in their country. 197 countries, all nationalities, 24/7.

Our exclusive large-scale survey of expats and travellers confirms it — the numbers are striking: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

By integrating SOS-Expat into your offer, you give your clients a safety net that is unique worldwide — a strong differentiator against your competitors, with zero additional management on your side.

Discover the platform: sos-expat.com
Become a partner: sos-expat.com/devenir-partenaire

Williams Jullin — Founder
SOS-Expat.com`,
  },
  {
    language: "es",
    subject: "Integra SOS-Expat en tu oferta — un factor diferenciador único en el mundo",
    body: `Hola,

Imagina: uno de tus clientes viaja al extranjero y se encuentra solo frente a un accidente, un litigio, una urgencia administrativa — sin contacto local, sin red, sin hablar el idioma. Esta es la realidad diaria de millones de expatriados, viajeros y turistas en todo el mundo.

SOS-Expat.com es la primera y única plataforma del mundo que resuelve este problema: en menos de 5 minutos, reciben una llamada de un abogado local o un expatriado que conoce el terreno, en su idioma, en su país. 197 países, todas las nacionalidades, 24h/24.

Nuestra gran encuesta exclusiva entre expatriados y viajeros lo confirma — las cifras son elocuentes: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Al integrar SOS-Expat en tu oferta, ofreces a tus clientes una red de seguridad única en el mundo — un fuerte argumento diferenciador frente a tus competidores, sin ninguna gestión adicional de tu parte.

Descubre la plataforma: sos-expat.com
Conviértete en socio: sos-expat.com/devenir-partenaire

Williams Jullin — Fundador
SOS-Expat.com`,
  },
  {
    language: "de",
    subject: "Integrieren Sie SOS-Expat in Ihr Angebot — ein weltweit einzigartiges Differenzierungsmerkmal",
    body: `Guten Tag,

Stellen Sie sich vor: einer Ihrer Kunden reist ins Ausland und befindet sich allein, konfrontiert mit einem Unfall, einem Rechtsstreit, einem Verwaltungsnotfall — ohne lokalen Kontakt, ohne Netzwerk, ohne die Sprache zu sprechen. Das ist die tägliche Realität von Millionen Expats, Reisenden und Urlaubern weltweit.

SOS-Expat.com ist die weltweit erste und einzige Plattform, die dieses Problem löst: in unter 5 Minuten werden sie von einem lokalen Anwalt oder einem Expat, der sich auskennt, telefonisch zurückgerufen — in ihrer Sprache, in ihrem Land. 197 Länder, alle Nationalitäten, rund um die Uhr.

Unsere exklusive Großumfrage unter Expats und Reisenden bestätigt es — die Zahlen sprechen für sich: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Indem Sie SOS-Expat in Ihr Angebot integrieren, bieten Sie Ihren Kunden ein weltweit einzigartiges Sicherheitsnetz — ein starkes Differenzierungsmerkmal gegenüber Ihren Wettbewerbern, ohne jeglichen zusätzlichen Verwaltungsaufwand auf Ihrer Seite.

Entdecken Sie die Plattform: sos-expat.com
Werden Sie Partner: sos-expat.com/devenir-partenaire

Williams Jullin — Gründer
SOS-Expat.com`,
  },
  {
    language: "pt",
    subject: "Integre SOS-Expat à sua oferta — um diferencial único no mundo",
    body: `Olá,

Imagine: um dos seus clientes viaja ao exterior e se encontra sozinho diante de um acidente, um litígio, uma urgência administrativa — sem contato local, sem rede, sem falar o idioma. Essa é a realidade diária de milhões de expatriados, viajantes e turistas em todo o mundo.

SOS-Expat.com é a primeira e única plataforma do mundo a resolver esse problema: em menos de 5 minutos, eles recebem uma ligação de um advogado local ou um expatriado que conhece o terreno, no seu idioma, no seu país. 197 países, todas as nacionalidades, 24h por dia.

Nossa grande pesquisa exclusiva com expatriados e viajantes confirma — os números são eloquentes: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Ao integrar SOS-Expat à sua oferta, você proporciona aos seus clientes uma rede de segurança única no mundo — um forte diferencial frente aos seus concorrentes, sem nenhuma gestão adicional do seu lado.

Descubra a plataforma: sos-expat.com
Torne-se parceiro: sos-expat.com/devenir-partenaire

Williams Jullin — Fundador
SOS-Expat.com`,
  },
  {
    language: "ru",
    subject: "Включите SOS-Expat в своё предложение — уникальное в мире конкурентное преимущество",
    body: `Здравствуйте,

Представьте: один из ваших клиентов едет за границу и оказывается один перед лицом аварии, спора, административной чрезвычайной ситуации — без местных контактов, без сети, без знания языка. Это повседневная реальность миллионов экспатов, путешественников и туристов по всему миру.

SOS-Expat.com — первая и единственная в мире платформа, решающая эту проблему: менее чем за 5 минут им перезванивает местный адвокат или экспат, знающий обстановку, на их языке, в их стране. 197 стран, все национальности, 24 часа в сутки.

Наш эксклюзивный масштабный опрос экспатов и путешественников подтверждает это — цифры красноречивы: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Включив SOS-Expat в своё предложение, вы предоставляете клиентам уникальную в мире страховочную сетку — сильный аргумент отличия от конкурентов, без какого-либо дополнительного управления с вашей стороны.

Откройте для себя платформу: sos-expat.com
Станьте партнёром: sos-expat.com/devenir-partenaire

Williams Jullin — Основатель
SOS-Expat.com`,
  },
  {
    language: "ar",
    subject: "ادمج SOS-Expat في عرضك — ميزة تنافسية فريدة عالمياً",
    body: `مرحباً،

تخيّل: أحد عملائك يسافر إلى الخارج ويجد نفسه بمفرده يواجه حادثاً أو نزاعاً أو طارئاً إدارياً — بلا اتصال محلي، بلا شبكة، دون إتقان اللغة. هذه هي الحقيقة اليومية لملايين المغتربين والمسافرين والسياح حول العالم.

SOS-Expat.com هي أول وأوحد منصة في العالم تحل هذه المشكلة: في أقل من 5 دقائق، يتلقون اتصالاً من محامٍ محلي أو مغترب يعرف الميدان، بلغتهم، في بلدهم. 197 دولة، جميع الجنسيات، على مدار الساعة.

استطلاعنا الحصري الكبير للمغتربين والمسافرين يؤكد ذلك — الأرقام بليغة: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

بدمج SOS-Expat في عرضك، تقدّم لعملائك شبكة أمان فريدة عالمياً — حجة تمييز قوية أمام منافسيك، دون أي إدارة إضافية من جانبك.

اكتشف المنصة: sos-expat.com
كن شريكاً: sos-expat.com/devenir-partenaire

Williams Jullin — المؤسس
SOS-Expat.com`,
  },
  {
    language: "zh",
    subject: "将 SOS-Expat 融入您的产品 — 全球独一无二的差异化优势",
    body: `您好，

想象一下：您的一位客户前往海外，独自一人面对一场意外、一场纠纷、一项紧急行政事务——没有当地联系人、没有网络、不会当地语言。这是全世界数百万外籍人士、旅行者和度假者每天面临的现实。

SOS-Expat.com 是全球首个也是唯一一个解决这一难题的平台：在 5 分钟内，他们就会接到当地律师或熟悉当地情况的外籍人士的回拨电话，使用其母语，在其所在国家。覆盖 197 个国家，支持所有国籍，全天 24 小时服务。

我们面向外籍人士和旅行者的大型独家调查证实了这一点——数据极具说服力：sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

将 SOS-Expat 融入您的产品，您将为客户提供一张全球独一无二的安全网——在面对竞争对手时形成强有力的差异化优势，同时您无需承担任何额外管理工作。

了解平台：sos-expat.com
成为合作伙伴：sos-expat.com/devenir-partenaire

Williams Jullin — 创始人
SOS-Expat.com`,
  },
  {
    language: "hi",
    subject: "SOS-Expat को अपने ऑफ़र में जोड़ें — दुनिया में अनोखा विभेदक तत्व",
    body: `नमस्ते,

कल्पना कीजिए: आपका एक ग्राहक विदेश जाता है और अकेला एक दुर्घटना, एक विवाद, एक प्रशासनिक आपातकाल का सामना कर रहा है — बिना स्थानीय संपर्क, बिना नेटवर्क, भाषा न बोलते हुए। यह दुनिया भर के लाखों प्रवासियों, यात्रियों और छुट्टी मनाने वालों की रोज़मर्रा की वास्तविकता है।

SOS-Expat.com दुनिया का पहला और एकमात्र प्लेटफ़ॉर्म है जो इस समस्या का समाधान करता है: 5 मिनट से भी कम समय में, उन्हें स्थानीय वकील या क्षेत्र को जानने वाले प्रवासी से उनकी भाषा में, उनके देश में फ़ोन पर कॉल बैक प्राप्त होता है। 197 देश, सभी राष्ट्रीयताएँ, 24 घंटे।

प्रवासियों और यात्रियों के बीच किया गया हमारा विशेष बड़े पैमाने का सर्वेक्षण इसकी पुष्टि करता है — आँकड़े स्पष्ट हैं: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

SOS-Expat को अपने ऑफ़र में जोड़कर, आप अपने ग्राहकों को दुनिया में अनोखा सुरक्षा कवच प्रदान करते हैं — अपने प्रतिस्पर्धियों के सामने एक मज़बूत विभेदक तर्क, आपकी ओर से बिना किसी अतिरिक्त प्रबंधन के।

प्लेटफ़ॉर्म खोजें: sos-expat.com
साझेदार बनें: sos-expat.com/devenir-partenaire

Williams Jullin — संस्थापक
SOS-Expat.com`,
  },
];

async function upsert(tpl: LangTemplate, frId: number | null) {
  const existing = await prisma.messageTemplate.findFirst({
    where: { language: tpl.language, sourceContactType: "agency" },
  });
  if (existing) {
    return prisma.messageTemplate.update({
      where: { id: existing.id },
      data: {
        subject: tpl.subject,
        body: tpl.body,
        category: "agency",
        ...(tpl.language !== "fr" && frId ? { translatedFromId: frId } : {}),
      },
    });
  }
  return prisma.messageTemplate.create({
    data: {
      language: tpl.language,
      sourceContactType: "agency",
      category: "agency",
      subject: tpl.subject,
      body: tpl.body,
      translatedFromId: tpl.language === "fr" ? null : frId,
    },
  });
}

async function main() {
  const fr = TEMPLATES.find((t) => t.language === "fr")!;
  const frSaved = await upsert(fr, null);
  console.log(`✓ fr  → id=${frSaved.id}`);

  for (const tpl of TEMPLATES.filter((t) => t.language !== "fr")) {
    const saved = await upsert(tpl, frSaved.id);
    console.log(`✓ ${tpl.language.padEnd(3)} → id=${saved.id}`);
  }

  console.log("\n=== Verification ===");
  const all = await prisma.messageTemplate.findMany({
    where: { sourceContactType: "agency" },
    orderBy: { language: "asc" },
  });
  console.log(`agency templates (${all.length}):`);
  for (const t of all) {
    const hasPhone = t.body.includes("+33") ? "AVEC phone" : "sans phone";
    const hasSurvey = t.body.includes("le-grand-sondage") ? "✓ survey" : "";
    const hasCta = t.body.includes("devenir-partenaire") ? "✓ partner-cta" : "";
    console.log(`  ${t.language.padEnd(3)} cat=${t.category ?? "null"} ${t.body.length} chars ${hasPhone} ${hasSurvey} ${hasCta}`);
  }

  process.exit(0);
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
