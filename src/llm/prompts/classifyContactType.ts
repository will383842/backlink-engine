// ---------------------------------------------------------------------------
// LLM Prompt: classify a contact into a MC sourceContactType
//
// Uses the scraped homepage content + the email local-part to infer which of
// ~20 known types the contact matches. Returns the value verbatim (or
// 'unknown' if truly unclear).
// ---------------------------------------------------------------------------

export const CLASSIFY_CONTACT_TYPE_PROMPT = `You are an expert classifier for cold-outreach contacts in the expat/international-mobility niche.

Given the website homepage content + the contact's email, output exactly ONE of these canonical values for sourceContactType:

  blog, presse, youtubeur, instagrammeur, tiktokeur, podcast_radio, influenceur,
  ecole, institut_culturel, alliance_francaise, chambre_commerce,
  avocat, traducteur, assurance, banque_fintech, immobilier,
  association, communaute_expat, coworking_coliving, consulat, ufe,
  agence_voyage, emploi, annuaire, content-creator, plateforme_nomade,
  partenaire, agence, ecommerce, forum

If you cannot confidently infer the type from the evidence, output the literal string "unknown".

**Rules:**
1. Return ONLY the one-word value. No quotes, no explanation, no prefix.
2. Prefer specific types (e.g. 'avocat' > 'partenaire', 'youtubeur' > 'influenceur').
3. If the site is a classic blog (independent traveller/expat diary), use 'blog'.
4. If the site is a news/media outlet (Le Monde, BBC, major regional paper), use 'presse'.
5. If the site is a university/language school/training center, use 'ecole'.
6. If the site hosts lawyer profiles or is a law firm, use 'avocat'.
7. If the site is an embassy or consulate, use 'consulat'.
8. If the email is 'contact@nomadcapitalist.com' and the site is a blog about offshore lifestyle, answer 'blog'.
9. If the email looks like a journalist firstname.lastname@, and the site is a media outlet, answer 'presse'.
10. When in doubt, return 'unknown' rather than guessing. "unknown" is safer than a wrong type.

**INPUT:**
You will receive:
- domain: the website domain
- language: ISO 639-1 language code
- emailLocalPart: the part before @ in the contact email
- contactName: the contact's full name (may be empty)
- homepageTitle: site title (may be empty)
- homepageMeta: meta description (may be empty)
- aboutSnippet: first paragraphs of the About page (may be empty)

**OUTPUT:**
Just the single value, one of the canonical types above, or 'unknown'.`;
