// ---------------------------------------------------------------------------
// Association templates — FR + 8 manual translations.
//
// William's copy (2026-04-20):
//   - sourceContactType = 'association', category = 'association'
//   - Audience: expat associations, communities, federations
//   - Angle: you're a pillar for your members — reinforce your value with
//     a safety net no other organization can offer
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
    subject: "Pour vos membres — un filet de sécurité humain et immédiat partout dans le monde",
    body: `Bonjour,

Votre association est un pilier essentiel pour tous les expatriés que vous accompagnez — un repère, une voix, une force sur laquelle ils comptent partout dans le monde.

Pourtant, face à un accident, un litige ou une urgence administrative survenant à l'autre bout du monde, même la plus engagée des associations ne peut pas toujours être là en temps réel.

SOS-Expat.com comble exactement ce vide : la première et unique plateforme au monde qui rappelle n'importe quel expatrié, voyageur ou vacancier en moins de 5 minutes par téléphone — avocat local ou expat qui connaît le terrain, dans sa langue, dans son pays. 197 pays, toutes nationalités, 24h/24.

Les chiffres de notre grand sondage exclusif auprès des expatriés parlent d'eux-mêmes : sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Nous vous proposons simplement de présenter SOS-Expat à vos membres dans votre prochain email ou newsletter — en leur offrant un filet de sécurité humain et immédiat que nulle autre organisation au monde ne peut leur donner. Un service qui renforce encore davantage ce que votre association représente pour eux.

Découvrez la plateforme : sos-expat.com
Parlons-en : sos-expat.com/devenir-partenaire

Williams Jullin — Fondateur
SOS-Expat.com
+33 7 43 33 12 01`,
  },
  {
    language: "en",
    subject: "For your members — a human, immediate safety net anywhere in the world",
    body: `Hello,

Your association is an essential pillar for every expat you support — a reference point, a voice, a force they rely on everywhere in the world.

Yet, facing an accident, a dispute or an administrative emergency on the other side of the world, even the most committed association cannot always be there in real time.

SOS-Expat.com fills exactly that gap: the world's first and only platform that calls back any expat, traveller or holidaymaker in under 5 minutes by phone — a local lawyer or an expat who knows the ground, in their language, in their country. 197 countries, all nationalities, 24/7.

The figures from our exclusive large-scale survey of expats speak for themselves: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

We simply suggest presenting SOS-Expat to your members in your next email or newsletter — offering them a human, immediate safety net that no other organization in the world can give them. A service that further reinforces what your association means to them.

Discover the platform: sos-expat.com
Let's talk: sos-expat.com/devenir-partenaire

Williams Jullin — Founder
SOS-Expat.com`,
  },
  {
    language: "es",
    subject: "Para tus miembros — una red de seguridad humana e inmediata en todo el mundo",
    body: `Hola,

Tu asociación es un pilar esencial para todos los expatriados que acompañas — un referente, una voz, una fuerza en la que cuentan en todo el mundo.

Sin embargo, frente a un accidente, un litigio o una urgencia administrativa al otro lado del mundo, incluso la asociación más comprometida no siempre puede estar presente en tiempo real.

SOS-Expat.com llena exactamente ese vacío: la primera y única plataforma del mundo que devuelve la llamada a cualquier expatriado, viajero o turista en menos de 5 minutos por teléfono — un abogado local o un expatriado que conoce el terreno, en su idioma, en su país. 197 países, todas las nacionalidades, 24h/24.

Las cifras de nuestra gran encuesta exclusiva entre expatriados hablan por sí solas: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Simplemente te proponemos presentar SOS-Expat a tus miembros en tu próximo email o newsletter — ofreciéndoles una red de seguridad humana e inmediata que ninguna otra organización en el mundo puede darles. Un servicio que refuerza aún más lo que tu asociación representa para ellos.

Descubre la plataforma: sos-expat.com
Hablemos: sos-expat.com/devenir-partenaire

Williams Jullin — Fundador
SOS-Expat.com`,
  },
  {
    language: "de",
    subject: "Für Ihre Mitglieder — ein menschliches, sofortiges Sicherheitsnetz weltweit",
    body: `Guten Tag,

Ihr Verein ist eine wesentliche Stütze für alle Expats, die Sie begleiten — ein Bezugspunkt, eine Stimme, eine Kraft, auf die sie sich überall auf der Welt verlassen.

Dennoch kann selbst der engagierteste Verein bei einem Unfall, einem Rechtsstreit oder einem Verwaltungsnotfall am anderen Ende der Welt nicht immer in Echtzeit vor Ort sein.

SOS-Expat.com schließt genau diese Lücke: die weltweit erste und einzige Plattform, die jeden Expat, Reisenden oder Urlauber in unter 5 Minuten telefonisch zurückruft — ein lokaler Anwalt oder ein Expat, der sich auskennt, in seiner Sprache, in seinem Land. 197 Länder, alle Nationalitäten, rund um die Uhr.

Die Zahlen unserer exklusiven Großumfrage unter Expats sprechen für sich: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Wir schlagen Ihnen einfach vor, SOS-Expat Ihren Mitgliedern in Ihrer nächsten E-Mail oder Ihrem nächsten Newsletter vorzustellen — und ihnen ein menschliches, sofortiges Sicherheitsnetz zu bieten, das keine andere Organisation weltweit ihnen geben kann. Ein Service, der zusätzlich stärkt, was Ihr Verein für sie bedeutet.

Entdecken Sie die Plattform: sos-expat.com
Sprechen wir darüber: sos-expat.com/devenir-partenaire

Williams Jullin — Gründer
SOS-Expat.com`,
  },
  {
    language: "pt",
    subject: "Para os seus membros — uma rede de segurança humana e imediata em todo o mundo",
    body: `Olá,

Sua associação é um pilar essencial para todos os expatriados que você acompanha — uma referência, uma voz, uma força com a qual eles contam em todo o mundo.

No entanto, diante de um acidente, um litígio ou uma urgência administrativa do outro lado do mundo, mesmo a associação mais engajada nem sempre pode estar presente em tempo real.

SOS-Expat.com preenche exatamente essa lacuna: a primeira e única plataforma do mundo que retorna a ligação para qualquer expatriado, viajante ou turista em menos de 5 minutos — um advogado local ou um expatriado que conhece o terreno, no seu idioma, no seu país. 197 países, todas as nacionalidades, 24h por dia.

Os números da nossa grande pesquisa exclusiva com expatriados falam por si: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Simplesmente propomos apresentar a SOS-Expat aos seus membros no seu próximo email ou newsletter — oferecendo-lhes uma rede de segurança humana e imediata que nenhuma outra organização no mundo pode lhes dar. Um serviço que reforça ainda mais o que sua associação representa para eles.

Descubra a plataforma: sos-expat.com
Vamos conversar: sos-expat.com/devenir-partenaire

Williams Jullin — Fundador
SOS-Expat.com`,
  },
  {
    language: "ru",
    subject: "Для ваших членов — человеческая, мгновенная страховочная сетка по всему миру",
    body: `Здравствуйте,

Ваша ассоциация — это важнейшая опора для всех экспатов, которых вы сопровождаете: ориентир, голос, сила, на которую они рассчитывают по всему миру.

Однако перед лицом аварии, спора или административной чрезвычайной ситуации на другом конце света даже самая вовлечённая ассоциация не всегда может оказаться рядом в реальном времени.

SOS-Expat.com заполняет именно этот пробел: первая и единственная в мире платформа, которая перезванивает любому экспату, путешественнику или туристу менее чем за 5 минут — местный адвокат или экспат, знающий обстановку, на его языке, в его стране. 197 стран, все национальности, 24 часа в сутки.

Цифры нашего эксклюзивного масштабного опроса экспатов говорят сами за себя: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Мы просто предлагаем представить SOS-Expat вашим членам в вашем следующем письме или рассылке — предоставив им человеческую, мгновенную страховочную сетку, которую ни одна другая организация в мире не может им дать. Сервис, ещё больше усиливающий то, что ваша ассоциация значит для них.

Откройте для себя платформу: sos-expat.com
Давайте поговорим: sos-expat.com/devenir-partenaire

Williams Jullin — Основатель
SOS-Expat.com`,
  },
  {
    language: "ar",
    subject: "لأعضائكم — شبكة أمان إنسانية وفورية في أي مكان في العالم",
    body: `مرحباً،

جمعيتكم ركيزة أساسية لكل المغتربين الذين ترافقونهم — مرجع وصوت وقوة يعتمدون عليها في جميع أنحاء العالم.

ومع ذلك، أمام حادث أو نزاع أو طارئ إداري يحدث في الطرف الآخر من العالم، حتى أكثر الجمعيات التزاماً لا تستطيع دائماً أن تكون حاضرة في الوقت الفعلي.

SOS-Expat.com تملأ هذه الفجوة تماماً: أول وأوحد منصة في العالم تعاود الاتصال بأي مغترب أو مسافر أو سائح في أقل من 5 دقائق عبر الهاتف — محامٍ محلي أو مغترب يعرف الميدان، بلغته، في بلده. 197 دولة، جميع الجنسيات، على مدار الساعة.

أرقام استطلاعنا الحصري الكبير للمغتربين تتحدث عن نفسها: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

نقترح عليكم ببساطة تقديم SOS-Expat لأعضائكم في رسالتكم أو نشرتكم الإخبارية القادمة — مقدّمين لهم شبكة أمان إنسانية وفورية لا يمكن لأي منظمة أخرى في العالم أن تمنحها. خدمة تعزّز أكثر ما تمثله جمعيتكم بالنسبة لهم.

اكتشف المنصة: sos-expat.com
لنتحدث: sos-expat.com/devenir-partenaire

Williams Jullin — المؤسس
SOS-Expat.com`,
  },
  {
    language: "zh",
    subject: "为您的成员 — 全球范围内人性化、即时的安全网",
    body: `您好，

贵协会是您所陪伴的所有外籍人士不可或缺的支柱——一个坐标、一种声音、一股他们在全世界都可以依靠的力量。

然而，面对发生在世界另一端的意外、纠纷或紧急行政事务，即使是最投入的协会，也并不总能实时在场。

SOS-Expat.com 正好填补了这一空白：全球首个也是唯一一个能在 5 分钟内通过电话回拨任何外籍人士、旅行者或度假者的平台——由当地律师或熟悉当地情况的外籍人士，以其母语、在其所在国家联系他们。覆盖 197 个国家，支持所有国籍，全天 24 小时服务。

我们面向外籍人士的大型独家调查数据不言而喻：sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

我们只是建议您在下一封邮件或通讯中向成员介绍 SOS-Expat——为他们提供一张人性化、即时的安全网，这是世界上任何其他组织都无法给予的。这项服务将进一步强化贵协会对他们的意义。

了解平台：sos-expat.com
让我们谈谈：sos-expat.com/devenir-partenaire

Williams Jullin — 创始人
SOS-Expat.com`,
  },
  {
    language: "hi",
    subject: "आपके सदस्यों के लिए — दुनिया भर में मानवीय, तत्काल सुरक्षा कवच",
    body: `नमस्ते,

आपका संघ उन सभी प्रवासियों के लिए एक आवश्यक स्तंभ है जिनके साथ आप खड़े हैं — एक संदर्भ बिंदु, एक आवाज़, एक शक्ति जिस पर वे दुनिया भर में भरोसा करते हैं।

फिर भी, दुनिया के दूसरे छोर पर होने वाली एक दुर्घटना, एक विवाद या एक प्रशासनिक आपातकाल के सामने, सबसे प्रतिबद्ध संघ भी हमेशा वास्तविक समय में वहाँ नहीं हो सकता।

SOS-Expat.com ठीक इसी कमी को पूरा करता है: दुनिया का पहला और एकमात्र प्लेटफ़ॉर्म जो किसी भी प्रवासी, यात्री या छुट्टी मनाने वाले को 5 मिनट से भी कम समय में फ़ोन पर कॉल बैक करता है — एक स्थानीय वकील या क्षेत्र को जानने वाला प्रवासी, उसकी भाषा में, उसके देश में। 197 देश, सभी राष्ट्रीयताएँ, 24 घंटे।

प्रवासियों के बीच हमारे विशेष बड़े पैमाने के सर्वेक्षण के आँकड़े खुद बोलते हैं: sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

हम बस यह सुझाव देते हैं कि आप अपने अगले ईमेल या न्यूज़लेटर में अपने सदस्यों को SOS-Expat प्रस्तुत करें — उन्हें एक मानवीय, तत्काल सुरक्षा कवच प्रदान करते हुए जो दुनिया में कोई अन्य संगठन उन्हें नहीं दे सकता। एक सेवा जो आपके संघ के उनके लिए अर्थ को और भी मज़बूत करती है।

प्लेटफ़ॉर्म खोजें: sos-expat.com
बात करें: sos-expat.com/devenir-partenaire

Williams Jullin — संस्थापक
SOS-Expat.com`,
  },
];

async function upsert(tpl: LangTemplate, frId: number | null) {
  const existing = await prisma.messageTemplate.findFirst({
    where: { language: tpl.language, sourceContactType: "association" },
  });
  if (existing) {
    return prisma.messageTemplate.update({
      where: { id: existing.id },
      data: {
        subject: tpl.subject,
        body: tpl.body,
        category: "association",
        ...(tpl.language !== "fr" && frId ? { translatedFromId: frId } : {}),
      },
    });
  }
  return prisma.messageTemplate.create({
    data: {
      language: tpl.language,
      sourceContactType: "association",
      category: "association",
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
    where: { sourceContactType: "association" },
    orderBy: { language: "asc" },
  });
  console.log(`association templates (${all.length}):`);
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
