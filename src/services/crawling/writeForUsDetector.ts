// ---------------------------------------------------------------------------
// Write For Us Detector - Find "guest post" / "write for us" pages
// ---------------------------------------------------------------------------

import { createChildLogger } from "../../utils/logger.js";
import { searchForProspects } from "./serpApiClient.js";
import type { CrawlHit } from "./blogCrawler.js";

const log = createChildLogger("write-for-us-detector");

/**
 * Default footprint queries to find "write for us" pages in multiple languages.
 */
const DEFAULT_FOOTPRINTS: string[] = [
  // English - all niches
  '"write for us" + expat',
  '"guest post" + expatriation',
  '"contribute" + "expat blog"',
  '"submit a guest post" + travel abroad',
  '"become a contributor" + "digital nomad"',
  '"write for us" + "living abroad"',
  '"guest post" + "study abroad"',
  '"write for us" + "travel blog"',
  '"guest post" + "retire abroad"',
  '"contribute" + "international relocation"',
  // French
  '"devenir auteur" + expat',
  '"article invité" + expatriation',
  '"écrire pour nous" + "voyage"',
  '"article invité" + "nomade digital"',
  '"contribuer" + "vivre à l\'étranger"',
  // German
  '"Gastbeitrag" + auswandern',
  '"für uns schreiben" + expat',
  '"Gastartikel" + "digitale nomaden"',
  // Spanish
  '"escribir para nosotros" + expatriado',
  '"artículo invitado" + "vivir en el extranjero"',
  '"colaborar" + "nómada digital"',
  // Portuguese
  '"escreva para nós" + expatriado',
  '"artigo convidado" + "morar no exterior"',
  // Russian
  '"гостевой пост" + эмиграция',
  '"написать для нас" + "жизнь за рубежом"',
  // Arabic
  '"اكتب لنا" + المغتربين',
];

/**
 * Detect "write for us" pages using search footprints.
 *
 * @param customFootprints - Optional custom footprints (merged with defaults)
 */
export async function detectWriteForUsPages(
  customFootprints?: string[],
): Promise<CrawlHit[]> {
  const footprints = customFootprints && customFootprints.length > 0
    ? [...DEFAULT_FOOTPRINTS, ...customFootprints]
    : DEFAULT_FOOTPRINTS;

  log.info({ footprintCount: footprints.length }, "Searching for write-for-us pages.");

  const hits = await searchForProspects(footprints, 30);

  log.info({ found: hits.length }, "Write-for-us detection complete.");
  return hits;
}
