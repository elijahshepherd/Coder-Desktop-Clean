import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  generatedImageScheme,
  persistGeneratedImageDataUrl,
  persistGeneratedImagesInActivity,
  resolveGeneratedImagePath
} from "./generatedImages";
import type { ImageGenerationActivity } from "../shared/types";

describe("generated image links", () => {
  it("persists data URLs and returns a short local app link", async () => {
    const dataPath = await mkdtemp(path.join(os.tmpdir(), "coder-images-"));

    try {
      const dataUrl = `data:image/png;base64,${Buffer.from("fake png").toString("base64")}`;
      const url = await persistGeneratedImageDataUrl(dataPath, dataUrl);
      const filePath = resolveGeneratedImagePath(dataPath, url);

      expect(url).toMatch(new RegExp(`^${generatedImageScheme}://generated/[a-f0-9]{16}\\.png$`));
      await expect(readFile(filePath, "utf8")).resolves.toBe("fake png");
    } finally {
      await rm(dataPath, { recursive: true, force: true });
    }
  });

  it("updates completed image activities with short links", async () => {
    const dataPath = await mkdtemp(path.join(os.tmpdir(), "coder-images-"));

    try {
      const activity: ImageGenerationActivity = {
        kind: "image-generation",
        title: "Image ready",
        description: "Created one generated image.",
        group: "Images",
        provider: "nvidia",
        model: "black-forest-labs/flux_1-schnell",
        prompt: "A sharp app icon",
        image: {
          dataUrl: `data:image/webp;base64,${Buffer.from("fake webp").toString("base64")}`
        },
        images: [
          {
            dataUrl: `data:image/webp;base64,${Buffer.from("fake webp").toString("base64")}`
          }
        ]
      };

      const persisted = await persistGeneratedImagesInActivity(dataPath, activity);

      expect(persisted.image?.url).toMatch(new RegExp(`^${generatedImageScheme}://generated/[a-f0-9]{16}\\.webp$`));
      expect(persisted.image?.shortUrl).toBe(persisted.image?.url);
      expect(persisted.images?.[0]?.url).toBe(persisted.image?.url);
    } finally {
      await rm(dataPath, { recursive: true, force: true });
    }
  });

  it("rejects generated image links outside the app-owned image directory", async () => {
    expect(() => resolveGeneratedImagePath(os.tmpdir(), "coder-image://generated/../../secret.png")).toThrow(
      "generated image file name"
    );
    await expect(persistGeneratedImageDataUrl(os.tmpdir(), "data:text/plain;base64,aGVsbG8=")).rejects.toThrow(
      "supported image data URL"
    );
  });
});
