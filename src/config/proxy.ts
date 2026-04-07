// ---------------------------------------------------------------------------
// Proxy Configuration - Route outbound HTTP through rotating proxies
// ---------------------------------------------------------------------------
//
// Supported proxy services: BrightData, Oxylabs, SmartProxy, or any
// standard HTTP/HTTPS proxy.
//
// Environment variables:
//   PROXY_ENABLED  - "true" to activate (default: "false")
//   PROXY_URL      - Full proxy URL, e.g. "http://user:pass@proxy.example.com:8080"
//
// How it works:
//   Node.js >= 18 native fetch (undici) respects HTTP_PROXY / HTTPS_PROXY
//   environment variables. When PROXY_ENABLED=true, we set these at module
//   load time so ALL subsequent fetch() calls go through the proxy.
//
//   The exported `proxyFetch` wrapper is used in scraping/crawling code to
//   make the proxy dependency explicit and allow per-call overrides later.
// ---------------------------------------------------------------------------

import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("proxy");

// ---------------------------------------------------------------------------
// Read configuration once at module load
// ---------------------------------------------------------------------------

const PROXY_ENABLED = process.env.PROXY_ENABLED === "true";
const PROXY_URL = process.env.PROXY_URL || "";

if (PROXY_ENABLED && PROXY_URL) {
  // Set standard proxy env vars that Node.js undici respects
  process.env.HTTP_PROXY = PROXY_URL;
  process.env.HTTPS_PROXY = PROXY_URL;
  log.info({ proxyUrl: PROXY_URL.replace(/\/\/.*@/, "//<credentials>@") }, "Proxy enabled — all outbound HTTP routed through proxy.");
} else if (PROXY_ENABLED && !PROXY_URL) {
  log.warn("PROXY_ENABLED=true but PROXY_URL is empty — proxy NOT activated.");
}

// ---------------------------------------------------------------------------
// proxyFetch — drop-in replacement for native fetch
// ---------------------------------------------------------------------------

/**
 * Proxy-aware fetch wrapper. Same signature as native `fetch()`.
 *
 * When PROXY_ENABLED=true and PROXY_URL is set, requests go through the
 * configured proxy (via HTTP_PROXY/HTTPS_PROXY env vars set at module load).
 *
 * When disabled, this is a zero-overhead passthrough to native fetch.
 */
export async function proxyFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, init);
}

/**
 * Whether the proxy is currently active.
 */
export function isProxyActive(): boolean {
  return PROXY_ENABLED && !!PROXY_URL;
}
