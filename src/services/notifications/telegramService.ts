import { createChildLogger } from "../../utils/logger.js";
import { prisma } from "../../config/database.js";

const log = createChildLogger("telegram-service");

interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  events: {
    prospectReplied: boolean;
    prospectWon: boolean;
    backlinkLost: boolean;
    backlinkVerified: boolean;
  };
}

/**
 * Get Telegram configuration from database
 */
async function getTelegramConfig(): Promise<TelegramConfig | null> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: "telegram_notifications" },
  });

  if (!setting) {
    return null;
  }

  return setting.value as unknown as TelegramConfig;
}

/**
 * Send a message via Telegram Bot API
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string,
  parseMode: "HTML" | "Markdown" = "HTML"
): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      log.error({ error, status: response.status }, "Telegram API error");
      return false;
    }

    log.info({ chatId }, "Telegram message sent successfully");
    return true;
  } catch (err) {
    log.error({ err }, "Failed to send Telegram message");
    return false;
  }
}

/**
 * Notify when a prospect replies
 */
export async function notifyProspectReplied(prospectId: number): Promise<void> {
  const config = await getTelegramConfig();

  if (!config || !config.enabled || !config.events.prospectReplied) {
    return;
  }

  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
    include: {
      contacts: {
        take: 1,
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!prospect) {
    return;
  }

  const contact = prospect.contacts[0];
  const message = `
🎉 <b>Nouveau prospect intéressé !</b>

<b>Prospect :</b> ${prospect.domain}
<b>Catégorie :</b> ${prospect.category}
<b>Langue :</b> ${prospect.language || "N/A"}
<b>Pays :</b> ${prospect.country || "N/A"}
${contact ? `<b>Email :</b> ${contact.email}` : ""}

<i>Un prospect a répondu à votre campagne !</i>
  `.trim();

  await sendTelegramMessage(config.botToken, config.chatId, message);
}

/**
 * Notify when a prospect accepts the deal
 */
export async function notifyProspectWon(prospectId: number): Promise<void> {
  const config = await getTelegramConfig();

  if (!config || !config.enabled || !config.events.prospectWon) {
    return;
  }

  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
    include: {
      contacts: {
        take: 1,
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!prospect) {
    return;
  }

  const contact = prospect.contacts[0];
  const message = `
✅ <b>Deal Conclu !</b>

<b>Prospect :</b> ${prospect.domain}
<b>Catégorie :</b> ${prospect.category}
<b>Langue :</b> ${prospect.language || "N/A"}
<b>Score :</b> ${prospect.score}
${contact ? `<b>Email :</b> ${contact.email}` : ""}

<i>Le prospect a accepté le partenariat 🚀</i>
  `.trim();

  await sendTelegramMessage(config.botToken, config.chatId, message);
}

/**
 * Notify when a backlink is lost
 */
export async function notifyBacklinkLost(backlinkId: number): Promise<void> {
  const config = await getTelegramConfig();

  if (!config || !config.enabled || !config.events.backlinkLost) {
    return;
  }

  const backlink = await prisma.backlink.findUnique({
    where: { id: backlinkId },
    include: {
      prospect: true,
    },
  });

  if (!backlink) {
    return;
  }

  const message = `
⚠️ <b>Backlink Perdu</b>

<b>Site :</b> ${backlink.prospect.domain}
<b>Page :</b> ${backlink.pageUrl}
<b>Anchor :</b> ${backlink.anchorText || "N/A"}
<b>Type :</b> ${backlink.linkType}

<i>Le lien n'est plus présent sur la page. Re-contact recommandé.</i>
  `.trim();

  await sendTelegramMessage(config.botToken, config.chatId, message);
}

/**
 * Notify when a backlink is verified
 */
export async function notifyBacklinkVerified(backlinkId: number): Promise<void> {
  const config = await getTelegramConfig();

  if (!config || !config.enabled || !config.events.backlinkVerified) {
    return;
  }

  const backlink = await prisma.backlink.findUnique({
    where: { id: backlinkId },
    include: {
      prospect: true,
    },
  });

  if (!backlink) {
    return;
  }

  const message = `
✅ <b>Backlink Vérifié</b>

<b>Site :</b> ${backlink.prospect.domain}
<b>Page :</b> ${backlink.pageUrl}
<b>Anchor :</b> ${backlink.anchorText || "N/A"}
<b>Type :</b> ${backlink.linkType}

<i>Le lien est actif et vérifié ✓</i>
  `.trim();

  await sendTelegramMessage(config.botToken, config.chatId, message);
}

/**
 * Test Telegram configuration by sending a test message
 */
export async function sendTestNotification(
  botToken: string,
  chatId: string
): Promise<boolean> {
  const message = `
🤖 <b>Test de Configuration</b>

Les notifications Telegram sont correctement configurées !

<i>Vous recevrez désormais des alertes pour vos prospects et backlinks.</i>
  `.trim();

  return sendTelegramMessage(botToken, chatId, message);
}

/**
 * Send the weekly report notification via Telegram.
 * Uses the stored Telegram config from DB.
 */
export async function sendWeeklyReportNotification(
  formattedMessage: string
): Promise<boolean> {
  const config = await getTelegramConfig();

  if (!config || !config.enabled) {
    log.warn("Telegram not configured or disabled, skipping weekly report notification.");
    return false;
  }

  return sendTelegramMessage(config.botToken, config.chatId, formattedMessage);
}
