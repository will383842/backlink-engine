// ---------------------------------------------------------------------------
// Media / Press templates — FR + 8 manual translations.
//
// William's copy (2026-04-20):
//   - sourceContactType = 'media', category = 'media'
//   - Audience: journalists, press outlets
//   - Angle: exclusive survey results + press kit link
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
    subject: "SOS-Expat — première plateforme mondiale d'aide aux expats en 5 min (dossier + interview)",
    body: `Bonjour,

Imaginez : un expatrié, un voyageur, un vacancier seul à l'étranger face à un accident, un litige, une urgence administrative — sans contact local, sans réseau, sans parler la langue. C'est la réalité quotidienne de millions de personnes dans le monde.

SOS-Expat.com est la première et unique plateforme au monde à résoudre ce problème : en moins de 5 minutes, n'importe qui à l'étranger peut être rappelé par téléphone par un avocat local ou un expat qui connaît le terrain, dans sa langue, dans son pays. 197 pays, toutes nationalités, 24h/24.

Notre grand sondage exclusif auprès des expatriés et voyageurs le confirme — les chiffres sont éloquents : sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Lancée il y a moins de 2 mois, la plateforme compte déjà 82 avocats inscrits dans le monde entier — un chiffre qui devrait tripler dans les prochaines semaines.

Découvrez la plateforme : sos-expat.com
Kit presse, communiqués et visuels : sos-expat.com/presse#press-kit

Nous restons disponibles pour un entretien exclusif ou tout complément d'information.

Williams Jullin — Fondateur
SOS-Expat.com
+33 7 43 33 12 01`,
  },
  {
    language: "en",
    subject: "SOS-Expat — world's first platform helping expats abroad in 5 min (story + interview)",
    body: `Hello,

Imagine: an expat, a traveller, a holidaymaker alone abroad facing an accident, a dispute, an administrative emergency — with no local contact, no network, without speaking the language. This is the daily reality of millions of people around the world.

SOS-Expat.com is the world's first and only platform to solve this problem: in under 5 minutes, anyone abroad can be called back by phone by a local lawyer or an expat who knows the ground, in their language, in their country. 197 countries, all nationalities, 24/7.

Our exclusive large-scale survey of expats and travellers confirms it — the numbers are striking: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Launched less than 2 months ago, the platform already has 82 registered lawyers worldwide — a number expected to triple in the coming weeks.

Discover the platform: sos-expat.com
Press kit, releases and visuals: sos-expat.com/presse#press-kit

We remain available for an exclusive interview or any further information.

Williams Jullin — Founder
SOS-Expat.com`,
  },
  {
    language: "es",
    subject: "SOS-Expat — primera plataforma mundial de ayuda a expatriados en 5 min (dossier + entrevista)",
    body: `Hola,

Imagina: un expatriado, un viajero, un turista solo en el extranjero frente a un accidente, un litigio, una urgencia administrativa — sin contacto local, sin red, sin hablar el idioma. Esta es la realidad diaria de millones de personas en todo el mundo.

SOS-Expat.com es la primera y única plataforma del mundo que resuelve este problema: en menos de 5 minutos, cualquiera en el extranjero puede recibir una llamada de un abogado local o un expatriado que conoce el terreno, en su idioma, en su país. 197 países, todas las nacionalidades, 24h/24.

Nuestra gran encuesta exclusiva entre expatriados y viajeros lo confirma — las cifras son elocuentes: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Lanzada hace menos de 2 meses, la plataforma ya cuenta con 82 abogados inscritos en todo el mundo — una cifra que debería triplicarse en las próximas semanas.

Descubre la plataforma: sos-expat.com
Kit de prensa, comunicados y visuales: sos-expat.com/presse#press-kit

Quedamos disponibles para una entrevista exclusiva o cualquier información adicional.

Williams Jullin — Fundador
SOS-Expat.com`,
  },
  {
    language: "de",
    subject: "SOS-Expat — weltweit erste Plattform für Expats im Notfall in 5 Min (Dossier + Interview)",
    body: `Guten Tag,

Stellen Sie sich vor: ein Expat, ein Reisender, ein Urlauber allein im Ausland, konfrontiert mit einem Unfall, einem Rechtsstreit, einem Verwaltungsnotfall — ohne lokalen Kontakt, ohne Netzwerk, ohne die Sprache zu sprechen. Das ist die tägliche Realität von Millionen Menschen weltweit.

SOS-Expat.com ist die weltweit erste und einzige Plattform, die dieses Problem löst: in unter 5 Minuten kann jeder im Ausland von einem lokalen Anwalt oder einem Expat, der sich auskennt, telefonisch zurückgerufen werden — in seiner Sprache, in seinem Land. 197 Länder, alle Nationalitäten, rund um die Uhr.

Unsere exklusive Großumfrage unter Expats und Reisenden bestätigt es — die Zahlen sprechen für sich: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Vor weniger als 2 Monaten gestartet, zählt die Plattform bereits 82 registrierte Anwälte weltweit — eine Zahl, die sich in den nächsten Wochen verdreifachen soll.

Entdecken Sie die Plattform: sos-expat.com
Pressemappe, Mitteilungen und Visuals: sos-expat.com/presse#press-kit

Wir stehen für ein exklusives Interview oder weitere Informationen zur Verfügung.

Williams Jullin — Gründer
SOS-Expat.com`,
  },
  {
    language: "pt",
    subject: "SOS-Expat — primeira plataforma mundial de ajuda a expatriados em 5 min (dossiê + entrevista)",
    body: `Olá,

Imagine: um expatriado, um viajante, um turista sozinho no exterior diante de um acidente, um litígio, uma urgência administrativa — sem contato local, sem rede, sem falar o idioma. Essa é a realidade diária de milhões de pessoas em todo o mundo.

SOS-Expat.com é a primeira e única plataforma do mundo a resolver esse problema: em menos de 5 minutos, qualquer pessoa no exterior pode receber uma ligação de um advogado local ou um expatriado que conhece o terreno, no seu idioma, no seu país. 197 países, todas as nacionalidades, 24h por dia.

Nossa grande pesquisa exclusiva com expatriados e viajantes confirma — os números são eloquentes: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Lançada há menos de 2 meses, a plataforma já conta com 82 advogados inscritos no mundo todo — um número que deve triplicar nas próximas semanas.

Descubra a plataforma: sos-expat.com
Kit de imprensa, comunicados e visuais: sos-expat.com/presse#press-kit

Permanecemos à disposição para uma entrevista exclusiva ou qualquer informação adicional.

Williams Jullin — Fundador
SOS-Expat.com`,
  },
  {
    language: "ru",
    subject: "SOS-Expat — первая в мире платформа помощи экспатам за 5 минут (досье + интервью)",
    body: `Здравствуйте,

Представьте: экспат, путешественник, турист, оказавшийся один за границей перед лицом аварии, спора, административной чрезвычайной ситуации — без местных контактов, без сети, без знания языка. Это повседневная реальность миллионов людей по всему миру.

SOS-Expat.com — первая и единственная в мире платформа, решающая эту проблему: менее чем за 5 минут любой за границей может получить обратный звонок от местного адвоката или экспата, знающего обстановку, на своём языке, в своей стране. 197 стран, все национальности, 24 часа в сутки.

Наш эксклюзивный масштабный опрос экспатов и путешественников подтверждает это — цифры красноречивы: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Запущенная менее 2 месяцев назад, платформа уже насчитывает 82 зарегистрированных адвоката по всему миру — цифра, которая должна утроиться в ближайшие недели.

Откройте для себя платформу: sos-expat.com
Пресс-кит, релизы и визуалы: sos-expat.com/presse#press-kit

Мы остаёмся доступны для эксклюзивного интервью или любой дополнительной информации.

Williams Jullin — Основатель
SOS-Expat.com`,
  },
  {
    language: "ar",
    subject: "SOS-Expat — أول منصة عالمية لمساعدة المغتربين في 5 دقائق (ملف + مقابلة)",
    body: `مرحباً،

تخيّل: مغترب أو مسافر أو سائح بمفرده في الخارج يواجه حادثاً أو نزاعاً أو طارئاً إدارياً — بلا اتصال محلي، بلا شبكة، دون إتقان اللغة. هذه هي الحقيقة اليومية لملايين الأشخاص حول العالم.

SOS-Expat.com هي أول وأوحد منصة في العالم تحل هذه المشكلة: في أقل من 5 دقائق، يمكن لأي شخص في الخارج أن يتلقى اتصالاً من محامٍ محلي أو مغترب يعرف الميدان، بلغته، في بلده. 197 دولة، جميع الجنسيات، على مدار الساعة.

استطلاعنا الحصري الكبير للمغتربين والمسافرين يؤكد ذلك — الأرقام بليغة: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

انطلقت منذ أقل من شهرين، وتضم المنصة بالفعل 82 محامياً مسجلاً في جميع أنحاء العالم — رقم يُتوقع أن يتضاعف ثلاث مرات في الأسابيع القادمة.

اكتشف المنصة: sos-expat.com
الملف الصحفي والبيانات والمرئيات: sos-expat.com/presse#press-kit

نبقى متاحين لمقابلة حصرية أو أي معلومات إضافية.

Williams Jullin — المؤسس
SOS-Expat.com`,
  },
  {
    language: "zh",
    subject: "SOS-Expat — 全球首个 5 分钟内援助海外人士的平台（资料 + 专访）",
    body: `您好，

想象一下：一位外籍人士、旅行者或度假者独自身处海外，面对一场意外、一场纠纷、一项紧急行政事务——没有当地联系人、没有网络、不会当地语言。这是全世界数百万人每天面临的现实。

SOS-Expat.com 是全球首个也是唯一一个解决这一难题的平台：在 5 分钟内，任何身处海外的人都可以接到来自当地律师或熟悉当地情况的外籍人士的回拨电话，使用其母语，在其所在国家。覆盖 197 个国家，支持所有国籍，全天 24 小时服务。

我们面向外籍人士和旅行者的大型独家调查证实了这一点——数据极具说服力：sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

平台上线不到 2 个月，已在全球注册 82 位律师——预计未来几周将增至三倍。

了解平台：sos-expat.com
新闻资料包、新闻稿与视觉素材：sos-expat.com/presse#press-kit

我们随时接受独家采访或提供任何补充信息。

Williams Jullin — 创始人
SOS-Expat.com`,
  },
  {
    language: "hi",
    subject: "SOS-Expat — विदेश में 5 मिनट में सहायता देने वाला दुनिया का पहला प्लेटफ़ॉर्म (डोज़ियर + साक्षात्कार)",
    body: `नमस्ते,

कल्पना कीजिए: एक प्रवासी, एक यात्री, एक छुट्टी मनाने वाला विदेश में अकेला, एक दुर्घटना, एक विवाद, एक प्रशासनिक आपातकाल का सामना कर रहा है — बिना स्थानीय संपर्क, बिना नेटवर्क, भाषा न बोलते हुए। यह दुनिया भर के लाखों लोगों की रोज़मर्रा की वास्तविकता है।

SOS-Expat.com दुनिया का पहला और एकमात्र प्लेटफ़ॉर्म है जो इस समस्या का समाधान करता है: 5 मिनट से भी कम समय में, विदेश में कोई भी व्यक्ति स्थानीय वकील या क्षेत्र को जानने वाले प्रवासी से अपनी भाषा में, अपने देश में फ़ोन पर कॉल बैक प्राप्त कर सकता है। 197 देश, सभी राष्ट्रीयताएँ, 24 घंटे।

प्रवासियों और यात्रियों के बीच किया गया हमारा विशेष बड़े पैमाने का सर्वेक्षण इसकी पुष्टि करता है — आँकड़े स्पष्ट हैं: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

2 महीने से भी कम समय पहले शुरू हुए इस प्लेटफ़ॉर्म पर पहले से ही दुनिया भर में 82 वकील पंजीकृत हैं — एक आँकड़ा जो आने वाले हफ़्तों में तीन गुना हो जाने की उम्मीद है।

प्लेटफ़ॉर्म खोजें: sos-expat.com
प्रेस किट, विज्ञप्तियाँ और विज़ुअल्स: sos-expat.com/presse#press-kit

हम एक विशेष साक्षात्कार या किसी भी अतिरिक्त जानकारी के लिए उपलब्ध हैं।

Williams Jullin — संस्थापक
SOS-Expat.com`,
  },
];

async function upsert(tpl: LangTemplate, frId: number | null) {
  const existing = await prisma.messageTemplate.findFirst({
    where: { language: tpl.language, sourceContactType: "media" },
  });
  if (existing) {
    return prisma.messageTemplate.update({
      where: { id: existing.id },
      data: {
        subject: tpl.subject,
        body: tpl.body,
        category: "media",
        ...(tpl.language !== "fr" && frId ? { translatedFromId: frId } : {}),
      },
    });
  }
  return prisma.messageTemplate.create({
    data: {
      language: tpl.language,
      sourceContactType: "media",
      category: "media",
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
    where: { sourceContactType: "media" },
    orderBy: { language: "asc" },
  });
  console.log(`media templates (${all.length}):`);
  for (const t of all) {
    const hasPhone = t.body.includes("+33") ? "AVEC phone" : "sans phone";
    const hasSurvey = t.body.includes("le-grand-sondage") ? "✓ survey" : "";
    const hasPressKit = t.body.includes("press-kit") ? "✓ presskit" : "";
    console.log(`  ${t.language.padEnd(3)} cat=${t.category ?? "null"} ${t.body.length} chars ${hasPhone} ${hasSurvey} ${hasPressKit}`);
  }

  process.exit(0);
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
