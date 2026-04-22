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
 */
import type { PressLang } from "@prisma/client";

export const EMBEDDED_PITCHES: Record<PressLang, string> = {
  fr: `Bonjour,

304 millions de personnes vivent ou voyagent à l'étranger. 17% n'ont aucune couverture santé. 57% seraient prêts à payer pour une aide juridique ou administrative. Et pourtant, jusqu'à il y a 2 mois, personne ne répondait à ce besoin.

Nous l'avons fait.

SOS-Expat.com est la première plateforme mondiale qui connecte voyageurs, vacanciers et expatriés à un avocat local ou un expert expat en moins de 5 minutes, par téléphone. 197 pays, toutes langues, 24h/24. En moins de 2 mois : plus de 80 avocats inscrits.

Ces chiffres sont issus de notre Grand Sondage Expat & Voyageur 2026 — 9 563 participants, 54 pays, données librement réutilisables (CC BY 4.0) :
https://sos-expat.com/fr-fr/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Je suis disponible pour une interview, une tribune ou une mention dans un article ressource. Communiqués de presse, dossier, logos et visuels sont téléchargeables directement sur : sos-expat.com/presse

Seriez-vous disponible pour un échange de 10 minutes ?

Bien cordialement,
Williams Jullin – Fondateur, SOS-Expat.com
+33 7 43 33 12 01`,

  en: `Hello,

304 million people live or travel abroad. 17% have no health coverage. 57% would be willing to pay for legal or administrative assistance. Yet until 2 months ago, no platform was addressing this need in real time.

We built it.

SOS-Expat.com is the world's first platform connecting travelers, tourists and expats to a local lawyer or expat expert in under 5 minutes, by phone. 197 countries, all languages, 24/7. In under 2 months: over 80 lawyers already on board.

These figures come from our Grand Expat & Traveler Survey 2026 — 9,563 participants, 54 countries, freely reusable data (CC BY 4.0):
https://sos-expat.com/fr-fr/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Press releases, press kit, logos and visuals available for download at:
sos-expat.com/presse

Would you be open to covering this story?

Best regards,
Williams Jullin – Founder, SOS-Expat.com`,

  es: `Estimado/a,

304 millones de personas viven o viajan en el extranjero. El 17% no tiene cobertura médica. El 57% estaría dispuesto a pagar por asistencia jurídica o administrativa. Y sin embargo, hasta hace 2 meses, ninguna plataforma respondía a esta necesidad en tiempo real.

Nosotros lo hemos creado.

SOS-Expat.com es la primera plataforma mundial que conecta a viajeros, turistas y expatriados con un abogado local o un experto expatriado en menos de 5 minutos, por teléfono. 197 países, todos los idiomas, 24/7. En menos de 2 meses: más de 80 abogados registrados.

Estas cifras provienen de nuestra Gran Encuesta Expat & Viajero 2026 — 9.563 participantes, 54 países, datos de libre uso (CC BY 4.0):
https://sos-expat.com/fr-fr/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Comunicados de prensa, dossier, logotipos e imágenes disponibles para descarga en:
sos-expat.com/presse

¿Estaría abierto/a a cubrir esta historia?

Atentamente,
Williams Jullin – Fundador, SOS-Expat.com`,

  de: `Guten Tag,

304 Millionen Menschen leben oder reisen im Ausland. 17% haben keinen Krankenversicherungsschutz. 57% wären bereit, für rechtliche oder administrative Unterstützung zu zahlen. Und dennoch hat bis vor 2 Monaten keine Plattform diesen Bedarf in Echtzeit gedeckt.

Wir haben es gebaut.

SOS-Expat.com ist die erste weltweite Plattform, die Reisende, Urlauber und Expats in weniger als 5 Minuten telefonisch mit einem lokalen Anwalt oder Expat-Experten verbindet. 197 Länder, alle Sprachen, 24/7. In weniger als 2 Monaten: über 80 registrierte Anwälte.

Diese Zahlen stammen aus unserer Großen Expat & Reisenden-Umfrage 2026 — 9.563 Teilnehmer, 54 Länder, frei verwendbare Daten (CC BY 4.0):
https://sos-expat.com/fr-fr/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Pressemitteilungen, Pressemappe, Logos und Bildmaterial stehen zum Download bereit:
sos-expat.com/presse

Wären Sie offen, darüber zu berichten?

Mit freundlichen Grüßen,
Williams Jullin – Gründer, SOS-Expat.com`,

  pt: `Caro/a,

304 milhões de pessoas vivem ou viajam no estrangeiro. 17% não têm qualquer cobertura de saúde. 57% estariam dispostos a pagar por assistência jurídica ou administrativa. No entanto, até há 2 meses, nenhuma plataforma respondia a esta necessidade em tempo real.

Nós criamos isso.

SOS-Expat.com é a primeira plataforma mundial que liga viajantes, turistas e expatriados a um advogado local ou a um especialista expatriado em menos de 5 minutos, por telefone. 197 países, todos os idiomas, 24/7. Em menos de 2 meses: mais de 80 advogados registados.

Estes dados provêm do nosso Grande Inquérito Expat & Viajante 2026 — 9.563 participantes, 54 países, dados de livre utilização (CC BY 4.0):
https://sos-expat.com/fr-fr/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Comunicados de imprensa, dossier, logotipos e imagens disponíveis para download em:
sos-expat.com/presse

Estaria aberto/a a cobrir esta história?

Com os melhores cumprimentos,
Williams Jullin – Fundador, SOS-Expat.com`,

  ru: `Здравствуйте,

304 миллиона человек живут или путешествуют за рубежом. 17% не имеют медицинской страховки. 57% готовы платить за юридическую или административную помощь. И тем не менее, ещё два месяца назад ни одна платформа не отвечала на эту потребность в режиме реального времени.

Мы это создали.

SOS-Expat.com — первая в мире платформа, которая соединяет путешественников, туристов и экспатов с местным адвокатом или экспертом-экспатом менее чем за 5 минут по телефону. 197 стран, все языки, круглосуточно. Менее чем за 2 месяца: уже более 80 зарегистрированных адвокатов.

Эти данные получены в ходе нашего Большого опроса экспатов и путешественников 2026 года — 9 563 участника, 54 страны, данные в свободном доступе (CC BY 4.0):
https://sos-expat.com/fr-fr/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Пресс-релизы, пресс-кит, логотипы и визуальные материалы доступны для скачивания по адресу:
sos-expat.com/presse

Были бы вы готовы осветить эту тему?

С уважением,
Williams Jullin – основатель, SOS-Expat.com`,

  zh: `您好，

全球有3.04亿人在海外生活或旅行。17%没有任何医疗保障。57%愿意为法律或行政协助付费。然而，就在两个月前，没有任何平台能够实时满足这一需求。

我们做到了。

SOS-Expat.com是全球首个平台，能在5分钟内通过电话将旅行者、游客和海外华人与当地律师或海外专家对接。覆盖197个国家，支持所有语言，全天候24/7服务。不到两个月：已有超过80名律师入驻。

以上数据来自我们的《2026年海外侨民与旅行者大调查》——9,563名参与者，54个国家，数据可免费使用（CC BY 4.0）：
https://sos-expat.com/fr-fr/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

新闻稿、媒体资料包、标志及视觉素材可在以下地址下载：
sos-expat.com/presse

您是否愿意报道这一话题？

此致敬礼，
Williams Jullin — SOS-Expat.com创始人`,

  hi: `नमस्ते,

30 करोड़ 40 लाख लोग विदेश में रहते या यात्रा करते हैं। 17% के पास कोई स्वास्थ्य बीमा नहीं है। 57% कानूनी या प्रशासनिक सहायता के लिए भुगतान करने को तैयार हैं। फिर भी, केवल 2 महीने पहले तक, कोई भी प्लेटफ़ॉर्म इस ज़रूरत को वास्तविक समय में पूरा नहीं कर रहा था।

हमने यह बनाया।

SOS-Expat.com दुनिया का पहला प्लेटफ़ॉर्म है जो यात्रियों, पर्यटकों और प्रवासियों को 5 मिनट से कम समय में फ़ोन पर एक स्थानीय वकील या प्रवासी विशेषज्ञ से जोड़ता है। 197 देश, सभी भाषाएँ, 24/7। 2 महीने से भी कम समय में: 80 से अधिक वकील पंजीकृत।

ये आंकड़े हमारे ग्रैंड एक्सपैट और ट्रैवलर सर्वे 2026 से लिए गए हैं — 9,563 प्रतिभागी, 54 देश, स्वतंत्र रूप से उपयोग योग्य डेटा (CC BY 4.0):
https://sos-expat.com/fr-fr/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

प्रेस विज्ञप्तियाँ, प्रेस किट, लोगो और विज़ुअल सामग्री यहाँ से डाउनलोड की जा सकती है:
sos-expat.com/presse

क्या आप इस विषय को कवर करने में रुचि रखते हैं?

सादर,
Williams Jullin — संस्थापक, SOS-Expat.com`,

  ar: `مرحبا،

304 ملايين شخص يعيشون أو يسافرون خارج بلدانهم. 17% ليس لديهم أي تغطية صحية. 57% مستعدون للدفع مقابل مساعدة قانونية أو إدارية. ومع ذلك، حتى قبل شهرين، لم تكن هناك منصة واحدة تستجيب لهذه الحاجة في الوقت الفعلي.

نحن بنيناها.

SOS-Expat.com هي أول منصة عالمية تربط المسافرين والسياح والمغتربين بمحامٍ محلي أو خبير مغترب في أقل من 5 دقائق عبر الهاتف. 197 دولة، جميع اللغات، 24/7. في أقل من شهرين: أكثر من 80 محامٍ مسجل.

هذه الأرقام مستقاة من استطلاعنا الكبير للمغتربين والمسافرين 2026 — 9 563 مشاركاً، 54 دولة، بيانات متاحة للاستخدام بحرية (CC BY 4.0):
https://sos-expat.com/fr-fr/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

البيانات الصحفية، حقيبة الصحافة، الشعارات والمواد المرئية متاحة للتنزيل على:
sos-expat.com/presse

هل أنتم مستعدون لتغطية هذا الموضوع؟

مع التقدير،
ويليامس جولين — مؤسس SOS-Expat.com`,

  et: `Tere,

304 miljonit inimest elab või reisib välismaal. 17%-l ei ole tervisekindlustust. 57% oleks valmis maksma õigusliku või haldusabi eest. Ja ometi, veel kaks kuud tagasi, ükski platvorm ei vastanud sellele vajadusele reaalajas.

Meie ehitasime selle.

SOS-Expat.com on maailma esimene platvorm, mis ühendab reisijaid, turiste ja välismaalasi kohaliku advokaadi või välismaalaste eksperdiga alla 5 minutiga telefoni teel. 197 riiki, kõik keeled, 24/7. Alla kahe kuuga: üle 80 registreeritud advokaadi.

Need andmed pärinevad meie 2026. aasta suurest välismaalaste ja reisijate uuringust — 9 563 osalejat, 54 riiki, vabalt kasutatavad andmed (CC BY 4.0):
https://sos-expat.com/fr-fr/sondages-expatries/le-grand-sondage-expatries-voyageurs/resultats

Pressiteated, pressipakett, logod ja visuaalid on allalaaditavad aadressil:
sos-expat.com/presse

Kas oleksite valmis sellel teemal kirjutama?

Lugupidamisega,
Williams Jullin — asutaja, SOS-Expat.com`,
};
