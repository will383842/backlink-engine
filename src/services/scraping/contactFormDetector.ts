// ─────────────────────────────────────────────────────────────
// Contact Form Detector - Detect contact forms on webpages
// ─────────────────────────────────────────────────────────────

import { load } from "cheerio";
import { createChildLogger } from "../../utils/logger.js";
import { proxyFetch } from "../../config/proxy.js";

const log = createChildLogger("contact-form-detector");

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

// Common contact form patterns
const CONTACT_FORM_INDICATORS = [
  // Form action patterns
  /contact/i,
  /kontakt/i,
  /contacto/i,
  /contato/i,
  /formulaire/i,
  /message/i,
  /send.*message/i,
  /get.*touch/i,

  // Form ID/class patterns
  /contact[-_]form/i,
  /contact[-_]us/i,
  /message[-_]form/i,
  /inquiry/i,
  /enquiry/i,
];

// CAPTCHA detection patterns
const CAPTCHA_PATTERNS = [
  "g-recaptcha",
  "h-captcha",
  "cf-turnstile",
  "grecaptcha",
  "hcaptcha",
  "data-sitekey",
  "recaptcha",
];

// Common field patterns
const FIELD_PATTERNS = {
  name: /name|nom|nombre|nome|имя|名前|नाम|اسم/i,
  email: /e-?mail|correo|correio|почта|メール|ईमेल|بريد/i,
  phone: /phone|tel|telefon|téléphone|telefone|телефон|電話|फोन|هاتف/i,
  subject: /subject|sujet|asunto|assunto|тема|件名|विषय|موضوع/i,
  message: /message|mensaje|mensagem|сообщение|メッセージ|संदेश|رسالة|comment|comentario/i,
  company: /company|entreprise|empresa|компания|会社|कंपनी|شركة/i,
};

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ContactFormDetectionResult {
  hasContactForm: boolean;
  contactFormUrl: string | null;
  formFields: {
    name?: boolean;
    email?: boolean;
    phone?: boolean;
    subject?: boolean;
    message?: boolean;
    company?: boolean;
  };
  hasCaptcha: boolean;
  confidence: "high" | "medium" | "low";
  detectionMethod: string;
}

// ─────────────────────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────────────────────

// Realistic browser headers — improves scraping success rate vs anti-bot walls
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

// Common contact page paths to try directly (in order of likelihood).
// Expanded to cover media/press sites (écrire à la rédaction…), education
// (admissions), associations (adhesion/join-us), e-commerce (support/SAV)
// and multi-language variants. Ordered by observed hit rate on our 5000+
// prospects so the HEAD request cascade finds a match ASAP.
const CONTACT_PATHS = [
  // Generic
  "/contact",
  "/contact-us",
  "/contact.html",
  "/contact.php",
  "/contact/",
  // French
  "/nous-contacter",
  "/fr/contact",
  "/nous-ecrire",
  "/ecrire-a-la-redaction",
  "/la-redaction",
  "/contact-redaction",
  // English
  "/en/contact",
  "/get-in-touch",
  "/reach-us",
  "/write-for-us",
  // German
  "/kontakt",
  "/impressum",
  "/kontaktieren",
  // Spanish / Portuguese / Italian
  "/contacto",
  "/contato",
  "/contatti",
  "/contattaci",
  // Press / media
  "/press",
  "/presse",
  "/press-contact",
  "/media-inquiries",
  "/media",
  "/newsroom",
  // Education / institutional
  "/admissions",
  "/admission",
  "/information",
  "/inscription",
  // Association / community
  "/rejoindre",
  "/join-us",
  "/adhesion",
  // Support / e-commerce
  "/support",
  "/help",
  "/service-client",
  // About pages
  "/about",
  "/about-us",
  "/a-propos",
  "/apropos",
  "/qui-sommes-nous",
  "/about/contact",
];

/**
 * Detect if a page has a contact form
 */
export async function detectContactForm(
  url: string
): Promise<ContactFormDetectionResult> {
  try {
    log.debug({ url }, "Starting contact form detection");

    // 1. Fetch HTML with realistic browser fingerprint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await proxyFetch(url, {
      signal: controller.signal,
      headers: BROWSER_HEADERS,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      log.warn({ url, status: response.status }, "Failed to fetch URL");
      return createNegativeResult();
    }

    const html = await response.text();
    const $ = load(html);

    // 2. Detect CAPTCHA first (common indicator)
    const hasCaptcha = detectCaptcha(html, $);

    // 3. Find forms
    const forms = $("form");
    if (forms.length === 0) {
      log.debug({ url }, "No forms found on page");
      return createNegativeResult();
    }

    log.debug({ url, formCount: forms.length }, `Found ${forms.length} forms`);

    // 4. Analyze each form for contact patterns
    let bestMatch: ContactFormDetectionResult | null = null;

    forms.each((_, formEl) => {
      const form = $(formEl);
      const formHtml = form.html() || "";
      const formAction = form.attr("action") || "";
      const formId = form.attr("id") || "";
      const formClass = form.attr("class") || "";

      // Check if this looks like a contact form
      const matchScore = calculateContactFormScore(
        formAction,
        formId,
        formClass,
        formHtml
      );

      if (matchScore > 0) {
        const fields = detectFormFields(form, $);
        const confidence = determineConfidence(matchScore, fields);

        const result: ContactFormDetectionResult = {
          hasContactForm: true,
          contactFormUrl: resolveFormUrl(url, formAction),
          formFields: fields,
          hasCaptcha,
          confidence,
          detectionMethod: "form_analysis",
        };

        // Keep the best match
        if (
          !bestMatch ||
          confidenceScore(result.confidence) > confidenceScore(bestMatch.confidence)
        ) {
          bestMatch = result;
        }
      }
    });

    if (bestMatch) {
      log.info({ url, result: bestMatch }, "Contact form detected");
      return bestMatch;
    }

    // 5. Fallback: Check if page URL suggests contact page
    if (isContactPage(url)) {
      const fields = detectFormFields($("form").first(), $);
      log.info({ url }, "Contact form detected via URL pattern");

      return {
        hasContactForm: true,
        contactFormUrl: url,
        formFields: fields,
        hasCaptcha,
        confidence: "medium",
        detectionMethod: "url_pattern",
      };
    }

    return createNegativeResult();
  } catch (err: any) {
    if (err.name === "AbortError") {
      log.warn({ url }, "Request timeout");
    } else {
      log.error({ err, url }, "Failed to detect contact form");
    }
    return createNegativeResult();
  }
}

/**
 * Try to find contact form URL from homepage.
 * Strategy:
 *   1. Try common direct URLs (/contact, /contact-us, /nous-contacter, etc.)
 *   2. If none work, fall back to scanning homepage HTML for contact links
 */
export async function findContactFormUrl(homepageUrl: string): Promise<string | null> {
  // Strategy 1: try direct common paths (fast, no HTML parsing needed)
  const baseUrl = new URL(homepageUrl).origin;
  for (const path of CONTACT_PATHS) {
    try {
      const testUrl = `${baseUrl}${path}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await proxyFetch(testUrl, {
        method: "HEAD",
        signal: controller.signal,
        headers: BROWSER_HEADERS,
        redirect: "follow",
      });
      clearTimeout(timeoutId);
      if (res.ok && res.status < 400) {
        log.debug({ homepageUrl, testUrl }, "Direct contact path found");
        return testUrl;
      }
    } catch {
      // Next path
    }
  }

  // Strategy 2: scan homepage for links containing contact-like patterns
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await proxyFetch(homepageUrl, {
      signal: controller.signal,
      headers: BROWSER_HEADERS,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const html = await response.text();
    const $ = load(html);

    // Look for contact page links (wider patterns)
    const contactLinks = $(
      'a[href*="contact" i], a[href*="kontakt" i], a[href*="contacto" i], a[href*="nous-contacter" i], a[href*="about" i], a[href*="impressum" i]',
    );

    for (let i = 0; i < contactLinks.length; i++) {
      const href = $(contactLinks[i]).attr("href");
      if (href && !href.startsWith("mailto:") && !href.startsWith("tel:")) {
        try {
          const absoluteUrl = new URL(href, homepageUrl).href;
          log.debug({ homepageUrl, contactUrl: absoluteUrl }, "Found contact page link");
          return absoluteUrl;
        } catch {
          // Invalid URL, skip
        }
      }
    }

    return null;
  } catch (err) {
    log.error({ err, homepageUrl }, "Failed to find contact form URL");
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function detectCaptcha(html: string, $: any): boolean {
  // Check HTML source for CAPTCHA patterns
  for (const pattern of CAPTCHA_PATTERNS) {
    if (html.includes(pattern)) {
      return true;
    }
  }

  // Check for CAPTCHA script tags
  const hasCaptchaScript =
    $('script[src*="recaptcha"]').length > 0 ||
    $('script[src*="hcaptcha"]').length > 0 ||
    $('script[src*="turnstile"]').length > 0;

  return hasCaptchaScript;
}

function calculateContactFormScore(
  action: string,
  id: string,
  className: string,
  formHtml: string
): number {
  let score = 0;

  const combinedText = `${action} ${id} ${className}`.toLowerCase();

  for (const pattern of CONTACT_FORM_INDICATORS) {
    if (pattern.test(combinedText)) {
      score += 10;
    }
  }

  // Check if form has email + message fields (strong indicator)
  if (formHtml.match(/type=["']email["']/i) && formHtml.match(/<textarea/i)) {
    score += 15;
  }

  // Check for submit button text
  if (
    formHtml.match(/send|envoyer|enviar|отправить|送信|भेजें|إرسال/i)
  ) {
    score += 5;
  }

  return score;
}

function detectFormFields(form: any, $: any): ContactFormDetectionResult["formFields"] {
  const fields: ContactFormDetectionResult["formFields"] = {};

  // Check inputs
  form.find("input, textarea, select").each((_: any, el: any) => {
    const $el = $(el);
    const name = $el.attr("name") || "";
    const id = $el.attr("id") || "";
    const placeholder = $el.attr("placeholder") || "";
    const label = $el.closest("label").text() || "";
    const type = $el.attr("type") || "";

    const combinedText = `${name} ${id} ${placeholder} ${label}`.toLowerCase();

    for (const [fieldName, pattern] of Object.entries(FIELD_PATTERNS)) {
      if (pattern.test(combinedText) || (fieldName === "email" && type === "email")) {
        (fields as any)[fieldName] = true;
      }
    }
  });

  return fields;
}

function determineConfidence(
  score: number,
  fields: ContactFormDetectionResult["formFields"]
): "high" | "medium" | "low" {
  const hasEmailAndMessage = fields.email && fields.message;

  if (score >= 25 && hasEmailAndMessage) return "high";
  if (score >= 15 || hasEmailAndMessage) return "medium";
  return "low";
}

function confidenceScore(confidence: "high" | "medium" | "low"): number {
  return { high: 3, medium: 2, low: 1 }[confidence];
}

function isContactPage(url: string): boolean {
  const urlLower = url.toLowerCase();
  return (
    urlLower.includes("/contact") ||
    urlLower.includes("/kontakt") ||
    urlLower.includes("/contacto") ||
    urlLower.includes("/contato") ||
    urlLower.includes("/get-in-touch") ||
    urlLower.includes("/nous-contacter")
  );
}

function resolveFormUrl(pageUrl: string, formAction: string): string {
  if (!formAction || formAction === "#" || formAction === "") {
    return pageUrl;
  }

  try {
    return new URL(formAction, pageUrl).href;
  } catch {
    return pageUrl;
  }
}

function createNegativeResult(): ContactFormDetectionResult {
  return {
    hasContactForm: false,
    contactFormUrl: null,
    formFields: {},
    hasCaptcha: false,
    confidence: "low",
    detectionMethod: "none",
  };
}
