/**
 * Unsubscribe token — HMAC-SHA256 signed token per PressContact.
 *
 * Design: stateless token derived from contactId + a persistent secret
 * stored in AppSetting.  No need for a new column on PressContact, and
 * tokens survive redeploys as long as the secret is intact.
 *
 * Format: base64url(HMAC-SHA256(secret, contactId))
 */
import crypto from "node:crypto";
import { prisma } from "../../config/database.js";

const SECRET_KEY = "press_unsubscribe_secret";

let cachedSecret: string | null = null;

export async function getUnsubscribeSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;

  const existing = await prisma.appSetting.findUnique({ where: { key: SECRET_KEY } });
  if (existing) {
    const val = existing.value as { secret?: string } | null;
    if (val?.secret) {
      cachedSecret = val.secret;
      return cachedSecret;
    }
  }

  // First-run: generate and persist
  const secret = crypto.randomBytes(32).toString("base64url");
  await prisma.appSetting.upsert({
    where: { key: SECRET_KEY },
    create: { key: SECRET_KEY, value: { secret } },
    update: { value: { secret } },
  });
  cachedSecret = secret;
  return secret;
}

export async function generateUnsubscribeToken(contactId: string): Promise<string> {
  const secret = await getUnsubscribeSecret();
  return crypto.createHmac("sha256", secret).update(contactId).digest("base64url");
}

export async function verifyUnsubscribeToken(contactId: string, token: string): Promise<boolean> {
  const expected = await generateUnsubscribeToken(contactId);
  // Constant-time compare
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

export async function buildUnsubscribeUrl(contactId: string, baseUrl?: string): Promise<string> {
  const base = baseUrl ?? process.env.TRACKING_BASE_URL ?? "https://backlinks.life-expat.com";
  const token = await generateUnsubscribeToken(contactId);
  return `${base}/api/press/unsubscribe?id=${encodeURIComponent(contactId)}&token=${token}`;
}
