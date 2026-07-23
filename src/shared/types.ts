export type ProviderId = "openai" | "claude" | "nvidia";

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  status?: "complete" | "thinking" | "error";
  durationMs?: number;
  approvalRequest?: ApprovalRequest;
  feedback?: MessageFeedback;
  imageGeneration?: ImageGenerationActivity;
  toolActivity?: ToolActivity;
  todoProgress?: TodoProgress;
  questionSet?: QuestionSet;
  providerError?: ProviderError;
}

export interface ChatThread {
  id: string;
  title: string;
  provider: ProviderId;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ProviderConfig {
  enabled: boolean;
  model: string;
  fallbackModels?: string[];
  reasoningEffort?: ReasoningEffort;
  baseUrl: string;
  imageModel?: string;
  imageModels?: ImageModelOption[];
  imageModelScan?: ImageModelScanResult;
  apiKey?: string;
  hasApiKey?: boolean;
}

export type ReasoningEffort = "none" | "low" | "medium" | "high";

export type ProviderSettings = {
  activeProvider: ProviderId;
} & Record<ProviderId, ProviderConfig>;

export interface SecuritySettings {
  accessMode: AccessMode;
  allowFileRead: boolean;
  allowFileEdit: boolean;
  allowShellExecute: boolean;
  allowInternetAccess: boolean;
  requirePermissionPrompts: boolean;
  autoContinueOnProviderError: boolean;
  showMessageIdentity: boolean;
}

export type AccessMode = "ask-approval" | "approve" | "full";

export type AccentTone = "graphite" | "blue" | "green" | "rose" | "custom";
export type ThemeMode = "light" | "dark" | "system";

export interface PersonalizationSettings {
  theme: ThemeMode;
  accentTone: AccentTone;
  customAccentColor: string;
  completionAnimation: boolean;
  completionNotifications: boolean;
  nvidiaPreset: NidiaPresetId;
  autonomousImageGeneration: boolean;
  autoAcceptImageGeneration: boolean;
  autoUpscaleGeneratedImages: boolean;
  autoCollapseImageCards: boolean;
  clearLocalDataOnVersionUpdate: boolean;
}

export type NidiaPresetId = "manual" | "development" | "everyday";

export interface AiFunctionalitySettings {
  maxLetMeKnows: number;
}

export interface WorkspaceSettings {
  root: string | null;
  recentRoots: string[];
}

export interface MaintenanceState {
  esid: string;
  of: string;
  al: "ALL" | "Windows" | "macOS";
  note: string;
  issueNumber: number;
  createdAt: string;
}

export interface AppState {
  chats: ChatThread[];
  activeChatId: string | null;
  hasSeenStarterCard: boolean;
  lastVersion: string;
  maintenance: MaintenanceState | null;
  providers: ProviderSettings;
  profile: UserProfile;
  personalization: PersonalizationSettings;
  aiFunctionality: AiFunctionalitySettings;
  security: SecuritySettings;
  workspace: WorkspaceSettings;
}

export interface FileEntry {
  name: string;
  path: string;
  relativePath: string;
  type: "file" | "folder";
  size: number;
  updatedAt: string;
}

export interface DiffLine {
  id: string;
  type: "added" | "removed" | "unchanged";
  value: string;
}

export interface DiffPreview {
  path: string;
  lines: DiffLine[];
}

export interface ShellResult {
  command: string;
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface ToolMetric {
  label: string;
  value: string;
  tone?: "neutral" | "added" | "removed" | "danger";
}

export type TodoProgressStatus = "pending" | "active" | "done";

export interface TodoProgressItem {
  id: string;
  title: string;
  status: TodoProgressStatus;
}

export interface TodoProgress {
  id: string;
  title: string;
  items: TodoProgressItem[];
  updatedAt: string;
}

export interface QuestionOption {
  id: string;
  label: string;
  recommended?: boolean;
}

export interface QuestionItem {
  id: string;
  question: string;
  options: QuestionOption[];
  customPlaceholder?: string;
}

export interface QuestionSet {
  id: string;
  title: string;
  questions: QuestionItem[];
  createdAt: string;
}

export interface ProviderError {
  id: string;
  provider: ProviderId;
  providerLabel: string;
  model?: string;
  title: string;
  message: string;
  statusCode?: number;
  createdAt: string;
}

export type ApprovalRequestStatus = "pending" | "approved" | "denied";

export interface ApprovalInternetRequest {
  type: InternetToolKind;
  query?: string;
  url?: string;
  urls?: string[];
  reason?: string;
}

export interface ApprovalRequest {
  id: string;
  type: "internet";
  title: string;
  description: string;
  approveLabel: string;
  denyLabel: string;
  status: ApprovalRequestStatus;
  createdAt: string;
  internetRequest: ApprovalInternetRequest;
}

export interface ProviderDiagnostic {
  provider: ProviderId;
  providerLabel: string;
  status: "ok" | "warning" | "error";
  message: string;
  checkedAt: string;
  modelsChecked?: number;
}

export type FeedbackRating = "like" | "dislike";

export interface MessageFeedback {
  rating: FeedbackRating;
  note?: string;
  submittedAt: string;
  status: "queued" | "sent" | "failed";
  issueUrl?: string;
}

export interface MessageFeedbackRequest {
  chatId: string;
  messageId: string;
  rating: FeedbackRating;
  note?: string;
}

export type BugSeverity = "low" | "medium" | "high" | "critical";

export interface BugReportRequest {
  area: string;
  title: string;
  message: string;
  severity?: BugSeverity;
  source?: "automatic" | "manual" | "provider" | "health-scan";
  stack?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface BugReportResult {
  status: "queued" | "sent" | "skipped" | "failed";
  issueUrl?: string;
  message: string;
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

export type ProviderTestKind = "base-url" | "main-model" | "fallback-model" | "image-model";
export type ProviderTestStatus = "ok" | "failed" | "removed" | "skipped";

export interface ProviderTestFailure {
  provider: ProviderId;
  providerLabel: string;
  kind: ProviderTestKind;
  model?: string;
  statusCode?: number;
  message: string;
  removed: boolean;
}

export interface ProviderTestRemoval {
  provider: ProviderId;
  providerLabel: string;
  kind: "main-model" | "fallback-model" | "image-model" | "provider";
  model?: string;
  replacementModel?: string;
  message: string;
}

export interface ProviderTestProgress {
  checked: number;
  total: number;
  percent: number;
  message: string;
  provider?: ProviderId;
  kind?: ProviderTestKind;
}

export interface ProviderTestResult {
  checkedAt: string;
  failures: ProviderTestFailure[];
  message: string;
  providers: ProviderSettings;
  removals: ProviderTestRemoval[];
  report?: BugReportResult;
  status: "ok" | "fixed" | "warning";
}

export interface ImageModelOption {
  id: string;
  label: string;
  provider: ProviderId;
  source: "api" | "known" | "manual";
  quality: "fast" | "balanced" | "quality";
}

export interface ImageModelScanResult {
  provider: ProviderId;
  status: "ready" | "none" | "needs-key" | "error";
  message: string;
  models: ImageModelOption[];
  selectedModel?: string;
  checkedAt: string;
}

export interface UserProfile {
  onboardingCompleted: boolean;
  preferredName: string;
  workFocus?: string;
  interests?: string;
  styleNotes?: string;
  updatedAt: string;
}

export type WorkspaceToolKind =
  | "file-list"
  | "file-read"
  | "file-count"
  | "file-write"
  | "file-create"
  | "file-delete"
  | "folder-count"
  | "folder-create"
  | "folder-delete"
  | "line-count"
  | "shell-command";

export interface WorkspaceToolActivity {
  kind: WorkspaceToolKind;
  title: string;
  description: string;
  group: "Files" | "Folders" | "Shell";
  target?: string;
  command?: string;
  result?: ShellResult;
  diff?: DiffPreview;
  preview?: string;
  metrics?: ToolMetric[];
}

export interface WindowsPowerShellActivity {
  kind: "windows-ps-group";
  command: string;
  commandName: string;
  title: string;
  description: string;
  group: string;
  result?: ShellResult;
}

export type InternetToolKind = "web-search" | "web-fetch" | "web-batch-fetch" | "web-screen-pull";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface InternetToolActivity {
  kind: InternetToolKind;
  title: string;
  description: string;
  group: "Internet";
  query?: string;
  url?: string;
  urls?: string[];
  results?: WebSearchResult[];
  preview?: string;
  metrics?: ToolMetric[];
}

export interface SettingsToolActivity {
  kind: "settings-change";
  title: string;
  description: string;
  group: "Settings";
  preview?: string;
  metrics?: ToolMetric[];
}

export type ToolActivity = WindowsPowerShellActivity | WorkspaceToolActivity | InternetToolActivity | SettingsToolActivity;

export interface GeneratedImage {
  mimeType: string;
  dataUrl?: string;
  url?: string;
  shortUrl?: string;
  revisedPrompt?: string;
  model?: string;
}

export interface ImageGenerationActivity {
  kind: "image-generation";
  title: string;
  description: string;
  group: "Images";
  provider: ProviderId;
  providerLabel: string;
  model: string;
  prompt: string;
  image?: GeneratedImage;
  images?: GeneratedImage[];
  metrics?: ToolMetric[];
  error?: string;
}

export interface EditImageContext {
  sourceImageDataUrl: string;
  sourcePrompt: string;
  sourceTitle: string;
  sourceProvider: string;
  sourceModel: string;
  revisedPrompt?: string;
}

export type UpdatePhase = "checking" | "downloading" | "installing" | "ready" | "error";

export interface UpdateAsset {
  name: string;
  downloadUrl: string;
  sizeBytes: number;
  platform: string;
  arch: string;
  format: string;
  updatedAt?: string;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  asset: UpdateAsset;
  canAutoInstall: boolean;
}

export interface UpdateProgress {
  phase: UpdatePhase;
  percent: number | null;
  transferredBytes: number;
  totalBytes: number | null;
  message: string;
}

export interface UpdateInstallResult {
  status: "opened" | "relaunching" | "downloaded";
  message: string;
  filePath?: string;
}

export interface DesktopApi {
  getState: () => Promise<AppState>;
  createChat: () => Promise<AppState>;
  markStarterCardSeen: () => Promise<AppState>;
  deleteChat: (chatId: string) => Promise<AppState>;
  setActiveChat: (chatId: string) => Promise<AppState>;
  sendMessage: (chatId: string, content: string) => Promise<AppState>;
  cancelChat: (chatId: string) => Promise<AppState>;
  resolveApproval: (chatId: string, messageId: string, approved: boolean) => Promise<AppState>;
  submitMessageFeedback: (request: MessageFeedbackRequest) => Promise<AppState>;
  updateProviders: (providers: ProviderSettings) => Promise<AppState>;
  validateProviders: () => Promise<ProviderDiagnostic[]>;
  scanImageModels: (provider: ProviderId) => Promise<AppState>;
  runProviderTest: () => Promise<ProviderTestResult>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<AppState>;
  updatePersonalization: (personalization: PersonalizationSettings) => Promise<AppState>;
  updateAiFunctionality: (settings: AiFunctionalitySettings) => Promise<AppState>;
  updateSecurity: (security: SecuritySettings) => Promise<AppState>;
  notifyChatComplete: (title: string, body?: string) => Promise<void>;
  createGeneratedImageLink: (dataUrl: string) => Promise<string>;
  saveGeneratedImage: (request: SaveGeneratedImageRequest) => Promise<SaveGeneratedImageResult>;
  reportBug: (request: BugReportRequest) => Promise<BugReportResult>;
  resetLocalData: () => Promise<AppState>;
  reinstallCurrentVersion: () => Promise<string>;
  selectWorkspace: () => Promise<AppState>;
  listFiles: () => Promise<FileEntry[]>;
  readFile: (relativePath: string) => Promise<string>;
  previewDiff: (relativePath: string, nextContent: string) => Promise<DiffPreview>;
  writeFile: (relativePath: string, nextContent: string) => Promise<DiffPreview>;
  createFolder: (relativePath: string) => Promise<FileEntry>;
  deleteFile: (relativePath: string) => Promise<DiffPreview>;
  deleteFolder: (relativePath: string) => Promise<FileEntry>;
  runCommand: (command: string) => Promise<ShellResult>;
  checkForUpdate: () => Promise<UpdateInfo | null>;
  installUpdate: () => Promise<UpdateInstallResult>;
  forceUninstall: (confirm: boolean) => Promise<{ success: boolean; message: string }>;
  onStateChanged: (listener: (state: AppState) => void) => () => void;
  onUpdateAvailable: (listener: (update: UpdateInfo) => void) => () => void;
  onUpdateProgress: (listener: (progress: UpdateProgress) => void) => () => void;
  onProviderTestProgress: (listener: (progress: ProviderTestProgress) => void) => () => void;
}
