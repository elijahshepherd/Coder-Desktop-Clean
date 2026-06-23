import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GeneratedImage, ImageGenerationActivity } from "../shared/types";

export const generatedImageScheme = "coder-image";
const generatedImageHost = "generated";
const maxGeneratedImageBytes = 24 * 1024 * 1024;
export async function persistGeneratedImageDataUrl(dataPath: string, dataUrl: string): Promise<string> {
  const parsed = parseImageDataUrl(dataUrl);
  const hash = createHash("sha256").update(parsed.mimeType).update(parsed.base64).digest("hex").slice(0, 16);
  const fileName = `${hash}.${extensionForMimeType(parsed.mimeType)}`;
  const imageDirectory = getGeneratedImageDirectory(dataPath);
  const filePath = path.join(imageDirectory, fileName);

  await mkdir(imageDirectory, { recursive: true });
  await writeFile(filePath, Buffer.from(parsed.base64, "base64"), { flag: "wx" }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") {
      throw error;
    }
  });

  return createGeneratedImageUrl(fileName);
}

export async function persistGeneratedImagesInActivity(
  dataPath: string,
  activity: ImageGenerationActivity
): Promise<ImageGenerationActivity> {
  const images = activity.images?.length ? activity.images : activity.image ? [activity.image] : [];

  if (!images.length) {
    return activity;
  }

  const persistedImages = await Promise.all(images.map((image) => persistGeneratedImage(dataPath, image)));

  return {
    ...activity,
    image: persistedImages[0],
    images: persistedImages
  };
}

export function resolveGeneratedImagePath(dataPath: string, url: string): string {
  const parsed = new URL(url);

  if (parsed.protocol !== `${generatedImageScheme}:` || parsed.hostname !== generatedImageHost) {
    throw new Error("The generated image link is not valid.");
  }

  const fileName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));

  if (!/^[a-f0-9]{16}\.(?:png|jpg|jpeg|webp|gif)$/i.test(fileName)) {
    throw new Error("The generated image file name is not valid.");
  }

  return path.join(getGeneratedImageDirectory(dataPath), fileName);
}

async function persistGeneratedImage(dataPath: string, image: GeneratedImage): Promise<GeneratedImage> {
  const existingShortUrl = image.shortUrl || (image.url?.startsWith(`${generatedImageScheme}://`) ? image.url : undefined);

  if (existingShortUrl) {
    return {
      ...image,
      shortUrl: existingShortUrl,
      url: existingShortUrl
    };
  }

  if (!image.dataUrl) {
    return image;
  }

  const shortUrl = await persistGeneratedImageDataUrl(dataPath, image.dataUrl);

  return {
    ...image,
    shortUrl,
    url: shortUrl
  };
}

function parseImageDataUrl(dataUrl: string): { base64: string; mimeType: string } {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl.trim());

  if (!match) {
    throw new Error("Generated image data was not a supported image data URL.");
  }

  const base64 = match[2].replace(/\s+/g, "");
  const byteLength = Math.floor((base64.length * 3) / 4);

  if (byteLength > maxGeneratedImageBytes) {
    throw new Error("Generated image data is too large to save as a short link.");
  }

  return {
    mimeType: match[1].toLowerCase().replace("image/jpg", "image/jpeg"),
    base64
  };
}

function getGeneratedImageDirectory(dataPath: string): string {
  return path.join(dataPath, "generated-images");
}

function createGeneratedImageUrl(fileName: string): string {
  return `${generatedImageScheme}://${generatedImageHost}/${encodeURIComponent(fileName)}`;
}

function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/png":
    default:
      return "png";
  }
}

export interface SaveGeneratedImageRequest {
  dataUrl: string;
  suggestedName: string;
}

export interface SaveGeneratedImageResult {
  ok: boolean;
  filePath?: string;
  revealed: boolean;
  message?: string;
}

export async function saveGeneratedImageToFile(
  downloadsDirectory: string,
  request: SaveGeneratedImageRequest
): Promise<SaveGeneratedImageResult> {
  const parsed = parseImageDataUrl(request.dataUrl);
  const safeName = sanitizeFileName(request.suggestedName) || `coder-desktop-image.${extensionForMimeType(parsed.mimeType)}`;
  const targetDirectory = downloadsDirectory || path.dirname(safeName);
  await mkdir(targetDirectory, { recursive: true });
  const filePath = path.join(targetDirectory, safeName);

  await writeFile(filePath, Buffer.from(parsed.base64, "base64"));

  return {
    ok: true,
    filePath,
    revealed: false
  };
}

export async function saveGeneratedImageWithDialog(
  downloadsDirectory: string,
  request: SaveGeneratedImageRequest
): Promise<SaveGeneratedImageResult> {
  const parsed = parseImageDataUrl(request.dataUrl);
  const safeName = sanitizeFileName(request.suggestedName) || `coder-desktop-image.${extensionForMimeType(parsed.mimeType)}`;
  const { dialog, shell } = await import("electron");

  const dialogResult = await dialog.showSaveDialog({
    title: "Save generated image",
    defaultPath: path.join(downloadsDirectory || "", safeName),
    filters: buildDialogFilters(parsed.mimeType)
  });

  if (dialogResult.canceled || !dialogResult.filePath) {
    return { ok: false, revealed: false, message: "Save cancelled." };
  }

  await mkdir(path.dirname(dialogResult.filePath), { recursive: true });
  await writeFile(dialogResult.filePath, Buffer.from(parsed.base64, "base64"));

  let revealed = false;
  try {
    shell.showItemInFolder(dialogResult.filePath);
    revealed = true;
  } catch {
    revealed = false;
  }

  return {
    ok: true,
    filePath: dialogResult.filePath,
    revealed
  };
}

function buildDialogFilters(mimeType: string): Array<{ name: string; extensions: string[] }> {
  const extension = extensionForMimeType(mimeType);
  const filters: Array<{ name: string; extensions: string[] }> = [];

  switch (mimeType) {
    case "image/jpeg":
      filters.push({ name: "JPEG image", extensions: ["jpg", "jpeg"] });
      break;
    case "image/webp":
      filters.push({ name: "WebP image", extensions: ["webp"] });
      break;
    case "image/gif":
      filters.push({ name: "GIF image", extensions: ["gif"] });
      break;
    case "image/png":
    default:
      filters.push({ name: "PNG image", extensions: ["png"] });
      break;
  }

  filters.push({ name: "All files", extensions: ["*"] });
  return filters;
}

function sanitizeFileName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
