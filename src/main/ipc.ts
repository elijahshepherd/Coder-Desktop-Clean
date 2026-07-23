import { app, dialog, ipcMain, Notification, type IpcMainInvokeEvent } from "electron";
import os from "node:os";
import path from "node:path";
import { parseAssistantStructuredBlocks, stripAssistantStructuredBlocks } from "./assistantStructuredBlocks";
import { persistGeneratedImageDataUrl, persistGeneratedImagesInActivity, saveGeneratedImageWithDialog } from "./generatedImages";
import {
  createImageGenerationActivity,
  generateImageFromPlan,
  parseImageGenerationRequests,
  scanProviderImageModels,
  stripImageGenerationRequests,
  type ImageGenerationPlan
} from "./imageModels";
import { fetchManyWebContents, fetchWebContent, screenPullWebContent, searchWeb } from "./internetTools";
import type { IssueReporter } from "./issueReporter";
import { runProviderTest } from "./providerTester";
import {
  createAssistantResponse,
  createPromptPrivacyReviewDirective,
  createToolContinuationDirective,
  isSystemPromptDisclosureRequest,
  looksLikeUnfinishedToolPromise,
  sanitizeAssistantVisibleContent,
  validateProviderConnections
} from "./providers";
import {
  applySettingsToolRequest,
  parseSettingsToolRequests,
  type SettingsToolPlan
} from "./settingsToolRequests";
import type { DesktopStore } from "./store";
import { isPathInsideWorkspace } from "../shared/workspace";
import {
  createWorkspaceFolder,
  countWorkspaceFiles,
  countWorkspaceFolders,
  countWorkspaceLines,
  deleteWorkspaceFile,
  deleteWorkspaceFolder,
  listWorkspaceFiles,
  previewWorkspaceDiff,
  readWorkspaceFile,
  runPowerShellCommand,
  runWorkspaceCommand,
  writeWorkspaceFile
} from "./workspaceTools";
import type {
  ApprovalRequest,
  BugReportRequest,
  MessageFeedbackRequest,
  ProviderError,
  ProviderId,
  ProviderSettings,
  QuestionSet,
  SaveGeneratedImageRequest,
  SecuritySettings,
  UpdateProgress
} from "../shared/types";
import { providerLabels } from "../shared/providers";
import type { UpdateService } from "./updates";
import {
  createWindowsPowerShellActivity,
  parseWindowsPowerShellToolRequests,
  stripCoderToolRequests,
  type WindowsPowerShellPlan
} from "./windowsPowerShellTools";
import {
  completeDiffActivity,
  completeCountActivity,
  completeFileListActivity,
  completeFolderActivity,
  completeReadActivity,
  completeShellActivity,
  parseWorkspaceToolRequests,
  type WorkspaceToolPlan
} from "./workspaceToolRequests";
import {
  completeWebFetchActivity,
  completeWebBatchFetchActivity,
  completeWebScreenPullActivity,
  completeWebSearchActivity,
  createInternetToolActivity,
  type InternetToolRequest,
  parseInternetToolRequests,
  type InternetToolPlan
} from "./internetToolRequests";

export function registerIpcHandlers(store: DesktopStore, updateService: UpdateService, issueReporter: IssueReporter): void {
  const activeControllers = new Map<string, AbortController>();

  ipcMain.handle("app:get-state", () => store.getPublicState());
    ipcMain.handle("app:force-uninstall", async (_event, confirm: boolean) => {
      if (!confirm) {
        return { success: false, message: "Force uninstall requires explicit confirmation." };
      }
      const { spawn } = await import("node:child_process");
      const { join } = await import("node:path");
      const { app } = await import("electron");
    
      const installPath = app.getPath("exe");
      const uninstallString = `"${installPath}" --uninstall`;
    
      return new Promise<{ success: boolean; message: string }>((resolve) => {
        const child = spawn("cmd.exe", ["/c", `start "" /wait ${uninstallString} /FORCE /S`], {
          detached: true,
          windowsHide: true
        });
        child.unref();
        resolve({ success: true, message: "Force uninstall initiated. The application will close and remove itself." });
      });
    });
    ipcMain.handle("chat:create", () => store.createChat());
  ipcMain.handle("starter:mark-seen", () => store.markStarterCardSeen());
  ipcMain.handle("chat:delete", (_event, chatId: string) => store.deleteChat(chatId));
  ipcMain.handle("chat:set-active", (_event, chatId: string) => store.setActiveChat(chatId));

  ipcMain.handle("chat:send", async (event, chatId: string, content: string) => {
    const preflightState = await store.getPublicState();
    if (preflightState.maintenance) {
      throw new Error("Coder Desktop is currently under maintenance. Please try again later.");
    }

    activeControllers.get(chatId)?.abort();
    const controller = new AbortController();
    activeControllers.set(chatId, controller);
    const requestStartedAt = Date.now();

    try {
      const chat = await store.addUserMessage(chatId, content);
      await publishState(event, store);

      throwIfAborted(controller.signal);

      const providers = await store.getProvidersWithSecrets();
      const publicState = await store.getPublicState();
      const response = await createNonStallingAssistantResponse(providers, store.getChat(chatId) ?? chat, {
        aiFunctionality: publicState.aiFunctionality,
        profile: publicState.profile,
        promptPrivacySuggestion: isSystemPromptDisclosureRequest(content) ? createPromptPrivacyReviewDirective(content) : undefined,
        security: store.getSecurity(),
        signal: controller.signal,
        workspaceRoot: store.getWorkspaceRoot(),
        turnStartedAt: requestStartedAt
      });

      let finalResponse = response;
      let addedStructuredBlock = await publishStructuredBlocks(event, store, chatId, finalResponse, issueReporter);
      let ranAnyTool = false;
      const completedToolSignatures = new Set<string>();

      for (let toolIndex = 0; toolIndex < 10; toolIndex += 1) {
        throwIfAborted(controller.signal);
        const requestedPowerShellPlans = dedupePlans(parseWindowsPowerShellToolRequests(finalResponse), completedToolSignatures, createPowerShellSignature);
        const requestedWorkspacePlans = dedupePlans(parseWorkspaceToolRequests(finalResponse), completedToolSignatures, createWorkspaceSignature);
        const requestedInternetPlans = dedupePlans(parseInternetToolRequests(finalResponse), completedToolSignatures, createInternetSignature);
        const requestedSettingsPlans = dedupePlans(parseSettingsToolRequests(finalResponse), completedToolSignatures, createSettingsSignature);
        const requestedImagePlans = limitImageGenerationPlans(
          dedupePlans(parseImageGenerationRequests(finalResponse), completedToolSignatures, createImageSignature)
        );

        if (
          requestedPowerShellPlans.length === 0 &&
          requestedWorkspacePlans.length === 0 &&
          requestedInternetPlans.length === 0 &&
          requestedSettingsPlans.length === 0 &&
          requestedImagePlans.length === 0
        ) {
          break;
        }

        const toolsRun = await runRequestedToolPlans(
          event,
          store,
          chatId,
          requestedPowerShellPlans,
          requestedWorkspacePlans,
          requestedInternetPlans,
          requestedSettingsPlans,
          controller.signal,
          issueReporter
        );
        await Promise.all(requestedImagePlans.map((plan) => runImageGenerationPlan(event, store, chatId, plan, controller.signal, issueReporter)));
        ranAnyTool = ranAnyTool || toolsRun > 0 || requestedImagePlans.length > 0;
        markPlansCompleted(completedToolSignatures, requestedPowerShellPlans, createPowerShellSignature);
        markPlansCompleted(completedToolSignatures, requestedWorkspacePlans, createWorkspaceSignature);
        markPlansCompleted(completedToolSignatures, requestedInternetPlans, createInternetSignature);
        markPlansCompleted(completedToolSignatures, requestedSettingsPlans, createSettingsSignature);
        markPlansCompleted(completedToolSignatures, requestedImagePlans, createImageSignature);

        const nextPublicState = await store.getPublicState();
        finalResponse = await createNonStallingAssistantResponse(providers, store.getChat(chatId) ?? chat, {
          aiFunctionality: nextPublicState.aiFunctionality,
          profile: nextPublicState.profile,
          security: store.getSecurity(),
          signal: controller.signal,
          workspaceRoot: store.getWorkspaceRoot(),
          turnStartedAt: requestStartedAt
        });
        addedStructuredBlock = (await publishStructuredBlocks(event, store, chatId, finalResponse, issueReporter)) || addedStructuredBlock;
      }

      const cleanResponse = sanitizeAssistantVisibleContent(
        stripImageGenerationRequests(stripAssistantStructuredBlocks(stripCoderToolRequests(finalResponse)))
      );
      let nextState = cleanResponse
        ? await store.addAssistantMessage(chatId, cleanResponse, "complete", Date.now() - requestStartedAt)
        : addedStructuredBlock || ranAnyTool
          ? await store.getPublicState()
          : await addReportedProviderError(event, store, chatId, createEmptyProviderError(providers), issueReporter, "no-output");

      await publishState(event, store);
      return nextState;
    } catch (error) {
      if (error instanceof ApprovalPendingError) {
        return store.getPublicState();
      }

      if (isAbortError(error) || controller.signal.aborted) {
        if (activeControllers.get(chatId) === controller) {
          const nextState = await store.addAssistantMessage(chatId, "Stopped the current request.", "complete", Date.now() - requestStartedAt);
          await publishState(event, store);
          return nextState;
        }

        return store.getPublicState();
      }

      void issueReporter.reportBug({
        area: "chat send",
        title: "Chat request failed",
        message: error instanceof Error ? error.message : String(error),
        severity: "high",
        stack: error instanceof Error ? error.stack : undefined,
        metadata: { chatId }
      });
      throw error;
    } finally {
      if (activeControllers.get(chatId) === controller) {
        activeControllers.delete(chatId);
      }
    }
  });

  ipcMain.handle("chat:cancel", async (event, chatId: string) => {
    const controller = activeControllers.get(chatId);

    if (!controller) {
      return store.getPublicState();
    }

    controller.abort();
    activeControllers.delete(chatId);
    const nextState = await store.addAssistantMessage(chatId, "Stopped the current request.");
    await publishState(event, store);
    return nextState;
  });

  ipcMain.handle("feedback:submit", async (event, request: MessageFeedbackRequest) => {
    const queuedFeedback = {
      rating: request.rating,
      note: request.note?.trim() || undefined,
      submittedAt: new Date().toISOString(),
      status: "queued" as const
    };
    event.sender.send("app:state-changed", await store.updateMessageFeedback(request.chatId, request.messageId, queuedFeedback));

    const chat = store.getChat(request.chatId);

    if (!chat) {
      return store.getPublicState();
    }

    const reportResult = await issueReporter.reportFeedback(request, chat);
    const finalFeedback = {
      ...queuedFeedback,
      status:
        reportResult.status === "sent"
          ? ("sent" as const)
          : reportResult.status === "queued"
            ? ("queued" as const)
            : ("failed" as const),
      issueUrl: reportResult.issueUrl
    };
    const nextState = await store.updateMessageFeedback(request.chatId, request.messageId, finalFeedback);
    event.sender.send("app:state-changed", nextState);
    return nextState;
  });

  ipcMain.handle("chat:resolve-approval", async (event, chatId: string, messageId: string, approved: boolean) => {
    const resolved = await store.resolveApprovalMessage(chatId, messageId, approved);
    event.sender.send("app:state-changed", resolved.state);

    if (!approved || !resolved.request) {
      return resolved.state;
    }

    const controller = new AbortController();
    activeControllers.set(chatId, controller);

    try {
      if (resolved.request.type === "internet") {
        const plan: InternetToolPlan = {
          request: resolved.request.internetRequest as InternetToolRequest,
          activity: createInternetToolActivity(resolved.request.internetRequest as InternetToolRequest)
        };
        await runInternetToolPlan(event, store, chatId, plan, controller.signal, true, issueReporter);
        try {
          await continueAssistantFromLatestState(event, store, chatId, issueReporter, controller.signal);
        } catch (error) {
          if (!(error instanceof ApprovalPendingError)) {
            throw error;
          }
        }
      }
    } finally {
      if (activeControllers.get(chatId) === controller) {
        activeControllers.delete(chatId);
      }
    }

    return store.getPublicState();
  });

  ipcMain.handle("providers:update", (_event, providers: ProviderSettings) => store.updateProviders(providers));
  ipcMain.handle("providers:validate", async () => validateProviderConnections(await store.getProvidersWithSecrets()));
  ipcMain.handle("providers:scan-image-models", async (event, provider: ProviderId) => {
    const scan = await scanProviderImageModels(await store.getProvidersWithSecrets(), provider);
    const nextState = await store.updateImageModelScan(provider, scan);
    event.sender.send("app:state-changed", nextState);
    return nextState;
  });
  ipcMain.handle("providers:test", async (event) => {
    const result = await runProviderTest(await store.getProvidersWithSecrets(), issueReporter, (progress) => {
      event.sender.send("providers:test-progress", progress);
    });
    const nextState = await store.updateProviders(result.providers);
    event.sender.send("app:state-changed", nextState);
    return {
      ...result,
      providers: nextState.providers
    };
  });
  ipcMain.handle("profile:update", (_event, profile) => store.updateProfile(profile));
  ipcMain.handle("personalization:update", (_event, personalization) => store.updatePersonalization(personalization));
  ipcMain.handle("ai-functionality:update", (_event, settings) => store.updateAiFunctionality(settings));
  ipcMain.handle("security:update", (_event, security: SecuritySettings) => store.updateSecurity(security));
  ipcMain.handle("notifications:chat-complete", (_event, title: string, body?: string) => {
    if (!Notification.isSupported()) {
      return;
    }

    new Notification({
      title: title.trim().slice(0, 80) || "Coder Desktop finished",
      body: body?.trim().slice(0, 160) || "The latest request is complete."
    }).show();
  });
  ipcMain.handle("images:create-link", (_event, dataUrl: string) => persistGeneratedImageDataUrl(store.getDataPath(), dataUrl));
  ipcMain.handle("images:save-to-disk", (_event, request: SaveGeneratedImageRequest) =>
    saveGeneratedImageWithDialog(app.getPath("downloads"), request)
  );
  ipcMain.handle("bugs:report", (_event, request: BugReportRequest) => issueReporter.reportBug(request));
  ipcMain.handle("maintenance:reset-local-data", async (event) => {
    const nextState = await store.resetLocalData();
    event.sender.send("app:state-changed", nextState);
    return nextState;
  });
  ipcMain.handle("maintenance:reinstall-current", () => {
    app.relaunch();
    app.exit(0);
    return "Coder Desktop is reopening with the current version.";
  });

  ipcMain.handle("workspace:select", async () => {
    const result = await dialog.showOpenDialog({
      title: "Choose workspace",
      properties: ["openDirectory"]
    });

    if (result.canceled || !result.filePaths[0]) {
      return store.getPublicState();
    }

    return store.updateWorkspace(result.filePaths[0]);
  });

  ipcMain.handle("files:list", () => {
    const workspaceRoot = requireWorkspace(store);
    return listWorkspaceFiles(workspaceRoot, store.getSecurity());
  });

  ipcMain.handle("files:read", (_event, relativePath: string) => {
    const workspaceRoot = requireWorkspace(store);
    return readWorkspaceFile(workspaceRoot, store.getSecurity(), relativePath);
  });

  ipcMain.handle("files:preview-diff", (_event, relativePath: string, nextContent: string) => {
    const workspaceRoot = requireWorkspace(store);
    return previewWorkspaceDiff(workspaceRoot, store.getSecurity(), relativePath, nextContent);
  });

  ipcMain.handle("files:write", (_event, relativePath: string, nextContent: string) => {
    const workspaceRoot = requireWorkspace(store);
    return writeWorkspaceFile(workspaceRoot, store.getSecurity(), relativePath, nextContent);
  });

  ipcMain.handle("folders:create", (_event, relativePath: string) => {
    const workspaceRoot = requireWorkspace(store);
    return createWorkspaceFolder(workspaceRoot, store.getSecurity(), relativePath);
  });

  ipcMain.handle("files:delete", (_event, relativePath: string) => {
    const workspaceRoot = requireWorkspace(store);
    return deleteWorkspaceFile(workspaceRoot, store.getSecurity(), relativePath);
  });

  ipcMain.handle("folders:delete", (_event, relativePath: string) => {
    const workspaceRoot = requireWorkspace(store);
    return deleteWorkspaceFolder(workspaceRoot, store.getSecurity(), relativePath);
  });

  ipcMain.handle("shell:run", (_event, command: string) => {
    const workspaceRoot = requireWorkspace(store);
    return runWorkspaceCommand(workspaceRoot, store.getSecurity(), command);
  });

  ipcMain.handle("updates:check", () => updateService.checkForUpdate());

  ipcMain.handle("updates:install", (event) => {
    const sendProgress = (progress: UpdateProgress): void => {
      event.sender.send("updates:progress", progress);
    };

    return updateService.installLatestUpdate(sendProgress);
  });
}

async function runWindowsPowerShellPlan(
  event: IpcMainInvokeEvent,
  store: DesktopStore,
  chatId: string,
  plan: WindowsPowerShellPlan,
  signal?: AbortSignal
): Promise<void> {
  throwIfAborted(signal);
  const security = store.getSecurity();

  if (!security.allowShellExecute) {
    await store.addAssistantMessage(
      chatId,
      [
        "**Windows PowerShell is turned off in settings.**",
        "",
        `I can run ${plan.command} once Windows PowerShell commands are enabled in Security.`
      ].join("\n"),
      "error"
    );
    await publishState(event, store);
    return;
  }

  const workingDirectory = store.getWorkspaceRoot() ?? os.homedir();
  const started = await store.addToolActivity(chatId, plan.activity, "thinking");
  event.sender.send("app:state-changed", started.state);

  const result = await runPowerShellCommand(workingDirectory, security, plan.command, signal);
  throwIfAborted(signal);
  const completedActivity = createWindowsPowerShellActivity(plan.command, result);
  const status = result.exitCode === 0 ? "complete" : "error";
  const nextState = await store.updateToolActivity(chatId, started.messageId, completedActivity, status);
  event.sender.send("app:state-changed", nextState);
}

async function runRequestedToolPlans(
  event: IpcMainInvokeEvent,
  store: DesktopStore,
  chatId: string,
  powerShellPlans: WindowsPowerShellPlan[],
  workspacePlans: WorkspaceToolPlan[],
  internetPlans: InternetToolPlan[],
  settingsPlans: SettingsToolPlan[],
  signal?: AbortSignal,
  issueReporter?: IssueReporter
): Promise<number> {
  const maxPlansPerRound = 32;
  const selectedSettingsPlans = settingsPlans.slice(0, maxPlansPerRound);
  const remainingAfterSettings = Math.max(0, maxPlansPerRound - selectedSettingsPlans.length);
  const selectedPowerShellPlans = powerShellPlans.slice(0, remainingAfterSettings);
  const remainingAfterPowerShell = Math.max(0, remainingAfterSettings - selectedPowerShellPlans.length);
  const selectedInternetPlans = internetPlans.slice(0, remainingAfterPowerShell);
  const selectedWorkspacePlans = workspacePlans.slice(0, Math.max(0, remainingAfterPowerShell - selectedInternetPlans.length));

  await Promise.all(selectedSettingsPlans.map((plan) => runSettingsToolPlan(event, store, chatId, plan, signal)));
  await Promise.all(selectedPowerShellPlans.map((plan) => runWindowsPowerShellPlan(event, store, chatId, plan, signal)));
  await Promise.all(selectedInternetPlans.map((plan) => runInternetToolPlan(event, store, chatId, plan, signal, false, issueReporter)));
  await runWorkspacePlanBatch(event, store, chatId, selectedWorkspacePlans, signal, issueReporter);

  return selectedSettingsPlans.length + selectedPowerShellPlans.length + selectedInternetPlans.length + selectedWorkspacePlans.length;
}

async function runSettingsToolPlan(
  event: IpcMainInvokeEvent,
  store: DesktopStore,
  chatId: string,
  plan: SettingsToolPlan,
  signal?: AbortSignal
): Promise<void> {
  throwIfAborted(signal);
  const started = await store.addToolActivity(chatId, plan.activity, "thinking");
  event.sender.send("app:state-changed", started.state);

  const publicState = await store.getPublicState();
  const result = applySettingsToolRequest(plan.request, publicState.personalization, publicState.aiFunctionality);
  await store.updatePersonalization(result.personalization);
  await store.updateAiFunctionality(result.aiFunctionality);
  throwIfAborted(signal);
  const nextState = await store.updateToolActivity(chatId, started.messageId, result.activity, "complete");
  event.sender.send("app:state-changed", nextState);
}

async function runImageGenerationPlan(
  event: IpcMainInvokeEvent,
  store: DesktopStore,
  chatId: string,
  plan: ImageGenerationPlan,
  signal?: AbortSignal,
  issueReporter?: IssueReporter
): Promise<void> {
  throwIfAborted(signal);
  const providers = await store.getProvidersWithSecrets();
  const started = await store.addImageGenerationMessage(chatId, createImageGenerationActivity(providers, plan), "thinking");
  event.sender.send("app:state-changed", started.state);

  try {
    const result = await generateImageFromPlan(providers, plan, signal);
    throwIfAborted(signal);
    const activity =
      result.status === "complete" ? await persistGeneratedImagesInActivity(store.getDataPath(), result.activity) : result.activity;
    const nextState = await store.updateImageGenerationMessage(chatId, started.messageId, activity, result.status);
    event.sender.send("app:state-changed", nextState);
    if (result.status === "error") {
      void issueReporter?.reportBug({
        area: "image generation",
        title: "Image generation failed",
        message: result.activity.error ?? "The image provider did not create an image.",
        severity: "medium",
        metadata: {
          provider: result.activity.provider,
          model: result.activity.model
        }
      });
    }
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) {
      return;
    }

    const failedActivity = {
      ...createImageGenerationActivity(providers, plan),
      title: "Image generation failed",
      description: "Coder Desktop could not create the requested image.",
      error: error instanceof Error ? error.message : String(error),
      metrics: [{ label: "Status", value: "Failed", tone: "danger" as const }]
    };
    const nextState = await store.updateImageGenerationMessage(chatId, started.messageId, failedActivity, "error");
    event.sender.send("app:state-changed", nextState);
    void issueReporter?.reportBug({
      area: "image generation",
      title: "Image generation failed",
      message: failedActivity.error,
      severity: "medium",
      stack: error instanceof Error ? error.stack : undefined,
      metadata: {
        provider: failedActivity.provider,
        model: failedActivity.model
      }
    });
  }
}

async function runInternetToolPlan(
  event: IpcMainInvokeEvent,
  store: DesktopStore,
  chatId: string,
  plan: InternetToolPlan,
  signal?: AbortSignal,
  approvedOverride = false,
  issueReporter?: IssueReporter
): Promise<void> {
  throwIfAborted(signal);
  const security = store.getSecurity();

  if (security.accessMode === "ask-approval" && !approvedOverride) {
    await store.addApprovalRequestMessage(chatId, createInternetApprovalRequest(plan));
    await publishState(event, store);
    throw new ApprovalPendingError();
  }

  const started = await store.addToolActivity(chatId, plan.activity, "thinking");
  event.sender.send("app:state-changed", started.state);

  try {
    let completedActivity = plan.activity;

    switch (plan.request.type) {
      case "web-search":
        completedActivity = completeWebSearchActivity(plan.activity, await searchWeb(security, plan.request.query ?? ""));
        break;
      case "web-batch-fetch":
        completedActivity = completeWebBatchFetchActivity(plan.activity, await fetchManyWebContents(security, plan.request.urls ?? []));
        break;
      case "web-screen-pull":
        completedActivity = completeWebScreenPullActivity(plan.activity, await screenPullWebContent(security, plan.request.url ?? ""));
        break;
      case "web-fetch":
      default:
        completedActivity = completeWebFetchActivity(plan.activity, await fetchWebContent(security, plan.request.url ?? ""));
        break;
    }

    throwIfAborted(signal);
    const nextState = await store.updateToolActivity(chatId, started.messageId, completedActivity, "complete");
    event.sender.send("app:state-changed", nextState);
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) {
      return;
    }

    const message = cleanToolErrorMessage(error instanceof Error ? error.message : "The internet tool could not run.");
    const failedActivity = {
      ...plan.activity,
      metrics: [{ label: "Status", value: "Failed", tone: "danger" as const }],
      preview: message
    };
    const nextState = await store.updateToolActivity(chatId, started.messageId, failedActivity, "error");
    event.sender.send("app:state-changed", nextState);
    void issueReporter?.reportBug({
      area: "internet tool",
      title: `${plan.request.type} failed`,
      message,
      severity: "medium",
      stack: error instanceof Error ? error.stack : undefined,
      metadata: {
        kind: plan.request.type,
        query: plan.request.query ?? null,
        url: plan.request.url ?? null
      }
    });
  }
}

async function runWorkspacePlanBatch(
  event: IpcMainInvokeEvent,
  store: DesktopStore,
  chatId: string,
  plans: WorkspaceToolPlan[],
  signal?: AbortSignal,
  issueReporter?: IssueReporter
): Promise<void> {
  let pendingParallelPlans: Array<Promise<void>> = [];

  const flushParallelPlans = async (): Promise<void> => {
    if (pendingParallelPlans.length === 0) {
      return;
    }

    await Promise.all(pendingParallelPlans);
    pendingParallelPlans = [];
  };

  for (const plan of plans) {
    if (canRunWorkspacePlanInParallel(plan)) {
      pendingParallelPlans.push(runWorkspaceToolPlan(event, store, chatId, plan, signal, issueReporter));
      continue;
    }

    await flushParallelPlans();
    await runWorkspaceToolPlan(event, store, chatId, plan, signal, issueReporter);
  }

  await flushParallelPlans();
}

function canRunWorkspacePlanInParallel(plan: WorkspaceToolPlan): boolean {
  return (
    plan.request.type === "list-files" ||
    plan.request.type === "read-file" ||
    plan.request.type === "count-files" ||
    plan.request.type === "count-folders" ||
    plan.request.type === "count-lines" ||
    plan.request.type === "run-shell"
  );
}

async function runWorkspaceToolPlan(
  event: IpcMainInvokeEvent,
  store: DesktopStore,
  chatId: string,
  plan: WorkspaceToolPlan,
  signal?: AbortSignal,
  issueReporter?: IssueReporter
): Promise<void> {
  throwIfAborted(signal);
  const workspaceRoot = resolveWorkspaceRootForPlan(store, plan);

  if (!workspaceRoot) {
    event.sender.send("app:state-changed", await store.addQuestionSetMessage(chatId, createWorkspaceRequiredQuestionSet(plan)));
    return;
  }

  const started = await store.addToolActivity(chatId, plan.activity, "thinking");
  event.sender.send("app:state-changed", started.state);

  try {
    const security = store.getSecurity();
    let completedActivity = plan.activity;
    let status: "complete" | "error" = "complete";

    switch (plan.request.type) {
      case "list-files": {
        const files = await listWorkspaceFiles(workspaceRoot, security, plan.request.path ?? "");
        completedActivity = completeFileListActivity(plan.activity, files);
        break;
      }
      case "read-file": {
        const content = await readWorkspaceFile(workspaceRoot, security, plan.request.path ?? "");
        completedActivity = completeReadActivity(plan.activity, content);
        break;
      }
      case "count-files": {
        const result = await countWorkspaceFiles(workspaceRoot, security, plan.request.path ?? "");
        completedActivity = completeCountActivity(plan.activity, result);
        break;
      }
      case "count-folders": {
        const result = await countWorkspaceFolders(workspaceRoot, security, plan.request.path ?? "");
        completedActivity = completeCountActivity(plan.activity, result);
        break;
      }
      case "count-lines": {
        const result = await countWorkspaceLines(workspaceRoot, security, plan.request.path ?? "");
        completedActivity = completeCountActivity(plan.activity, result);
        break;
      }
      case "write-file":
      case "create-file": {
        const diff = await writeWorkspaceFile(workspaceRoot, security, plan.request.path ?? "", plan.request.content ?? "");
        completedActivity = completeDiffActivity(plan.activity, diff);
        break;
      }
      case "delete-file": {
        const diff = await deleteWorkspaceFile(workspaceRoot, security, plan.request.path ?? "");
        completedActivity = completeDiffActivity(plan.activity, diff);
        break;
      }
      case "create-folder": {
        const entry = await createWorkspaceFolder(workspaceRoot, security, plan.request.path ?? "");
        completedActivity = completeFolderActivity(plan.activity, entry);
        break;
      }
      case "delete-folder": {
        const entry = await deleteWorkspaceFolder(workspaceRoot, security, plan.request.path ?? "");
        completedActivity = completeFolderActivity(plan.activity, entry);
        break;
      }
      case "run-shell": {
        const result = await runWorkspaceCommand(workspaceRoot, security, plan.request.command ?? "", signal);
        completedActivity = completeShellActivity(plan.activity, result);
        status = result.exitCode === 0 ? "complete" : "error";
        break;
      }
    }

    throwIfAborted(signal);
    const nextState = await store.updateToolActivity(chatId, started.messageId, completedActivity, status);
    event.sender.send("app:state-changed", nextState);
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) {
      return;
    }

    const message = error instanceof Error ? error.message : "The local tool could not run.";
    const failedActivity = {
      ...plan.activity,
      metrics: [{ label: "Status", value: "Failed", tone: "danger" as const }],
      preview: message
    };
    const nextState = await store.updateToolActivity(chatId, started.messageId, failedActivity, "error");
    event.sender.send("app:state-changed", nextState);
    void issueReporter?.reportBug({
      area: "workspace tool",
      title: `${plan.request.type} failed`,
      message,
      severity: "medium",
      stack: error instanceof Error ? error.stack : undefined,
      metadata: {
        kind: plan.request.type,
        path: plan.request.path ?? null
      }
    });
  }
}

async function publishState(event: IpcMainInvokeEvent, store: DesktopStore): Promise<void> {
  event.sender.send("app:state-changed", await store.getPublicState());
}

async function publishStructuredBlocks(
  event: IpcMainInvokeEvent,
  store: DesktopStore,
  chatId: string,
  content: string,
  issueReporter: IssueReporter
): Promise<boolean> {
  const blocks = parseAssistantStructuredBlocks(content);

  if (!blocks.hadBlocks) {
    return false;
  }

  for (const progress of blocks.progress) {
    event.sender.send("app:state-changed", await store.upsertTodoProgressMessage(chatId, progress));
  }

  for (const questionSet of blocks.questionSets) {
    const publicState = await store.getPublicState();
    const maxLetMeKnows = publicState.aiFunctionality.maxLetMeKnows;
    const visibleQuestionSet =
      maxLetMeKnows > 0
        ? {
            ...questionSet,
            questions: questionSet.questions.slice(0, maxLetMeKnows)
          }
        : questionSet;
    event.sender.send("app:state-changed", await store.addQuestionSetMessage(chatId, visibleQuestionSet));
  }

  for (const providerError of blocks.providerErrors) {
    event.sender.send("app:state-changed", await store.addProviderErrorMessage(chatId, providerError));
    if (isReportableProviderError(providerError.message, providerError.title)) {
      void issueReporter.reportProviderError(providerError, { source: "structured-block" });
    }
  }

  return true;
}

async function createNonStallingAssistantResponse(
  providers: ProviderSettings,
  chat: NonNullable<ReturnType<DesktopStore["getChat"]>>,
  context: Parameters<typeof createAssistantResponse>[2]
): Promise<string> {
  let response = await createAssistantResponse(providers, chat, context);
  throwIfAborted(context.signal);

  for (let attempt = 0; attempt < 2 && looksLikeUnfinishedToolPromise(response); attempt += 1) {
    throwIfAborted(context.signal);
    response = await createAssistantResponse(providers, chat, {
      ...context,
      continuationDirective: createToolContinuationDirective(response)
    });
    throwIfAborted(context.signal);
  }

  return response;
}

async function continueAssistantFromLatestState(
  event: IpcMainInvokeEvent,
  store: DesktopStore,
  chatId: string,
  issueReporter: IssueReporter,
  signal?: AbortSignal
): Promise<void> {
  const providers = await store.getProvidersWithSecrets();
  const publicState = await store.getPublicState();
  const turnStartedAt = Date.now();
  let finalResponse = await createNonStallingAssistantResponse(providers, store.getChat(chatId)!, {
    aiFunctionality: publicState.aiFunctionality,
    profile: publicState.profile,
    security: store.getSecurity(),
    signal,
    turnStartedAt,
    workspaceRoot: store.getWorkspaceRoot()
  });
  let addedStructuredBlock = await publishStructuredBlocks(event, store, chatId, finalResponse, issueReporter);
  let ranAnyTool = false;
  const completedToolSignatures = new Set<string>();

  for (let toolIndex = 0; toolIndex < 10; toolIndex += 1) {
    throwIfAborted(signal);
    const requestedPowerShellPlans = dedupePlans(parseWindowsPowerShellToolRequests(finalResponse), completedToolSignatures, createPowerShellSignature);
    const requestedWorkspacePlans = dedupePlans(parseWorkspaceToolRequests(finalResponse), completedToolSignatures, createWorkspaceSignature);
    const requestedInternetPlans = dedupePlans(parseInternetToolRequests(finalResponse), completedToolSignatures, createInternetSignature);
    const requestedSettingsPlans = dedupePlans(parseSettingsToolRequests(finalResponse), completedToolSignatures, createSettingsSignature);
    const requestedImagePlans = limitImageGenerationPlans(
      dedupePlans(parseImageGenerationRequests(finalResponse), completedToolSignatures, createImageSignature)
    );

    if (
      requestedPowerShellPlans.length === 0 &&
      requestedWorkspacePlans.length === 0 &&
      requestedInternetPlans.length === 0 &&
      requestedSettingsPlans.length === 0 &&
      requestedImagePlans.length === 0
    ) {
      break;
    }

    const toolsRun = await runRequestedToolPlans(
      event,
      store,
      chatId,
      requestedPowerShellPlans,
      requestedWorkspacePlans,
      requestedInternetPlans,
      requestedSettingsPlans,
      signal,
      issueReporter
    );
    await Promise.all(requestedImagePlans.map((plan) => runImageGenerationPlan(event, store, chatId, plan, signal, issueReporter)));
    ranAnyTool = ranAnyTool || toolsRun > 0 || requestedImagePlans.length > 0;
    markPlansCompleted(completedToolSignatures, requestedPowerShellPlans, createPowerShellSignature);
    markPlansCompleted(completedToolSignatures, requestedWorkspacePlans, createWorkspaceSignature);
    markPlansCompleted(completedToolSignatures, requestedInternetPlans, createInternetSignature);
    markPlansCompleted(completedToolSignatures, requestedSettingsPlans, createSettingsSignature);
    markPlansCompleted(completedToolSignatures, requestedImagePlans, createImageSignature);

    const nextPublicState = await store.getPublicState();
    finalResponse = await createNonStallingAssistantResponse(providers, store.getChat(chatId)!, {
      aiFunctionality: nextPublicState.aiFunctionality,
      profile: nextPublicState.profile,
      security: store.getSecurity(),
      signal,
      turnStartedAt,
      workspaceRoot: store.getWorkspaceRoot()
    });
    addedStructuredBlock = (await publishStructuredBlocks(event, store, chatId, finalResponse, issueReporter)) || addedStructuredBlock;
  }

  const cleanResponse = sanitizeAssistantVisibleContent(
    stripImageGenerationRequests(stripAssistantStructuredBlocks(stripCoderToolRequests(finalResponse)))
  );

  if (cleanResponse) {
    await store.addAssistantMessage(chatId, cleanResponse);
  } else if (!addedStructuredBlock && !ranAnyTool) {
    await addReportedProviderError(event, store, chatId, createEmptyProviderError(providers), issueReporter, "no-output");
  }

  await publishState(event, store);
}

async function addReportedProviderError(
  event: IpcMainInvokeEvent,
  store: DesktopStore,
  chatId: string,
  providerError: ProviderError,
  issueReporter: IssueReporter,
  source: string
): Promise<Awaited<ReturnType<DesktopStore["getPublicState"]>>> {
  const nextState = await store.addProviderErrorMessage(chatId, providerError);
  event.sender.send("app:state-changed", nextState);
  void issueReporter.reportProviderError(providerError, { source });
  return nextState;
}

function createInternetApprovalRequest(plan: InternetToolPlan): ApprovalRequest {
  const target = createApprovalTarget(plan.request);
  const action =
    plan.request.type === "web-search"
      ? "search the web"
      : plan.request.type === "web-batch-fetch"
        ? "read several web pages"
        : plan.request.type === "web-screen-pull"
          ? "pull screen content from a web page"
          : "read a web page";

  return {
    id: `internet-${Date.now().toString(36)}`,
    type: "internet",
    title: "Approve internet access",
    description: `Coder Desktop wants to ${action} for ${target}.`,
    approveLabel: "Approve",
    denyLabel: "Deny",
    status: "pending",
    createdAt: new Date().toISOString(),
    internetRequest: {
      type: plan.request.type,
      query: plan.request.query,
      url: plan.request.url,
      urls: plan.request.urls,
      reason: plan.request.reason
    }
  };
}

function createApprovalTarget(request: InternetToolRequest): string {
  const reason = request.reason?.trim();

  if (reason && !/^read the (url|web page|web pages) the user (provided|asked about)$/i.test(reason)) {
    return reason.replace(/^(read|search|fetch|pull|extract)\s+/i, "the ").replace(/\s+/g, " ").trim();
  }

  if (request.type === "web-search" && request.query) {
    return request.query;
  }

  if (request.type === "web-batch-fetch") {
    return "the requested public pages";
  }

  if (request.type === "web-screen-pull") {
    return "the requested public page structure";
  }

  return "the requested public page";
}

function resolveWorkspaceRootForPlan(store: DesktopStore, plan: WorkspaceToolPlan): string | null {
  const selectedWorkspace = store.getWorkspaceRoot();

  if (selectedWorkspace) {
    return selectedWorkspace;
  }

  const requestedPath = plan.request.path?.trim();

  if (!requestedPath || !path.isAbsolute(requestedPath)) {
    return null;
  }

  const homeRoot = os.homedir();
  const normalizedPath = path.resolve(requestedPath);

  if (!isPathInsideWorkspace(homeRoot, normalizedPath)) {
    return null;
  }

  const parent = path.dirname(normalizedPath);
  return isPathInsideWorkspace(homeRoot, parent) ? parent : homeRoot;
}

function createWorkspaceRequiredQuestionSet(plan: WorkspaceToolPlan): QuestionSet {
  const homeRoot = os.homedir();
  const desktopPath = path.join(homeRoot, "Desktop");
  const downloadsPath = path.join(homeRoot, "Downloads");
  const target = plan.request.path?.trim();
  const recommendedFolder = target && path.isAbsolute(target) ? path.dirname(path.resolve(target)) : desktopPath;

  return {
    id: `workspace-needed-${Date.now().toString(36)}`,
    title: "Let me know",
    createdAt: new Date().toISOString(),
    questions: [
      {
        id: "workspace-folder",
        question: "Which real folder should Coder Desktop use for this local file action?",
        customPlaceholder: "Paste a full folder path",
        options: [
          {
            id: "recommended-folder",
            label: `Use ${recommendedFolder}`,
            recommended: true
          },
          {
            id: "desktop-folder",
            label: `Use ${desktopPath}`
          },
          {
            id: "downloads-folder",
            label: `Use ${downloadsPath}`
          }
        ]
      }
    ]
  };
}

function requireWorkspace(store: DesktopStore): string {
  const workspaceRoot = store.getWorkspaceRoot();

  if (!workspaceRoot) {
    throw new Error("Choose a workspace folder before using local file or shell tools.");
  }

  return workspaceRoot;
}

function dedupePlans<T>(plans: T[], completedToolSignatures: Set<string>, getSignature: (plan: T) => string): T[] {
  const seen = new Set<string>();
  return plans.filter((plan) => {
    const signature = getSignature(plan);

    if (completedToolSignatures.has(signature) || seen.has(signature)) {
      return false;
    }

    seen.add(signature);
    return true;
  });
}

function markPlansCompleted<T>(completedToolSignatures: Set<string>, plans: T[], getSignature: (plan: T) => string): void {
  for (const plan of plans) {
    completedToolSignatures.add(getSignature(plan));
  }
}

function createPowerShellSignature(plan: WindowsPowerShellPlan): string {
  return `ps:${plan.command.trim().toLowerCase()}`;
}

function createWorkspaceSignature(plan: WorkspaceToolPlan): string {
  return `workspace:${plan.request.type}:${plan.request.path ?? ""}:${plan.request.command ?? ""}`;
}

function createInternetSignature(plan: InternetToolPlan): string {
  return `internet:${plan.request.type}:${plan.request.query ?? ""}:${plan.request.url ?? ""}`;
}

function createSettingsSignature(plan: SettingsToolPlan): string {
  return `settings:${plan.request.theme ?? ""}:${String(plan.request.maxLetMeKnows)}:${String(
    plan.request.completionAnimation
  )}:${String(plan.request.completionNotifications)}`;
}

function createImageSignature(plan: ImageGenerationPlan): string {
  return `image:${plan.provider ?? ""}:${plan.model ?? ""}:${plan.prompt.trim().toLowerCase()}:${plan.count ?? 1}`;
}

function limitImageGenerationPlans(plans: ImageGenerationPlan[]): ImageGenerationPlan[] {
  const selected: ImageGenerationPlan[] = [];
  let remaining = 1;

  for (const plan of plans) {
    if (remaining <= 0) {
      break;
    }

    const requested = typeof plan.count === "number" && Number.isFinite(plan.count) ? Math.round(plan.count) : 1;
    const count = Math.min(remaining, Math.max(1, Math.min(1, requested)));
    selected.push({ ...plan, count });
    remaining -= count;
  }

  return selected;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException("The current request was stopped.", "AbortError");
  }
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "AbortError";
}

function isReportableProviderError(message: string, title: string): boolean {
  const combined = `${title} ${message}`.toLowerCase();

  if (/needs an api key|api key needed|disabled in settings|selected provider is disabled|missing api key/.test(combined)) {
    return false;
  }

  if (/abort|stopped|cancelled|canceled/.test(combined)) {
    return false;
  }

  return /timeout|failed|empty|status\s+\d{3}|network|provider|model/.test(combined);
}

class ApprovalPendingError extends Error {
  constructor() {
    super("Approval pending.");
    this.name = "ApprovalPendingError";
  }
}

function cleanToolErrorMessage(message: string): string {
  return message.replace(/\bfetch failed\b/gi, "The network request failed").replace(/\s+/g, " ").trim();
}

function createEmptyProviderError(providers: ProviderSettings): ProviderError {
  const provider = providers.activeProvider;
  const config = providers[provider];
  const providerLabel = providerLabels[provider];

  return {
    id: `${provider}-empty-response`,
    provider,
    providerLabel,
    model: config.model,
    title: `${providerLabel} returned no usable answer`,
    message: `${providerLabel} did not return usable text for this step. Coder Desktop will try to continue from the latest chat context when auto continue is enabled.`,
    createdAt: new Date().toISOString()
  };
}
