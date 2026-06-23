import type { DesktopApi } from "../../shared/types";
import { createPreviewApi } from "./previewApi";

export const desktopApi: DesktopApi = window.coderDesktop ?? createPreviewApi();
