# Feature Guide

![Feature guide](https://img.shields.io/badge/Guide-features-111111?style=flat-square)
![Current version](https://img.shields.io/badge/Current%20version-0.1.0-2f3238?style=flat-square)
![Desktop app](https://img.shields.io/badge/Desktop-real%20application-4e5158?style=flat-square)
![Local tools](https://img.shields.io/badge/Local%20tools-main%20process-6f747d?style=flat-square)
![Provider fallback](https://img.shields.io/badge/Providers-fallback%20models-202124?style=flat-square)

This folder explains the main Coder Desktop features in practical detail. It is meant for users, maintainers, and future contributors who need to understand what the app does without reading the entire codebase first.

> [!NOTE]
> Coder Desktop is a desktop application. Browser renderer checks are useful for UI development, but the real product is the packaged app that runs on the user's computer.

> [!IMPORTANT]
> Feature documentation should describe implemented behavior. Planned work belongs in issues, roadmaps, or release notes, not in this folder as if it already exists.

## Feature Areas

| Area | Document | What it covers |
| --- | --- | --- |
| Chat workflow | [chat-workflow.md](chat-workflow.md) | Chats, queued prompts, progress cards, clarification cards, Markdown, copy buttons, titles, and loading states. |
| Local tools and security | [local-tools-and-security.md](local-tools-and-security.md) | File reading, file writing, create and delete actions, shell commands, Windows information cards, web tools, and access modes. |
| Providers and updates | [providers-and-updates.md](providers-and-updates.md) | OpenAI, Claude, NVIDIA, API keys, model fallback, reasoning effort, update checks, and release downloads. |
| Feedback and reporting | [feedback-and-reporting.md](feedback-and-reporting.md) | End-of-message feedback, GitHub issue reports, automatic bug reporting, privacy filtering, and spam protection. |
| Image generation | [image-generation.md](image-generation.md) | NVIDIA FLUX image model scanning, chat image generation cards, fallback behavior, copy links, and one to three image requests. |

## Current Feature Summary

Coder Desktop `0.0.38` includes these major capabilities:

- Searchable local chats.
- Independent chat sessions.
- Queued prompts while a chat is already working.
- Compact expandable tool cards.
- Todo progress cards for larger AI tasks.
- Let me know cards for clarification questions.
- Strict Let Me Know mode for users who want the assistant to ask instead of infer when missing details matter.
- Markdown rendering with tables, code blocks, inline code, links, lists, quotes, and rules.
- Copy buttons for inline code, code blocks, command chips, paths, and outputs.
- End-of-message copy, like, dislike, and response timing actions.
- Feedback reports that send public GitHub issues through the configured token, or save locally when no token is set.
- Automatic bug reports for real app failures, with no browser or Git credential helper side effects.
- Sanitized report payloads with dedupe and daily limits.
- Provider settings for OpenAI, Claude, and NVIDIA.
- Local API key storage.
- Primary provider selection.
- Up to three fallback models per provider.
- Background provider health checks for base URLs, primary models, fallback models, and supported image models.
- Automatic sanitized provider issue reports only when real problems are found.
- NVIDIA FLUX image model scanning.
- FLUX-only image generation models.
- Chat image generation cards with one to three generated images.
- Full card image generation animation during thinking with the prompt anchored underneath.
- Native Download action for every generated image, with the saved file revealed in the system file explorer.
- Fallback image generation across configured NVIDIA FLUX models with one concise failure message.
- Reasoning effort controls when the selected model supports reasoning.
- Read, edit, create, and delete file or folder actions.
- Shell command execution when enabled.
- Approved Windows PowerShell information commands.
- Web search and public web page fetching.
- Chat access mode selection.
- Full-screen tabbed settings for providers, access, personalization, AI functionality, and local maintenance.
- Auto-saving settings changes.
- Security settings for local and internet behavior with a consistent dark mode surface across Personalization, Security, and Local settings.
- Personalization controls for theme, accent tone, completion animation, and desktop notifications.
- Custom accent color personalization with readability safeguards.
- Background-free logo rendering and calmer personalization controls.
- Max Let Me Knows switch for strict clarification behavior.
- Quiet update checks against GitHub Releases.
- Update cards that show the new version and a Click here to install action.
- Click here to install opens the matching GitHub Release asset for the user's operating system.
- Stop controls that cancel active generation without provider-error retries.
- A safe AI settings tool for allowed preference changes.
- Safe cleanup for old Coder Desktop update downloads and release artifacts.
- Real versioned release downloads.
- Packaged desktop icons for installed builds.

## How To Read These Docs

Start with the feature area that matches the work you are doing:

- Use the chat workflow guide when changing the renderer, chat cards, chat state, titles, Markdown, or queued prompts.
- Use the local tools and security guide when changing file, shell, PowerShell, internet, or permission behavior.
- Use the providers and updates guide when changing provider calls, model settings, API keys, fallback behavior, update checks, packaging, or downloads.
- Use the feedback and reporting guide when changing message actions, GitHub issue reporting, automatic bug reports, or report privacy filters.
- Use the image generation guide when changing image model scanning, image prompts, generated image cards, or same-provider image retry behavior.

> [!TIP]
> When a feature crosses the renderer and main process, document both sides. Users care about what they see, but maintainers need to know where the trusted behavior lives.

## Design And Wording Rules

Feature docs should follow the same product rules as the app:

- Use sentence case.
- Avoid fully uppercase interface wording.
- Avoid em dashes.
- Explain behavior directly.
- Do not advertise visual polish as a feature.
- Do not document placeholder features as real capabilities.
- Use callout tags only when they help the reader avoid confusion or risk.

## Release Alignment

Each feature guide should stay aligned with:

- [README.md](../../README.md)
- [Architecture](../architecture.md)
- [Security](../security.md)
- [Provider setup](../provider-setup.md)
- [Release notes](../releases/0.0.38.md)
- [Changelog](../../CHANGELOG.md)

> [!CAUTION]
> If a guide says a feature exists, the app, tests, and release notes should agree.
