async function testFetch(url: string): Promise<void> {
  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
      },
    });
    clearTimeout(timeoutId);
    const elapsed = Date.now() - t0;
    console.log(`  ${url} → ${res.status} (${elapsed}ms, content-length=${res.headers.get("content-length")})`);
    if (res.ok) {
      const buf = await res.arrayBuffer();
      console.log(`    body bytes: ${buf.byteLength}`);
      const text = new TextDecoder().decode(buf);
      console.log(`    first 200 chars: ${text.slice(0, 200).replace(/\s+/g, " ")}`);
      const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
      console.log(`    title match: ${titleMatch ? titleMatch[1] : "(none)"}`);
    }
  } catch (e) {
    const elapsed = Date.now() - t0;
    console.log(`  ${url} → ERROR (${elapsed}ms): ${e instanceof Error ? e.message : e}`);
  }
}

const urls = [
  "https://curiositesdevoyageuses.com",
  "https://nouvellecaledonie-tourisme.com",
  "https://globetrotteuse.com",
  "https://pvtcanada.com",
  "https://greaterdays.fr",
  "https://nomadcapitalist.com",
];

for (const url of urls) {
  await testFetch(url);
}
process.exit(0);
