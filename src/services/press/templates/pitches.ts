/**
 * Embedded press pitch templates — 10 languages.
 *
 * Mirror of brand-entity-kit/presse/pitch-emails-9-langues.md, embedded
 * directly in TypeScript so the backend does not need filesystem access
 * to the parent sos-expat-project repo (which is not copied into the
 * Docker image).
 *
 * Positioning: SOS-Expat is "lawyer OR helpful expat" — covered across
 * all 10 languages. Update here AND in the markdown file together to
 * keep them in sync (the markdown is the human-editable reference).
 */
import type { PressLang } from "@prisma/client";

export const EMBEDDED_PITCHES: Record<PressLang, string> = {
  fr: `Bonjour [Prénom Journaliste],

Je vous contacte car votre travail sur [sujet récent écrit par le journaliste — une phrase pour montrer que vous avez lu] m'a fait penser à une actualité qui pourrait intéresser vos lecteurs.

SOS-Expat (sos-expat.com) est une plateforme lancée [date] depuis Tallinn qui résout un problème très concret : les 280 millions d'expatriés et voyageurs qui, chaque année, se retrouvent bloqués à l'étranger dans une situation juridique ou administrative sans savoir à qui s'adresser — dans leur langue.

En quelques chiffres :
  • 197 pays couverts
  • 9 langues (FR, EN, ES, DE, PT, RU, ZH, HI, AR)
  • Mise en relation téléphonique vérifiée en < 5 min avec un avocat OU un expatrié aidant
  • Consultation à l'acte $19-49, sans abonnement
  • 24h/24, 7j/7
  • Conforme RGPD + eIDAS

Je serais heureux·se de vous fournir :
  • Un communiqué de presse détaillé (PDF ci-joint)
  • Des visuels HD (logo, bannière, screenshots)
  • Un entretien avec [fondateur] sous 48h si un angle vous intéresse

Page presse : https://sos-expat.com/fr-fr/presse

Bien cordialement,
[Ton nom]
SOS-Expat
contact@sos-expat.com`,

  en: `Hello [Journalist's First Name],

I'm reaching out because your recent piece on [topic — one line] reminded me of news that might interest your readers.

SOS-Expat (sos-expat.com) is a platform launched [date] from Tallinn that solves a very concrete problem: the 280 million expats and travelers who, every year, find themselves stuck abroad in a legal or administrative situation without knowing whom to call — in their own language.

Key figures:
  • 197 countries covered
  • 9 languages (EN, FR, ES, DE, PT, RU, ZH, HI, AR)
  • Verified phone connection in under 5 min with a lawyer OR a helpful expat
  • Pay-per-consultation $19-49, no subscription
  • 24/7, worldwide
  • GDPR + eIDAS compliant

I'd be happy to provide:
  • A detailed press release (PDF attached)
  • HD visuals (logo, banner, screenshots)
  • An interview with [founder] within 48h

Press page: https://sos-expat.com/en-us/press

Best regards,
[Your name]
SOS-Expat
contact@sos-expat.com`,

  es: `Hola [Nombre del periodista],

Le contacto porque su reciente artículo sobre [tema — una frase] me hizo pensar en una noticia que podría interesar a sus lectores.

SOS-Expat (sos-expat.com) es una plataforma lanzada [fecha] desde Tallin que resuelve un problema muy concreto: los 280 millones de expatriados y viajeros que cada año se encuentran bloqueados en el extranjero en una situación jurídica o administrativa sin saber a quién llamar — en su idioma.

Cifras clave:
  • 197 países cubiertos
  • 9 idiomas (ES, EN, FR, DE, PT, RU, ZH, HI, AR)
  • Conexión telefónica verificada en menos de 5 min con un abogado O un expatriado ayudante
  • Consulta por acto $19-49, sin suscripción
  • 24/7, en todo el mundo
  • Conforme RGPD + eIDAS

Me encantaría proporcionarle:
  • Una nota de prensa detallada (PDF adjunto)
  • Visuales HD (logotipo, banner, capturas)
  • Una entrevista con [fundador] en 48h

Página de prensa: https://sos-expat.com/es-es/prensa

Atentamente,
[Tu nombre]
SOS-Expat
contact@sos-expat.com`,

  de: `Guten Tag [Vorname des Journalisten],

ich schreibe Ihnen, weil Ihr jüngster Beitrag zu [Thema — ein Satz] mich an eine Neuigkeit erinnert hat, die Ihre Leser interessieren könnte.

SOS-Expat (sos-expat.com) ist eine Plattform, die [Datum] von Tallinn aus gestartet wurde und ein ganz konkretes Problem löst: die 280 Millionen Expats und Reisenden, die jedes Jahr im Ausland in einer rechtlichen oder administrativen Situation feststecken, ohne zu wissen, an wen sie sich wenden können — in ihrer eigenen Sprache.

Kennzahlen:
  • 197 abgedeckte Länder
  • 9 Sprachen (DE, EN, FR, ES, PT, RU, ZH, HI, AR)
  • Verifizierte Telefonverbindung in unter 5 Min mit einem Anwalt ODER einem hilfsbereiten Expat
  • Abrechnung pro Beratung $19-49, kein Abonnement
  • 24/7, weltweit
  • DSGVO + eIDAS konform

Gerne stelle ich Ihnen zur Verfügung:
  • Eine detaillierte Pressemitteilung (PDF anbei)
  • HD-Visuals (Logo, Banner, Screenshots)
  • Ein Interview mit [Gründer] innerhalb von 48 Std

Pressebereich: https://sos-expat.com/de-de/presse

Mit freundlichen Grüßen,
[Dein Name]
SOS-Expat
contact@sos-expat.com`,

  pt: `Olá [Nome do jornalista],

Entro em contacto consigo porque o seu recente artigo sobre [tópico — uma frase] me fez pensar numa notícia que poderia interessar aos seus leitores.

SOS-Expat (sos-expat.com) é uma plataforma lançada [data] a partir de Tallinn que resolve um problema muito concreto: os 280 milhões de expatriados e viajantes que, todos os anos, se encontram bloqueados no estrangeiro numa situação jurídica ou administrativa sem saber a quem recorrer — no seu idioma.

Alguns números:
  • 197 países cobertos
  • 9 idiomas (PT, EN, FR, ES, DE, RU, ZH, HI, AR)
  • Ligação telefónica verificada em menos de 5 min com um advogado OU um expatriado ajudante
  • Consulta por acto $19-49, sem subscrição
  • 24/7, em todo o mundo
  • Em conformidade com o RGPD + eIDAS

Teria todo o gosto em fornecer-lhe:
  • Um comunicado de imprensa detalhado (PDF em anexo)
  • Visuais HD (logo, banner, capturas de ecrã)
  • Uma entrevista com [fundador] em 48h

Página de imprensa: https://sos-expat.com/pt-pt/imprensa

Com os melhores cumprimentos,
[O seu nome]
SOS-Expat
contact@sos-expat.com`,

  ru: `Здравствуйте, [Имя журналиста],

Я пишу Вам, потому что Ваша недавняя статья о [тема — одна фраза] напомнила мне о новости, которая может заинтересовать Ваших читателей.

SOS-Expat (sos-expat.com) — это платформа, запущенная [дата] из Таллина, которая решает очень конкретную проблему: 280 миллионов экспатов и путешественников, которые каждый год оказываются заблокированными за границей в юридической или административной ситуации, не зная, к кому обратиться — на своем языке.

Ключевые цифры:
  • 197 охваченных стран
  • 9 языков (RU, EN, FR, ES, DE, PT, ZH, HI, AR)
  • Проверенное телефонное соединение менее чем за 5 минут с юристом ИЛИ помогающим экспатом
  • Оплата за консультацию $19-49, без подписки
  • 24/7, по всему миру
  • Соответствие GDPR + eIDAS

Я был бы рад предоставить Вам:
  • Подробный пресс-релиз (PDF приложен)
  • Визуальные материалы HD (логотип, баннер, скриншоты)
  • Интервью с [основатель] в течение 48 часов

Страница прессы: https://sos-expat.com/ru-ru/pressa

С уважением,
[Ваше имя]
SOS-Expat
contact@sos-expat.com`,

  zh: `您好，[记者姓名]，

我写信给您，因为您最近关于[主题——一句话]的报道让我想到了一条可能引起您读者兴趣的新闻。

SOS-Expat（sos-expat.com）是一个于[日期]从塔林推出的平台，它解决了一个非常具体的问题：每年有2.8亿海外人士和旅行者在海外陷入法律或行政困境，不知道该联系谁——用他们自己的语言。

关键数字：
  • 覆盖197个国家
  • 9种语言（中文、英语、法语、西班牙语、德语、葡萄牙语、俄语、印地语、阿拉伯语）
  • 5分钟内完成经过验证的电话连接，可与律师或热心的外籍人士通话
  • 按次咨询19-49美元，无需订阅
  • 24/7全球服务
  • 符合GDPR + eIDAS

我很乐意为您提供：
  • 详细的新闻稿（PDF附件）
  • 高清视觉素材（徽标、横幅、截图）
  • 48小时内与[创始人]的访谈

新闻页面：https://sos-expat.com/zh-cn/xinwen

此致
[您的名字]
SOS-Expat
contact@sos-expat.com`,

  hi: `नमस्ते [पत्रकार का पहला नाम],

मैं आपसे संपर्क कर रहा/रही हूँ क्योंकि [विषय — एक पंक्ति] पर आपके हाल के लेख ने मुझे एक ऐसी खबर के बारे में सोचने पर मजबूर किया जो आपके पाठकों को रुचिकर लग सकती है।

SOS-Expat (sos-expat.com) एक ऐसा मंच है जिसे [तारीख] को टालिन से लॉन्च किया गया था और जो एक बहुत ही ठोस समस्या को हल करता है: 28 करोड़ प्रवासी और यात्री हर साल विदेश में कानूनी या प्रशासनिक स्थिति में फंस जाते हैं और नहीं जानते कि किसको कॉल करें — अपनी भाषा में।

मुख्य आँकड़े:
  • 197 देशों में उपलब्धता
  • 9 भाषाएँ (HI, EN, FR, ES, DE, PT, RU, ZH, AR)
  • 5 मिनट से भी कम समय में सत्यापित फोन कनेक्शन वकील या सहायक प्रवासी के साथ
  • प्रति परामर्श $19-49, बिना सदस्यता
  • 24/7, विश्वव्यापी
  • GDPR + eIDAS अनुपालन

मुझे प्रदान करने में खुशी होगी:
  • एक विस्तृत प्रेस विज्ञप्ति (PDF संलग्न)
  • HD विज़ुअल (लोगो, बैनर, स्क्रीनशॉट)
  • [संस्थापक] के साथ 48 घंटे के भीतर एक साक्षात्कार

प्रेस पेज: https://sos-expat.com/hi-in/press

सादर,
[आपका नाम]
SOS-Expat
contact@sos-expat.com`,

  ar: `مرحبًا [الاسم الأول للصحفي]،

أتواصل معك لأن مقالك الأخير عن [الموضوع — جملة واحدة] ذكرني بخبر قد يهم قراءك.

SOS-Expat (sos-expat.com) هي منصة أُطلقت في [التاريخ] من تالين وتحل مشكلة ملموسة: 280 مليون مغترب ومسافر يجدون أنفسهم كل عام عالقين في الخارج في موقف قانوني أو إداري دون معرفة من يتصلون به — بلغتهم الأم.

أرقام رئيسية:
  • 197 دولة مغطاة
  • 9 لغات (AR, EN, FR, ES, DE, PT, RU, ZH, HI)
  • اتصال هاتفي موثق في أقل من 5 دقائق مع محامٍ أو مغترب مساعد
  • استشارة بالجلسة 19-49 دولارًا، بدون اشتراك
  • 24/7، في جميع أنحاء العالم
  • متوافق مع GDPR و eIDAS

يسعدني أن أقدم لك:
  • بيان صحفي مفصل (PDF مرفق)
  • صور عالية الدقة (شعار، لافتة، لقطات شاشة)
  • مقابلة مع [المؤسس] خلال 48 ساعة

صفحة الصحافة: https://sos-expat.com/ar-sa/sahafah

مع أطيب التحيات،
[اسمك]
SOS-Expat
contact@sos-expat.com`,

  et: `Tere [Ajakirjaniku eesnimi],

Võtan ühendust, sest teie hiljutine artikkel teemal [teema — üks lause] tuletas mulle meelde uudise, mis võiks teie lugejaid huvitada.

SOS-Expat (sos-expat.com) on Tallinnast [kuupäev] käivitatud platvorm, mis lahendab väga konkreetse probleemi: 280 miljonit välismaalast ja reisijat jäävad igal aastal välismaal juriidilises või administratiivses olukorras kinni, teadmata, kellele helistada — oma emakeeles.

Põhinäitajad:
  • 197 kaetud riiki
  • 9 keelt (ET, EN, FR, ES, DE, PT, RU, ZH, HI, AR)
  • Verifitseeritud telefoniühendus alla 5 min advokaadi või abivalmis välismaalasega
  • Konsultatsioon korra kohta $19-49, ilma tellimuseta
  • 24/7, üle kogu maailma
  • GDPR + eIDAS nõuetele vastav

Meelsasti pakun:
  • Üksikasjalikku pressiteadet (PDF lisatud)
  • HD visuaale (logo, bänner, ekraanikuvad)
  • Intervjuud [asutaja] 48 tunni jooksul

Pressileht: https://sos-expat.com/et-ee/press

Lugupidamisega,
[Sinu nimi]
SOS-Expat
contact@sos-expat.com`,
};
