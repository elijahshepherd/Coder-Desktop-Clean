import { CheckCircle2, ChevronDown, Download, Pencil, Sparkles, XCircle, ImageIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ImageGenerationActivity, PersonalizationSettings } from "../../shared/types";
import { desktopApi } from "../api/desktopApi";
import { BlackAndWhiteSpewsAnimation } from "./BlackAndWhiteSpewsAnimation";

interface ImageGenerationCardProps {
  activity: ImageGenerationActivity;
  personalization?: PersonalizationSettings;
  status?: "complete" | "thinking" | "error";
  onEditImage?: (context: EditImageContext) => void;
}

export interface EditImageContext {
  sourceImageDataUrl: string;
  sourcePrompt: string;
  sourceTitle: string;
  sourceProvider: string;
  sourceModel: string;
  revisedPrompt?: string;
}

export function ImageGenerationCard({
  activity,
  personalization,
  status = "complete",
  onEditImage
}: ImageGenerationCardProps) {
  const isThinking = status === "thinking" && !activity.image && !activity.error;
  const isError = status === "error" || Boolean(activity.error);
  const images = activity.images?.length ? activity.images : activity.image ? [activity.image] : [];
  const collapseByDefault = personalization?.autoCollapseImageCards ?? true;
  const [expanded, setExpanded] = useState(!collapseByDefault);

  useEffect(() => {
    setExpanded(!collapseByDefault);
  }, [collapseByDefault]);

  if (isThinking) {
    return (
      <section className="image-generation-card thinking full-stage">
        <BlackAndWhiteSpewsAnimation />
        <div className="full-stage-caption">
          <span className="image-card-icon" aria-hidden="true">
            <Sparkles size={16} />
          </span>
          <div>
            <h3>{activity.title}</h3>
            <p>{activity.description}</p>
            <p className="full-stage-progress">Generating image...</p>
          </div>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="image-generation-card error error-stage">
        <div className="error-stage-content">
          <span className="image-card-icon" aria-hidden="true">
            <XCircle size={16} />
          </span>
          <div>
            <h3>{activity.title}</h3>
            <p>{activity.description}</p>
            {activity.error ? <p className="image-card-error">{activity.error}</p> : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="image-generation-card">
      <header>
        <span className="image-card-icon" aria-hidden="true">
          {images.length > 0 ? <CheckCircle2 size={16} /> : <ImageIcon size={16} />}
        </span>
        <div>
          <h3>{activity.title}</h3>
          <p>{activity.description}</p>
        </div>
        {images.length > 0 ? (
          <button
            className="primary-button image-card-toggle"
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? "Hide generated images" : "Show generated images"}
            onClick={() => setExpanded((current) => !current)}
          >
            <ChevronDown size={14} aria-hidden="true" />
            {expanded ? "Hide" : "Show"}
          </button>
        ) : null}
      </header>

      {images.length && expanded ? (
        <div className={images.length > 1 ? "generated-image-grid multiple" : "generated-image-grid"}>
          {images.map((image, index) => {
            return (
              <GeneratedImageFrame
                activity={activity}
                image={image}
                imageCount={images.length}
                index={index}
                key={`${image.model ?? activity.model}-${index}`}
                onEditImage={onEditImage}
                upscaleEnabled={personalization?.autoUpscaleGeneratedImages ?? false}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function GeneratedImageFrame({
  activity,
  image,
  imageCount,
  index,
  onEditImage,
  upscaleEnabled
}: {
  activity: ImageGenerationActivity;
  image: NonNullable<ImageGenerationActivity["images"]>[number];
  imageCount: number;
  index: number;
  onEditImage?: (context: EditImageContext) => void;
  upscaleEnabled: boolean;
}) {
  const blobUrl = useImageBlobUrl(image.dataUrl);
  const displayUrl = useUpscaledBlobUrl(image.dataUrl, upscaleEnabled ? 4 : 1);
  const imageSource = blobUrl ?? image.dataUrl ?? image.url ?? "";
  const shownSource = displayUrl ?? blobUrl ?? image.dataUrl ?? image.url ?? "";
  const [downloadState, setDownloadState] = useState<"idle" | "downloading" | "saved" | "failed">("idle");

  useEffect(() => {
    if (downloadState === "idle" || downloadState === "failed") {
      return undefined;
    }
    const resetTimer = window.setTimeout(() => setDownloadState("idle"), 1800);
    return () => window.clearTimeout(resetTimer);
  }, [downloadState]);

  if (!imageSource) {
    return null;
  }

  const caption = image.revisedPrompt || (imageCount > 1 ? `Generated image ${index + 1}` : "Image generated from the chat prompt.");
  const downloadName = buildDownloadName(activity, image, imageCount, index);

  const onDownload = async () => {
    if (!image.dataUrl) {
      setDownloadState("failed");
      return;
    }
    setDownloadState("downloading");
    try {
      const result = await desktopApi.saveGeneratedImage({
        dataUrl: image.dataUrl,
        suggestedName: downloadName
      });
      setDownloadState(result.ok ? "saved" : "failed");
    } catch {
      setDownloadState("failed");
    }
  };

  const onEdit = () => {
    if (!onEditImage || !image.dataUrl) {
      return;
    }
    onEditImage({
      sourceImageDataUrl: image.dataUrl,
      sourcePrompt: activity.prompt,
      sourceTitle: activity.title,
      sourceProvider: activity.providerLabel,
      sourceModel: activity.model,
      revisedPrompt: image.revisedPrompt
    });
  };

  const downloadLabel =
    downloadState === "downloading"
      ? "Saving"
      : downloadState === "saved"
        ? "Saved"
        : downloadState === "failed"
          ? "Retry download"
          : "Download";

  return (
    <figure className="generated-image-frame">
      <img src={shownSource} alt={image.revisedPrompt || activity.prompt} />
      <figcaption>
        <span>{caption}</span>
        <div className="generated-image-actions">
          <button
            className="primary-button image-action"
            type="button"
            aria-label="Edit this image with the same provider and a new prompt"
            title="Edit image"
            onClick={onEdit}
            disabled={!image.dataUrl}
          >
            <Pencil size={18} aria-hidden="true" />
            <span>Edit</span>
          </button>
          <button
            className={`copy-button image-action${downloadState === "saved" ? " copied" : ""}${
              downloadState === "downloading" ? " is-busy" : ""
            }${downloadState === "failed" ? " is-failed" : ""}`}
            type="button"
            aria-label={downloadLabel}
            title={downloadLabel}
            onClick={onDownload}
            disabled={downloadState === "downloading"}
          >
            <Download size={18} aria-hidden="true" />
            <span>{downloadLabel}</span>
          </button>
        </div>
      </figcaption>
    </figure>
  );
}

function buildDownloadName(
  activity: ImageGenerationActivity,
  image: NonNullable<ImageGenerationActivity["images"]>[number],
  imageCount: number,
  index: number
): string {
  const base =
    activity.title?.trim() ||
    image.revisedPrompt?.trim() ||
    image.model ||
    activity.providerLabel ||
    "coder-desktop-image";
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 60) || "coder-desktop-image";
  const suffix = imageCount > 1 ? `-${index + 1}` : "";
  return `${slug}${suffix}.png`;
}

function useImageBlobUrl(dataUrl?: string): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    const nextBlobUrl = createBlobUrl(dataUrl);
    setBlobUrl(nextBlobUrl);
    return () => {
      if (nextBlobUrl) {
        URL.revokeObjectURL(nextBlobUrl);
      }
    };
  }, [dataUrl]);
  return blobUrl;
}

function useUpscaledBlobUrl(dataUrl: string | undefined, factor: number) {
  const [upscaledUrl, setUpscaledUrl] = useState<string | null>(null);
  const requestedScale = useMemo(() => Math.max(1, Math.round(factor)), [factor]);

  useEffect(() => {
    if (!dataUrl || requestedScale <= 1) {
      setUpscaledUrl(null);
      return undefined;
    }

    let cancelled = false;
    upsampleDataUrl(dataUrl, requestedScale)
      .then((url) => {
        if (!cancelled) {
          setUpscaledUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUpscaledUrl(null);
        }
      });

    return () => {
      cancelled = true;
      setUpscaledUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return current;
      });
    };
  }, [dataUrl, requestedScale]);

  return upscaledUrl;
}

async function upsampleDataUrl(dataUrl: string, factor: number): Promise<string | null> {
  if (!dataUrl.startsWith("data:image/") || typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return null;
  }

  const image = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const targetWidth = image.width * factor;
  const targetHeight = image.height * factor;
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, "image/png");
  });
}

function createBlobUrl(dataUrl?: string): string | null {
  if (!dataUrl?.startsWith("data:image/")) {
    return null;
  }
  try {
    const [metadata, encoded] = dataUrl.split(",", 2);
    const mime = metadata.match(/^data:([^;]+);base64$/)?.[1] ?? "image/png";
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch {
    return null;
  }
}
