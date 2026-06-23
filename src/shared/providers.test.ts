import { describe, expect, it } from "vitest";
import { isProviderId, normalizeProviderBaseUrl, sanitizeProviderBaseUrl, sanitizeText } from "./providers";

describe("provider helpers", () => {
  it("identifies supported providers", () => {
    expect(isProviderId("openai")).toBe(true);
    expect(isProviderId("claude")).toBe(true);
    expect(isProviderId("nvidia")).toBe(true);
    expect(isProviderId("other")).toBe(false);
  });

  it("normalizes safe provider URLs", () => {
    expect(normalizeProviderBaseUrl("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1");
    expect(normalizeProviderBaseUrl("http://localhost:11434/v1/")).toBe("http://localhost:11434/v1");
  });

  it("rejects unsafe provider URLs", () => {
    expect(normalizeProviderBaseUrl("file:///tmp/provider")).toBeNull();
    expect(normalizeProviderBaseUrl("http://example.com/v1")).toBeNull();
    expect(sanitizeProviderBaseUrl("not a url", "https://fallback.example/v1")).toBe("https://fallback.example/v1");
  });

  it("sanitizes plain text values", () => {
    expect(sanitizeText("  model-name\0  ", "fallback", 20)).toBe("model-name");
    expect(sanitizeText("abcdefghijklmnopqrstuvwxyz", "fallback", 5)).toBe("abcde");
    expect(sanitizeText(undefined, "fallback", 20)).toBe("fallback");
  });
});
