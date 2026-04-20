// ---------------------------------------------------------------------------
// Corporate templates — FR + 8 manual translations.
//
// William's copy (2026-04-20):
//   - sourceContactType = 'corporate', category = 'corporate'
//   - Audience: HR / mobility teams of companies with staff abroad
//   - Angle: your employees abroad are your greatest asset — never leave
//     them truly alone
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
    subject: "Pour vos collaborateurs à l'étranger — une réponse humaine en moins de 5 minutes",
    body: `Bonjour,

Vos collaborateurs à l'étranger sont votre plus grande force. Mais quand l'un d'eux fait face à un accident, un litige ou une urgence administrative — seul, sans réseau, sans parler la langue — qui est là pour lui en moins de 5 minutes ?

SOS-Expat.com est la première et unique plateforme au monde qui leur apporte une réponse humaine et immédiate : ils choisissent un avocat local ou un expat qui connaît le terrain selon leur langue, leur pays et leurs spécialités — et sont rappelés par téléphone en moins de 5 minutes. 197 pays, toutes nationalités, 24h/24.

Lancée il y a moins de 2 mois, la plateforme compte déjà 82 avocats inscrits dans le monde entier — un chiffre qui devrait tripler dans les prochaines semaines.

La preuve par les chiffres de notre grand sondage exclusif auprès des expatriés : sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Offrir SOS-Expat à vos collaborateurs, c'est leur garantir qu'ils ne seront jamais vraiment seuls — où qu'ils soient dans le monde.

Découvrez la plateforme : sos-expat.com
Parlons-en : sos-expat.com/devenir-partenaire

Williams Jullin — Fondateur
SOS-Expat.com
+33 7 43 33 12 01`,
  },
  {
    language: "en",
    subject: "For your employees abroad — a human answer in under 5 minutes",
    body: `Hello,

Your employees abroad are your greatest strength. But when one of them faces an accident, a dispute or an administrative emergency — alone, without a network, without speaking the language — who is there for them in under 5 minutes?

SOS-Expat.com is the world's first and only platform that gives them a human, immediate answer: they choose a local lawyer or an expat who knows the ground based on their language, country and specialties — and are called back by phone in under 5 minutes. 197 countries, all nationalities, 24/7.

Launched less than 2 months ago, the platform already has 82 registered lawyers worldwide — a number expected to triple in the coming weeks.

The proof in numbers from our exclusive large-scale survey of expats: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Offering SOS-Expat to your employees means guaranteeing they will never truly be alone — wherever they are in the world.

Discover the platform: sos-expat.com
Let's talk: sos-expat.com/devenir-partenaire

Williams Jullin — Founder
SOS-Expat.com`,
  },
  {
    language: "es",
    subject: "Para tus empleados en el extranjero — una respuesta humana en menos de 5 minutos",
    body: `Hola,

Tus empleados en el extranjero son tu mayor fuerza. Pero cuando uno de ellos se enfrenta a un accidente, un litigio o una urgencia administrativa — solo, sin red, sin hablar el idioma — ¿quién está ahí para él en menos de 5 minutos?

SOS-Expat.com es la primera y única plataforma del mundo que les ofrece una respuesta humana e inmediata: eligen un abogado local o un expatriado que conoce el terreno según su idioma, país y especialidades — y reciben una llamada por teléfono en menos de 5 minutos. 197 países, todas las nacionalidades, 24h/24.

Lanzada hace menos de 2 meses, la plataforma ya cuenta con 82 abogados inscritos en todo el mundo — una cifra que debería triplicarse en las próximas semanas.

La prueba por las cifras de nuestra gran encuesta exclusiva entre expatriados: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Ofrecer SOS-Expat a tus empleados es garantizarles que nunca estarán verdaderamente solos — estén donde estén en el mundo.

Descubre la plataforma: sos-expat.com
Hablemos: sos-expat.com/devenir-partenaire

Williams Jullin — Fundador
SOS-Expat.com`,
  },
  {
    language: "de",
    subject: "Für Ihre Mitarbeiter im Ausland — eine menschliche Antwort in unter 5 Minuten",
    body: `Guten Tag,

Ihre Mitarbeiter im Ausland sind Ihre größte Stärke. Aber wenn einer von ihnen mit einem Unfall, einem Rechtsstreit oder einem Verwaltungsnotfall konfrontiert wird — allein, ohne Netzwerk, ohne die Sprache zu sprechen — wer ist in unter 5 Minuten für ihn da?

SOS-Expat.com ist die weltweit erste und einzige Plattform, die ihnen eine menschliche und sofortige Antwort bietet: Sie wählen einen lokalen Anwalt oder einen Expat, der sich auskennt, nach Sprache, Land und Spezialgebieten aus — und werden in unter 5 Minuten telefonisch zurückgerufen. 197 Länder, alle Nationalitäten, rund um die Uhr.

Vor weniger als 2 Monaten gestartet, zählt die Plattform bereits 82 registrierte Anwälte weltweit — eine Zahl, die sich in den nächsten Wochen verdreifachen soll.

Der Beweis durch die Zahlen unserer exklusiven Großumfrage unter Expats: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

SOS-Expat Ihren Mitarbeitern anzubieten bedeutet, ihnen zu garantieren, dass sie nie wirklich allein sein werden — wo auch immer sie auf der Welt sind.

Entdecken Sie die Plattform: sos-expat.com
Sprechen wir darüber: sos-expat.com/devenir-partenaire

Williams Jullin — Gründer
SOS-Expat.com`,
  },
  {
    language: "pt",
    subject: "Para os seus colaboradores no exterior — uma resposta humana em menos de 5 minutos",
    body: `Olá,

Seus colaboradores no exterior são sua maior força. Mas quando um deles enfrenta um acidente, um litígio ou uma urgência administrativa — sozinho, sem rede, sem falar o idioma — quem está lá para ele em menos de 5 minutos?

SOS-Expat.com é a primeira e única plataforma do mundo que lhes oferece uma resposta humana e imediata: eles escolhem um advogado local ou um expatriado que conhece o terreno conforme seu idioma, país e especialidades — e recebem uma ligação por telefone em menos de 5 minutos. 197 países, todas as nacionalidades, 24h por dia.

Lançada há menos de 2 meses, a plataforma já conta com 82 advogados inscritos no mundo todo — um número que deve triplicar nas próximas semanas.

A prova pelos números da nossa grande pesquisa exclusiva com expatriados: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Oferecer SOS-Expat aos seus colaboradores é garantir-lhes que nunca estarão verdadeiramente sozinhos — onde quer que estejam no mundo.

Descubra a plataforma: sos-expat.com
Vamos conversar: sos-expat.com/devenir-partenaire

Williams Jullin — Fundador
SOS-Expat.com`,
  },
  {
    language: "ru",
    subject: "Для ваших сотрудников за рубежом — человеческий ответ менее чем за 5 минут",
    body: `Здравствуйте,

Ваши сотрудники за рубежом — ваша главная сила. Но когда один из них сталкивается с аварией, спором или административной чрезвычайной ситуацией — один, без сети, без знания языка — кто окажется рядом с ним менее чем за 5 минут?

SOS-Expat.com — первая и единственная в мире платформа, которая даёт им человеческий и мгновенный ответ: они выбирают местного адвоката или экспата, знающего обстановку, по языку, стране и специализациям — и получают обратный звонок менее чем за 5 минут. 197 стран, все национальности, 24 часа в сутки.

Запущенная менее 2 месяцев назад, платформа уже насчитывает 82 зарегистрированных адвоката по всему миру — цифра, которая должна утроиться в ближайшие недели.

Доказательство в цифрах нашего эксклюзивного масштабного опроса экспатов: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Предложить SOS-Expat своим сотрудникам — значит гарантировать им, что они никогда не будут по-настоящему одни — где бы они ни находились в мире.

Откройте для себя платформу: sos-expat.com
Давайте поговорим: sos-expat.com/devenir-partenaire

Williams Jullin — Основатель
SOS-Expat.com`,
  },
  {
    language: "ar",
    subject: "لموظفيكم في الخارج — رد بشري في أقل من 5 دقائق",
    body: `مرحباً،

موظفوكم في الخارج هم أعظم قوة لديكم. لكن عندما يواجه أحدهم حادثاً أو نزاعاً أو طارئاً إدارياً — بمفرده، بلا شبكة، دون إتقان اللغة — من يقف بجانبه في أقل من 5 دقائق؟

SOS-Expat.com هي أول وأوحد منصة في العالم تقدّم لهم رداً بشرياً وفورياً: يختارون محامياً محلياً أو مغترباً يعرف الميدان حسب لغتهم وبلدهم وتخصصاتهم — ويتلقون اتصالاً هاتفياً في أقل من 5 دقائق. 197 دولة، جميع الجنسيات، على مدار الساعة.

انطلقت منذ أقل من شهرين، وتضم المنصة بالفعل 82 محامياً مسجلاً في جميع أنحاء العالم — رقم يُتوقع أن يتضاعف ثلاث مرات في الأسابيع القادمة.

الدليل بالأرقام من استطلاعنا الحصري الكبير للمغتربين: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

تقديم SOS-Expat لموظفيكم يعني أن تضمنوا لهم أنهم لن يكونوا وحيدين حقاً أبداً — أينما كانوا في العالم.

اكتشف المنصة: sos-expat.com
لنتحدث: sos-expat.com/devenir-partenaire

Williams Jullin — المؤسس
SOS-Expat.com`,
  },
  {
    language: "zh",
    subject: "为您在海外的员工 — 5 分钟内的人性化回应",
    body: `您好，

您在海外的员工是贵公司最大的力量。但当他们中的一位面对意外、纠纷或紧急行政事务时——独自一人、没有网络、不会当地语言——谁能在 5 分钟内陪伴他？

SOS-Expat.com 是全球首个也是唯一一个为他们提供人性化、即时回应的平台：他们可以根据语言、国家和专长选择一位当地律师或熟悉当地情况的外籍人士——并在 5 分钟内接到电话回拨。覆盖 197 个国家，支持所有国籍，全天 24 小时服务。

平台上线不到 2 个月，已在全球注册 82 位律师——预计未来几周将增至三倍。

我们面向外籍人士的大型独家调查数据为证：sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

将 SOS-Expat 提供给您的员工，就是向他们保证：无论他们身在世界何处，都永远不会真正孤单。

了解平台：sos-expat.com
让我们谈谈：sos-expat.com/devenir-partenaire

Williams Jullin — 创始人
SOS-Expat.com`,
  },
  {
    language: "hi",
    subject: "विदेश में आपके कर्मचारियों के लिए — 5 मिनट से कम में मानवीय प्रतिक्रिया",
    body: `नमस्ते,

विदेश में आपके कर्मचारी आपकी सबसे बड़ी ताकत हैं। लेकिन जब उनमें से कोई एक दुर्घटना, एक विवाद या एक प्रशासनिक आपातकाल का सामना करता है — अकेला, बिना नेटवर्क, भाषा न बोलते हुए — कौन 5 मिनट से भी कम समय में उसके लिए मौजूद है?

SOS-Expat.com दुनिया का पहला और एकमात्र प्लेटफ़ॉर्म है जो उन्हें एक मानवीय और तत्काल प्रतिक्रिया प्रदान करता है: वे अपनी भाषा, देश और विशेषज्ञता के अनुसार एक स्थानीय वकील या क्षेत्र को जानने वाले प्रवासी को चुनते हैं — और 5 मिनट से भी कम समय में फ़ोन पर कॉल बैक प्राप्त करते हैं। 197 देश, सभी राष्ट्रीयताएँ, 24 घंटे।

2 महीने से भी कम समय पहले शुरू हुए इस प्लेटफ़ॉर्म पर पहले से ही दुनिया भर में 82 वकील पंजीकृत हैं — एक आँकड़ा जो आने वाले हफ़्तों में तीन गुना हो जाने की उम्मीद है।

प्रवासियों के बीच हमारे विशेष बड़े पैमाने के सर्वेक्षण के आँकड़ों से प्रमाण: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

अपने कर्मचारियों को SOS-Expat प्रदान करना उन्हें यह गारंटी देना है कि वे कभी भी वास्तव में अकेले नहीं होंगे — दुनिया में चाहे वे कहीं भी हों।

प्लेटफ़ॉर्म खोजें: sos-expat.com
बात करें: sos-expat.com/devenir-partenaire

Williams Jullin — संस्थापक
SOS-Expat.com`,
  },
];

async function upsert(tpl: LangTemplate, frId: number | null) {
  const existing = await prisma.messageTemplate.findFirst({
    where: { language: tpl.language, sourceContactType: "corporate" },
  });
  if (existing) {
    return prisma.messageTemplate.update({
      where: { id: existing.id },
      data: {
        subject: tpl.subject,
        body: tpl.body,
        category: "corporate",
        ...(tpl.language !== "fr" && frId ? { translatedFromId: frId } : {}),
      },
    });
  }
  return prisma.messageTemplate.create({
    data: {
      language: tpl.language,
      sourceContactType: "corporate",
      category: "corporate",
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
    where: { sourceContactType: "corporate" },
    orderBy: { language: "asc" },
  });
  console.log(`corporate templates (${all.length}):`);
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
