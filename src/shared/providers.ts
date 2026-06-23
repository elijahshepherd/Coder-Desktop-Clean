import type { ProviderId } from "./types";

export const providerIds = ["openai", "claude", "nvidia"] as const satisfies readonly ProviderId[];

export const providerLabels: Record<ProviderId, string> = {
  openai: "OpenAI",
  claude: "Claude",
  nvidia: "NVIDIA"
};

const localHttpHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && providerIds.includes(value as ProviderId);
}

export function sanitizeText(value: unknown, fallback: string, maxLength: number): string {
  const trimmed = typeof value === "string" ? value.replace(/\0/g, "").trim() : "";
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

export function normalizeProviderBaseUrl(value: unknown): string | null {
  const trimmed = sanitizeText(value, "", 300);

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    if (url.protocol === "http:" && !localHttpHosts.has(url.hostname)) {
      return null;
    }

    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function sanitizeProviderBaseUrl(value: unknown, fallback: string): string {
  return normalizeProviderBaseUrl(value) ?? fallback;
}
