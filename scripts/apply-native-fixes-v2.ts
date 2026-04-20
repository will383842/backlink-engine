// ---------------------------------------------------------------------------
// Second-pass native-review fixes across 8 languages.
// Addresses issues identified by a second round of native-speaker agents
// after the first apply-native-fixes.ts run.
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
    { field: "body", from: "No local contact, no network, the language barrier.", to: "No local contact, no network, no one who speaks their language." },
    { field: "body", from: "paid out within 24 hours on request", to: "paid out within 24 hours of your request" },
    { field: "body", from: "and doesn't speak the local language", to: "and unable to speak the local language" },
    { field: "body", from: "No admin on your end — passive income from day one.", to: "No paperwork on your end — passive income from day one." },
    { field: "body", from: "We simply suggest presenting SOS-Expat to your members", to: "Our suggestion is simple: present SOS-Expat to your members" },
    { field: "body", from: "A service that further reinforces what your association means to them.", to: "A service that reinforces what your association already means to them." },
  ],
  es: [
    { field: "body", from: "Solo queremos proponerte presentar SOS-Expat a tus miembros", to: "Simplemente queremos proponerte presentar SOS-Expat a tus miembros" },
    { field: "body", from: "el papel que tu asociación tiene para ellos", to: "lo que tu asociación representa para ellos" },
    { field: "body", from: "19€ por 30 min con un expatriado voluntario", to: "19€ por 30 min con un expatriado que ayuda" },
    { field: "body", from: "Sin ninguna gestión: ingreso pasivo al instante.", to: "Cero gestiones: ingreso pasivo inmediato." },
    { field: "body", from: "un elemento diferenciador único en el mundo", to: "un argumento diferenciador único en el mundo" },
    { field: "body", from: "refuerzas el valor que aportas a tus clientes", to: "refuerzas el valor añadido que aportas a tus clientes" },
  ],
  de: [
    { field: "subject", from: "Auszahlung binnen 24 h", to: "Auszahlung binnen 24 Std." },
    { field: "body", from: "ausgewählt nach Sprache, Land, Bewertungen und Spezialgebieten, und sie direkt telefonisch zurückruft", to: "ausgewählt nach Sprache, Land, Bewertungen und Spezialgebieten — und Sie direkt telefonisch zurückruft" },
    { field: "body", from: "werden sie von einem lokalen Anwalt oder einem Expat, der sich auskennt, telefonisch zurückgerufen — in ihrer Sprache, in ihrem Land", to: "wird er von einem lokalen Anwalt oder einem erfahrenen Expat vor Ort telefonisch zurückgerufen — in seiner Sprache, in seinem Land" },
    { field: "body", from: "einer Ihrer Kunden reist ins Ausland und befindet sich allein, konfrontiert mit", to: "einer Ihrer Kunden ist im Ausland und steht plötzlich allein da — konfrontiert mit" },
    { field: "body", from: "Indem Sie SOS-Expat Ihrer Community empfehlen, bieten Sie ihnen", to: "Indem Sie SOS-Expat Ihrer Community empfehlen, bieten Sie ihr" },
    { field: "body", from: "kann jeder im Ausland von einem lokalen Anwalt oder einem Expat, der sich auskennt, telefonisch zurückgerufen werden", to: "erhält jeder im Ausland innerhalb von 5 Minuten einen Rückruf von einem lokalen Anwalt oder einem erfahrenen Expat vor Ort" },
    { field: "body", from: "auf die sie sich überall auf der Welt verlassen.", to: "auf die sie sich überall auf der Welt verlassen können." },
    { field: "body", from: "Sie wählen einen lokalen Anwalt oder einen Expat, der sich auskennt, nach Sprache, Land und Spezialgebieten aus", to: "Sie wählen einen lokalen Anwalt oder einen erfahrenen Expat vor Ort nach Sprache, Land und Spezialgebieten aus" },
  ],
  pt: [
    { field: "body", from: "disponível em seu painel e disponível para levantamento em 24h a pedido", to: "creditado no seu painel e disponível para saque em 24h mediante solicitação" },
    { field: "body", from: "um expatriado disposto a ajudar", to: "um expatriado voluntário" },
    { field: "body", from: "que lhes liga de volta diretamente", to: "que lhes telefona diretamente" },
    { field: "body", from: "um expatriado que conhece a realidade local", to: "um expatriado que conhece bem o país" },
    { field: "body", from: "colmata precisamente essa lacuna", to: "preenche exatamente essa lacuna" },
    { field: "body", from: "Falemos sobre isso:", to: "Vamos conversar:" },
    { field: "body", from: "vê-se sozinho no estrangeiro", to: "se encontra sozinho no exterior" },
    { field: "body", from: "Da sua parte, ganha 10$ por cada chamada gerada", to: "Você, por sua vez, ganha 10$ por cada chamada gerada" },
    { field: "body", from: "registados em todo o mundo", to: "inscritos em todo o mundo" },
    { field: "body", from: "Ficamos à disposição para uma entrevista exclusiva ou qualquer informação adicional.", to: "Estamos à disposição para uma entrevista exclusiva ou qualquer esclarecimento adicional." },
    { field: "body", from: "nosso grande inquérito exclusivo a expatriados", to: "nossa grande pesquisa exclusiva com expatriados" },
    { field: "body", from: "quem está lá para o apoiar em menos de 5 minutos?", to: "quem está presente para apoiá-lo em menos de 5 minutos?" },
    { field: "body", from: "viaja para o estrangeiro e vê-se sozinho", to: "viaja para o exterior e se encontra sozinho" },
  ],
  ru: [
    { field: "body", from: "даёт им живой человеческий отклик", to: "даёт им живую человеческую поддержку" },
    { field: "body", from: "с экспатом-консультантом", to: "с экспатом-помощником" },
    { field: "body", from: "доступный в личном кабинете и выводимый в течение 24 часов по первому запросу", to: "доступные в личном кабинете; вывод — в течение 24 часов по первому запросу" },
    { field: "subject", from: "человеческая, мгновенная страховочная сетка по всему миру", to: "мгновенная человеческая поддержка по всему миру" },
    { field: "body", from: "человеческую, мгновенную подстраховку", to: "мгновенную живую поддержку" },
    { field: "body", from: "оказывается один за границей перед лицом аварии", to: "оказывается за границей один на один с ЧП" },
    { field: "body", from: "усиливаете свою ценность в глазах клиентов", to: "повышаете свою ценность в глазах клиентов" },
    { field: "body", from: "автоматически зачисляемый на вашу панель", to: "автоматически зачисляются в ваш личный кабинет" },
    { field: "body", from: "Никакой рутины — мгновенный пассивный доход.", to: "Никакой волокиты — по-настоящему пассивный доход." },
    { field: "body", from: "Мы всегда готовы дать эксклюзивное интервью или любой дополнительной информации.", to: "Мы всегда готовы дать эксклюзивное интервью или предоставить любую дополнительную информацию." },
    { field: "body", from: "экспата, знающего обстановку", to: "опытного экспата, хорошо знающего страну" },
    { field: "body", from: "и без каких-либо дополнительных хлопот с вашей стороны", to: "и совершенно без дополнительных хлопот с вашей стороны" },
    { field: "body", from: "значит гарантировать им, что они никогда не будут по-настоящему одни", to: "значит дать им гарантию: они никогда не останутся одни" },
  ],
  ar: [
    { field: "body", from: "بأن تصبح شريكاً لـ SOS-Expat، تقدّم لجمهورك", to: "عندما تصبح شريكاً لـ SOS-Expat، فإنك تقدّم لجمهورك" },
    { field: "body", from: "بتوصية SOS-Expat لمجتمعك، تقدّم لهم", to: "عندما توصي مجتمعك بـ SOS-Expat، فإنك تقدّم لهم" },
    { field: "body", from: "بتوصية SOS-Expat لقرّائك، تمنحهم شبكة أمان حقيقية", to: "عندما توصي قرّاءك بـ SOS-Expat، فإنك تمنحهم شبكة أمان حقيقية" },
    { field: "body", from: "بدمج SOS-Expat في عرضك، تقدّم لعملائك", to: "عند دمج SOS-Expat في عرضك، تقدّم لعملائك" },
    { field: "body", from: "موظفوكم في الخارج هم أعظم رصيد لديكم", to: "موظفوكم في الخارج هم أكبر ثروة لديكم" },
    { field: "body", from: "الدليل بالأرقام من استطلاعنا الحصري الكبير للمغتربين", to: "الأرقام خير دليل، من استطلاعنا الحصري الكبير للمغتربين" },
    { field: "body", from: "دون أي أعباء إدارية، ودخل سلبي فوري", to: "دون أي أعباء إدارية، ودخل فوري يأتيك تلقائياً" },
    { field: "body", from: "مقابل 30 دقيقة مع مغترب مساعد", to: "مقابل 30 دقيقة مع مغترب يُقدّم المساعدة" },
    { field: "body", from: "نبقى متاحين لمقابلة حصرية أو أي معلومات إضافية", to: "نحن رهن إشارتكم لإجراء مقابلة حصرية أو لتقديم أي معلومات إضافية" },
  ],
  zh: [
    { field: "body", from: "我们只是建议您在下一封邮件或通讯中向成员介绍 SOS-Expat", to: "我们诚挚建议您在下一封邮件或会员通讯中向成员介绍 SOS-Expat" },
    { field: "body", from: "全程免操心，被动收入即时到账。", to: "全程无需操心，被动收入随时到账。" },
    { field: "body", from: "我们随时接受独家采访或提供任何补充信息。", to: "我们随时可以接受独家专访，或提供您所需的任何补充资料。" },
    { field: "body", from: "谁能在 5 分钟内陪伴他？", to: "谁能在 5 分钟内为他提供支援？" },
    { field: "body", from: "我们面向外籍人士的大型独家调查数据为证", to: "我们面向外籍人士开展的大型独家调查，数据足以为证" },
    { field: "body", from: "申请成为推广合作伙伴：sos-expat.com/devenir-blogger", to: "注册成为推广合作伙伴：sos-expat.com/devenir-blogger" },
  ],
  hi: [
    { field: "body", from: "फ़ोन पर फ़ोन पर जवाब देता है", to: "सीधे फ़ोन पर कॉल बैक करता है" },
    { field: "body", from: "फ़ोन पर फ़ोन पर कॉल वापस आती है", to: "सीधे फ़ोन पर कॉल बैक आती है" },
    { field: "body", from: "फ़ोन पर फ़ोन पर कॉल वापस पा सकता है", to: "सीधे फ़ोन पर कॉल बैक पा सकता है" },
    { field: "body", from: "एक्सक्लूसिव बड़ा सर्वे", to: "विशेष बड़े पैमाने का सर्वेक्षण" },
    { field: "body", from: "एक क्लिक पर अनुरोध करके 24 घंटे में निकाला जा सकता है", to: "सिर्फ़ एक क्लिक पर 24 घंटे में निकाला जा सकता है" },
    { field: "body", from: "अपने प्रतिस्पर्धियों के सामने एक मज़बूत अलग दिखाने वाली खूबी", to: "अपने प्रतिस्पर्धियों के मुक़ाबले एक मज़बूत विभेदक" },
    { field: "body", from: "कौन 5 मिनट से भी कम समय में उसके लिए मौजूद है?", to: "तो 5 मिनट से भी कम समय में उसके साथ कौन खड़ा है?" },
    { field: "body", from: "हम एक्सक्लूसिव इंटरव्यू या किसी भी अतिरिक्त जानकारी के लिए हाज़िर हैं।", to: "हम एक्सक्लूसिव इंटरव्यू या किसी भी अतिरिक्त जानकारी के लिए उपलब्ध हैं।" },
    { field: "body", from: "स्वचालित रूप से आपके डैशबोर्ड में जमा होता है", to: "अपने आप आपके डैशबोर्ड में जमा हो जाता है" },
    { field: "body", from: "कोई झंझट नहीं, तुरंत पैसिव इनकम।", to: "कोई झंझट नहीं, सीधी पैसिव इनकम।" },
  ],
};

async function main() {
  let totalRows = 0;
  let totalReps = 0;
  const perLang: Record<string, { rows: number; reps: number }> = {};

  for (const [lang, fixes] of Object.entries(FIXES)) {
    console.log(`\n=== ${lang} (${fixes.length} v2 fixes) ===`);
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
    console.log(`  → ${langRows} rows, ${langReps} replacements`);
    perLang[lang] = { rows: langRows, reps: langReps };
    totalRows += langRows;
    totalReps += langReps;
  }

  console.log(`\n=== Summary ===`);
  for (const [lang, { rows, reps }] of Object.entries(perLang)) {
    console.log(`  ${lang}: ${rows} rows / ${reps} replacements`);
  }
  console.log(`  TOTAL v2: ${totalRows} rows, ${totalReps} replacements`);

  process.exit(0);
}

main()
  .catch((e) => { console.error("FATAL:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
