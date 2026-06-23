import type { SecuritySettings, WebSearchResult } from "../shared/types";

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
}

export interface WebFetchResponse {
  url: string;
  title: string;
  content: string;
}

export interface WebBatchFetchResponse {
  pages: WebFetchResponse[];
}

export interface WebScreenPullResponse {
  url: string;
  title: string;
  content: string;
}

const maxFetchCharacters = 16_000;
const maxResponseBytes = 2_500_000;
const maxBatchPages = 8;
const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) CoderDesktop/0.0.33 Safari/537.36";

export async function searchWeb(security: SecuritySettings, query: string): Promise<WebSearchResponse> {
  assertInternetAllowed(security);
  const safeQuery = query.replace(/\0/g, "").trim();

  if (!safeQuery) {
    throw new Error("Enter a search query before using web search.");
  }

  const searchUrls = [
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(safeQuery)}`,
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(safeQuery)}`,
    `https://www.bing.com/search?q=${encodeURIComponent(safeQuery)}`
  ];
  const results: WebSearchResult[] = [];

  for (const searchUrl of searchUrls) {
    try {
      const response = await fetch(searchUrl, {
        headers: createBrowserHeaders(),
        signal: AbortSignal.timeout(45_000)
      });

      if (!response.ok) {
        continue;
      }

      const html = await response.text();
      const parsedResults = searchUrl.includes("bing.com") ? parseBingResults(html) : parseDuckDuckGoResults(html);
      addUniqueResults(results, parsedResults);
    } catch {
      continue;
    }

    if (results.length >= 24) {
      break;
    }
  }

  if (shouldIncludeGitHubSearch(safeQuery)) {
    addUniqueResults(results, [
      {
        title: "GitHub code search",
        url: `https://github.com/search?q=${encodeURIComponent(safeQuery)}&type=code`,
        snippet: "Search public repositories and source files for the requested text."
      },
      {
        title: "GitHub repository search",
        url: `https://github.com/search?q=${encodeURIComponent(safeQuery)}&type=repositories`,
        snippet: "Search public repositories that may contain the requested source."
      }
    ]);
  }

  if (!results.length) {
    addUniqueResults(results, createFallbackSearchResults(safeQuery));
  }

  return {
    query: safeQuery,
    results: results.slice(0, 24)
  };
}

export async function fetchWebContent(security: SecuritySettings, url: string): Promise<WebFetchResponse> {
  assertInternetAllowed(security);
  const safeUrl = normalizeHttpUrl(url);
  const html = await fetchHtml(safeUrl);
  const title = readTitle(html) || safeUrl;
  const metadata = readMetadataSummary(html);
  const content = [metadata, htmlToText(html)].filter(Boolean).join("\n\n").slice(0, maxFetchCharacters);

  return {
    url: safeUrl,
    title,
    content
  };
}

export async function fetchManyWebContents(security: SecuritySettings, urls: string[]): Promise<WebBatchFetchResponse> {
  assertInternetAllowed(security);
  const safeUrls = Array.from(new Set(urls.map((url) => normalizeHttpUrl(url)))).slice(0, maxBatchPages);

  if (!safeUrls.length) {
    throw new Error("Enter at least one valid web URL before reading pages.");
  }

  const pages = await Promise.all(
    safeUrls.map(async (url) => {
      try {
        return await fetchWebContent(security, url);
      } catch (error) {
        return {
          url,
          title: "Could not read page",
          content: `Coder Desktop tried alternate public routes for this page, but it was not readable from this computer. ${cleanFetchError(error)}`
        };
      }
    })
  );
  return { pages };
}

export async function screenPullWebContent(security: SecuritySettings, url: string): Promise<WebScreenPullResponse> {
  assertInternetAllowed(security);
  const safeUrl = normalizeHttpUrl(url);
  const html = await fetchHtml(safeUrl);
  const title = readTitle(html) || safeUrl;
  const pull = {
    title,
    url: safeUrl,
    metadata: readMetadataSummary(html).split("\n").filter(Boolean),
    headings: readTaggedText(html, "h[1-6]", 48),
    buttons: readTaggedText(html, "button", 64),
    inputs: readInputs(html, 64),
    links: readLinks(html, safeUrl, 80),
    visibleText: htmlToText(html).slice(0, 12_000)
  };

  return {
    url: safeUrl,
    title,
    content: JSON.stringify(pull, null, 2)
  };
}

async function fetchHtml(url: string): Promise<string> {
  const candidates = createFetchUrlCandidates(url);
  let lastError = "";

  for (const candidate of candidates) {
    try {
      return await fetchCandidateHtml(candidate);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(`That public page could not be read after trying alternate public routes. ${cleanFetchError(lastError)}`.trim());
}

async function fetchCandidateHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: createBrowserHeaders(),
    signal: AbortSignal.timeout(60_000)
  });

  if (!response.ok) {
    throw new Error(`That public page could not be read right now. Status ${response.status}.`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");

  if (contentLength > maxResponseBytes) {
    throw new Error("That page is too large for the chat preview.");
  }

  return response.text();
}

function createBrowserHeaders(): Record<string, string> {
  return {
    "User-Agent": userAgent,
    Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,application/json;q=0.8,*/*;q=0.7",
    "Accept-Language": "en-US,en;q=0.9"
  };
}

function createFetchUrlCandidates(url: string): string[] {
  const candidates = new Set<string>();
  candidates.add(url);

  try {
    const parsed = new URL(url);
    parsed.hash = "";
    candidates.add(parsed.toString());

    if (parsed.search) {
      const withoutSearch = new URL(parsed.toString());
      withoutSearch.search = "";
      candidates.add(withoutSearch.toString());
    }

    for (const candidate of createGitHubRawCandidates(parsed)) {
      candidates.add(candidate);
    }
  } catch {
    candidates.add(url);
  }

  return Array.from(candidates);
}

function createGitHubRawCandidates(url: URL): string[] {
  const host = url.hostname.toLowerCase();

  if (host !== "github.com" && host !== "www.github.com") {
    return [];
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const [owner, repo, mode, branch, ...fileParts] = parts;

  if (!owner || !repo) {
    return [];
  }

  const candidates: string[] = [];

  if ((mode === "blob" || mode === "raw") && branch && fileParts.length) {
    candidates.push(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${fileParts.join("/")}`);
  }

  if (!mode || mode === "tree") {
    candidates.push(`https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`);
    candidates.push(`https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`);
  }

  return candidates;
}

function shouldIncludeGitHubSearch(query: string): boolean {
  return /\b(git|github|repo|repository|source code|code search|commit|branch|tag|release|file)\b/i.test(query);
}

function createFallbackSearchResults(query: string): WebSearchResult[] {
  return [
    {
      title: "DuckDuckGo search page",
      url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      snippet: "Open this public search page if automated result extraction is blocked."
    },
    {
      title: "Bing search page",
      url: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
      snippet: "Open this public search page if another search source is blocked."
    }
  ];
}

function cleanFetchError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\bfetch failed\b/gi, "The network request failed").replace(/\s+/g, " ").trim();
}

function addUniqueResults(target: WebSearchResult[], incoming: WebSearchResult[]): void {
  const seen = new Set(target.map((result) => normalizeResultUrl(result.url)));

  for (const result of incoming) {
    const key = normalizeResultUrl(result.url);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    target.push(result);
  }
}

function assertInternetAllowed(security: SecuritySettings): void {
  if (!security.allowInternetAccess) {
    throw new Error("Internet access is turned off for this chat access mode.");
  }
}

function normalizeHttpUrl(value: string): string {
  try {
    const url = new URL(value.trim());

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Only http and https pages can be fetched.");
    }

    return url.toString();
  } catch (error) {
    if (error instanceof Error && error.message === "Only http and https pages can be fetched.") {
      throw error;
    }

    throw new Error("Enter a valid web URL before fetching a page.");
  }
}

function parseDuckDuckGoResults(html: string): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const resultPattern =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>)?/gi;
  let match: RegExpExecArray | null;

  while ((match = resultPattern.exec(html))) {
    const title = decodeHtml(stripTags(match[2]));
    const url = normalizeDuckDuckGoUrl(decodeHtml(match[1]));
    const snippet = decodeHtml(stripTags(match[3] || match[4] || ""));

    if (title && url && !results.some((result) => result.url === url)) {
      results.push({
        title,
        url,
        snippet
      });
    }
  }

  return results;
}

function parseBingResults(html: string): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const blockPattern = /<li[^>]+class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockPattern.exec(html))) {
    const block = blockMatch[1];
    const linkMatch = /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i.exec(block);

    if (!linkMatch) {
      continue;
    }

    const url = decodeHtml(linkMatch[1]);
    const title = decodeHtml(stripTags(linkMatch[2]));
    const snippetMatch = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block);
    const snippet = decodeHtml(stripTags(snippetMatch?.[1] ?? ""));

    if (title && /^https?:\/\//i.test(url)) {
      results.push({ title, url, snippet });
    }
  }

  return results;
}

function normalizeDuckDuckGoUrl(value: string): string {
  try {
    const url = new URL(value, "https://duckduckgo.com");
    const redirected = url.searchParams.get("uddg");

    if (redirected) {
      return redirected;
    }

    return url.toString();
  } catch {
    return value;
  }
}

function readTitle(html: string): string {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? decodeHtml(stripTags(match[1])).slice(0, 160) : "";
}

function readMetadataSummary(html: string): string {
  const fields = [
    readMetaContent(html, "description"),
    readMetaPropertyContent(html, "og:title"),
    readMetaPropertyContent(html, "og:description"),
    readMetaPropertyContent(html, "twitter:title"),
    readMetaPropertyContent(html, "twitter:description")
  ].filter(Boolean);

  return Array.from(new Set(fields)).join("\n");
}

function readMetaContent(html: string, name: string): string {
  const pattern = new RegExp(`<meta[^>]+name=["']${escapeRegExp(name)}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  const match = pattern.exec(html);
  return match ? decodeHtml(match[1]).slice(0, 360) : "";
}

function readMetaPropertyContent(html: string, property: string): string {
  const pattern = new RegExp(`<meta[^>]+property=["']${escapeRegExp(property)}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  const match = pattern.exec(html);
  return match ? decodeHtml(match[1]).slice(0, 360) : "";
}

function htmlToText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function readTaggedText(html: string, tagExpression: string, limit: number): string[] {
  const pattern = new RegExp(`<(${tagExpression})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, "gi");
  const values: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) && values.length < limit) {
    const value = decodeHtml(stripTags(match[2]));

    if (value && !values.includes(value)) {
      values.push(value);
    }
  }

  return values;
}

function readInputs(html: string, limit: number): Array<{ label: string; type: string; name: string }> {
  const pattern = /<(input|textarea|select)\b([^>]*)>/gi;
  const values: Array<{ label: string; type: string; name: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) && values.length < limit) {
    const attrs = match[2];
    const label = readAttribute(attrs, "aria-label") || readAttribute(attrs, "placeholder") || readAttribute(attrs, "title");
    const type = readAttribute(attrs, "type") || match[1].toLowerCase();
    const name = readAttribute(attrs, "name") || readAttribute(attrs, "id");

    if (label || name) {
      values.push({ label, type, name });
    }
  }

  return values;
}

function readLinks(html: string, baseUrl: string, limit: number): Array<{ text: string; url: string }> {
  const pattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const values: Array<{ text: string; url: string }> = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) && values.length < limit) {
    const href = readAttribute(match[1], "href");
    const text = decodeHtml(stripTags(match[2])).slice(0, 180);

    if (!href || !text) {
      continue;
    }

    try {
      const url = new URL(href, baseUrl).toString();

      if (seen.has(url)) {
        continue;
      }

      seen.add(url);
      values.push({ text, url });
    } catch {
      continue;
    }
  }

  return values;
}

function readAttribute(attributes: string, name: string): string {
  const pattern = new RegExp(`${escapeRegExp(name)}\\s*=\\s*["']([^"']*)["']`, "i");
  const match = pattern.exec(attributes);
  return match ? decodeHtml(match[1]).slice(0, 220) : "";
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"'
  };

  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, entity: string) => named[entity.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeResultUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return value.trim();
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
