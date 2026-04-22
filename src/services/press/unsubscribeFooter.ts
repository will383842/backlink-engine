/**
 * Unsubscribe footer — one line per PressLang.
 *
 * Appended to every press email (text + html) before sending.
 * Required by RGPD art. 21 (droit d'opposition) + CAN-SPAM §5(a)(5) +
 * CASL s. 6(2)(c).  Also triggers Gmail/Yahoo's "Unsubscribe" button
 * when paired with the List-Unsubscribe header.
 */
import type { PressLang } from "@prisma/client";

type Footer = {
  text: (url: string) => string;
  html: (url: string) => string;
};

export const UNSUBSCRIBE_FOOTERS: Record<PressLang, Footer> = {
  fr: {
    text: (url) => `\n\n---\nVous recevez ce message car vous êtes journaliste / rédacteur d'un média référencé publiquement. Pour ne plus recevoir d'emails de ma part : ${url}`,
    html: (url) => `<hr style="margin-top:24px;border:none;border-top:1px solid #ddd;"><p style="font-size:11px;color:#888;margin-top:8px;">Vous recevez ce message car vous êtes journaliste / rédacteur d'un média référencé publiquement. <a href="${url}" style="color:#888;">Se désinscrire</a></p>`,
  },
  en: {
    text: (url) => `\n\n---\nYou received this because you're a journalist or editor at a publicly-listed media outlet. Unsubscribe: ${url}`,
    html: (url) => `<hr style="margin-top:24px;border:none;border-top:1px solid #ddd;"><p style="font-size:11px;color:#888;margin-top:8px;">You received this because you're a journalist or editor at a publicly-listed media outlet. <a href="${url}" style="color:#888;">Unsubscribe</a></p>`,
  },
  es: {
    text: (url) => `\n\n---\nRecibes este mensaje porque eres periodista o redactor de un medio público. Darse de baja: ${url}`,
    html: (url) => `<hr style="margin-top:24px;border:none;border-top:1px solid #ddd;"><p style="font-size:11px;color:#888;margin-top:8px;">Recibes este mensaje porque eres periodista o redactor de un medio público. <a href="${url}" style="color:#888;">Darse de baja</a></p>`,
  },
  de: {
    text: (url) => `\n\n---\nSie erhalten diese Nachricht, weil Sie Journalist/Redakteur eines öffentlich gelisteten Mediums sind. Abmelden: ${url}`,
    html: (url) => `<hr style="margin-top:24px;border:none;border-top:1px solid #ddd;"><p style="font-size:11px;color:#888;margin-top:8px;">Sie erhalten diese Nachricht, weil Sie Journalist/Redakteur eines öffentlich gelisteten Mediums sind. <a href="${url}" style="color:#888;">Abmelden</a></p>`,
  },
  pt: {
    text: (url) => `\n\n---\nRecebe esta mensagem porque é jornalista ou redator de um órgão de comunicação listado publicamente. Cancelar subscrição: ${url}`,
    html: (url) => `<hr style="margin-top:24px;border:none;border-top:1px solid #ddd;"><p style="font-size:11px;color:#888;margin-top:8px;">Recebe esta mensagem porque é jornalista ou redator de um órgão de comunicação listado publicamente. <a href="${url}" style="color:#888;">Cancelar subscrição</a></p>`,
  },
  ru: {
    text: (url) => `\n\n---\nВы получили это письмо, потому что вы журналист или редактор публично указанного СМИ. Отписаться: ${url}`,
    html: (url) => `<hr style="margin-top:24px;border:none;border-top:1px solid #ddd;"><p style="font-size:11px;color:#888;margin-top:8px;">Вы получили это письмо, потому что вы журналист или редактор публично указанного СМИ. <a href="${url}" style="color:#888;">Отписаться</a></p>`,
  },
  zh: {
    text: (url) => `\n\n---\n您收到此邮件是因为您是公开列出的媒体机构的记者或编辑。取消订阅：${url}`,
    html: (url) => `<hr style="margin-top:24px;border:none;border-top:1px solid #ddd;"><p style="font-size:11px;color:#888;margin-top:8px;">您收到此邮件是因为您是公开列出的媒体机构的记者或编辑。<a href="${url}" style="color:#888;">取消订阅</a></p>`,
  },
  hi: {
    text: (url) => `\n\n---\nआपको यह संदेश इसलिए मिला है क्योंकि आप एक सार्वजनिक रूप से सूचीबद्ध मीडिया संस्थान के पत्रकार या संपादक हैं। सदस्यता समाप्त करें: ${url}`,
    html: (url) => `<hr style="margin-top:24px;border:none;border-top:1px solid #ddd;"><p style="font-size:11px;color:#888;margin-top:8px;">आपको यह संदेश इसलिए मिला है क्योंकि आप एक सार्वजनिक रूप से सूचीबद्ध मीडिया संस्थान के पत्रकार या संपादक हैं। <a href="${url}" style="color:#888;">सदस्यता समाप्त करें</a></p>`,
  },
  ar: {
    text: (url) => `\n\n---\nأنت تتلقى هذه الرسالة لأنك صحفي أو محرر في مؤسسة إعلامية مُدرجة علنياً. إلغاء الاشتراك: ${url}`,
    html: (url) => `<hr style="margin-top:24px;border:none;border-top:1px solid #ddd;"><p style="font-size:11px;color:#888;margin-top:8px;" dir="rtl">أنت تتلقى هذه الرسالة لأنك صحفي أو محرر في مؤسسة إعلامية مُدرجة علنياً. <a href="${url}" style="color:#888;">إلغاء الاشتراك</a></p>`,
  },
  et: {
    text: (url) => `\n\n---\nSaate selle kirja, sest olete avalikult loetletud meediaväljaande ajakirjanik või toimetaja. Loobu: ${url}`,
    html: (url) => `<hr style="margin-top:24px;border:none;border-top:1px solid #ddd;"><p style="font-size:11px;color:#888;margin-top:8px;">Saate selle kirja, sest olete avalikult loetletud meediaväljaande ajakirjanik või toimetaja. <a href="${url}" style="color:#888;">Loobu</a></p>`,
  },
};

export function getUnsubscribeFooter(lang: PressLang, url: string): { text: string; html: string } {
  const footer = UNSUBSCRIBE_FOOTERS[lang] ?? UNSUBSCRIBE_FOOTERS.en;
  return {
    text: footer.text(url),
    html: footer.html(url),
  };
}
