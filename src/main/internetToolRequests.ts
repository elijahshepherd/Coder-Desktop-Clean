import type { InternetToolActivity, ToolMetric, WebSearchResult } from "../shared/types";
import { extractCoderToolPayloads } from "./coderToolMarkup";
import type { WebBatchFetchResponse, WebFetchResponse, WebScreenPullResponse, WebSearchResponse } from "./internetTools";

export type InternetToolRequestType = "web-search" | "web-fetch" | "web-batch-fetch" | "web-screen-pull";

export interface InternetToolRequest {
  type: InternetToolRequestType;
  query?: string;
  url?: string;
  urls?: string[];
  reason?: string;
}

export interface InternetToolPlan {
  request: InternetToolRequest;
  activity: InternetToolActivity;
}

const requestTypes = new Set<InternetToolRequestType>(["web-search", "web-fetch", "web-batch-fetch", "web-screen-pull"]);

export function detectInternetToolPlan(content: string): InternetToolPlan | null {
  const urlMatches = Array.from(content.matchAll(/\bhttps?:\/\/[^\s<>"']+/gi), (match) => match[0].replace(/[),.;]+$/, ""));

  const explicitUrlRead = /\b(read|fetch|open|check|inspect|summarize|summarise|look\s+at|pull|extract|scan)\b/i.test(content);

  if (urlMatches.length > 1 && explicitUrlRead) {
    const request: InternetToolRequest = {
      type: "web-batch-fetch",
      urls: urlMatches,
      reason: createUrlReadReason(normalizedContentWithoutUrls(content), "Read the web pages the user asked about")
    };

    return {
      request,
      activity: createInternetToolActivity(request)
    };
  }

  const urlMatch = urlMatches[0];

  if (urlMatch && explicitUrlRead) {
    const request: InternetToolRequest = {
      type: /\b(screen\s*pull|pull screen|extract page|buttons?|inputs?|elements?)\b/i.test(content) ? "web-screen-pull" : "web-fetch",
      url: urlMatch,
      reason: createUrlReadReason(normalizedContentWithoutUrls(content), "Read the web page the user asked about")
    };

    return {
      request,
      activity: createInternetToolActivity(request)
    };
  }

  const normalized = content.replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();
  const asksForSearch = /\b(search|look up|lookup|research|find|check|docs|documentation|download|specs|requirements)\b/i.test(normalized);
  const asksForOrigin =
    /\b(where\s+(does|did|is).{0,90}(come\s+from|from)|what\s+(is|was).{0,90}(from|source)|source\s+of|origin\s+of|line\s+from|quote\s+from|lyric|lyrics|song|movie|video|clip|meme)\b/i.test(
      normalized
    );
  const asksForGitSource =
    /\b(use\s+git|git\s+(grep|log|blame|show|search|find)|github\s+(search|repo|repository|code|file|release)|find.{0,50}(github|repo|repository))\b/i.test(
      normalized
    );

  if (
    !asksForOrigin &&
    !asksForGitSource &&
    !(
      asksForSearch &&
      /\b(official|docs|documentation|download|release|github|repository|repo|specs|requirements|minimum|recommended|game|application|app|install|quote|lyric|lyrics|origin|source)\b/i.test(
        normalized
      )
    )
  ) {
    return null;
  }

  const request: InternetToolRequest = {
    type: "web-search",
    query: createImplicitSearchQuery(normalized, lower).slice(0, 220),
    reason: "Search the web for the information the user requested"
  };

  return {
    request,
    activity: createInternetToolActivity(request)
  };
}

function createImplicitSearchQuery(normalized: string, lower: string): string {
  const quoted = extractQuotedPhrase(normalized);

  if (quoted && /\b(where|from|source|origin|line|quote|lyric|lyrics|song|movie|video|clip|meme)\b/i.test(normalized)) {
    return `"${quoted}" source origin`;
  }

  if (/\b(use\s+git|git\s+(grep|log|blame|show|search|find)|github)\b/i.test(lower)) {
    return `${normalized} GitHub source code repository`;
  }

  return normalized;
}

function normalizedContentWithoutUrls(content: string): string {
  return content
    .replace(/\bhttps?:\/\/[^\s<>"']+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createUrlReadReason(textWithoutUrls: string, fallback: string): string {
  const cleaned = textWithoutUrls
    .replace(/\b(read|fetch|open|check|inspect|summarize|summarise|look\s+at|pull|extract|scan)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 8) {
    return fallback;
  }

  return `Read ${cleaned.slice(0, 180)}`;
}

function extractQuotedPhrase(value: string): string | null {
  const match = /["\u201c\u201d]([^"\u201c\u201d]{6,220})["\u201c\u201d]/.exec(value);
  const phrase = match?.[1]?.replace(/\s+/g, " ").trim();
  return phrase || null;
}

export function parseInternetToolRequests(content: string): InternetToolPlan[] {
  const plans: InternetToolPlan[] = [];

  for (const payload of extractCoderToolPayloads(content)) {
    try {
      const request = normalizeRequest(JSON.parse(payload) as Record<string, unknown>);

      if (request) {
        plans.push({
          request,
          activity: createInternetToolActivity(request)
        });
      }
    } catch {
      continue;
    }
  }

  return plans;
}

export function createInternetToolActivity(request: InternetToolRequest): InternetToolActivity {
  const description = request.reason || defaultDescription(request);

  if (request.type === "web-search") {
    return {
      kind: "web-search",
      title: "Searching the web",
      description,
      group: "Internet",
      query: request.query?.trim()
    };
  }

  if (request.type === "web-batch-fetch") {
    return {
      kind: "web-batch-fetch",
      title: "Reading web pages",
      description,
      group: "Internet",
      urls: request.urls?.map((url) => url.trim()).filter(Boolean)
    };
  }

  if (request.type === "web-screen-pull") {
    return {
      kind: "web-screen-pull",
      title: "Pulling screen content",
      description,
      group: "Internet",
      url: request.url?.trim()
    };
  }

  return {
    kind: "web-fetch",
    title: "Reading web page",
    description,
    group: "Internet",
    url: request.url?.trim()
  };
}

export function completeWebSearchActivity(activity: InternetToolActivity, response: WebSearchResponse): InternetToolActivity {
  return {
    ...activity,
    title: "Searched sources",
    query: response.query,
    results: response.results,
    metrics: [
      {
        label: "Results",
        value: String(response.results.length)
      }
    ],
    preview: formatSearchResults(response.results)
  };
}

export function completeWebFetchActivity(activity: InternetToolActivity, response: WebFetchResponse): InternetToolActivity {
  const metrics: ToolMetric[] = [
    {
      label: "Characters",
      value: String(response.content.length)
    }
  ];

  return {
    ...activity,
    title: "Read web page",
    url: response.url,
    metrics,
    preview: [`${response.title}`, response.url, "", response.content].join("\n").slice(0, 8_000)
  };
}

export function completeWebBatchFetchActivity(activity: InternetToolActivity, response: WebBatchFetchResponse): InternetToolActivity {
  const metrics: ToolMetric[] = [
    {
      label: "Pages",
      value: String(response.pages.length)
    }
  ];

  return {
    ...activity,
    title: "Read web pages",
    urls: response.pages.map((page) => page.url),
    metrics,
    preview: response.pages
      .map((page, index) => [`Page ${index + 1}: ${page.title}`, page.url, "", page.content].join("\n"))
      .join("\n\n")
      .slice(0, 12_000)
  };
}

export function completeWebScreenPullActivity(activity: InternetToolActivity, response: WebScreenPullResponse): InternetToolActivity {
  const metrics: ToolMetric[] = [
    {
      label: "Characters",
      value: String(response.content.length)
    }
  ];

  return {
    ...activity,
    title: "Pulled screen content",
    url: response.url,
    metrics,
    preview: [`${response.title}`, response.url, "", response.content].join("\n").slice(0, 12_000)
  };
}

export function formatInternetToolContent(activity: InternetToolActivity): string {
  const target = activity.query || activity.url || activity.urls?.join(", ") || "";
  const output = activity.preview || formatSearchResults(activity.results ?? []);

  return [
    `Internet activity: ${activity.title}`,
    `Target: ${target}`,
    `Status: ${activity.preview || activity.results ? "complete" : "running"}`,
    output ? `Result:\n${output.slice(0, 8_000)}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeRequest(input: Record<string, unknown>): InternetToolRequest | null {
  if (typeof input.type !== "string" || !requestTypes.has(input.type as InternetToolRequestType)) {
    return null;
  }

  const request: InternetToolRequest = {
    type: input.type as InternetToolRequestType,
    query: typeof input.query === "string" ? input.query.trim() : undefined,
    url: typeof input.url === "string" ? input.url.trim() : undefined,
    urls: Array.isArray(input.urls)
      ? input.urls.filter((url): url is string => typeof url === "string").map((url) => url.trim()).filter(Boolean).slice(0, 8)
      : undefined,
    reason: typeof input.reason === "string" ? input.reason.trim().slice(0, 220) : undefined
  };

  if (request.type === "web-search" && !request.query) {
    return null;
  }

  if (request.type === "web-fetch" && !request.url) {
    return null;
  }

  if (request.type === "web-batch-fetch" && !request.urls?.length) {
    return null;
  }

  if (request.type === "web-screen-pull" && !request.url) {
    return null;
  }

  return request;
}

function defaultDescription(request: InternetToolRequest): string {
  switch (request.type) {
    case "web-search":
      return "Searching public web results for the requested information.";
    case "web-batch-fetch":
      return "Fetching and summarizing public web pages.";
    case "web-screen-pull":
      return "Extracting text, links, controls, and page structure from a public web page.";
    case "web-fetch":
    default:
      return "Fetching and summarizing a public web page.";
  }
}

function formatSearchResults(results: WebSearchResult[]): string {
  if (results.length === 0) {
    return "No search results were returned.";
  }

  return results
    .map((result, index) => {
      const snippet = result.snippet ? `\n${result.snippet}` : "";
      return `${index + 1}. ${result.title}\n${result.url}${snippet}`;
    })
    .join("\n\n");
}
