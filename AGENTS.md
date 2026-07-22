# Coder Desktop — Agent Instructions

## Project Overview

Coder Desktop is a local-first AI coding workspace built with **Electron + React + TypeScript**. It uses a strict **main/preload/renderer** architecture with sandboxed renderer and context isolation. All local system access (file I/O, shell commands, provider calls) happens in the trusted main process via a secure preload bridge.

**Repository**: elijahshepherd/Coder-Desktop-Clean
**Default branch**: master

---

## Commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev (renderer + main) | `npm run dev` |
| Typecheck | `npm run typecheck` |
| Test (vitest) | `npm test` |
| Test single file | `npx vitest run src/shared/providers.test.ts` |
| Build (production) | `npm run build` |
| Package (no installer) | `npm run package` |
| Dist (Windows NSIS) | `npm run dist` |
| Release Windows | `npm run release:windows` |
| Release macOS | `npm run release:macos` |
| Generate manifest | `npm run release:manifest` |

**Key scripts in package.json**:
- `sync:version` — writes shared version to `src/shared/version.ts` (runs before dev/typecheck/test/build/package/dist)
- `dev` — runs Vite dev server + Electron concurrently
- `build` — clean + typecheck + vite build + tsc for main/preload
- `dist` — build + electron-builder (Windows NSIS installer)

---

## Architecture

### Process Separation

```
src/
├── main/          # Electron main process (Node.js, full system access)
│   ├── main.ts           # App entry, window creation, lifecycle
│   ├── ipc.ts            # IPC handler registration
│   ├── store.ts          # SQLite-backed persistence (chats, settings, providers)
│   ├── providers.ts      # AI provider implementations (OpenAI, Claude, NVIDIA)
│   ├── workspaceTools.ts # File/folder/shell tools exposed via IPC
│   ├── updates.ts        # GitHub Releases update checking
│   └── *.test.ts         # Unit tests alongside source
├── preload/       # Secure bridge (contextIsolation + sandbox)
│   └── preload.ts        # Exposes `window.coderDesktop` API to renderer
├── renderer/      # React app (sandboxed, no Node access)
│   ├── App.tsx           # Root component
│   ├── main.tsx          # Entry point
│   ├── components/       # UI components
│   ├── hooks/            # React hooks (useCoderDesktopState, etc.)
│   ├── api/              # Type-safe wrappers for preload API
│   └── styles.css        # Global styles
├── shared/        # Types & constants shared across processes
│   ├── types.ts          # All IPC contracts, AppState, settings types
│   ├── providers.ts      # Provider config types
│   ├── workspace.ts      # Workspace types
│   └── version.ts        # Injected app version (from sync:version)
```

### Security Model
- **Renderer**: sandboxed, `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`
- **Preload**: Only exposes typed `DesktopApi` via `contextBridge.exposeInMainWorld("coderDesktop", api)`
- **Main**: Owns all privileged operations (file system, shell, network, provider API keys, auto-updater)
- **IPC**: All communication via `ipcRenderer.invoke` / `ipcMain.handle` — no raw events

### Key IPC Patterns
```typescript
// preload.ts — exposed API shape
api: DesktopApi = {
  getState: () => ipcRenderer.invoke("app:get-state"),
  sendMessage: (chatId, content) => ipcRenderer.invoke("chat:send", chatId, content),
  listFiles: () => ipcRenderer.invoke("files:list"),
  runCommand: (cmd) => ipcRenderer.invoke("shell:run", cmd),
  // ... all methods are invoke-based (promise)
}

// main/ipc.ts — handler registration
ipcMain.handle("files:list", async () => { /* filesystem access */ });
```

---

## Build & Release Pipeline

### Local Windows Build
```powershell
npm run release:windows
# or directly:
powershell -ExecutionPolicy Bypass -File scripts/build-windows.ps1
```
- Builds NSIS installer for x64 (and arm64 on ARM64 host)
- Creates distribution ZIP of the installer
- Validates installer > 10MB, ZIP > 10MB

### GitHub Actions Release (trigger: push tag `v*`)
**`.github/workflows/publish-release.yml`**:
1. **build-windows** (windows-latest) → `npm run release:current` → uploads artifacts
2. **build-macos** (macos-latest) → `electron-builder --mac zip --x64 --arm64` → uploads artifacts
3. **publish** (ubuntu-latest) → downloads both, creates versioned `downloads/vX.Y.Z/{Windows,macOS}/`, generates `manifest.json`, creates/updates GitHub Release with assets and notes from `docs/releases/X.Y.Z.md`

### macOS Build (manual or workflow_dispatch)
```bash
npm run build && npm exec electron-builder -- --mac zip --x64 --arm64
```

### Artifact Structure
```
downloads/v0.1.0/
├── Windows/
│   ├── Coder-Desktop-0.1.0-setup-win-x64.exe      # NSIS installer
│   ├── Coder-Desktop-0.1.0-setup-win-x64.exe.blockmap
│   └── Coder-Desktop-0.1.0-win-x64.zip            # ZIP of installer
└── macOS/
    ├── Coder-Desktop-0.1.0-mac-x64.zip
    └── Coder-Desktop-0.1.0-mac-arm64.zip
```

### Version Management
- Version lives in `package.json` (source of truth)
- `scripts/write-shared-version.mjs` copies it to `src/shared/version.ts` for runtime access
- Run `npm run sync:version` manually if needed

---

## Key Conventions

### File Organization
- Tests live **next to source**: `store.ts` ↔ `store.test.ts`
- Shared types in `src/shared/types.ts` — single source of truth for IPC contracts
- No barrel exports; import directly from file paths

### TypeScript
- **Strict mode** in all tsconfigs
- Main/preload: `module: CommonJS`, `outDir: dist`
- Renderer: `module: ESNext`, `moduleResolution: Bundler`, no emit
- Shared types included in both main and renderer tsconfigs

### Electron Builder Config (`electron-builder.yml`)
- `asar: true` — app code packaged into asar
- `afterPack: scripts/stamp-windows-executable.cjs` — stamps version/copyright/icon on Windows EXE
- **Windows**: NSIS only (no portable, no ZIP target); `oneClick: false`, `allowToChangeInstallationDirectory: true`
- **macOS**: `dmg` + `zip` targets for x64 + arm64
- **Linux**: AppImage + zip (not actively tested)
- `files: ["**/*"]` with extensive exclusions (node_modules, release, .git, tests, scripts, etc.)

### Git & Large Files
- Binary artifacts in `downloads/v*/` are tracked via **Git LFS** (`.gitattributes` tracks `*.exe`, `*.zip`, `*.blockmap`, `*.dmg`, `*.AppImage`)
- `.gitignore` excludes `release/`, `dist/`, `node_modules/`, `*.log`, `.vite/`
- **Do not commit large binaries directly** — they go to GitHub Releases via the publish workflow

### Code Style
- ESLint not configured (TypeScript strict mode serves as primary check)
- Prettier not configured
- 2-space indent, single quotes, semicolons (enforced by TS)
- No enums — use `const` objects or union types
- Prefer `type` over `interface` for simple shapes

### Naming
- Files: PascalCase for components (`Sidebar.tsx`), camelCase for utilities (`write-download-manifest.mjs`)
- IPC channels: `namespace:action` (e.g., `chat:send`, `files:list`, `providers:test`)
- Environment vars: `CSC_LINK`, `CSC_KEY_PASSWORD`, `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` for code signing

---

## Common Tasks

### Add a New IPC Channel
1. Add method to `DesktopApi` in `src/shared/types.ts`
2. Implement in `src/preload/preload.ts` (expose via `ipcRenderer.invoke`)
3. Register handler in `src/main/ipc.ts` (use `ipcMain.handle`)
4. Use in renderer via `window.coderDesktop.newMethod()`

### Add a New AI Provider
1. Add provider config type to `src/shared/providers.ts`
2. Implement in `src/main/providers.ts` (follow OpenAI/Claude/NVIDIA patterns)
3. Add validation/test in `src/main/providers.test.ts`
4. Update provider UI in `src/renderer/components/SettingsPanel.tsx`

### Modify Build Output
- Windows: edit `scripts/build-windows.ps1` or `electron-builder.yml` (win/nsis sections)
- macOS: edit `.github/workflows/build-macos-downloads.yml` or `scripts/build-macos-downloads.sh`
- Manifest: `scripts/write-download-manifest.mjs`

### Run Tests for Specific Test in Watch Mode
```bash
npx vitest
# or single file:
npx vitest run src/shared/providers.test.ts
```

---

## Platform Notes

| Platform | Build Host | Artifacts |
|----------|------------|-----------|
| Windows x64 | Windows (local or GH Actions) | NSIS installer (.exe), blockmap, ZIP of installer |
| Windows ARM64 | ARM64 Windows host only | Same as x64 |
| macOS x64 | macOS (GH Actions) | ZIP |
| macOS ARM64 | macOS (GH Actions) | ZIP |
| Linux | Linux (GH Actions) | AppImage, ZIP (untested) |

---

## Documentation References

- `docs/architecture.md` — Full architecture diagram and data flow
- `docs/security.md` — Security model details
- `docs/provider-setup.md` — Provider configuration guide
- `docs/features/README.md` — Feature guides index
- `docs/code-signing-and-smartscreen.md` — Windows signing guide
- `docs/releases/0.1.0.md` — Release notes template
- `README.md` — Project overview, badges, quick start