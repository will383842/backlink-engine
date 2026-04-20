// ---------------------------------------------------------------------------
// Apply native-review fixes from 8 language-native agents.
// Each fix is string.split(from).join(to) on subject/body.
// Idempotent: applying twice is a no-op after first success.
// ---------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Fix {
  field: "subject" | "body";
  from: string;
  to: string;
}

const FIXES: Record<string, Fix[]> = {
  en: [
    { field: "body", from: "an expat who knows the ground", to: "an expat who knows the country inside out" },
    { field: "body", from: "without speaking the language", to: "and doesn't speak the local language" },
    { field: "body", from: "withdrawable within 24h on simple request", to: "paid out within 24 hours on request" },
    { field: "subject", from: "24h withdrawal", to: "paid out in 24 hours" },
    { field: "body", from: "On your side, you earn $10 per call generated", to: "For you, it's $10 per call generated" },
    { field: "body", from: "Zero management, immediate passive income.", to: "No admin on your end — passive income from day one." },
    { field: "body", from: "The proof in numbers from our exclusive large-scale survey of expats:", to: "The data from our in-depth survey of expats backs it up:" },
    { field: "body", from: "a number expected to triple in the coming weeks", to: "and that figure is on track to triple in the coming weeks" },
    { field: "body", from: "Let's talk:", to: "Get in touch:" },
    { field: "body", from: "We remain available for an exclusive interview or any further information.", to: "Happy to set up an exclusive interview or share any further details." },
    { field: "body", from: "travellers and holidaymakers", to: "travelers and vacationers" },
    { field: "body", from: "€49 for 20 min with a lawyer, €19 for 30 min with a fellow expat", to: "$49 for 20 min with a lawyer, $19 for 30 min with a fellow expat" },
    { field: "body", from: "facing an accident, a dispute or an administrative emergency", to: "dealing with an accident, a dispute or a paperwork emergency" },
    { field: "body", from: "the world's first and only platform to solve this problem", to: "the only platform in the world built to solve this" },
  ],
  de: [
    { field: "body", from: "Stellen Sie sich vor:", to: "Stellen Sie sich folgende Situation vor:" },
    { field: "body", from: "ein Expat, der sich auskennt", to: "ein erfahrener Expat vor Ort" },
    { field: "body", from: "Guten Tag,\n\n", to: "Sehr geehrte Damen und Herren,\n\n" },
    { field: "body", from: "die tägliche Realität von Millionen", to: "der Alltag von Millionen" },
    { field: "body", from: "menschliche Antwort", to: "persönliche Antwort" },
    { field: "body", from: "in unter 5 Minuten", to: "in weniger als 5 Minuten" },
    { field: "body", from: "die Zahlen sprechen für sich:", to: "die Zahlen sprechen eine deutliche Sprache:" },
    { field: "body", from: "Entdecken Sie die Plattform:", to: "Mehr über die Plattform:" },
    { field: "body", from: "Sprechen wir darüber:", to: "Kontakt aufnehmen:" },
    { field: "body", from: "pro generiertem Anruf", to: "pro vermitteltem Anruf" },
    { field: "subject", from: "pro generiertem Anruf", to: "pro vermitteltem Anruf" },
    { field: "subject", from: "Auszahlung in 24h", to: "Auszahlung binnen 24 h" },
    { field: "body", from: "auf einfache Anfrage innerhalb von 24h auszahlbar", to: "auf Anfrage innerhalb von 24 Stunden auszahlbar" },
    { field: "body", from: "Auf Ihrer Seite verdienen Sie", to: "Sie selbst verdienen dabei" },
    { field: "body", from: "Wir schlagen Ihnen einfach vor,", to: "Wir möchten Ihnen vorschlagen," },
    { field: "body", from: "stärken Ihren Mehrwert", to: "steigern so den Mehrwert" },
    { field: "body", from: "Der Beweis durch die Zahlen unserer", to: "Den Beweis liefern die Zahlen unserer" },
    { field: "subject", from: "Differenzierungsmerkmal", to: "Alleinstellungsmerkmal" },
    { field: "body", from: "Differenzierungsmerkmal", to: "Alleinstellungsmerkmal" },
    { field: "body", from: "ohne jeglichen zusätzlichen Verwaltungsaufwand", to: "ganz ohne zusätzlichen Verwaltungsaufwand" },
    { field: "body", from: "Treten Sie dem Programm bei:", to: "Jetzt am Programm teilnehmen:" },
  ],
  es: [
    { field: "body", from: "la plataforma ya ya tiene 82 abogados", to: "la plataforma ya cuenta con 82 abogados" },
    { field: "body", from: "un expatriado que conoce el terreno", to: "un expatriado que conoce el país" },
    { field: "body", from: "sin hablar el idioma", to: "sin dominar el idioma" },
    { field: "body", from: "las cifras son elocuentes", to: "las cifras hablan por sí solas" },
    { field: "body", from: "y retirable en 24h con una simple solicitud", to: "y que puedes retirar en 24 h con una simple solicitud" },
    { field: "body", from: "Cero gestión, ingreso pasivo instantáneo.", to: "Sin ninguna gestión: ingreso pasivo al instante." },
    { field: "body", from: "una fuerza en la que cuentan", to: "una fuerza con la que cuentan" },
    { field: "body", from: "Simplemente te proponemos presentar SOS-Expat", to: "Solo queremos proponerte presentar SOS-Expat" },
    { field: "body", from: "refuerza aún más lo que tu asociación representa para ellos", to: "refuerza todavía más el papel que tu asociación tiene para ellos" },
    { field: "body", from: "Quedamos disponibles para una entrevista exclusiva o cualquier información adicional.", to: "Quedamos a tu disposición para una entrevista exclusiva o para ampliar cualquier información." },
    { field: "body", from: "La prueba por las cifras de nuestra", to: "La prueba está en las cifras de nuestra" },
    { field: "body", from: "nunca estarán verdaderamente solos", to: "nunca estarán realmente solos" },
    { field: "body", from: "19€ por 30 min con un expatriado dispuesto a ayudar.", to: "19€ por 30 min con un expatriado voluntario." },
    { field: "body", from: "refuerzas tu valor añadido ante tus clientes.", to: "refuerzas el valor que aportas a tus clientes." },
    { field: "subject", from: "un factor diferenciador único en el mundo", to: "un elemento diferenciador único en el mundo" },
    { field: "body", from: "un fuerte argumento diferenciador frente a tus competidores", to: "una ventaja diferencial clara frente a tus competidores" },
    { field: "body", from: "no sabe a quién acudir", to: "no sabe a quién recurrir" },
    { field: "body", from: "Imagina:", to: "Imagínate:" },
  ],
  pt: [
    { field: "body", from: "que conhece o terreno", to: "que conhece a realidade local" },
    { field: "body", from: "sem falar o idioma", to: "sem falar a língua" },
    { field: "body", from: "a barreira do idioma", to: "a barreira linguística" },
    { field: "body", from: "que retorna a ligação diretamente por telefone", to: "que lhes liga de volta diretamente" },
    { field: "body", from: "no seu idioma, no seu país", to: "na sua língua, no seu país" },
    { field: "subject", from: "saque em 24h", to: "levantamento em 24h" },
    { field: "body", from: "sacável em 24h com uma simples solicitação", to: "disponível para levantamento em 24h a pedido" },
    { field: "body", from: "Do seu lado, você ganha 10$", to: "Da sua parte, ganha 10$" },
    { field: "body", from: "Zero gestão, renda passiva imediata.", to: "Zero gestão, rendimento passivo imediato." },
    { field: "body", from: "Simplesmente propomos apresentar a SOS-Expat", to: "Propomos apenas apresentar a SOS-Expat" },
    { field: "body", from: "Vamos conversar:", to: "Falemos sobre isso:" },
    { field: "body", from: "ou usuários se encontra sozinho no exterior", to: "ou utilizadores vê-se sozinho no estrangeiro" },
    { field: "body", from: "viaja ao exterior e se encontra sozinho", to: "viaja para o estrangeiro e vê-se sozinho" },
    { field: "body", from: "frente aos seus concorrentes, sem nenhuma gestão adicional do seu lado", to: "face aos seus concorrentes, sem qualquer gestão adicional da sua parte" },
    { field: "body", from: "quem está lá para ele em menos de 5 minutos?", to: "quem está lá para o apoiar em menos de 5 minutos?" },
    { field: "body", from: "A prova pelos números da nossa grande pesquisa exclusiva com expatriados", to: "A prova está nos números do nosso grande inquérito exclusivo a expatriados" },
    { field: "body", from: "Permanecemos à disposição", to: "Ficamos à disposição" },
    { field: "body", from: "preenche exatamente essa lacuna", to: "colmata precisamente essa lacuna" },
    { field: "body", from: "os números são eloquentes", to: "os números falam por si" },
    { field: "body", from: "reforça seu valor agregado junto aos seus clientes", to: "reforça a sua proposta de valor junto dos seus clientes" },
    { field: "body", from: "a associação mais engajada", to: "a associação mais empenhada" },
  ],
  ru: [
    { field: "body", from: "административной чрезвычайной ситуации", to: "проблемы с документами" },
    { field: "body", from: "Нет местных контактов, нет сети, языковой барьер.", to: "Ни знакомых на месте, ни связей, ни знания языка." },
    { field: "body", from: "без местных контактов, без сети, без знания языка", to: "без знакомых на месте, без связей и без знания языка" },
    { field: "body", from: "экспат, знающий обстановку", to: "экспат, хорошо знающий страну" },
    { field: "body", from: "человеческий ответ", to: "живой человеческий отклик" },
    { field: "body", from: "все национальности, 24 часа в сутки", to: "любые национальности, круглосуточно" },
    { field: "body", from: "Откройте для себя платформу:", to: "Узнайте о платформе:" },
    { field: "body", from: "цифра, которая должна утроиться", to: "и их число, по нашим прогнозам, должно утроиться" },
    { field: "body", from: "за каждый сгенерированный звонок", to: "за каждый приведённый звонок" },
    { field: "body", from: "в вашей панели", to: "в личном кабинете" },
    { field: "body", from: "Ноль управления, мгновенный пассивный доход.", to: "Никакой рутины — мгновенный пассивный доход." },
    { field: "body", from: "Мы просто предлагаем представить SOS-Expat вашим членам", to: "Мы предлагаем просто рассказать о SOS-Expat вашим участникам" },
    { field: "body", from: "вашим членам", to: "вашим участникам" },
    { field: "body", from: "Давайте поговорим:", to: "Обсудим детали:" },
    { field: "body", from: "добавленную ценность для клиентов", to: "ценность в глазах клиентов" },
    { field: "body", from: "уникальный в мире сервис", to: "не имеющий аналогов в мире сервис" },
    { field: "body", from: "уникальную в мире подстраховку", to: "не имеющую аналогов в мире подстраховку" },
    { field: "body", from: "сильный аргумент отличия от конкурентов", to: "весомый аргумент, выделяющий вас среди конкурентов" },
    { field: "body", from: "без какого-либо дополнительного управления с вашей стороны", to: "и без каких-либо дополнительных хлопот с вашей стороны" },
    { field: "body", from: "Доказательство в цифрах нашего", to: "Красноречивые цифры нашего" },
    { field: "body", from: "цифры красноречивы:", to: "цифры говорят сами за себя:" },
    { field: "body", from: "Мы остаёмся доступны для эксклюзивного интервью", to: "Мы всегда готовы дать эксклюзивное интервью" },
    { field: "body", from: "с экспатом-помощником", to: "с экспатом-консультантом" },
    { field: "body", from: "49€", to: "49 €" },
    { field: "body", from: "19€", to: "19 €" },
    { field: "body", from: "10$", to: "10 $" },
    { field: "subject", from: "10$", to: "10 $" },
    { field: "body", from: "5$", to: "5 $" },
    { field: "body", from: "сопровождаете", to: "помогаете" },
    { field: "body", from: "самая вовлечённая ассоциация не всегда может оказаться рядом в реальном времени", to: "самая активная ассоциация не всегда способна прийти на помощь здесь и сейчас" },
  ],
  ar: [
    { field: "body", from: "تحية طيبة،\n\n", to: "السلام عليكم ورحمة الله وبركاته،\n\nتحية طيبة وبعد،\n\n" },
    { field: "body", from: "يعرف الميدان", to: "على دراية بواقع البلد" },
    { field: "body", from: "حاجز اللغة", to: "وصعوبة التواصل باللغة المحلية" },
    { field: "body", from: "وحيداً،", to: "وحيدًا،" },
    { field: "body", from: "Williams Jullin", to: "ويليامز جولان" },
    { field: "body", from: "هي أول وأوحد منصة", to: "هي المنصة الأولى والوحيدة" },
    { field: "body", from: "رقم يُتوقع أن يتضاعف ثلاث مرات", to: "رقم نتوقّع أن يبلغ ثلاثة أضعافه" },
    { field: "body", from: "الأرقام بليغة", to: "الأرقام تتحدث عن نفسها" },
    { field: "body", from: "طارئاً إدارياً", to: "طارئة إدارية" },
    { field: "body", from: "سجّل كشريك تابع:", to: "انضم إلى برنامج الشركاء:" },
    { field: "body", from: "صفر إدارة، دخل سلبي فوري.", to: "دون أي أعباء إدارية، ودخل سلبي فوري." },
    { field: "body", from: "تُقيَّد تلقائياً في لوحة تحكمك", to: "تُضاف تلقائياً إلى لوحة تحكّمك" },
    { field: "body", from: "خدمة فريدة عالمياً، مكمّلة لخدمتك الخاصة", to: "خدمة فريدة من نوعها عالميًا، ومكمّلة لخدمتك" },
    { field: "body", from: "وتعزّز قيمتك المضافة لدى عملائك.", to: "وتعزّز مكانتك لدى عملائك." },
    { field: "body", from: "حجة تمييز قوية أمام منافسيك", to: "ميزة تنافسية قوية أمام منافسيك" },
    { field: "body", from: "دون أي إدارة إضافية من جانبك.", to: "دون أي أعباء إدارية إضافية عليك." },
    { field: "body", from: "في الطرف الآخر من العالم", to: "في أقاصي الأرض" },
    { field: "body", from: "تملأ هذه الفجوة تماماً", to: "تسدّ هذه الثغرة تمامًا" },
    { field: "body", from: "لا يمكن لأي منظمة أخرى في العالم أن تمنحها", to: "لا تستطيع أي منظمة أخرى في العالم تقديمها" },
    { field: "body", from: "لنتحدث:", to: "للتواصل معنا:" },
    { field: "body", from: "موظفوكم في الخارج هم أعظم قوة لديكم.", to: "موظفوكم في الخارج هم أعظم رصيد لديكم." },
    { field: "body", from: "يعني أن تضمنوا لهم أنهم لن يكونوا وحيدين حقاً أبداً", to: "يعني أن تمنحوهم ضمانة حقيقية بألّا يكونوا وحدهم أبدًا" },
    { field: "subject", from: "لمساعدة المغتربين في 5 دقائق", to: "لإغاثة المغتربين خلال 5 دقائق" },
  ],
  zh: [
    { field: "body", from: "想象一下：", to: "设想这样一个场景：" },
    { field: "body", from: "熟悉当地情况的外籍人士", to: "熟知当地情况的资深同胞" },
    { field: "body", from: "数百万外籍人士、旅行者和度假者", to: "数百万海外同胞、旅居者和游客" },
    { field: "body", from: "旅行者和度假者", to: "旅居者和游客" },
    { field: "body", from: "支持所有国籍", to: "不限国籍" },
    { field: "body", from: "全天候服务。", to: "7×24 小时在线。" },
    { field: "body", from: "您好，\n\n", to: "您好：\n\n" },
    { field: "body", from: "与助人外籍人士沟通 30 分钟 19 欧元", to: "热心同胞咨询 30 分钟 19 欧元" },
    { field: "body", from: "与律师沟通 20 分钟 49 欧元", to: "律师咨询 20 分钟 49 欧元" },
    { field: "body", from: "已注册律师 82 位——预计未来几周将增至三倍", to: "已入驻律师 82 位，预计未来数周内将增至三倍" },
    { field: "body", from: "全球已注册 82 位律师——预计未来几周将增至三倍", to: "全球已入驻律师 82 位，预计未来数周内将增至三倍" },
    { field: "body", from: "您每产生一次通话可赚取 10 美元", to: "每成功促成一次通话，您即可获得 10 美元佣金" },
    { field: "body", from: "您每产生一次通话即可赚取 10 美元", to: "您每成功促成一次通话即可获得 10 美元佣金" },
    { field: "body", from: "可在您的控制面板中查看，申请后 24 小时内即可提现", to: "佣金实时显示在后台面板，申请后 24 小时内到账" },
    { field: "body", from: "自动计入您的控制面板，申请后 24 小时内即可提现", to: "自动进入您的后台账户，申请后 24 小时内到账" },
    { field: "body", from: "注册成为推广合作伙伴：", to: "申请成为推广合作伙伴：" },
    { field: "body", from: "紧急行政事务", to: "紧急行政手续问题" },
    { field: "body", from: "让我们谈谈：", to: "期待与您进一步沟通：" },
    { field: "body", from: "一场意外、一场纠纷、一项紧急行政手续问题", to: "意外、纠纷或紧急行政难题" },
    { field: "body", from: "一场意外、一场纠纷或一个紧急情况", to: "意外、纠纷或紧急状况" },
    { field: "body", from: "一场意外、一场纠纷、一个紧急问题", to: "意外、纠纷或突发难题" },
    { field: "body", from: "了解平台：", to: "查看平台详情：" },
    { field: "body", from: "成为合作伙伴：", to: "申请成为合作伙伴：" },
    { field: "body", from: "成为 SOS-Expat 网红", to: "加入 SOS-Expat 达人计划" },
    { field: "subject", from: "成为 SOS-Expat 网红", to: "加入 SOS-Expat 达人计划" },
    { field: "body", from: "零管理，即时被动收入。", to: "全程免操心，被动收入即时到账。" },
    { field: "body", from: "您的专属代码", to: "您的专属推广码" },
    { field: "body", from: "独家折扣", to: "专属优惠" },
  ],
  hi: [
    { field: "body", from: "कल्पना कीजिए:", to: "ज़रा सोचिए —" },
    { field: "body", from: "मानवीय उत्तर", to: "इंसानी, भरोसेमंद जवाब" },
    { field: "body", from: "मानवीय और तत्काल प्रतिक्रिया", to: "इंसानी और तुरंत मदद" },
    { field: "body", from: "मानवीय, तत्काल सुरक्षा कवच", to: "इंसानी, तुरंत मिलने वाला सुरक्षा कवच" },
    { field: "subject", from: "मानवीय प्रतिक्रिया", to: "इंसानी मदद" },
    { field: "body", from: "दिन के 24 घंटे", to: "24 घंटे, हफ़्ते के सातों दिन" },
    { field: "body", from: "क्षेत्र को जानने वाले प्रवासी", to: "वहाँ के माहौल से वाकिफ़ प्रवासी" },
    { field: "body", from: "क्षेत्र को जानने वाला प्रवासी", to: "वहाँ के माहौल से वाकिफ़ प्रवासी" },
    { field: "body", from: "कॉल बैक करता है", to: "फ़ोन पर जवाब देता है" },
    { field: "body", from: "कॉल बैक प्राप्त करता है", to: "फ़ोन पर कॉल वापस आती है" },
    { field: "body", from: "कॉल बैक प्राप्त होता है", to: "फ़ोन पर कॉल वापस आती है" },
    { field: "body", from: "कॉल बैक प्राप्त कर सकता है", to: "फ़ोन पर कॉल वापस पा सकता है" },
    { field: "body", from: "भाषा न बोलते हुए", to: "वहाँ की भाषा भी नहीं आती" },
    { field: "body", from: "रोज़मर्रा की वास्तविकता है", to: "रोज़ की हकीकत है" },
    { field: "body", from: "एफ़िलिएट के रूप में पंजीकरण करें", to: "एफ़िलिएट के तौर पर साइन-अप करें" },
    { field: "body", from: "प्लेटफ़ॉर्म खोजें:", to: "प्लेटफ़ॉर्म देखें:" },
    { field: "body", from: "सरल अनुरोध पर 24 घंटे में निकाला जा सकता है", to: "एक क्लिक पर अनुरोध करके 24 घंटे में निकाला जा सकता है" },
    { field: "body", from: "शून्य प्रबंधन, तत्काल निष्क्रिय आय।", to: "कोई झंझट नहीं, तुरंत पैसिव इनकम।" },
    { field: "body", from: "बात करें:", to: "बात करते हैं:" },
    { field: "body", from: "विभेदक तत्व", to: "पहचान बनाने वाला फ़ायदा" },
    { field: "subject", from: "विभेदक तत्व", to: "पहचान बनाने वाला फ़ायदा" },
    { field: "body", from: "विभेदक तर्क", to: "अलग दिखाने वाली खूबी" },
    { field: "body", from: "आँकड़े खुद बोलते हैं", to: "आँकड़े खुद बहुत कुछ कह देते हैं" },
    { field: "subject", from: "डोज़ियर + साक्षात्कार", to: "प्रेस किट + इंटरव्यू" },
    { field: "body", from: "विशेष साक्षात्कार", to: "एक्सक्लूसिव इंटरव्यू" },
    { field: "body", from: "हम एक एक्सक्लूसिव इंटरव्यू या किसी भी अतिरिक्त जानकारी के लिए उपलब्ध हैं।", to: "हम एक्सक्लूसिव इंटरव्यू या किसी भी अतिरिक्त जानकारी के लिए हाज़िर हैं।" },
    { field: "body", from: "विशेष बड़े पैमाने के सर्वेक्षण", to: "एक्सक्लूसिव बड़ा सर्वे" },
    { field: "body", from: "एक सहायक प्रवासी", to: "एक मददगार प्रवासी" },
  ],
};

async function main() {
  let totalRows = 0;
  let totalReplacements = 0;
  const perLang: Record<string, { rows: number; reps: number }> = {};

  for (const [lang, fixes] of Object.entries(FIXES)) {
    console.log(`\n=== ${lang} (${fixes.length} fixes defined) ===`);
    const rows = await prisma.messageTemplate.findMany({
      where: { language: lang },
      select: { id: true, subject: true, body: true },
    });
    let langRows = 0;
    let langReps = 0;

    for (const row of rows) {
      let newSubject = row.subject;
      let newBody = row.body;
      let touched = false;

      for (const fix of fixes) {
        if (fix.field === "subject") {
          const next = newSubject.split(fix.from).join(fix.to);
          if (next !== newSubject) { newSubject = next; touched = true; langReps++; }
        } else {
          const next = newBody.split(fix.from).join(fix.to);
          if (next !== newBody) { newBody = next; touched = true; langReps++; }
        }
      }

      if (touched) {
        await prisma.messageTemplate.update({
          where: { id: row.id },
          data: { subject: newSubject, body: newBody },
        });
        langRows++;
      }
    }
    console.log(`  → ${langRows} rows touched, ${langReps} replacements`);
    perLang[lang] = { rows: langRows, reps: langReps };
    totalRows += langRows;
    totalReplacements += langReps;
  }

  console.log(`\n=== Summary ===`);
  for (const [lang, { rows, reps }] of Object.entries(perLang)) {
    console.log(`  ${lang}: ${rows} rows / ${reps} replacements`);
  }
  console.log(`  TOTAL: ${totalRows} rows, ${totalReplacements} replacements`);

  process.exit(0);
}

main()
  .catch((e) => { console.error("FATAL:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
