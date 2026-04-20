// ---------------------------------------------------------------------------
// Influencer templates — FR + 8 manual translations.
//
// William's copy (2026-04-20):
//   - sourceContactType = 'influencer'
//   - Audience: social media influencers, not bloggers
//   - 5$ discount for audience via personal code + 10$/call for influencer
//   - FR keeps phone number; 8 other languages don't
//   - No variable placeholders
//   - Affiliate URL: sos-expat.com/devenir-influenceur
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
    subject: "Devenez influenceur SOS-Expat — 10$ par appel généré, retrait 24h",
    body: `Bonjour,

Imaginez : l'un de vos abonnés est à l'étranger, seul, face à un accident, un litige ou une urgence — et ne sait pas vers qui se tourner. Pas de contact local, pas de réseau, la barrière de la langue.

C'est la réalité quotidienne de millions d'expats, voyageurs et vacanciers partout dans le monde.

SOS-Expat.com est la première plateforme au monde qui leur apporte une réponse humaine en moins de 5 minutes : un avocat local ou un expat qui connaît le terrain, choisi selon sa langue, son pays, ses avis et ses spécialités, rappelé directement par téléphone. 197 pays, toutes langues, 24h/24.

En recommandant SOS-Expat à votre communauté, vous leur offrez un service concret — et une remise exclusive de 5$ sur chaque appel grâce à votre code personnel. De votre côté, vous gagnez 10$ par appel généré, automatiquement crédité sur votre tableau de bord, retiré sous 24h sur simple demande. Zéro gestion, revenu passif immédiat.

Découvrez la plateforme : sos-expat.com
Rejoignez le programme : sos-expat.com/devenir-influenceur

Williams Jullin
SOS-Expat.com
+33 7 43 33 12 01`,
  },
  {
    language: "en",
    subject: "Become an SOS-Expat influencer — $10 per call generated, 24h withdrawal",
    body: `Hello,

Imagine: one of your followers is abroad, alone, facing an accident, a dispute or an emergency — and doesn't know who to turn to. No local contact, no network, the language barrier.

This is the daily reality of millions of expats, travellers and holidaymakers around the world.

SOS-Expat.com is the world's first platform that gives them a human answer in under 5 minutes: a local lawyer or an expat who knows the ground, chosen based on their language, country, reviews and specialties, called back directly by phone. 197 countries, all languages, 24/7.

By recommending SOS-Expat to your community, you offer them a real service — plus an exclusive $5 discount on each call thanks to your personal code. On your side, you earn $10 per call generated, automatically credited to your dashboard and withdrawable within 24h on simple request. Zero management, immediate passive income.

Discover the platform: sos-expat.com
Join the program: sos-expat.com/devenir-influenceur

Williams Jullin
SOS-Expat.com`,
  },
  {
    language: "es",
    subject: "Conviértete en influencer SOS-Expat — 10$ por llamada generada, retiro en 24h",
    body: `Hola,

Imagina: uno de tus seguidores está en el extranjero, solo, frente a un accidente, un litigio o una urgencia — y no sabe a quién acudir. Sin contacto local, sin red, la barrera del idioma.

Es la realidad diaria de millones de expatriados, viajeros y turistas en todo el mundo.

SOS-Expat.com es la primera plataforma del mundo que les ofrece una respuesta humana en menos de 5 minutos: un abogado local o un expatriado que conoce el terreno, elegido según su idioma, país, opiniones y especialidades, que les devuelve la llamada directamente por teléfono. 197 países, todos los idiomas, 24h/24.

Al recomendar SOS-Expat a tu comunidad, les ofreces un servicio concreto — y un descuento exclusivo de 5$ en cada llamada gracias a tu código personal. Por tu parte, ganas 10$ por cada llamada generada, acreditado automáticamente en tu panel y retirable en 24h con una simple solicitud. Cero gestión, ingreso pasivo inmediato.

Descubre la plataforma: sos-expat.com
Únete al programa: sos-expat.com/devenir-influenceur

Williams Jullin
SOS-Expat.com`,
  },
  {
    language: "de",
    subject: "Werden Sie SOS-Expat Influencer — 10$ pro generiertem Anruf, Auszahlung in 24h",
    body: `Guten Tag,

Stellen Sie sich vor: einer Ihrer Follower ist im Ausland, allein, mit einem Unfall, einem Rechtsstreit oder einem Notfall konfrontiert — und weiß nicht, an wen er sich wenden soll. Kein lokaler Kontakt, kein Netzwerk, die Sprachbarriere.

Das ist die tägliche Realität von Millionen Expats, Reisenden und Urlaubern weltweit.

SOS-Expat.com ist die weltweit erste Plattform, die ihnen in unter 5 Minuten eine menschliche Antwort bietet: ein lokaler Anwalt oder ein Expat, der sich auskennt, ausgewählt nach Sprache, Land, Bewertungen und Spezialgebieten, direkt telefonisch zurückgerufen. 197 Länder, alle Sprachen, rund um die Uhr.

Indem Sie SOS-Expat Ihrer Community empfehlen, bieten Sie ihnen einen konkreten Service — und einen exklusiven Rabatt von 5$ auf jeden Anruf dank Ihres persönlichen Codes. Auf Ihrer Seite verdienen Sie 10$ pro generiertem Anruf, automatisch auf Ihrem Dashboard gutgeschrieben und auf einfache Anfrage innerhalb von 24h auszahlbar. Null Verwaltung, sofortiges passives Einkommen.

Entdecken Sie die Plattform: sos-expat.com
Treten Sie dem Programm bei: sos-expat.com/devenir-influenceur

Williams Jullin
SOS-Expat.com`,
  },
  {
    language: "pt",
    subject: "Torne-se influenciador SOS-Expat — 10$ por chamada gerada, saque em 24h",
    body: `Olá,

Imagine: um dos seus seguidores está no exterior, sozinho, diante de um acidente, um litígio ou uma emergência — e não sabe a quem recorrer. Sem contato local, sem rede, a barreira do idioma.

Essa é a realidade diária de milhões de expatriados, viajantes e turistas em todo o mundo.

SOS-Expat.com é a primeira plataforma do mundo que lhes oferece uma resposta humana em menos de 5 minutos: um advogado local ou um expatriado que conhece o terreno, escolhido segundo seu idioma, país, avaliações e especialidades, que retorna a ligação diretamente por telefone. 197 países, todos os idiomas, 24h por dia.

Ao recomendar SOS-Expat à sua comunidade, você lhes oferece um serviço concreto — e um desconto exclusivo de 5$ em cada chamada graças ao seu código pessoal. Do seu lado, você ganha 10$ por cada chamada gerada, creditado automaticamente no seu painel e sacável em 24h com uma simples solicitação. Zero gestão, renda passiva imediata.

Descubra a plataforma: sos-expat.com
Junte-se ao programa: sos-expat.com/devenir-influenceur

Williams Jullin
SOS-Expat.com`,
  },
  {
    language: "ru",
    subject: "Станьте инфлюенсером SOS-Expat — 10$ за каждый звонок, вывод за 24 часа",
    body: `Здравствуйте,

Представьте: один из ваших подписчиков за границей, один, столкнулся с аварией, спором или чрезвычайной ситуацией — и не знает, к кому обратиться. Нет местных контактов, нет сети, языковой барьер.

Это повседневная реальность миллионов экспатов, путешественников и туристов по всему миру.

SOS-Expat.com — первая в мире платформа, которая даёт им человеческий ответ менее чем за 5 минут: местный адвокат или экспат, знающий обстановку, выбранный по языку, стране, отзывам и специализациям, перезванивает напрямую по телефону. 197 стран, все языки, 24 часа в сутки.

Рекомендуя SOS-Expat своему сообществу, вы предоставляете им конкретную услугу — и эксклюзивную скидку 5$ на каждый звонок благодаря вашему личному коду. А вы зарабатываете 10$ за каждый сгенерированный звонок, автоматически зачисляемый на вашу панель и выводимый в течение 24 часов по простому запросу. Ноль управления, мгновенный пассивный доход.

Откройте для себя платформу: sos-expat.com
Присоединяйтесь к программе: sos-expat.com/devenir-influenceur

Williams Jullin
SOS-Expat.com`,
  },
  {
    language: "ar",
    subject: "كن مؤثراً لدى SOS-Expat — 10$ لكل مكالمة، سحب خلال 24 ساعة",
    body: `مرحباً،

تخيّل: أحد متابعيك في الخارج، وحيداً، يواجه حادثاً أو نزاعاً أو حالة طارئة — ولا يعرف إلى من يتوجه. لا اتصال محلي، لا شبكة، حاجز اللغة.

هذه هي الحقيقة اليومية لملايين المغتربين والمسافرين والسياح حول العالم.

SOS-Expat.com هي أول منصة في العالم توفّر لهم رداً بشرياً في أقل من 5 دقائق: محامٍ محلي أو مغترب يعرف الميدان، مختار حسب لغته وبلده وتقييماته وتخصصاته، يتصل بهم مباشرة عبر الهاتف. 197 دولة، جميع اللغات، على مدار الساعة.

بتوصية SOS-Expat لمجتمعك، تقدّم لهم خدمة ملموسة — وخصماً حصرياً قدره 5$ على كل مكالمة بفضل رمزك الشخصي. ومن جانبك، تربح 10$ لكل مكالمة تولّدها، تُقيَّد تلقائياً في لوحة تحكمك وقابلة للسحب خلال 24 ساعة بطلب بسيط. صفر إدارة، دخل سلبي فوري.

اكتشف المنصة: sos-expat.com
انضم إلى البرنامج: sos-expat.com/devenir-influenceur

Williams Jullin
SOS-Expat.com`,
  },
  {
    language: "zh",
    subject: "成为 SOS-Expat 网红 — 每次通话赚取 10 美元，24 小时内提现",
    body: `您好，

想象一下：您的一位粉丝身在海外，独自一人，面对一场意外、一场纠纷或一个紧急情况——却不知道该向谁求助。没有当地联系人，没有网络，还有语言障碍。

这是全世界数百万外籍人士、旅行者和度假者每天面临的现实。

SOS-Expat.com 是全球首个为他们在 5 分钟内提供真人解答的平台：一位当地律师或熟悉当地情况的外籍人士，根据其语言、国家、评价和专长进行筛选，直接通过电话回拨。覆盖 197 个国家，支持所有语言，全天 24 小时服务。

向您的粉丝推荐 SOS-Expat，您为他们提供一项切实的服务——并通过您的专属代码，让他们每次通话享受 5 美元的独家折扣。而您每产生一次通话即可赚取 10 美元，自动计入您的控制面板，申请后 24 小时内即可提现。零管理，即时被动收入。

了解平台：sos-expat.com
加入计划：sos-expat.com/devenir-influenceur

Williams Jullin
SOS-Expat.com`,
  },
  {
    language: "hi",
    subject: "SOS-Expat इन्फ्लुएंसर बनें — प्रति कॉल $10, 24 घंटे में निकासी",
    body: `नमस्ते,

कल्पना कीजिए: आपके एक फ़ॉलोअर विदेश में हैं, अकेले हैं, एक दुर्घटना, एक विवाद या एक आपातकाल का सामना कर रहे हैं — और नहीं जानते कि किसके पास जाएँ। कोई स्थानीय संपर्क नहीं, कोई नेटवर्क नहीं, भाषा की बाधा।

यह दुनिया भर के लाखों प्रवासियों, यात्रियों और छुट्टी मनाने वालों की रोज़मर्रा की वास्तविकता है।

SOS-Expat.com दुनिया का पहला प्लेटफ़ॉर्म है जो उन्हें 5 मिनट से भी कम समय में मानवीय उत्तर प्रदान करता है: एक स्थानीय वकील या एक प्रवासी जो क्षेत्र को जानता है, उसकी भाषा, देश, समीक्षाओं और विशेषज्ञता के आधार पर चुना जाता है, और सीधे फ़ोन पर कॉल बैक करता है। 197 देश, सभी भाषाएँ, 24 घंटे।

अपने समुदाय को SOS-Expat की सिफ़ारिश करके, आप उन्हें एक ठोस सेवा प्रदान करते हैं — और आपके व्यक्तिगत कोड के कारण हर कॉल पर $5 की विशेष छूट। आपकी ओर से, आप प्रति कॉल $10 कमाते हैं, स्वचालित रूप से आपके डैशबोर्ड में जमा होता है और सरल अनुरोध पर 24 घंटे में निकाला जा सकता है। शून्य प्रबंधन, तत्काल निष्क्रिय आय।

प्लेटफ़ॉर्म खोजें: sos-expat.com
कार्यक्रम में शामिल हों: sos-expat.com/devenir-influenceur

Williams Jullin
SOS-Expat.com`,
  },
];

async function upsert(tpl: LangTemplate, frId: number | null) {
  const existing = await prisma.messageTemplate.findFirst({
    where: { language: tpl.language, sourceContactType: "influencer" },
  });
  if (existing) {
    return prisma.messageTemplate.update({
      where: { id: existing.id },
      data: {
        subject: tpl.subject,
        body: tpl.body,
        ...(tpl.language !== "fr" && frId ? { translatedFromId: frId } : {}),
      },
    });
  }
  return prisma.messageTemplate.create({
    data: {
      language: tpl.language,
      sourceContactType: "influencer",
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
    where: { sourceContactType: "influencer" },
    orderBy: { language: "asc" },
  });
  console.log(`influencer templates (${all.length}):`);
  for (const t of all) {
    const hasPhone = t.body.includes("+33") ? "AVEC phone" : "sans phone";
    const hasPlatformLink = t.body.includes("sos-expat.com\n") ? "✓ platform" : "";
    const hasAffLink = t.body.includes("devenir-influenceur") ? "✓ influencer" : "";
    console.log(`  ${t.language.padEnd(3)} ${t.body.length} chars ${hasPhone} ${hasPlatformLink} ${hasAffLink}`);
  }

  process.exit(0);
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
