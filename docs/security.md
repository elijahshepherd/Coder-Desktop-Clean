# Security

![Security model](https://img.shields.io/badge/Security-local%20permissions-111111?style=flat-square)
![Local tools](https://img.shields.io/badge/Local%20tools-main%20process-4e5158?style=flat-square)
![Renderer](https://img.shields.io/badge/Renderer-isolated-6f747d?style=flat-square)
![Secrets](https://img.shields.io/badge/API%20keys-local%20storage-202124?style=flat-square)
![Current tools](https://img.shields.io/badge/0.0.33-controlled%20tools-2f3238?style=flat-square)

Coder Desktop is a local-first desktop app, so security has to be direct and practical. In version `0.0.33`, file reading, file editing, file and folder creation, file and folder deletion, shell commands, approved Windows PowerShell information commands, internet search or page fetching, message feedback, bug reporting, background provider health checks, image generation, safe update download opening, safe AI settings changes, and safe Coder Desktop download cleanup can run through controlled app paths when the matching permission or configuration is available.

Chat access modes are available directly in the composer status area. `Approve for me` keeps normal development work moving while still prompting around risky actions. `Ask for approval` keeps external edits and internet use off until the user chooses otherwise. `Full access` opens local tools and internet access inside the app security boundaries.

The project uses a simple rule: sensitive local operations must go through the trusted Electron main process, where permissions and local tool boundaries can be checked.

> [!IMPORTANT]
> Security settings are not decorative UI. They define which local behaviors may be enabled and keep sensitive actions visible before they run.

> [!NOTE]
> The project is local-first, not provider-private by default. Provider calls can still send selected chat content and context to the active AI provider.

## Security Goals

Coder Desktop is designed to:

- Keep renderer code isolated from direct local machine access.
- Keep provider API keys out of public renderer state.
- Keep file and shell tools behind explicit permissions.
- Make file edits, folder changes, shell commands, and PowerShell command execution explicit user-controlled capabilities.
- Avoid loading unsafe external URLs inside the app.
- Keep update discovery and update downloads controlled by the main process.
- Keep feedback and bug reports sanitized before public GitHub issue creation.

Security is not treated as a single feature. It is part of the app architecture.

## Renderer Isolation

The renderer runs with:

- Context isolation enabled.
- Node integration disabled.
- Renderer sandboxing enabled.
- Web security enabled.

The renderer only receives the typed desktop API exposed by the preload bridge. It cannot call Node.js APIs directly. This protects the local machine if renderer code has a bug or if unsafe content is ever displayed.

> [!TIP]
> Renderer isolation is strongest when the preload API stays small, typed, and boring.

## IPC Boundary

All sensitive actions go through named IPC handlers. Examples include:

- Updating provider settings.
- Updating security settings.
- Selecting a preferred working folder.
- Checking and installing updates.
- File and shell tools.

IPC handlers should stay narrow and specific. A narrow method is easier to validate than a generic method that accepts broad commands or arbitrary paths.

> [!WARNING]
> Avoid generic IPC channels such as `runAnything` or `openPath`. They are hard to audit and can become unsafe quickly.

## Local Path Handling

File tools are controlled by the trusted main process. The AI can request reads, edits, creates, deletes, folder changes, and shell commands, but those actions still go through permission checks before running.

Local path behavior includes:

- Resolving relative paths against the selected workspace.
- Requiring a selected workspace before local file or shell tools run.
- Rejecting explicit absolute paths that resolve outside the selected workspace.
- Limiting oversized file reads.

This is important because desktop users often ask about files outside a project folder, including downloads, screenshots, installed tools, and system locations. If work needs to happen in a different folder, that folder should be selected as the workspace first.

> [!CAUTION]
> Absolute paths are useful and sensitive. Keep file edits, deletes, shell commands, and internet use visible through permissions and activity cards, and keep file paths inside the selected workspace.

## Permission Model

The app exposes local capabilities through security settings.

Current capability areas:

- File reading.
- File editing, creation, and deletion.
- Shell commands.
- Windows PowerShell information commands.
- Internet search and public page fetching.
- Permission prompts.

Windows PowerShell command cards are limited to approved read-only information commands. Permission prompts remain visible so sensitive actions are not hidden from the user.

## Prompt Privacy Guard

Coder Desktop protects hidden system prompts, developer instructions, tool routing rules, compacted hidden context, and internal prompt sections before a request is sent to an AI provider.

The prompt privacy guard normalizes common typo, spacing, leetspeak, and obfuscation patterns so requests such as hidden prompt reloads, encoded prompt dumps, translated developer instructions, startup prompt probes, or rule-listing attempts are handled consistently. It is designed to avoid false positives by allowing normal prompt-writing help, high-level prompt engineering education, and defensive prompt-injection discussion.

> [!NOTE]
> Public project files can still be inspected when the user asks about repository code. The guard blocks hidden instruction disclosure, not normal documentation, source review, or security education.

## Local Tool Boundaries

PowerShell command cards should:

- Run from the selected workspace.
- Be limited by length validation.
- Return stdout, stderr, and exit code.
- Avoid destructive, permission-changing, installation, deletion, shutdown, credential, registry-writing, firewall-changing, and disk-formatting commands.
- Stay visible through chat activity cards.

File reads and writes should:

- Resolve relative paths against the selected workspace.
- Reject explicit absolute paths outside the selected workspace.
- Limit oversized file reads.
- Show file edits through a visible diff flow before writing.

> [!WARNING]
> Local tools can inspect files, modify projects, install packages, delete files, or expose secrets if they are too broad. Keep them permission-gated, visible, and narrow.

## Provider Key Storage

Provider API keys are stored locally. The app separates secret values from public provider settings.

When Electron safe storage is available, secrets are encrypted through the operating system. If safe storage is not available, local storage should be treated with the same care as any developer credential file.

API keys should never be placed in:

- Renderer public state.
- Logs.
- Release files.
- Documentation examples.
- Git commits.

## Provider URL Validation

Provider base URLs are sanitized before storage and use. Plain `http` provider URLs are restricted to local hosts. This allows local development endpoints while avoiding accidental use of unsafe remote endpoints.

Provider values should be treated as configuration, not trusted code.

## Provider Health Check Safety

Provider health checks run automatically from the trusted main process. They use locally stored provider secrets for live checks, but they do not return API keys to the renderer and do not include them in issue reports.

The checks may verify configured base URLs, primary chat models, fallback chat models, and supported image generation models. Missing API keys are skipped as setup work. When a chat model, fallback model, or configured image model fails with a clear provider error and a working replacement exists, the app can remove or replace that failing setting and report sanitized evidence for the app developer. Reports should include provider names, model names, status codes, base URL host information, and failure summaries, but never raw keys, request bodies with secrets, or private chat content.

## External Navigation

The Electron window blocks unexpected navigation. External links are only opened through safe protocols:

- `http:`
- `https:`
- `mailto:`

Unexpected app navigation is denied so untrusted links do not replace the app surface.

## Update Safety

The update service checks GitHub Releases from the main process. The renderer does not provide the update URL and does not decide which asset to download.

The update service is expected to:

- Compare the latest release version with the installed app version.
- Offer update installation only when the latest release version is newer than the installed app version.
- Select a compatible asset for the current operating system and CPU architecture.
- Open the matching GitHub Release asset when the user chooses Click here to install.
- Keep the app running during the handoff.
- Avoid trusting renderer-provided update URLs.

This design prevents the UI from becoming the source of truth for update downloads.

## Public Report Safety

Message feedback and automatic bug reports can open public GitHub issues from the user's computer.

The report path is designed to:

- Run through the Electron main process.
- Use environment GitHub tokens or stored Git credentials when available.
- Save a local pending report and open a prefilled GitHub issue link when direct issue creation is not available.
- Keep background automatic reports quiet when direct issue creation is not available.
- Include a trimmed sanitized report log for recent failures and scan activity.
- Redact common API key, token, password, and secret patterns.
- Redact the user's home path.
- Trim chat content and stack details.
- Avoid raw file contents.
- Avoid raw chat history.
- Use fixed app-generated labels.
- Rate-limit duplicate reports.
- Limit daily report volume.

Expected setup states, such as missing API keys or disabled providers, are not treated as bugs.

Manual bug reports from settings can open a prefilled GitHub issue link when direct creation is unavailable. Automatic provider, renderer, tool, update, crash, and hourly diagnostic reports stay in the background and save pending reports locally instead of unexpectedly opening a browser.

> [!CAUTION]
> Public reporting should stay technical. Users should not place secrets, private file contents, or personal information in optional feedback notes.

## Release Security

Release security matters because users download and run the app.

Recommended release practices:

- Build artifacts from a clean working tree.
- Keep artifact names stable and readable.
- Include manifests with file sizes and hashes.
- Upload real binaries to GitHub Releases.
- Avoid empty or temporary download files.
- Sign Windows releases with a trusted certificate when available.
- Timestamp signatures.
- Keep publisher identity stable.

SmartScreen reputation is covered in [code-signing-and-smartscreen.md](code-signing-and-smartscreen.md).

> [!IMPORTANT]
> Real release assets, stable hashes, and clear manifests are part of user safety. Empty files or placeholders should never be published as downloads.

## Reporting Security Issues

Security reports should be handled carefully and privately when possible. Use the repository security policy in [../SECURITY.md](../SECURITY.md) for reporting expectations.

Do not publish exploit details in public issues before the maintainer has had a reasonable chance to review and respond.
