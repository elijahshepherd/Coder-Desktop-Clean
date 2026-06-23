# Providers And Updates

![Providers](https://img.shields.io/badge/Providers-OpenAI%20Claude%20NVIDIA-111111?style=flat-square)
![Fallbacks](https://img.shields.io/badge/Fallbacks-up%20to%203%20models-4e5158?style=flat-square)
![Reasoning](https://img.shields.io/badge/Reasoning-model%20aware-6f747d?style=flat-square)
![Image models](https://img.shields.io/badge/Image%20models-scanned-202124?style=flat-square)
![Updates](https://img.shields.io/badge/Updates-GitHub%20Releases-202124?style=flat-square)
![Downloads](https://img.shields.io/badge/Downloads-real%20artifacts-2f3238?style=flat-square)

Coder Desktop supports multiple AI providers and a release update flow that checks GitHub Releases for newer desktop builds.

> [!NOTE]
> Provider calls can send chat content and tool context to the selected provider. Local-first means the desktop app controls local tools and files. It does not mean every provider request stays on the machine.

## Supported Providers

Coder Desktop currently supports:

- OpenAI.
- Claude.
- NVIDIA.

Each provider has:

- Enabled state.
- API key.
- Model.
- Up to three fallback models.
- Base URL.
- Reasoning effort when the model supports it.
- Image model scanning and image model selection.

## Primary Provider

The selected provider is the primary provider for new chat requests. The settings card shows which provider is primary with a neutral moving border around the card.

Changing the primary provider updates app state immediately.

## API Keys

API keys are entered inside the settings card and saved locally. Public renderer state does not expose the raw key.

When a key already exists, the settings field can show that it is saved locally without revealing the value.

> [!CAUTION]
> API keys should never appear in screenshots, logs, release notes, documentation examples, public issues, or Git commits.

## Model Defaults

Version `0.0.38` uses practical defaults that can be changed by the user:

| Provider | Default model | Default reasoning |
| --- | --- | --- |
| OpenAI | `gpt-5-mini` | Medium |
| Claude | `claude-haiku-4-5` | None |
| NVIDIA | `z-ai/glm-5.1` | High |

Fallback model fields let the user keep known alternatives available when a provider is slow, rate limited, or temporarily unavailable.

## Image Models

NVIDIA includes a `Scan image models` action for FLUX image models. OpenAI and Claude show a clear message that image generation is available through NVIDIA FLUX models.

The scan checks the configured provider endpoint and updates:

- NVIDIA FLUX image model choices.
- Selected NVIDIA FLUX image model.
- Scan status.
- No-model messages.

Image generation models are limited to NVIDIA FLUX choices. Coder Desktop treats OpenAI-compatible NVIDIA FLUX models and FLUX GenAI hosted models as separate request paths so a NVIDIA image request does not become an OpenAI configuration error. Claude is shown as unavailable for native image generation in this app.

> [!NOTE]
> Image generation availability can change by account and endpoint. The scan is preferred over hard-coding one universal list for every user.

## Fallback Models

Each provider can store up to three fallback models.

The request order is:

1. Primary model.
2. First fallback model.
3. Second fallback model.
4. Third fallback model.

Fallbacks are attempted for errors that often recover with another model:

- Timeout.
- Rate limit.
- Temporary provider errors.
- Server errors.
- Gateway errors.

Fallbacks are not intended to hide all configuration problems. If a key is missing or a model is not available to the account, the app should show a readable provider error card.

## Reasoning Effort

Reasoning controls appear when the model name looks like a reasoning-capable model. Supported values are:

- None.
- Low.
- Medium.
- High.

For OpenAI-compatible providers, reasoning effort is sent as `reasoning_effort` only when the selected model appears to support that field. This avoids sending unsupported parameters to ordinary models.

## Provider Errors

Provider errors are rendered as cards. A provider error card should show:

- Provider.
- Model.
- Status code when available.
- A clear title.
- A concise explanation.
- Tried models when fallback was used.

Provider errors should not dump raw request payloads.

## Background Provider Health Checks

Coder Desktop runs provider health checks automatically in the background from the trusted desktop process. Users do not need to start these checks manually.

The background check can verify:

- Configured provider base URLs.
- Primary chat models.
- Fallback chat models.
- Supported image generation models.

When a fallback model or image model clearly fails, Coder Desktop removes that failing model from the saved public provider settings. If the primary chat model fails but a fallback model works, the app can promote the working fallback so chat can continue with a usable configuration.

Missing API keys are skipped as setup work instead of counted as failures. NVIDIA image model 404 responses can remove failing configured image models when another configured FLUX model remains available.

When a background check finds reportable failures, Coder Desktop sends or saves a sanitized issue report for the app developer. The report can include provider names, model names, status codes, base URL host information, and failure summaries. It must not include API keys, raw secrets, raw chat history, or private file contents. Expected setup gaps, skipped checks, and duplicate fallback timeouts should not create noisy high-severity reports.

## Update Checks

Coder Desktop checks GitHub Releases quietly after startup. If a compatible newer release exists, the renderer shows a corner update card.

The updater compares normalized semantic versions. It should not offer to install the same version again.

> [!IMPORTANT]
> A user who installs `0.0.38` should not be prompted to install `0.0.38` again.

The update card shows the new version and one clear action: `Click here to install`. The action opens the matching GitHub Release asset for the user's operating system and CPU architecture. Coder Desktop does not attempt to install the update directly from inside the app, and it does not close itself as part of the handoff.

After the app opens, Coder Desktop safely removes app-owned staged update folders and older Coder Desktop release artifacts from the user's Downloads folder. The cleanup is intentionally narrow: it only targets Coder Desktop installer, portable, ZIP, blockmap, DMG, MSI, and AppImage files from older versions, plus Coder Desktop update staging folders. It does not delete unrelated downloads.

## Asset Selection

The update service chooses assets by platform and CPU architecture.

Windows preference order:

1. Setup installer.
2. Portable executable.
3. ZIP archive.

macOS preference order:

1. ZIP archive.
2. Disk image if one exists.

Linux preference order:

1. AppImage.
2. ZIP archive.

## Downloads

Release downloads are versioned under `downloads`.

For public release use, assets should also be attached to the matching GitHub Release. The release page is the safest place for users to download because it serves the actual uploaded binaries.

Each release folder should include a manifest with:

- File name.
- File size.
- SHA-256 hash.
- Version.
- Creation time.

> [!WARNING]
> Do not publish empty downloads, placeholder files, or instructions that pretend a missing artifact exists.

## Packaging

Windows packaging is supported locally through PowerShell and Electron Builder. macOS artifacts should be built on macOS or through the macOS GitHub Actions runner.

Package identity includes:

- Product name.
- App id.
- App icon.
- Artifact names.
- Version number from `package.json`.

## Release Checklist

Before publishing a release:

- Bump `package.json`.
- Bump `package-lock.json`.
- Update `CHANGELOG.md`.
- Add release notes under `docs/releases`.
- Add a `downloads/<version>` folder.
- Run tests.
- Run typecheck.
- Run the production build.
- Build local Windows downloads when possible.
- Push the tag.
- Confirm GitHub Release assets are real.
- Confirm the app opens with the correct icon and version.

> [!TIP]
> The updater only works correctly when the installed app version and GitHub Release tag are aligned.
