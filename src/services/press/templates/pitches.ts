/**
 * Embedded press pitch templates — 10 languages.
 *
 * Reworked 2026-04-22 with the new angle centered on the Grand Expat
 * & Traveler Survey 2026 (9 563 participants, 54 countries, CC BY 4.0)
 * and the "80+ lawyers onboarded in under 2 months" launch milestone.
 *
 * Positioning: SOS-Expat = lawyer OR expat expert, 5-min phone connection,
 * 197 countries, 24/7.  Signed by Williams Jullin, Founder.
 *
 * These bodies are the embedded defaults.  Admins can override any of them
 * via the press/templates admin UI (stored in AppSetting DB row).
 *
 * 2026-04-24: added EMBEDDED_PITCH_VARIANTS with 2 additional body variants
 * per language (founder-narrative angle B + data/editorial angle C).  The
 * renderer picks one of [EMBEDDED_PITCHES[lang], ...VARIANTS[lang]] from a
 * hash of the contactId, so a given journalist always sees the same body
 * across initial + follow-ups (thread coherence) but across 651 contacts
 * the body rotates — removes the bulk-identical-body spam signal.  The
 * admin UI continues to read EMBEDDED_PITCHES as the single "primary" body.
 */
import type { PressLang } from "@prisma/client";

export const EMBEDDED_PITCHES: Record<PressLang, string> = {
  fr: `Bonjour,

304 millions de personnes vivent ou voyagent à l'étranger. 17% n'ont aucune couverture santé. 57% seraient prêts à payer pour une aide juridique ou administrative. Et pourtant, jusqu'à il y a 2 mois, personne ne répondait à ce besoin.

Nous l'avons fait.

SOS-Expat.com est la première plateforme mondiale qui connecte voyageurs, vacanciers et expatriés à un avocat local ou un expert expat en moins de 5 minutes, par téléphone. 197 pays, toutes langues, 24h/24. En moins de 2 mois : plus de 80 avocats inscrits.

Ces chiffres sont issus de notre Grand Sondage Expat & Voyageur 2026 — 9 563 participants, 54 pays, données librement réutilisables (CC BY 4.0) :
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Je suis disponible pour une interview, une tribune ou une mention dans un article ressource. Communiqués de presse, dossier, logos et visuels sont téléchargeables directement sur : https://sos-expat.com/presse

Seriez-vous disponible pour un échange de 10 minutes ?

Bien cordialement,
Williams Jullin – Fondateur, SOS-Expat.com
+33 7 43 33 12 01`,

  en: `Hello,

304 million people live or travel abroad. 17% have no health coverage. 57% would be willing to pay for legal or administrative assistance. Yet until 2 months ago, no platform was addressing this need in real time.

We built it.

SOS-Expat.com is the world's first platform connecting travelers, tourists and expats to a local lawyer or expat expert in under 5 minutes, by phone. 197 countries, all languages, 24/7. In under 2 months: over 80 lawyers already on board.

These figures come from our Grand Expat & Traveler Survey 2026 — 9,563 participants, 54 countries, freely reusable data (CC BY 4.0):
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Press releases, press kit, logos and visuals available for download at:
https://sos-expat.com/presse

Would you be open to covering this story?

Best regards,
Williams Jullin – Founder, SOS-Expat.com`,

  es: `Estimado/a,

304 millones de personas viven o viajan en el extranjero. El 17% no tiene cobertura médica. El 57% estaría dispuesto a pagar por asistencia jurídica o administrativa. Y sin embargo, hasta hace 2 meses, ninguna plataforma respondía a esta necesidad en tiempo real.

Nosotros lo hemos creado.

SOS-Expat.com es la primera plataforma mundial que conecta a viajeros, turistas y expatriados con un abogado local o un experto expatriado en menos de 5 minutos, por teléfono. 197 países, todos los idiomas, 24/7. En menos de 2 meses: más de 80 abogados registrados.

Estas cifras provienen de nuestra Gran Encuesta Expat & Viajero 2026 — 9.563 participantes, 54 países, datos de libre uso (CC BY 4.0):
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Comunicados de prensa, dossier, logotipos e imágenes disponibles para descarga en:
https://sos-expat.com/presse

¿Estaría abierto/a a cubrir esta historia?

Atentamente,
Williams Jullin – Fundador, SOS-Expat.com`,

  de: `Guten Tag,

304 Millionen Menschen leben oder reisen im Ausland. 17% haben keinen Krankenversicherungsschutz. 57% wären bereit, für rechtliche oder administrative Unterstützung zu zahlen. Und dennoch hat bis vor 2 Monaten keine Plattform diesen Bedarf in Echtzeit gedeckt.

Wir haben es gebaut.

SOS-Expat.com ist die erste weltweite Plattform, die Reisende, Urlauber und Expats in weniger als 5 Minuten telefonisch mit einem lokalen Anwalt oder Expat-Experten verbindet. 197 Länder, alle Sprachen, 24/7. In weniger als 2 Monaten: über 80 registrierte Anwälte.

Diese Zahlen stammen aus unserer Großen Expat & Reisenden-Umfrage 2026 — 9.563 Teilnehmer, 54 Länder, frei verwendbare Daten (CC BY 4.0):
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Pressemitteilungen, Pressemappe, Logos und Bildmaterial stehen zum Download bereit:
https://sos-expat.com/presse

Wären Sie offen, darüber zu berichten?

Mit freundlichen Grüßen,
Williams Jullin – Gründer, SOS-Expat.com`,

  pt: `Caro/a,

304 milhões de pessoas vivem ou viajam no estrangeiro. 17% não têm qualquer cobertura de saúde. 57% estariam dispostos a pagar por assistência jurídica ou administrativa. No entanto, até há 2 meses, nenhuma plataforma respondia a esta necessidade em tempo real.

Nós criamos isso.

SOS-Expat.com é a primeira plataforma mundial que liga viajantes, turistas e expatriados a um advogado local ou a um especialista expatriado em menos de 5 minutos, por telefone. 197 países, todos os idiomas, 24/7. Em menos de 2 meses: mais de 80 advogados registados.

Estes dados provêm do nosso Grande Inquérito Expat & Viajante 2026 — 9.563 participantes, 54 países, dados de livre utilização (CC BY 4.0):
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Comunicados de imprensa, dossier, logotipos e imagens disponíveis para download em:
https://sos-expat.com/presse

Estaria aberto/a a cobrir esta história?

Com os melhores cumprimentos,
Williams Jullin – Fundador, SOS-Expat.com`,

  ru: `Здравствуйте,

304 миллиона человек живут или путешествуют за рубежом. 17% не имеют медицинской страховки. 57% готовы платить за юридическую или административную помощь. И тем не менее, ещё два месяца назад ни одна платформа не отвечала на эту потребность в режиме реального времени.

Мы это создали.

SOS-Expat.com — первая в мире платформа, которая соединяет путешественников, туристов и экспатов с местным адвокатом или экспертом-экспатом менее чем за 5 минут по телефону. 197 стран, все языки, круглосуточно. Менее чем за 2 месяца: уже более 80 зарегистрированных адвокатов.

Эти данные получены в ходе нашего Большого опроса экспатов и путешественников 2026 года — 9 563 участника, 54 страны, данные в свободном доступе (CC BY 4.0):
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Пресс-релизы, пресс-кит, логотипы и визуальные материалы доступны для скачивания по адресу:
https://sos-expat.com/presse

Были бы вы готовы осветить эту тему?

С уважением,
Williams Jullin – основатель, SOS-Expat.com`,

  zh: `您好，

全球有3.04亿人在海外生活或旅行。17%没有任何医疗保障。57%愿意为法律或行政协助付费。然而，就在两个月前，没有任何平台能够实时满足这一需求。

我们做到了。

SOS-Expat.com是全球首个平台，能在5分钟内通过电话将旅行者、游客和海外华人与当地律师或海外专家对接。覆盖197个国家，支持所有语言，全天候24/7服务。不到两个月：已有超过80名律师入驻。

以上数据来自我们的《2026年海外侨民与旅行者大调查》——9,563名参与者，54个国家，数据可免费使用（CC BY 4.0）：
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

新闻稿、媒体资料包、标志及视觉素材可在以下地址下载：
https://sos-expat.com/presse

您是否愿意报道这一话题？

此致敬礼，
Williams Jullin — SOS-Expat.com创始人`,

  hi: `नमस्ते,

30 करोड़ 40 लाख लोग विदेश में रहते या यात्रा करते हैं। 17% के पास कोई स्वास्थ्य बीमा नहीं है। 57% कानूनी या प्रशासनिक सहायता के लिए भुगतान करने को तैयार हैं। फिर भी, केवल 2 महीने पहले तक, कोई भी प्लेटफ़ॉर्म इस ज़रूरत को वास्तविक समय में पूरा नहीं कर रहा था।

हमने यह बनाया।

SOS-Expat.com दुनिया का पहला प्लेटफ़ॉर्म है जो यात्रियों, पर्यटकों और प्रवासियों को 5 मिनट से कम समय में फ़ोन पर एक स्थानीय वकील या प्रवासी विशेषज्ञ से जोड़ता है। 197 देश, सभी भाषाएँ, 24/7। 2 महीने से भी कम समय में: 80 से अधिक वकील पंजीकृत।

ये आंकड़े हमारे ग्रैंड एक्सपैट और ट्रैवलर सर्वे 2026 से लिए गए हैं — 9,563 प्रतिभागी, 54 देश, स्वतंत्र रूप से उपयोग योग्य डेटा (CC BY 4.0):
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

प्रेस विज्ञप्तियाँ, प्रेस किट, लोगो और विज़ुअल सामग्री यहाँ से डाउनलोड की जा सकती है:
https://sos-expat.com/presse

क्या आप इस विषय को कवर करने में रुचि रखते हैं?

सादर,
Williams Jullin — संस्थापक, SOS-Expat.com`,

  ar: `مرحبا،

304 ملايين شخص يعيشون أو يسافرون خارج بلدانهم. 17% ليس لديهم أي تغطية صحية. 57% مستعدون للدفع مقابل مساعدة قانونية أو إدارية. ومع ذلك، حتى قبل شهرين، لم تكن هناك منصة واحدة تستجيب لهذه الحاجة في الوقت الفعلي.

نحن بنيناها.

SOS-Expat.com هي أول منصة عالمية تربط المسافرين والسياح والمغتربين بمحامٍ محلي أو خبير مغترب في أقل من 5 دقائق عبر الهاتف. 197 دولة، جميع اللغات، 24/7. في أقل من شهرين: أكثر من 80 محامٍ مسجل.

هذه الأرقام مستقاة من استطلاعنا الكبير للمغتربين والمسافرين 2026 — 9 563 مشاركاً، 54 دولة، بيانات متاحة للاستخدام بحرية (CC BY 4.0):
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

البيانات الصحفية، حقيبة الصحافة، الشعارات والمواد المرئية متاحة للتنزيل على:
https://sos-expat.com/presse

هل أنتم مستعدون لتغطية هذا الموضوع؟

مع التقدير،
ويليامس جولين — مؤسس SOS-Expat.com`,

  et: `Tere,

304 miljonit inimest elab või reisib välismaal. 17%-l ei ole tervisekindlustust. 57% oleks valmis maksma õigusliku või haldusabi eest. Ja ometi, veel kaks kuud tagasi, ükski platvorm ei vastanud sellele vajadusele reaalajas.

Meie ehitasime selle.

SOS-Expat.com on maailma esimene platvorm, mis ühendab reisijaid, turiste ja välismaalasi kohaliku advokaadi või välismaalaste eksperdiga alla 5 minutiga telefoni teel. 197 riiki, kõik keeled, 24/7. Alla kahe kuuga: üle 80 registreeritud advokaadi.

Need andmed pärinevad meie 2026. aasta suurest välismaalaste ja reisijate uuringust — 9 563 osalejat, 54 riiki, vabalt kasutatavad andmed (CC BY 4.0):
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Pressiteated, pressipakett, logod ja visuaalid on allalaaditavad aadressil:
https://sos-expat.com/presse

Kas oleksite valmis sellel teemal kirjutama?

Lugupidamisega,
Williams Jullin — asutaja, SOS-Expat.com`,
};

/**
 * Additional body variants — 2026-04-24.
 *
 * These complement EMBEDDED_PITCHES (variant A) with 2 alternative framings
 * per language:
 *   - Variant B = founder narrative (personal story, "Two months ago I
 *     launched...")
 *   - Variant C = data-for-editors (direct data pitch, "I'm writing
 *     because we published data that could serve your editorial line")
 *
 * All variants cover the same core pitch (SOS-Expat platform, 80 lawyers
 * in 2 months, 9,563-participant CC-BY survey, 5-min phone, 197 countries)
 * but with distinct sentence structures, hooks, and CTAs — so across 651
 * journalists, body-fingerprinting filters never see more than ~1/3 of the
 * sends as identical. Same URLs kept across variants (that's fine — link
 * reputation builds faster with consistent URLs).
 */
export const EMBEDDED_PITCH_VARIANTS: Record<PressLang, readonly string[]> = {
  fr: [
    `Bonjour,

Il y a deux mois, depuis Tallinn, j'ai lancé une plateforme que je prépare depuis trois ans : SOS-Expat.com.

Le constat de départ : 304 millions de personnes vivent ou voyagent à l'étranger. Quand elles ont un vrai problème — accident, conflit administratif, arrestation, perte de documents — il leur faut en moyenne plusieurs jours pour trouver quelqu'un qui parle leur langue ET connaisse le droit local. Nous avons ramené ce délai à 5 minutes : un appel téléphonique, un avocat local ou un expat expert, 197 pays, 24h/24. 80 avocats ont rejoint le réseau en moins de 2 mois.

Nous avons aussi publié un sondage sur 9 563 expatriés dans 54 pays (licence CC BY 4.0, données libres de droits) :
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Le kit presse (communiqué, logos, visuels HD) est ici : https://sos-expat.com/presse

Un échange de 10 minutes vous tenterait ?

Cordialement,
Williams Jullin – Fondateur, SOS-Expat.com
+33 7 43 33 12 01`,

    `Bonjour,

Je vous écris parce que nous venons de publier un jeu de données qui pourrait alimenter vos prochains articles sur l'expatriation.

Sondage réalisé entre 2025 et 2026 auprès de 9 563 expatriés et voyageurs dans 54 pays, licence CC BY 4.0 : vous pouvez réutiliser les chiffres, les graphiques et les tableaux sans demande d'autorisation.
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Quelques résultats marquants :
— 17% des expatriés vivent sans couverture santé
— 57% se disent prêts à payer pour une aide juridique ou administrative
— 43% rapportent au moins une urgence à l'étranger sur les 5 dernières années

Le contexte : pour répondre à ce besoin, nous avons lancé SOS-Expat.com — mise en relation téléphonique en 5 minutes avec un avocat local ou un expat expert, dans 197 pays, en 9 langues. 80 avocats inscrits en 2 mois.

Le dossier presse complet : https://sos-expat.com/presse

Je reste disponible pour toute précision ou interview.

Bien à vous,
Williams Jullin – Fondateur, SOS-Expat.com`,
  ],

  en: [
    `Hello,

Two months ago, from Tallinn, I launched a platform I had been preparing for three years: SOS-Expat.com.

The starting observation: 304 million people live or travel abroad. When they hit a real problem — accident, admin dispute, arrest, lost documents — it typically takes them several days to find someone who speaks their language AND knows the local law. We brought that delay down to 5 minutes: one phone call, a local lawyer or an experienced expat, 197 countries, 24/7. 80 lawyers have joined in under 2 months.

We also published a survey of 9,563 expats across 54 countries (CC BY 4.0 license, free to reuse):
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Press kit (release, logos, HD visuals): https://sos-expat.com/presse

Would a 10-minute call be of interest?

Best,
Williams Jullin – Founder, SOS-Expat.com`,

    `Hello,

I'm writing because we just published a dataset that could feed into your upcoming expat coverage.

Survey run 2025–2026 among 9,563 expats and travelers across 54 countries, under CC BY 4.0 license: figures, charts and tables are free to reuse without permission.
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

A few standout results:
— 17% of expats live without any health coverage
— 57% would pay for remote legal or administrative help
— 43% report at least one emergency abroad over the past 5 years

Context: to address this need, we launched SOS-Expat.com — 5-minute phone connection with a local lawyer or an expat expert, 197 countries, 9 languages. 80 lawyers onboarded in 2 months.

Full press kit: https://sos-expat.com/presse

Happy to provide any clarification or an interview.

Best regards,
Williams Jullin – Founder, SOS-Expat.com`,
  ],

  es: [
    `Estimado/a,

Hace dos meses, desde Tallin, lancé una plataforma que había estado preparando durante tres años: SOS-Expat.com.

El punto de partida: 304 millones de personas viven o viajan al extranjero. Cuando surge un problema real — accidente, conflicto administrativo, detención, pérdida de documentos — suelen necesitar varios días para encontrar a alguien que hable su idioma Y conozca el derecho local. Hemos reducido ese tiempo a 5 minutos: una llamada telefónica, un abogado local o un experto expatriado, 197 países, 24/7. 80 abogados se han sumado en menos de 2 meses.

También hemos publicado una encuesta a 9.563 expatriados en 54 países (licencia CC BY 4.0, datos de libre uso):
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Kit de prensa (comunicado, logos, imágenes HD): https://sos-expat.com/presse

¿Una llamada de 10 minutos sería de su interés?

Atentamente,
Williams Jullin – Fundador, SOS-Expat.com`,

    `Estimado/a,

Le escribo porque acabamos de publicar un conjunto de datos que podría servir para sus próximos artículos sobre expatriación.

Encuesta realizada entre 2025 y 2026 con 9.563 expatriados y viajeros en 54 países, bajo licencia CC BY 4.0: cifras, gráficos y tablas son de libre reutilización sin necesidad de permiso.
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Algunos resultados destacados:
— 17% de los expatriados vive sin cobertura médica
— 57% pagaría por asistencia jurídica o administrativa a distancia
— 43% relata al menos una emergencia en el extranjero en los últimos 5 años

Contexto: para cubrir esta necesidad hemos lanzado SOS-Expat.com — conexión telefónica en 5 minutos con un abogado local o un experto expatriado, 197 países, 9 idiomas. 80 abogados inscritos en 2 meses.

Dossier de prensa completo: https://sos-expat.com/presse

Disponible para cualquier aclaración o entrevista.

Un saludo cordial,
Williams Jullin – Fundador, SOS-Expat.com`,
  ],

  de: [
    `Guten Tag,

Vor zwei Monaten habe ich von Tallinn aus eine Plattform gestartet, an der ich drei Jahre gearbeitet habe: SOS-Expat.com.

Der Ausgangspunkt: 304 Millionen Menschen leben oder reisen im Ausland. Wenn sie ein echtes Problem haben — Unfall, Behördenstreit, Festnahme, verlorene Dokumente — brauchen sie in der Regel mehrere Tage, um jemanden zu finden, der ihre Sprache spricht UND das lokale Recht kennt. Wir haben diese Wartezeit auf 5 Minuten reduziert: ein Telefonat, ein lokaler Anwalt oder ein erfahrener Expat, 197 Länder, 24/7. 80 Anwälte sind in weniger als 2 Monaten beigetreten.

Wir haben auch eine Umfrage unter 9.563 Expats in 54 Ländern veröffentlicht (Lizenz CC BY 4.0, frei verwendbar):
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Pressemappe (Mitteilung, Logos, HD-Bilder): https://sos-expat.com/presse

Wäre ein 10-minütiges Gespräch interessant?

Mit freundlichen Grüßen,
Williams Jullin – Gründer, SOS-Expat.com`,

    `Guten Tag,

Ich schreibe Ihnen, weil wir gerade einen Datensatz veröffentlicht haben, der Ihre nächste Berichterstattung zum Thema Expats unterstützen könnte.

Umfrage durchgeführt 2025–2026 unter 9.563 Expats und Reisenden in 54 Ländern, Lizenz CC BY 4.0: Zahlen, Grafiken und Tabellen sind ohne Genehmigung frei wiederverwendbar.
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Einige wichtige Ergebnisse:
— 17% der Expats leben ohne Krankenversicherungsschutz
— 57% würden für rechtliche oder administrative Fernhilfe zahlen
— 43% berichten von mindestens einem Notfall im Ausland in den letzten 5 Jahren

Hintergrund: Um diesen Bedarf zu decken, haben wir SOS-Expat.com gestartet — telefonische Verbindung in 5 Minuten mit einem lokalen Anwalt oder Expat-Experten, 197 Länder, 9 Sprachen. 80 Anwälte in 2 Monaten registriert.

Vollständige Pressemappe: https://sos-expat.com/presse

Für Rückfragen oder ein Interview stehe ich gerne zur Verfügung.

Mit freundlichen Grüßen,
Williams Jullin – Gründer, SOS-Expat.com`,
  ],

  pt: [
    `Caro/a,

Há dois meses, a partir de Tallinn, lancei uma plataforma que vinha a preparar há três anos: SOS-Expat.com.

O ponto de partida: 304 milhões de pessoas vivem ou viajam no estrangeiro. Quando enfrentam um problema real — acidente, conflito administrativo, detenção, perda de documentos — costumam precisar de vários dias para encontrar alguém que fale a sua língua E conheça a legislação local. Reduzimos esse tempo para 5 minutos: uma chamada telefónica, um advogado local ou um expatriado experiente, 197 países, 24/7. 80 advogados aderiram em menos de 2 meses.

Publicámos também um inquérito a 9.563 expatriados em 54 países (licença CC BY 4.0, dados de livre utilização):
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Kit de imprensa (comunicado, logos, imagens HD): https://sos-expat.com/presse

Uma chamada de 10 minutos seria do seu interesse?

Com os melhores cumprimentos,
Williams Jullin – Fundador, SOS-Expat.com`,

    `Caro/a,

Escrevo-lhe porque acabámos de publicar um conjunto de dados que poderá alimentar os seus próximos artigos sobre expatriação.

Inquérito realizado entre 2025 e 2026 junto de 9.563 expatriados e viajantes em 54 países, sob licença CC BY 4.0: números, gráficos e tabelas podem ser reutilizados sem pedido de autorização.
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Alguns resultados em destaque:
— 17% dos expatriados vivem sem qualquer cobertura de saúde
— 57% estariam dispostos a pagar por ajuda jurídica ou administrativa à distância
— 43% reportam pelo menos uma emergência no estrangeiro nos últimos 5 anos

Contexto: para responder a esta necessidade, lançámos a SOS-Expat.com — ligação telefónica em 5 minutos com um advogado local ou um expatriado especialista, 197 países, 9 línguas. 80 advogados registados em 2 meses.

Dossier de imprensa completo: https://sos-expat.com/presse

Disponível para qualquer esclarecimento ou entrevista.

Com os melhores cumprimentos,
Williams Jullin – Fundador, SOS-Expat.com`,
  ],

  ru: [
    `Здравствуйте,

Два месяца назад из Таллина я запустил платформу, над которой работал три года: SOS-Expat.com.

Исходная точка: 304 миллиона человек живут или путешествуют за рубежом. Когда у них возникает реальная проблема — авария, административный конфликт, арест, потеря документов — им обычно требуется несколько дней, чтобы найти кого-то, кто говорит на их языке И знает местное право. Мы сократили это время до 5 минут: один звонок, местный адвокат или опытный экспат, 197 стран, круглосуточно. Более 80 адвокатов присоединились менее чем за 2 месяца.

Мы также опубликовали опрос среди 9 563 экспатов в 54 странах (лицензия CC BY 4.0, данные в свободном доступе):
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Пресс-кит (релиз, логотипы, визуальные материалы в HD): https://sos-expat.com/presse

Был бы Вам интересен 10-минутный разговор?

С уважением,
Williams Jullin – основатель, SOS-Expat.com`,

    `Здравствуйте,

Пишу Вам потому, что мы только что опубликовали набор данных, который мог бы быть полезен для Ваших будущих материалов на тему экспатов.

Опрос проведён в 2025–2026 годах среди 9 563 экспатов и путешественников в 54 странах, лицензия CC BY 4.0: цифры, графики и таблицы можно свободно использовать без запроса разрешения.
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Несколько ключевых результатов:
— 17% экспатов живут без медицинского покрытия
— 57% готовы платить за дистанционную юридическую или административную помощь
— 43% сообщают хотя бы об одной чрезвычайной ситуации за рубежом за последние 5 лет

Контекст: чтобы ответить на эту потребность, мы запустили SOS-Expat.com — телефонная связь за 5 минут с местным адвокатом или экспертом-экспатом, 197 стран, 9 языков. Более 80 адвокатов зарегистрированы за 2 месяца.

Полный пресс-кит: https://sos-expat.com/presse

Готов предоставить любые уточнения или дать интервью.

С уважением,
Williams Jullin – основатель, SOS-Expat.com`,
  ],

  zh: [
    `您好，

两个月前，我在塔林启动了一个筹备了三年的平台：SOS-Expat.com。

出发点是这样的：全球有3.04亿人在海外生活或旅行。当他们遇到真正的问题——事故、行政纠纷、被拘留、证件丢失——通常需要好几天才能找到一位既会说他们语言、又熟悉当地法律的人。我们把这个时间缩短到5分钟：一通电话，联系当地律师或资深海外人士，覆盖197个国家，全天候24/7。不到两个月，已有超过80位律师加入。

我们还发布了一份对54个国家9,563位海外人士的调查（CC BY 4.0授权，数据可自由使用）：
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

媒体资料包（新闻稿、标志、高清视觉素材）：https://sos-expat.com/presse

10分钟通话您是否有兴趣？

此致敬礼，
Williams Jullin — SOS-Expat.com创始人`,

    `您好，

我写信给您，是因为我们刚刚发布了一组数据，或许对您未来关于海外人士的报道有所帮助。

本次调查于2025—2026年间进行，覆盖54个国家9,563位海外人士和旅行者，采用CC BY 4.0授权：数据、图表和表格均可自由重用，无需申请许可。
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

几项重要结果：
— 17%的海外人士没有任何医疗保障
— 57%愿意付费获取远程法律或行政协助
— 43%报告过去5年中至少经历过一次海外紧急情况

背景：为了回应这一需求，我们推出了SOS-Expat.com——5分钟内电话接通本地律师或海外专家，覆盖197个国家、9种语言。2个月内已有80位律师入驻。

完整媒体资料包：https://sos-expat.com/presse

如需任何补充说明或采访，我都随时待命。

此致敬礼，
Williams Jullin — SOS-Expat.com创始人`,
  ],

  hi: [
    `नमस्ते,

दो महीने पहले, तालिन से, मैंने एक ऐसा प्लेटफ़ॉर्म लॉन्च किया जिसे मैं तीन साल से तैयार कर रहा था: SOS-Expat.com।

शुरुआती अवलोकन: 30 करोड़ 40 लाख लोग विदेश में रहते या यात्रा करते हैं। जब उन्हें कोई वास्तविक समस्या आती है — दुर्घटना, प्रशासनिक विवाद, गिरफ़्तारी, दस्तावेज़ खोना — तो आम तौर पर उन्हें ऐसा कोई खोजने में कई दिन लग जाते हैं जो उनकी भाषा बोलता हो और स्थानीय कानून जानता हो। हमने इस समय को 5 मिनट पर ले आया है: एक फ़ोन कॉल, एक स्थानीय वकील या एक अनुभवी प्रवासी, 197 देश, 24/7। 2 महीने से भी कम समय में 80 से अधिक वकील जुड़ चुके हैं।

हमने 54 देशों के 9,563 प्रवासियों पर एक सर्वेक्षण भी प्रकाशित किया है (लाइसेंस CC BY 4.0, डेटा मुक्त रूप से उपयोग योग्य):
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

प्रेस किट (विज्ञप्ति, लोगो, HD विज़ुअल): https://sos-expat.com/presse

क्या 10 मिनट की बातचीत आपकी रुचि में होगी?

सादर,
Williams Jullin — संस्थापक, SOS-Expat.com`,

    `नमस्ते,

मैं आपको इसलिए लिख रहा हूँ क्योंकि हमने अभी एक डेटा सेट प्रकाशित किया है जो प्रवासन पर आपके अगले लेखों के लिए उपयोगी हो सकता है।

सर्वेक्षण 2025—2026 के दौरान 54 देशों के 9,563 प्रवासियों और यात्रियों पर किया गया, लाइसेंस CC BY 4.0 के तहत: आंकड़े, चार्ट और तालिकाएँ बिना अनुमति के स्वतंत्र रूप से पुनः उपयोग योग्य हैं।
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

कुछ प्रमुख परिणाम:
— 17% प्रवासी बिना किसी स्वास्थ्य कवरेज के रहते हैं
— 57% दूरस्थ कानूनी या प्रशासनिक सहायता के लिए भुगतान करने को तैयार हैं
— 43% पिछले 5 वर्षों में विदेश में कम से कम एक आपातकालीन स्थिति की रिपोर्ट करते हैं

संदर्भ: इस आवश्यकता को पूरा करने के लिए हमने SOS-Expat.com लॉन्च किया — स्थानीय वकील या प्रवासी विशेषज्ञ से 5 मिनट में फ़ोन कनेक्शन, 197 देश, 9 भाषाएँ। 2 महीने में 80 वकील पंजीकृत।

पूरा प्रेस डोज़ियर: https://sos-expat.com/presse

किसी भी स्पष्टीकरण या साक्षात्कार के लिए उपलब्ध हूँ।

सादर,
Williams Jullin — संस्थापक, SOS-Expat.com`,
  ],

  ar: [
    `مرحباً،

منذ شهرين، ومن تالين، أطلقتُ منصة كنت أعمل على إعدادها منذ ثلاث سنوات: SOS-Expat.com.

الملاحظة الأولى: 304 ملايين شخص يعيشون أو يسافرون خارج بلدانهم. وعندما تواجههم مشكلة حقيقية — حادث، نزاع إداري، اعتقال، فقدان وثائق — فإنهم يحتاجون في المتوسط عدة أيام للعثور على شخص يتحدث لغتهم ويعرف القانون المحلي. لقد خفّضنا هذا الزمن إلى 5 دقائق: مكالمة هاتفية، محامٍ محلي أو مغترب من ذوي الخبرة، 197 دولة، على مدار الساعة. وانضم أكثر من 80 محامياً خلال أقل من شهرين.

كما نشرنا استطلاعاً شمل 9 563 مغترباً في 54 دولة (ترخيص CC BY 4.0، بيانات متاحة للاستخدام بحرية):
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

الحقيبة الصحفية (البيان، الشعارات، المرئيات بجودة عالية): https://sos-expat.com/presse

هل تهمكم مكالمة لمدة 10 دقائق؟

مع التقدير،
ويليامس جولين — مؤسس SOS-Expat.com`,

    `مرحباً،

أكتب إليكم لأننا نشرنا للتو مجموعة بيانات قد تفيد تغطيتكم المقبلة حول شؤون المغتربين.

استطلاع أُجري بين عامَي 2025 و2026 شمل 9 563 مغترباً ومسافراً في 54 دولة، بموجب ترخيص CC BY 4.0: الأرقام والرسوم البيانية والجداول قابلة لإعادة الاستخدام بحرية دون الحاجة إلى إذن.
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

بعض النتائج البارزة:
— 17% من المغتربين يعيشون بدون أي تغطية صحية
— 57% مستعدون للدفع مقابل مساعدة قانونية أو إدارية عن بُعد
— 43% أبلغوا عن حالة طارئة واحدة على الأقل خلال السنوات الخمس الماضية في الخارج

السياق: لتلبية هذه الحاجة، أطلقنا SOS-Expat.com — اتصال هاتفي في غضون 5 دقائق مع محامٍ محلي أو خبير مغترب، 197 دولة، 9 لغات. 80 محامياً مسجّلاً خلال شهرين.

الملف الصحفي الكامل: https://sos-expat.com/presse

أبقى على استعداد لأي توضيح أو مقابلة.

مع خالص التحية،
ويليامس جولين — مؤسس SOS-Expat.com`,
  ],

  et: [
    `Tere,

Kaks kuud tagasi avasin Tallinnast platvormi, mille ettevalmistamisega tegelesin kolm aastat: SOS-Expat.com.

Lähtepunkt: 304 miljonit inimest elab või reisib välismaal. Kui neil tekib tõeline probleem — õnnetus, haldusvaidlus, vahistamine, dokumentide kadu — võtab neil tavaliselt mitu päeva, et leida kedagi, kes räägib nende keelt JA tunneb kohalikku õigust. Oleme selle ooteaja lühendanud viie minutini: üks telefonikõne, kohalik advokaat või kogenud välismaalane, 197 riiki, ööpäevaringselt. Alla kahe kuuga on liitunud üle 80 advokaadi.

Avaldasime ka uuringu 9 563 välismaalase kohta 54 riigis (litsents CC BY 4.0, andmed vabalt kasutatavad):
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Pressipakett (pressiteade, logod, HD-pildid): https://sos-expat.com/presse

Kas 10-minutiline vestlus oleks Teile huvipakkuv?

Lugupidamisega,
Williams Jullin — asutaja, SOS-Expat.com`,

    `Tere,

Pöördun Teie poole, sest avaldasime just andmestiku, mis võiks toita Teie järgmisi välismaalaste teemalisi artikleid.

Uuring viidi läbi aastatel 2025—2026 9 563 välismaalase ja reisija seas 54 riigis, litsentsi CC BY 4.0 all: numbrid, graafikud ja tabelid on luba küsimata vabalt kasutatavad.
https://sos-expat.com/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Mõned esile tõstetavad tulemused:
— 17% välismaalastest elab ilma igasuguse tervisekindlustuseta
— 57% oleks valmis maksma kaugteel pakutava õigus- või haldusabi eest
— 43% on viimase viie aasta jooksul teatanud vähemalt ühest hädaolukorrast välismaal

Taust: sellele vajadusele vastates käivitasime SOS-Expat.com — telefoniühendus 5 minutiga kohaliku advokaadi või välismaalaste eksperdiga, 197 riiki, 9 keelt. Alla kahe kuuga on liitunud 80 advokaati.

Täielik pressipakett: https://sos-expat.com/presse

Olen kättesaadav täpsustuste või intervjuu jaoks.

Lugupidamisega,
Williams Jullin — asutaja, SOS-Expat.com`,
  ],
};
