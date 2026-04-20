// ---------------------------------------------------------------------------
// Manual blog-template translations (no LLM call).
// Hand-written by Claude (model output, pre-rendered offline) so William has
// a deterministic, reviewable source of truth without any placeholder
// variables and with the FR phone number ONLY on the FR row.
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
    subject: "Devenez blogueur SOS-Expat — 10$ par appel généré, retrait 24h",
    body: `Bonjour,

Imaginez : vous êtes à l'étranger, seul, face à un problème — un accident, un litige, une question urgente — et vous ne savez pas vers qui vous tourner. Pas de contact local, pas de réseau, la barrière de la langue.

C'est la réalité quotidienne de millions d'expats, voyageurs et vacanciers partout dans le monde.

SOS-Expat.com est la première plateforme au monde qui leur apporte une réponse humaine en moins de 5 minutes : un avocat local ou un expat qui connaît le terrain, choisi selon sa langue, son pays, ses avis et ses spécialités, qui les rappelle directement par téléphone. 49€ pour 20 min avec un avocat, 19€ pour 30 min avec un expat aidant. 197 pays, toutes langues, toutes nationalités, 24h/24.

Lancée il y a moins de 2 mois, la plateforme compte déjà 82 avocats inscrits — un chiffre qui devrait tripler dans les prochaines semaines.

En recommandant SOS-Expat à vos lecteurs, vous leur offrez un filet de sécurité réel. Et vous gagnez 10$ par appel généré, disponible dans votre tableau de bord et retiré sous 24h sur simple demande.

Inscrivez-vous ici : sos-expat.com/devenir-blogger

Williams Jullin
SOS-Expat.com
+33 7 43 33 12 01`,
  },
  {
    language: "en",
    subject: "Become an SOS-Expat blogger — $10 per call generated, 24h withdrawal",
    body: `Hello,

Imagine: you're abroad, alone, facing a problem — an accident, a dispute, an urgent question — and you don't know who to turn to. No local contact, no network, the language barrier.

This is the daily reality of millions of expats, travellers and holidaymakers around the world.

SOS-Expat.com is the world's first platform that gives them a human answer in under 5 minutes: a local lawyer or an expat who knows the ground, chosen based on their language, country, reviews and specialties, who calls them back directly by phone. €49 for 20 min with a lawyer, €19 for 30 min with a helpful expat. 197 countries, all languages, all nationalities, 24/7.

Launched less than 2 months ago, the platform already has 82 registered lawyers — a number expected to triple in the coming weeks.

By recommending SOS-Expat to your readers, you give them a real safety net. And you earn $10 per call generated, available in your dashboard and withdrawable within 24h on simple request.

Sign up here: sos-expat.com/devenir-blogger

Williams Jullin
SOS-Expat.com`,
  },
  {
    language: "es",
    subject: "Conviértete en bloguero SOS-Expat — 10$ por llamada generada, retiro en 24h",
    body: `Hola,

Imagina: estás en el extranjero, solo, frente a un problema — un accidente, un litigio, una pregunta urgente — y no sabes a quién acudir. Sin contacto local, sin red, la barrera del idioma.

Es la realidad diaria de millones de expatriados, viajeros y turistas en todo el mundo.

SOS-Expat.com es la primera plataforma del mundo que les ofrece una respuesta humana en menos de 5 minutos: un abogado local o un expatriado que conoce el terreno, elegido según su idioma, país, opiniones y especialidades, que les devuelve la llamada directamente por teléfono. 49€ por 20 min con un abogado, 19€ por 30 min con un expatriado solidario. 197 países, todos los idiomas, todas las nacionalidades, 24h/24.

Lanzada hace menos de 2 meses, la plataforma ya cuenta con 82 abogados inscritos — una cifra que debería triplicarse en las próximas semanas.

Al recomendar SOS-Expat a tus lectores, les ofreces una red de seguridad real. Y ganas 10$ por cada llamada generada, disponible en tu panel y retirable en 24h con una simple solicitud.

Regístrate aquí: sos-expat.com/devenir-blogger

Williams Jullin
SOS-Expat.com`,
  },
  {
    language: "de",
    subject: "Werden Sie SOS-Expat Blogger — 10$ pro generiertem Anruf, Auszahlung in 24h",
    body: `Guten Tag,

Stellen Sie sich vor: Sie sind im Ausland, allein, mit einem Problem konfrontiert — ein Unfall, ein Rechtsstreit, eine dringende Frage — und wissen nicht, an wen Sie sich wenden sollen. Kein lokaler Kontakt, kein Netzwerk, die Sprachbarriere.

Das ist die tägliche Realität von Millionen Expats, Reisenden und Urlaubern weltweit.

SOS-Expat.com ist die weltweit erste Plattform, die ihnen in unter 5 Minuten eine menschliche Antwort bietet: ein lokaler Anwalt oder ein Expat, der sich auskennt, ausgewählt nach Sprache, Land, Bewertungen und Spezialgebieten, und sie direkt telefonisch zurückruft. 49€ für 20 Min mit einem Anwalt, 19€ für 30 Min mit einem hilfsbereiten Expat. 197 Länder, alle Sprachen, alle Nationalitäten, rund um die Uhr.

Vor weniger als 2 Monaten gestartet, zählt die Plattform bereits 82 registrierte Anwälte — eine Zahl, die sich in den nächsten Wochen verdreifachen soll.

Indem Sie SOS-Expat Ihren Lesern empfehlen, bieten Sie ihnen ein echtes Sicherheitsnetz. Und Sie verdienen 10$ pro generiertem Anruf, verfügbar in Ihrem Dashboard und auf einfache Anfrage innerhalb von 24h auszahlbar.

Hier anmelden: sos-expat.com/devenir-blogger

Williams Jullin
SOS-Expat.com`,
  },
  {
    language: "pt",
    subject: "Torne-se blogger SOS-Expat — 10$ por chamada gerada, saque em 24h",
    body: `Olá,

Imagine: você está no exterior, sozinho, diante de um problema — um acidente, um litígio, uma questão urgente — e não sabe a quem recorrer. Sem contato local, sem rede, a barreira do idioma.

Essa é a realidade diária de milhões de expatriados, viajantes e turistas em todo o mundo.

SOS-Expat.com é a primeira plataforma do mundo que lhes oferece uma resposta humana em menos de 5 minutos: um advogado local ou um expatriado que conhece o terreno, escolhido segundo seu idioma, país, avaliações e especialidades, que retorna a ligação diretamente por telefone. 49€ por 20 min com um advogado, 19€ por 30 min com um expatriado solidário. 197 países, todos os idiomas, todas as nacionalidades, 24h por dia.

Lançada há menos de 2 meses, a plataforma já conta com 82 advogados inscritos — um número que deve triplicar nas próximas semanas.

Ao recomendar SOS-Expat aos seus leitores, você lhes oferece uma rede de segurança real. E ganha 10$ por cada chamada gerada, disponível em seu painel e sacável em 24h com uma simples solicitação.

Inscreva-se aqui: sos-expat.com/devenir-blogger

Williams Jullin
SOS-Expat.com`,
  },
  {
    language: "ru",
    subject: "Станьте блогером SOS-Expat — 10$ за каждый звонок, вывод за 24 часа",
    body: `Здравствуйте,

Представьте: вы за границей, один, столкнулись с проблемой — авария, спор, срочный вопрос — и не знаете, к кому обратиться. Нет местных контактов, нет сети, языковой барьер.

Это повседневная реальность миллионов экспатов, путешественников и туристов по всему миру.

SOS-Expat.com — первая в мире платформа, которая даёт им человеческий ответ менее чем за 5 минут: местный адвокат или экспат, знающий обстановку, выбранный по языку, стране, отзывам и специализациям, перезванивает напрямую по телефону. 49€ за 20 минут с адвокатом, 19€ за 30 минут с экспатом-помощником. 197 стран, все языки, все национальности, 24 часа в сутки.

Запущенная менее 2 месяцев назад, платформа уже насчитывает 82 зарегистрированных адвоката — цифра, которая должна утроиться в ближайшие недели.

Рекомендуя SOS-Expat своим читателям, вы предоставляете им реальную страховочную сетку. А вы зарабатываете 10$ за каждый сгенерированный звонок, доступный в вашей панели и выводимый в течение 24 часов по простому запросу.

Зарегистрируйтесь здесь: sos-expat.com/devenir-blogger

Williams Jullin
SOS-Expat.com`,
  },
  {
    language: "ar",
    subject: "كن مدوناً لدى SOS-Expat — 10$ لكل مكالمة، سحب خلال 24 ساعة",
    body: `مرحباً،

تخيّل: أنت في الخارج، وحيداً، تواجه مشكلة — حادثاً، نزاعاً، سؤالاً عاجلاً — ولا تعرف إلى من تتوجه. لا اتصال محلي، لا شبكة، حاجز اللغة.

هذه هي الحقيقة اليومية لملايين المغتربين والمسافرين والسياح حول العالم.

SOS-Expat.com هي أول منصة في العالم توفّر لهم رداً بشرياً في أقل من 5 دقائق: محامٍ محلي أو مغترب يعرف الميدان، مختار حسب لغته وبلده وتقييماته وتخصصاته، يتصل بهم مباشرة عبر الهاتف. 49€ مقابل 20 دقيقة مع محامٍ، 19€ مقابل 30 دقيقة مع مغترب مساعد. 197 دولة، جميع اللغات، جميع الجنسيات، على مدار الساعة.

انطلقت منذ أقل من شهرين، وتضم المنصة بالفعل 82 محامياً مسجلاً — رقم يُتوقع أن يتضاعف ثلاث مرات في الأسابيع القادمة.

بتوصية SOS-Expat لقرّائك، تمنحهم شبكة أمان حقيقية. وتربح 10$ لكل مكالمة تولّدها، متاحة في لوحة التحكم الخاصة بك وقابلة للسحب خلال 24 ساعة بطلب بسيط.

سجّل هنا: sos-expat.com/devenir-blogger

Williams Jullin
SOS-Expat.com`,
  },
  {
    language: "zh",
    subject: "成为 SOS-Expat 博主 — 每次通话赚取 10 美元，24 小时内提现",
    body: `您好，

想象一下：您身在海外，独自一人，面对一个问题——一场意外、一场纠纷、一个紧急问题——却不知道该向谁求助。没有当地联系人，没有网络，还有语言障碍。

这是全世界数百万外籍人士、旅行者和度假者每天面临的现实。

SOS-Expat.com 是全球首个为他们在 5 分钟内提供真人解答的平台：一位当地律师或熟悉当地情况的外籍人士，根据其语言、国家、评价和专长进行筛选，直接通过电话回拨。与律师沟通 20 分钟 49 欧元，与助人外籍人士沟通 30 分钟 19 欧元。覆盖 197 个国家，支持所有语言和国籍，全天 24 小时服务。

平台上线不到 2 个月，已注册律师 82 位——预计未来几周将增至三倍。

向您的读者推荐 SOS-Expat，您为他们提供一张真正的安全网。同时，您每产生一次通话可赚取 10 美元，可在您的控制面板中查看，申请后 24 小时内即可提现。

在此注册：sos-expat.com/devenir-blogger

Williams Jullin
SOS-Expat.com`,
  },
  {
    language: "hi",
    subject: "SOS-Expat ब्लॉगर बनें — प्रति कॉल $10, 24 घंटे में निकासी",
    body: `नमस्ते,

कल्पना कीजिए: आप विदेश में हैं, अकेले हैं, एक समस्या का सामना कर रहे हैं — एक दुर्घटना, एक विवाद, एक तत्काल प्रश्न — और आप नहीं जानते कि किसके पास जाएँ। कोई स्थानीय संपर्क नहीं, कोई नेटवर्क नहीं, भाषा की बाधा।

यह दुनिया भर के लाखों प्रवासियों, यात्रियों और छुट्टी मनाने वालों की रोज़मर्रा की वास्तविकता है।

SOS-Expat.com दुनिया का पहला प्लेटफ़ॉर्म है जो उन्हें 5 मिनट से भी कम समय में मानवीय उत्तर प्रदान करता है: एक स्थानीय वकील या एक प्रवासी जो क्षेत्र को जानता है, उसकी भाषा, देश, समीक्षाओं और विशेषज्ञता के आधार पर चुना जाता है, और सीधे फ़ोन पर कॉल बैक करता है। एक वकील के साथ 20 मिनट के लिए 49€, एक सहायक प्रवासी के साथ 30 मिनट के लिए 19€। 197 देश, सभी भाषाएँ, सभी राष्ट्रीयताएँ, 24 घंटे।

2 महीने से भी कम समय पहले शुरू हुए इस प्लेटफ़ॉर्म पर पहले से ही 82 वकील पंजीकृत हैं — एक आँकड़ा जो आने वाले हफ़्तों में तीन गुना हो जाने की उम्मीद है।

अपने पाठकों को SOS-Expat की सिफ़ारिश करके, आप उन्हें एक वास्तविक सुरक्षा कवच प्रदान करते हैं। और आप प्रति कॉल $10 कमाते हैं, जो आपके डैशबोर्ड में उपलब्ध होता है और सरल अनुरोध पर 24 घंटे में निकाला जा सकता है।

यहाँ पंजीकरण करें: sos-expat.com/devenir-blogger

Williams Jullin
SOS-Expat.com`,
  },
];

async function upsert(tpl: LangTemplate, frId: number | null) {
  const existing = await prisma.messageTemplate.findFirst({
    where: { language: tpl.language, sourceContactType: "blog" },
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
      sourceContactType: "blog",
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
    console.log(`✓ ${tpl.language}  → id=${saved.id}`);
  }

  console.log("\n=== Verification ===");
  const all = await prisma.messageTemplate.findMany({
    where: { sourceContactType: "blog" },
    orderBy: { language: "asc" },
  });
  for (const t of all) {
    const hasPhone = t.body.includes("+33") ? "📞 AVEC phone" : "sans phone";
    console.log(`  ${t.language.padEnd(3)} (${t.body.length} chars) ${hasPhone}`);
  }

  process.exit(0);
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
