import { app, BrowserWindow, net, protocol, shell, session } from "electron";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { registerIpcHandlers } from "./ipc";
import { cleanupOldCoderDesktopDownloads } from "./downloadCleanup";
import { generatedImageScheme, resolveGeneratedImagePath } from "./generatedImages";
import { installBugReportHandlers, IssueReporter } from "./issueReporter";
import { pollMaintenanceIssues, readActiveMaintenance } from "./maintenance";
import { runProviderTest } from "./providerTester";
import { DesktopStore } from "./store";
import { UpdateService } from "./updates";

let mainWindow: BrowserWindow | null = null;
const safeExternalProtocols = new Set(["http:", "https:", "mailto:"]);
const appName = "Coder Desktop";
const hourlyDiagnosticScanMs = 60 * 60 * 1000;
const backgroundProviderTestMs = 6 * 60 * 60 * 1000;

protocol.registerSchemesAsPrivileged([
  {
    scheme: generatedImageScheme,
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true
    }
  }
]);

async function createWindow(issueReporter: IssueReporter): Promise<void> {
  const preload = path.join(__dirname, "..", "preload", "preload.js");
  const icon = resolveWindowIcon();

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1060,
    minHeight: 720,
    title: appName,
    backgroundColor: "#fbfbfc",
    show: false,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }

    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isTrustedAppUrl(url)) {
      return;
    }

    event.preventDefault();

    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    void issueReporter.reportBug({
      area: "renderer process",
      title: "Renderer process stopped",
      message: details.reason,
      severity: details.reason === "crashed" ? "critical" : "high",
      metadata: {
        reason: details.reason,
        exitCode: details.exitCode
      }
    });
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl) => {
    if (errorCode === -3) {
      return;
    }

    void issueReporter.reportBug({
      area: "renderer load",
      title: "Renderer failed to load",
      message: errorDescription,
      severity: "high",
      metadata: {
        errorCode,
        url: validatedUrl
      }
    });
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  }
}

app.setName(appName);

if (process.platform === "win32") {
  app.setAppUserModelId("com.elijahshepherd.coderdesktop");
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  const store = await DesktopStore.create(app.getPath("userData"));
  const initialMaintenance = await readActiveMaintenance(store.getDataPath());
  if (initialMaintenance) {
    await store.setMaintenance(initialMaintenance);
  }
  registerGeneratedImageProtocol(store.getDataPath());
  const issueReporter = new IssueReporter({
    appVersion: app.getVersion(),
    dataPath: store.getDataPath(),
    getActiveChat: () => {
      const activeId = store.getActiveChatId();
      return activeId ? store.getChat(activeId) ?? null : null;
    }
  });
  installBugReportHandlers(issueReporter);
  const updateService = new UpdateService({
    currentVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    tempDirectory: app.getPath("temp"),
    downloadsDirectory: app.getPath("downloads"),
    portableExecutablePath: process.env.PORTABLE_EXECUTABLE_FILE ?? null,
    currentExecutablePath: process.platform === "win32" && app.isPackaged ? process.execPath : null,
    processId: process.pid,
    parentProcessId: process.ppid,
    currentExecutableMtimeMs: app.isPackaged ? getCurrentExecutableMtimeMs() : null,
    onRevealDownloadedFile: () => undefined,
    onOpenExternalUrl: async (url) => {
      if (!isSafeExternalUrl(url)) {
        throw new Error("The update download URL is not safe to open.");
      }

      await shell.openExternal(url);
    },
    onQuitForInstall: () => app.quit()
  });

  registerIpcHandlers(store, updateService, issueReporter);
  await createWindow(issueReporter);
  schedulePostInstallDownloadCleanup(issueReporter);
  scheduleStartupUpdateCheck(updateService, issueReporter);
  scheduleBackgroundProviderTests(store, issueReporter);
  scheduleHourlyDiagnosticScans(store, issueReporter);
  startMaintenancePolling(store, issueReporter);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow(issueReporter);
    }
  });
});

function registerGeneratedImageProtocol(dataPath: string): void {
  protocol.handle(generatedImageScheme, (request) => {
    const imagePath = resolveGeneratedImagePath(dataPath, request.url);
    return net.fetch(pathToFileURL(imagePath).toString());
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return safeExternalProtocols.has(url.protocol);
  } catch {
    return false;
  }
}

function getCurrentExecutableMtimeMs(): number | null {
  try {
    return statSync(process.execPath).mtimeMs;
  } catch {
    return null;
  }
}

function isTrustedAppUrl(value: string): boolean {
  try {
    const url = new URL(value);

    if (process.env.VITE_DEV_SERVER_URL) {
      return url.origin === new URL(process.env.VITE_DEV_SERVER_URL).origin;
    }

    return url.protocol === "file:";
  } catch {
    return false;
  }
}

function resolveWindowIcon(): string | undefined {
  const candidates = [
    app.isPackaged ? path.join(process.resourcesPath, "icon.png") : path.join(process.cwd(), "build", "icon.png")
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

function scheduleStartupUpdateCheck(updateService: UpdateService, issueReporter: IssueReporter): void {
  setTimeout(() => {
    void updateService
      .checkForUpdate()
      .then((update) => {
        if (update && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("updates:available", update);
        }
      })
      .catch((error) => {
        void issueReporter.reportBug({
          area: "updates",
          title: "Startup update check failed",
          message: error instanceof Error ? error.message : String(error),
          severity: "low",
          stack: error instanceof Error ? error.stack : undefined
        });
        // Startup update checks stay quiet unless a usable update exists.
      });
  }, 2500);
}

function schedulePostInstallDownloadCleanup(issueReporter: IssueReporter): void {
  setTimeout(() => {
    void cleanupOldCoderDesktopDownloads({
      currentVersion: app.getVersion(),
      downloadsDirectory: app.getPath("downloads"),
      tempDirectory: app.getPath("temp")
    })
      .then((result) => {
        if (result.failures.length === 0) {
          return;
        }

        void issueReporter.reportBug({
          area: "download cleanup",
          title: "Old Coder Desktop downloads could not be fully cleaned",
          message: result.failures[0]?.message ?? "One or more old Coder Desktop downloads could not be removed.",
          severity: "low",
          metadata: {
            failureCount: result.failures.length,
            deletedCount: result.deleted.length
          }
        });
      })
      .catch((error) => {
        void issueReporter.reportBug({
          area: "download cleanup",
          title: "Old Coder Desktop download cleanup failed",
          message: error instanceof Error ? error.message : String(error),
          severity: "low",
          stack: error instanceof Error ? error.stack : undefined
        });
      });
  }, 1800);
}

function scheduleBackgroundProviderTests(store: DesktopStore, issueReporter: IssueReporter): void {
  let isRunning = false;

  const runTest = async (): Promise<void> => {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      const result = await runProviderTest(await store.getProvidersWithSecrets(), issueReporter, () => undefined);

      if (result.removals.length > 0) {
        await store.updateProviders(result.providers);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("app:state-changed", await store.getPublicState());
        }
      }
    } catch (error) {
      void issueReporter.reportBug({
        area: "provider health check",
        title: "Background provider health check failed",
        message: error instanceof Error ? error.message : String(error),
        severity: "low",
        source: "health-scan",
        stack: error instanceof Error ? error.stack : undefined
      });
    } finally {
      isRunning = false;
    }
  };

  setTimeout(() => void runTest(), 45_000);
  setInterval(() => void runTest(), backgroundProviderTestMs);
}

function scheduleHourlyDiagnosticScans(store: DesktopStore, issueReporter: IssueReporter): void {
  const runScan = async (): Promise<void> => {
    const activeChatId = store.getActiveChatId();
    const state = await store.getPublicState();

    await issueReporter.runDiagnosticScan({
      activeChatId: activeChatId ?? null,
      activeChatExists: activeChatId ? Boolean(store.getChat(activeChatId)) : true,
      chatCount: state.chats.length,
      provider: state.providers.activeProvider,
      workspaceSelected: Boolean(state.workspace.root),
      windowAlive: Boolean(mainWindow && !mainWindow.isDestroyed())
    });
  };

  setTimeout(() => {
    void runScan().catch((error) => {
      void issueReporter.reportBug({
        area: "diagnostic scan",
        title: "Hourly diagnostic scan failed",
        message: error instanceof Error ? error.message : String(error),
        severity: "medium",
        source: "health-scan",
        stack: error instanceof Error ? error.stack : undefined
      });
    });
  }, 10_000);

  setInterval(() => {
    void runScan().catch((error) => {
      void issueReporter.reportBug({
        area: "diagnostic scan",
        title: "Hourly diagnostic scan failed",
        message: error instanceof Error ? error.message : String(error),
        severity: "medium",
        source: "health-scan",
        stack: error instanceof Error ? error.stack : undefined
      });
    });
  }, hourlyDiagnosticScanMs);
}

const maintenancePollMs = 5 * 60 * 1000;

function startMaintenancePolling(store: DesktopStore, issueReporter: IssueReporter): void {
  const poll = async (): Promise<void> => {
    const command = await pollMaintenanceIssues(store.getDataPath());
    const state = await store.setMaintenance(command);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("app:state-changed", state);
    }
  };

  setTimeout(() => void poll().catch(() => { /* silent */ }), 15_000);
  setInterval(() => void poll().catch(() => { /* silent */ }), maintenancePollMs);
}
