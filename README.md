# Coder Desktop

![Official project](https://img.shields.io/badge/Official-Coder%20Desktop-111111?style=flat-square)
![Current version](https://img.shields.io/badge/Current%20version-0.1.0-2f3238?style=flat-square)
![GitHub release](https://img.shields.io/github/v/release/elijahshepherd/Coder-Desktop?style=flat-square&label=GitHub%20Release)
![CI](https://img.shields.io/github/actions/workflow/status/elijahshepherd/Coder-Desktop/ci.yml?branch=main&style=flat-square&label=CI)
![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-brightgreen?style=flat-square&logo=node.js&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-desktop-47848f?style=flat-square&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-interface-61dafb?style=flat-square&logo=react&logoColor=111111)
![TypeScript](https://img.shields.io/badge/TypeScript-strict%20contracts-3178c6?style=flat-square&logo=typescript&logoColor=white)
![Local tools](https://img.shields.io/badge/Local%20tools-main%20process-4e5158?style=flat-square)
![Read only open source](https://img.shields.io/badge/Open%20source-read--only-6f747d?style=flat-square)
![Windows](https://img.shields.io/badge/Windows-installer-0078d4?style=flat-square&logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-zip%20builds-999999?style=flat-square&logo=apple&logoColor=white)

<img width="21600" height="10800" alt="Coder Desktop Banner" src="https://github.com/user-attachments/assets/e69c8668-3872-4d0f-ac32-01861d783385" />

Coder Desktop is a local-first AI coding workspace that gives you the power of AI-assisted development inside a real desktop app while keeping full ownership of your projects, files, tools, and workflow in one secure, unified environment.

The goal is simple: make software development feel calmer, more capable, and more under the user's control.

## Project Identity

Coder Desktop is a **Project By Rubic**. Development is by **Elijah Shepherd**.

This repository is the desktop version of Coder. Other Coder projects, including the CLI, are still in active development and will be added to GitHub when they are ready for public release.

> [!NOTE]
> Coder Desktop is a desktop application. Browser renderer checks are only for development and documentation review.

> [!IMPORTANT]
> Official downloads should come from the versioned GitHub Release page. The `downloads` folder mirrors release artifacts for the repository archive, but a plain checkout may show Git LFS pointer files instead of full binaries.

> [!TIP]
> Badge meanings, documentation tags, and maintenance rules are explained in [docs/status-badges.md](docs/status-badges.md).

## What Coder Desktop Is

Coder Desktop is an Electron, React, and TypeScript application designed around local desktop control. It keeps project work on the user's computer, asks configured AI providers for help, and keeps sensitive desktop capabilities behind a controlled bridge.

The app is intended to feel closer to a focused coding workbench than a general chat product. The main experience is an adjustable sidebar, a central conversation surface, a floating composer, local activity cards, and a bottom-right settings card.

## Product Principles

- Local-first by default. Project files and local tools remain on the user's computer unless the user chooses what to send to a provider.
- Provider-flexible. The app supports multiple AI providers instead of locking users into one service.
- Calm interface. The UI should feel soft, minimal, and professional, with motion used carefully.
- Explicit permission boundaries. File tools, folder tools, shell commands, and permission prompts are controlled through settings.
- Real desktop releases. Downloads should be actual packaged applications, with release assets attached to GitHub Releases.
- Human documentation. Documentation should explain the product clearly and completely.

## Core Capabilities

Coder Desktop includes the foundations expected from an AI coding workspace:

- New chats and searchable chat history.
- OpenAI, Claude, and NVIDIA provider configuration.
- Local API key storage through the desktop app.
- Preferred working folder selection and recent folder tracking.
- Local tool activity cards for file edits, folder changes, shell commands, and Windows information commands.
- Web search and public page fetching through main-process internet tools.
- Queued prompts while a chat is already working.
- Todo progress cards and Let me know clarification cards for larger or unclear tasks.
- A strict Let me know mode that asks before inferring missing details when enabled.
- End-of-message copy, like, dislike, and response timing actions.
- Sanitized GitHub feedback and automatic bug reporting when GitHub authentication is available.
- In-chat image generation cards.
- Full-screen tabbed settings for providers, access, personalization, AI functionality, and local maintenance.
- Auto-saving settings changes across the desktop settings surface.
- A security panel for file reading, file editing, shell commands, internet access, and permission prompt controls.
- Up to three fallback models per provider.
- Background provider health checks that remove clearly failing fallback or image models and report sanitized evidence only when problems occur.
- NVIDIA FLUX image model scanning and selected image model settings.
- Image generation fallback across configured NVIDIA FLUX models.
- Multiple image generation for one to three requested images in a single response.
- Copy image link actions for generated images.
- Reasoning effort controls for models that support reasoning.
- Custom accent color personalization with theme-aware contrast protection.
- Adjustable and collapsible sidebar.
- Theme switching inside Settings, chat creation, settings access, and sidebar behavior inside the desktop app.
- Startup update checks through GitHub Releases.
- Windows and macOS release packaging.
- Background-free Coder Desktop logo rendering in the app.

## Desktop Application Shape

Coder Desktop has three main runtime surfaces:

- Sidebar. Shows navigation, chats, search, settings access, and collapse controls.
- Chat surface. Shows the active chat, the build prompt, model status, local activity cards, queued prompts, and the composer.
- Settings card. Opens from the bottom-right control and contains provider and security settings.

The renderer is intentionally isolated from direct Node.js access. It talks to the desktop system through a preload bridge. The main process owns provider calls, local persistence, dialogs, updates, and permission enforcement.

## AI Providers

The project currently supports these provider families:

- OpenAI.
- Claude.
- NVIDIA.

Each provider has configurable model, base URL, and API key fields. Provider settings are sanitized before storage. API keys are stored locally and are handled separately from normal public app state.

More provider details are available in [docs/provider-setup.md](docs/provider-setup.md).

## Local Tools

Coder Desktop exposes local capabilities through the trusted Electron main process, not through direct renderer access.

Current tool behavior includes:

- File listing through the trusted desktop bridge.
- File reading through the trusted desktop bridge.
- File editing with compact diff summaries.
- File and folder creation.
- File and folder deletion.
- Shell commands from the selected workspace when shell access is enabled.
- Windows PowerShell information cards for approved read-only commands such as `systeminfo`, `ipconfig`, `tasklist`, `Get-Process`, `Get-Service`, `whoami`, `hostname`, and `Get-Date`.
- Internet search and public page fetching when internet access is enabled.
- Progressive chat state updates so a command can appear as an active card while the app is working.
- A branded provider system prompt that explains the current tool state and tool request formats.
- Clean activity cards that show tool work in chat, including edit summaries such as `+45 -31`.

File and folder tools use the selected workspace. Explicit absolute paths are accepted only when they resolve inside that workspace. PowerShell information cards remain limited to approved information commands. Shell commands are controlled by the shell command permission.

## Security Model

Coder Desktop is designed around explicit local permissions. The security model is not meant to replace careful user judgment, but it does make sensitive actions visible and configurable.

Important defaults and controls include:

- Renderer sandboxing.
- Context isolation.
- No direct renderer Node.js access.
- Default-deny browser permission requests.
- External navigation restricted to safe protocols.
- Read file, edit file, and shell command controls.
- Permission prompt controls.

More detail is available in [docs/security.md](docs/security.md).

## Updates

The app can quietly check GitHub Releases when it opens. If a newer compatible release exists, the user sees a small corner prompt with the new version number and a `Click here to install` action. The prompt is version-based, so the app does not ask the user to reinstall the same version.

The update flow is intentionally split:

- The main process checks GitHub Releases.
- The main process chooses the correct asset for the current platform and CPU architecture.
- The renderer only displays update information and progress.
- The Click here to install button opens the matching GitHub Release asset for the current operating system and CPU architecture.
- Windows, macOS, and other packaged formats are handled as release downloads instead of trusted renderer-provided URLs.

This keeps download decisions away from untrusted renderer input and prevents the app from closing before the user reaches the real GitHub download.

## Release Downloads

Release artifacts live in versioned folders under [downloads](downloads). Older release folders can be moved or copied into [old-downloads](old-downloads) as the public archive grows.

Typical artifacts include:

- Windows setup installer for x64.
- Windows portable executable for x64.
- Windows ZIP archive for x64.
- Windows ZIP archive for ARM64.
- macOS ZIP archive for x64.
- macOS ZIP archive for ARM64.
- Windows installer blockmap for update tooling.
- Manifest with artifact sizes and SHA-256 hashes.

GitHub Releases should attach the real files from the matching download folder. Binary artifacts are tracked through Git LFS in the repository, so the release page is the source of truth for normal user downloads.

## SmartScreen And Signing

Windows SmartScreen reputation cannot be solved only by application code. A production release should be signed with a trusted code-signing certificate, timestamped, distributed consistently, and submitted to Microsoft when reputation or false-positive issues need review.

The project includes packaging support, icons, metadata, and NSIS configuration. A trusted release environment still needs a real certificate and stable publisher identity.

More detail is available in [docs/code-signing-and-smartscreen.md](docs/code-signing-and-smartscreen.md).

## Development Requirements

Recommended local tools:

- Node.js 20 or newer.
- npm.
- Git.
- Git LFS.
- PowerShell on Windows.

Install dependencies:

```powershell
npm install
```

Run the desktop app in development:

```powershell
npm run dev
```

Run the core checks:

```powershell
npm run typecheck
npm test
npm run build
```

Run a full local Windows release build:

```powershell
npm run release:current
```

## Packaging

The project uses Electron Builder for desktop packaging.

Common commands:

```powershell
npm run package
npm run dist
npm run release:windows
npm run release:windows:nsis
npm run release:macos
npm run release:manifest
```

Notes:

- Windows artifacts can be built locally on Windows.
- macOS application ZIPs should be built on macOS or through the macOS GitHub Actions workflow.
- The manifest script records artifact sizes and hashes.
- Release folders should not contain empty or temporary download files.

## Repository Layout

Important paths:

- [src/main](src/main): Electron main process code, IPC handlers, providers, storage, local tools, and updates.
- [src/preload](src/preload): Secure preload bridge exposed to the renderer.
- [src/renderer](src/renderer): React app, UI components, hooks, CSS, and browser development API.
- [src/shared](src/shared): Shared types, defaults, and cross-runtime helpers.
- [docs](docs): Product, security, architecture, provider, and signing documentation.
- [docs/features](docs/features): Feature guides for chat workflow, local tools, providers, updates, and security behavior.
- [docs/releases](docs/releases): Version-specific release notes.
- [downloads](downloads): Public release artifact folders.
- [old-downloads](old-downloads): Archive area for older public release artifacts.
- [.github](.github): Workflows, issue templates, and repository automation.

## Documentation

Project documentation:

- [Architecture](docs/architecture.md)
- [Security](docs/security.md)
- [Provider setup](docs/provider-setup.md)
- [Feature guide](docs/features/README.md)
- [Future features](docs/future-features.md)
- [Code signing and SmartScreen](docs/code-signing-and-smartscreen.md)
- [Open source policy](docs/open-source-policy.md)
- [Status badges and documentation tags](docs/status-badges.md)

Repository documentation:

- [Contributing](CONTRIBUTING.md)
- [Support](SUPPORT.md)
- [Security policy](SECURITY.md)
- [Governance](GOVERNANCE.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [License](LICENSE.md)
- [Notice](NOTICE.md)

## Repository Policy

Coder Desktop is published for transparency and public inspection. The repository is source-available and read-only for public contribution unless Elijah Shepherd explicitly invites a change.

Issues may be used for reports and project communication. Pull requests are not accepted by default.

## Project Status

Coder Desktop is early, but it is being structured like a real desktop product. The current focus is reliable packaging, trustworthy downloads, provider configuration, interface quality, clear security controls, and clear documentation.
