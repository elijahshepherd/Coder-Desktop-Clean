import { describe, expect, it } from "vitest";
import { isPathInsideWorkspace, resolveWorkspacePath } from "./workspace";

describe("working path resolution", () => {
  it("still identifies paths inside the preferred folder", () => {
    const root = "C:/projects/coder";

    expect(isPathInsideWorkspace(root, "C:/projects/coder/src/App.tsx")).toBe(true);
  });

  it("still identifies sibling paths outside the preferred folder", () => {
    const root = "C:/projects/coder";

    expect(isPathInsideWorkspace(root, "C:/projects/coder-backup/secrets.txt")).toBe(false);
  });

  it("blocks relative traversal outside the preferred folder", () => {
    const root = "C:/projects/coder";

    expect(() => resolveWorkspacePath(root, "../secrets.txt")).toThrow("outside the selected workspace");
  });

  it("keeps absolute paths only when they are inside the preferred folder", () => {
    expect(resolveWorkspacePath("C:/projects/coder", "C:/projects/coder/src/App.tsx").replace(/\\/g, "/")).toBe(
      "C:/projects/coder/src/App.tsx"
    );
    expect(() => resolveWorkspacePath("C:/projects/coder", "D:/Scratch/file.txt")).toThrow("outside the selected workspace");
  });
});
