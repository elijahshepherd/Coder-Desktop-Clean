import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchManyWebContents, fetchWebContent, searchWeb } from "./internetTools";
import type { SecuritySettings } from "../shared/types";

const security: SecuritySettings = {
  accessMode: "full",
  allowFileRead: true,
  allowFileEdit: true,
  allowShellExecute: true,
  allowInternetAccess: true,
  requirePermissionPrompts: false,
  autoContinueOnProviderError: true,
  showMessageIdentity: false
};

describe("internet tools", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps searching when public result pages fail", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await searchWeb(security, "use git find source file");

    expect(response.results.some((result) => result.title === "GitHub code search")).toBe(true);
    expect(response.results.some((result) => result.title === "GitHub repository search")).toBe(true);
  });

  it("tries raw GitHub files when a GitHub blob page is not readable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(new Response("# Readme\n\nReal repository text.", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWebContent(security, "https://github.com/example/repo/blob/main/README.md");

    expect(response.content).toContain("Real repository text");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("https://raw.githubusercontent.com/example/repo/main/README.md");
  });

  it("keeps batch page reads useful when one page fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("<title>Good</title><p>Readable page</p>", { status: 200 }))
      .mockRejectedValueOnce(new Error("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchManyWebContents(security, ["https://example.test/good", "https://example.test/blocked"]);

    expect(response.pages[0]?.content).toContain("Readable page");
    expect(response.pages[1]?.content).toContain("not readable from this computer");
    expect(response.pages[1]?.content).not.toContain("fetch failed");
  });
});
