# Architecture

![Architecture](https://img.shields.io/badge/Architecture-desktop%20bridge-111111?style=flat-square)
![Electron](https://img.shields.io/badge/Electron-main%20process-47848f?style=flat-square&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-renderer-61dafb?style=flat-square&logo=react&logoColor=111111)
![TypeScript](https://img.shields.io/badge/TypeScript-shared%20contracts-3178c6?style=flat-square&logo=typescript&logoColor=white)
![Sandboxed renderer](https://img.shields.io/badge/Renderer-sandboxed-4e5158?style=flat-square)

Coder Desktop is a desktop application built with Electron, React, TypeScript, and Electron Builder. The app is organized around a strict separation between the user interface and the local machine operations that require trust.

The architecture has one main purpose: allow the renderer to feel fast and modern while keeping files, shell commands, provider secrets, updates, and local persistence behind controlled desktop APIs.

> [!NOTE]
> This document describes the trusted desktop boundary. The app may look like a web interface, but the sensitive work happens through Electron main-process services.

> [!IMPORTANT]
> Renderer code should never become the authority for files, shell commands, provider secrets, or update downloads.

> [!NOTE]
> In version `0.0.38`, Coder Desktop exposes file actions, folder actions, shell commands, approved Windows PowerShell information commands, internet search, page fetching, queued prompts, progress cards, clarification cards, strict Let Me Know mode, provider fallback models, background provider health checks, NVIDIA FLUX image model scanning, multi-image generation cards, message feedback, automatic bug reports, onboarding profile storage, stop controls, reasoning controls, full-screen auto-saving settings, persisted theme settings, personalization controls, custom accent colors, AI functionality controls, automatic provider-error continuation, safe AI settings changes, generated image short links, native generated image downloads, environment token based GitHub issue submission, safe update download opening, safe Coder Desktop download cleanup, clean dark mode personal and security panels, and strengthened Windows release packaging through the desktop app.

## Runtime Overview

Coder Desktop has four primary runtime layers.

| Layer | Location | Responsibility |
| --- | --- | --- |
| Main process | `src/main` | Owns Electron app lifecycle, windows, IPC handlers, providers, storage, updates, dialogs, local tools, and security checks. |
| Preload bridge | `src/preload` | Exposes a small typed API from the trusted main process to the renderer. |
| Renderer | `src/renderer` | Renders the React interface, manages local UI state, and calls the preload API. |
| Shared code | `src/shared` | Holds shared types, defaults, provider identifiers, and helpers used across runtimes. |

The renderer does not receive direct Node.js access. It cannot directly read arbitrary files, execute shell commands, or access provider secrets. Those operations must cross the preload bridge and be handled by the main process.

> [!TIP]
> When adding a feature, first decide which layer owns the trusted action. UI state belongs in the renderer. Local machine actions belong in the main process.

## Main Process

The main process is the trusted desktop side of the application. It is responsible for:

- Creating the Electron browser window.
- Enforcing renderer sandboxing and context isolation.
- Registering IPC handlers.
- Loading and saving application state.
- Managing provider calls.
- Testing configured provider endpoints, chat models, fallback models, and image models from the trusted desktop side in the background.
- Managing API keys through the local secrets layer.
- Keeping file APIs, shell commands, internet tools, and PowerShell command tools behind explicit permission checks.
- Managing image model scans and image generation requests.
- Sanitizing and sending feedback or bug report issues.
- Handling external links.
- Checking for application updates.
- Opening trusted GitHub Release assets for the current platform and architecture.

The main process should stay explicit. It should prefer small services and functions over hidden behavior because it owns actions that can affect the local machine.

## Preload Bridge

The preload bridge is defined in `src/preload/preload.ts`. It exposes the `window.coderDesktop` API to the renderer through Electron's `contextBridge`.

The preload bridge should remain narrow. Every method should map to an approved IPC channel and return typed data. It should not expose broad filesystem, shell, process, or network access.

> [!WARNING]
> A broad IPC method can accidentally become a local automation backdoor. Prefer specific methods with clear inputs and explicit validation.

Current preload responsibilities include:

- App state loading.
- Chat actions.
- Provider and security settings updates.
- Preferred working folder selection.
- Diff review calls.
- File bridge calls.
- Windows PowerShell command activity calls.
- Internet search and page fetch activity calls.
- Update checks and update progress events.
- Message feedback and automatic bug report requests.
- Image model scans.
- Background provider health check requests.

## Renderer

The renderer is a React application located in `src/renderer`. It is responsible for the product experience:

- Sidebar navigation.
- Searchable chat list.
- Main chat surface.
- Floating composer.
- Local activity cards.
- Todo progress cards.
- Let me know clarification cards.
- Chat access mode controls.
- Settings panel.
- Security panel.
- Update prompt.
- Message feedback actions.
- Image generation cards.

The renderer should treat local machine operations as requests. It asks the desktop API for state, tools, and updates. It should not decide which update URL to trust, which file path is safe, or whether a shell command can run.

## Shared Types

Shared types live in `src/shared/types.ts`. These types define the contract between main, preload, and renderer.

Shared contracts include:

- Chat data.
- Provider configuration.
- Security settings.
- Todo progress messages.
- Clarification question messages.
- Working folder settings.
- File entries.
- Diff previews.
- Shell results.
- Update information.
- Update progress.
- Message feedback.
- Bug reports.
- Image model scans.
- Image generation activities.
- Provider health check progress and sanitized provider health results.
- Personalization and AI functionality settings.

Keeping shared contracts explicit helps prevent accidental drift between the UI and the desktop bridge.

## Data Flow

Typical app startup:

1. Electron starts the main process.
2. The main process configures the app name, permissions, and browser window.
3. The main process creates the local store.
4. IPC handlers are registered.
5. The renderer loads through the Electron window.
6. The renderer calls `getState`.
7. The main process returns public app state without raw secrets.
8. A quiet update check runs in the background.
9. If a compatible newer release exists, the renderer receives an update event and shows the update card.

File read:

1. The renderer asks to list or read a file.
2. The preload bridge forwards the request to the main process.
3. The main process resolves the requested path inside the selected workspace.
4. The main process checks security settings.
5. The main process resolves the filesystem path and applies file limits.
6. The main process returns the file result to the renderer.

This flow is intentionally controlled by the main process and security settings. It should not become direct renderer filesystem access.

Windows PowerShell information command:

1. The user asks for local Windows information, or the provider requests a `windows-ps-group` tool command.
2. The main process checks that the command is approved for read-only information use.
3. The store adds a live PowerShell activity card to the chat.
4. The main process runs PowerShell from the selected workspace.
5. The store updates the card with stdout, stderr, and exit code.
6. The provider receives compact tool-result context and answers from the result.

Typical provider call:

1. The user sends a chat message.
2. The renderer calls the chat send IPC method.
3. The store records the user message.
4. The main process loads provider settings and secrets.
5. The provider service calls the selected provider.
6. The store records the assistant response.
7. The renderer receives updated app state.

## Local State

Application state is stored under Electron's user data path. Public state includes chats, preferred folder information, provider settings without raw keys, and security settings.

Provider keys are handled separately by the secrets layer. When Electron safe storage is available, keys are encrypted through the operating system. If safe storage is not available, the project treats local key storage with the same caution as a developer credential file.

## Local Tools

Local file and shell tools live in `src/main/workspaceTools.ts`. These tools are intentionally owned by the main process and are scoped to the selected workspace.

The layer is expected to:

- Reject operations when the matching permission is disabled.
- Resolve relative file paths from the selected workspace.
- Reject explicit absolute paths that resolve outside the selected workspace.
- Limit oversized file reads.
- Return diffs before writes.
- Run shell commands only when explicitly enabled.
- Limit automatic Windows information command use to approved read-only commands.
- Run internet search and page fetch tools only when internet access is enabled by the chat access mode and security settings.

This layer should stay conservative because it touches user files.

> [!CAUTION]
> Local path handling must stay explicit. A path can point at important user data, so file edits and deletes should stay permission-gated and visible through chat cards.

## Provider Layer

Provider logic lives in `src/main/providers.ts` and shared provider helpers live in `src/shared/providers.ts`.

Provider settings are sanitized before use. Supported provider identifiers are defined centrally so the renderer and main process agree on valid provider values.

The provider layer should stay replaceable. New providers should be added through explicit provider identifiers, default settings, validation, and typed request handling.

## Update Layer

Update logic lives in `src/main/updates.ts`.

The update service:

- Fetches GitHub Release metadata from the main process.
- Compares semantic versions.
- Selects the best asset for the current platform and architecture.
- Opens the matching GitHub Release asset in the user's browser when the user chooses Click here to install.
- Keeps installation decisions and download URL selection in the trusted main process.

The renderer only displays the result. It does not choose the release URL or decide whether an asset is trusted.

## Release Architecture

Release packaging is split between local builds and GitHub automation.

Windows artifacts can be built locally with PowerShell and Electron Builder. macOS application ZIP files must be built on macOS, either locally on macOS or through the `Build macOS Downloads` GitHub Actions workflow.

Release files live in versioned folders under `downloads`. Each release folder should include a manifest that records file sizes and SHA-256 hashes. GitHub Releases should publish the actual artifacts from the matching folder.

> [!IMPORTANT]
> A release folder is not complete unless the GitHub Release has real downloadable assets for users. Git LFS pointers are useful in the repository, but release pages must provide the actual files.

## Design Constraints

Important architectural constraints:

- Do not give renderer code direct Node.js access.
- Do not move file safety checks into React.
- Do not trust renderer-provided update URLs.
- Do not store raw API keys in public renderer state.
- Do not add a broad IPC method when a narrow method is enough.
- Do not make release folders look complete unless the downloads are real.
