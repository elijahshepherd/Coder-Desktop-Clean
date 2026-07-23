import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  AppState,
  BugReportRequest,
  DesktopApi,
  MessageFeedbackRequest,
  ProviderId,
  ProviderTestProgress,
  ProviderSettings,
  SaveGeneratedImageRequest,
  SaveGeneratedImageResult,
  SecuritySettings,
  UpdateInfo,
  UpdateProgress,
  UserProfile
} from "../shared/types";

const api: DesktopApi = {
  getState: () => ipcRenderer.invoke("app:get-state"),
  createChat: () => ipcRenderer.invoke("chat:create"),
  markStarterCardSeen: () => ipcRenderer.invoke("starter:mark-seen"),
  deleteChat: (chatId) => ipcRenderer.invoke("chat:delete", chatId),
  setActiveChat: (chatId) => ipcRenderer.invoke("chat:set-active", chatId),
  sendMessage: (chatId, content) => ipcRenderer.invoke("chat:send", chatId, content),
  cancelChat: (chatId) => ipcRenderer.invoke("chat:cancel", chatId),
  resolveApproval: (chatId, messageId, approved) => ipcRenderer.invoke("chat:resolve-approval", chatId, messageId, approved),
  submitMessageFeedback: (request: MessageFeedbackRequest) => ipcRenderer.invoke("feedback:submit", request),
  updateProviders: (providers: ProviderSettings) => ipcRenderer.invoke("providers:update", providers),
  validateProviders: () => ipcRenderer.invoke("providers:validate"),
  scanImageModels: (provider: ProviderId) => ipcRenderer.invoke("providers:scan-image-models", provider),
  runProviderTest: () => ipcRenderer.invoke("providers:test"),
  updateProfile: (profile: Partial<UserProfile>) => ipcRenderer.invoke("profile:update", profile),
  updatePersonalization: (personalization) => ipcRenderer.invoke("personalization:update", personalization),
  updateAiFunctionality: (settings) => ipcRenderer.invoke("ai-functionality:update", settings),
  updateSecurity: (security: SecuritySettings) => ipcRenderer.invoke("security:update", security),
  notifyChatComplete: (title, body) => ipcRenderer.invoke("notifications:chat-complete", title, body),
  createGeneratedImageLink: (dataUrl) => ipcRenderer.invoke("images:create-link", dataUrl),
  saveGeneratedImage: (request: SaveGeneratedImageRequest): Promise<SaveGeneratedImageResult> =>
    ipcRenderer.invoke("images:save-to-disk", request),
  reportBug: (request: BugReportRequest) => ipcRenderer.invoke("bugs:report", request),
  resetLocalData: () => ipcRenderer.invoke("maintenance:reset-local-data"),
  reinstallCurrentVersion: () => ipcRenderer.invoke("maintenance:reinstall-current"),
  selectWorkspace: () => ipcRenderer.invoke("workspace:select"),
  listFiles: () => ipcRenderer.invoke("files:list"),
  readFile: (relativePath) => ipcRenderer.invoke("files:read", relativePath),
  previewDiff: (relativePath, nextContent) => ipcRenderer.invoke("files:preview-diff", relativePath, nextContent),
  writeFile: (relativePath, nextContent) => ipcRenderer.invoke("files:write", relativePath, nextContent),
  createFolder: (relativePath) => ipcRenderer.invoke("folders:create", relativePath),
  deleteFile: (relativePath) => ipcRenderer.invoke("files:delete", relativePath),
  deleteFolder: (relativePath) => ipcRenderer.invoke("folders:delete", relativePath),
  runCommand: (command) => ipcRenderer.invoke("shell:run", command),
  checkForUpdate: () => ipcRenderer.invoke("updates:check"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
    forceUninstall: (confirm: boolean) => ipcRenderer.invoke("app:force-uninstall", confirm),
    onStateChanged: (listener) => {
    const handler = (_event: IpcRendererEvent, state: AppState): void => listener(state);
    ipcRenderer.on("app:state-changed", handler);
    return () => ipcRenderer.removeListener("app:state-changed", handler);
  },
  onUpdateAvailable: (listener) => {
    const handler = (_event: IpcRendererEvent, update: UpdateInfo): void => listener(update);
    ipcRenderer.on("updates:available", handler);
    return () => ipcRenderer.removeListener("updates:available", handler);
  },
  onUpdateProgress: (listener) => {
    const handler = (_event: IpcRendererEvent, progress: UpdateProgress): void => listener(progress);
    ipcRenderer.on("updates:progress", handler);
    return () => ipcRenderer.removeListener("updates:progress", handler);
  },
  onProviderTestProgress: (listener) => {
    const handler = (_event: IpcRendererEvent, progress: ProviderTestProgress): void => listener(progress);
    ipcRenderer.on("providers:test-progress", handler);
    return () => ipcRenderer.removeListener("providers:test-progress", handler);
  }
};

contextBridge.exposeInMainWorld("coderDesktop", api);
