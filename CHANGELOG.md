# Changelog

## [0.0.42] - 2026-06-16

### Changed

- Improved Windows executable metadata: added `LegalTrademarks`, enhanced `FileDescription`, and set all available version-string fields to provide a complete digital identity for the application. This helps Windows SmartScreen and other antivirus software properly identify the executable as legitimate software.
- Changed the primary Windows build target to NSIS installer (first), with portable and ZIP as secondary formats. Installers with proper metadata are better recognized by SmartScreen.
- Enhanced NSIS installer metadata: added `VIProductVersion`, `BrandingText`, and all `VIAddVersionKey` fields (ProductName, CompanyName, FileDescription, LegalCopyright, LegalTrademarks) to the installer's version resources.
- Updated the portable ZIP start guide with clearer instructions for bypassing SmartScreen ("More info" → "Run anyway").

### Release

- Prepared version `0.0.42` as a metadata and build configuration release focused on improving Windows SmartScreen compatibility by providing complete executable version information and using the installer format as the primary Windows download.

## [0.0.41] - 2026-06-16

### Fixed

- Fixed Sub Apps modal not opening when clicking the sidebar button (removed the `sub-apps:open` event listener inside the modal that was calling `onClose()` immediately after the parent opened it).
- Fixed the image generation animation mockup text ("Drag 7 red nodes to warp perspective freely. The center dot marks the cube corner. Press SPACE for clean view.") that incorrectly appeared in the thinking stage animation. Replaced with "Creating your image..." and removed the texture upload, clear, and clean-view UI.
- Fixed the Edit button on image generation cards not working — `onEditImage` was never wired to a handler. Now wired through `ChatWorkspace` → `MessageBubble` → `ImageGenerationCard`, calling `onSend` with the image prompt to trigger a new image generation.
- Fixed the "Sending feedback" label that got stuck when reports were queued without an `issueUrl` (now shows "Saved locally").
- Fixed bug reports being queued locally when no GitHub token was available — now falls back to the `gh` CLI (GitHub CLI) to create issues automatically without requiring environment variable setup.

### Changed

- Increased download and edit button icon sizes from 16px to 18px in image generation cards.
- Reduced compactness in Settings panel: increased padding, gap, and min-height values across preference cards, permission switches, provider cards, local settings cards, and section spacing.
- Increased spacing in general `.preference-card` (gap 14→18, padding 16→20), `.permission-switch.compact` (min-height 44→50), `.settings-section` (gap 18→22), `.preference-grid` (gap 14→18), `.settings-stack` (gap 10→14).

### Added

- Added AS (Automatic Stoppers) maintenance system: polls GitHub issues every 5 minutes for maintenance-format issues (`L:N T: Maintenance`), parses `ESID/OF/AL/NOTE` fields, writes/clears a lock file, and pushes maintenance state to the renderer. A maintenance check in the `chat:send` IPC handler blocks new messages when maintenance is active.

### Release

- Prepared version `0.0.41` as a bugfix and polish release addressing the Sub Apps modal not opening, incorrect mockup text in the image generation animation, non-functional Edit button, small icon sizes, compact settings spacing, bug reports requiring tokens, and the initial implementation of the AS maintenance system.

## [0.0.40] - 2026-06-16

### Added

- Added Sub Apps modal (`SubAppsModal.tsx`) with Image Studio "coming soon" card, opened via a new sidebar footer button above Settings.
- Added `autoAcceptImageGeneration` personalization setting (default `false` with warning text about model and cost responsibility).
- Added `PermissionButton` warning prop that renders a `.preference-warning` paragraph below the toggle.
- Added new CSS rules for `.sub-apps-modal`, `.sub-apps-grid`, `.sub-app-card`, `.sub-app-icon`, `.preference-warning`, `.update-notice-error-message`.
- Added `MaintenanceState` type to `shared/types.ts` and `maintenance.ts` module for the upcoming AS (Automatic Stoppers) system.
- Added `release:0.0.40` npm script following the same release pipeline pattern.
- Updated logo assets (`coder-logo-dark.png`, `coder-logo-light.png`) in `src/renderer/assets/brand/`.
- Added `retryWithBackoff` function with exponential backoff for rate limit retries.

### Changed

- Changed `.preference-card` border from hardcoded graphite to `var(--accent-border)` with hover accent.
- Changed `.settings-root .permission-switch.compact.active` border/background to use `var(--accent)` and `var(--accent-soft)`.
- Changed bug report `formatQueuedMessage` back from "Set CODER_DESKTOP_GITHUB_TOKEN..." to "Will retry the next time the app talks to GitHub."
- Changed the `issueReporter.test.ts` assertion to match the updated queued message text.
- Changed `limitImageGenerationPlans` max from 3 to 1 total image per tool loop.
- Rewrote `LICENSE.md` to clarify read-only source status, allow forking/publishing with credit to Elijah Shepherd, and define commercial terms.
- Updated system prompt identity section to describe Coder Desktop as "read-only open-source project" with fork/credit instructions.

### Fixed

- Fixed the "Sending feedback" label in `MessageFeedbackActions.tsx` that got stuck when reports had a queued status without an `issueUrl` (now shows "Saved locally").

### Release

- Prepared version `0.0.40` as a feature release with Sub Apps modal, auto-accept image generation toggle, license rewrite, preference-card accent styling, bug report text fix, feedback label fix, rate limit retry with exponential backoff, image generation plan cap at 1, and maintenance system scaffolding.

## [0.0.39] - 2026-06-16

### Changed

- Changed the image generation card thinking stage to use a full-stage layout with the animation filling the entire card and the status caption anchored at the bottom, replacing the previous two-row split layout.
- Changed the image generation card error stage to use the same consistent full-width error layout instead of the old thinking-stage template.
- Changed image generation cards to collapse by default with a toggle button (ChevronDown icon + "Show"/"Hide" label) when autoCollapseImageCards is enabled, keeping the message feed compact after images are generated.
- Changed the SD image upscale toggle to a 4x upsize that uses client-side canvas resampling with createImageBitmap and imageSmoothingQuality.
- Changed the download button to show "Saving"/"Saved"/"Retry download" states inline with a clean icon + text layout alongside the new Edit button.
- Changed the system prompt so Coder Desktop now identifies itself as an open-source project by Elijah Shepherd, explains it runs locally on Windows with Electron and React, and clarifies it is not affiliated with Coder the remote-workspace product.
- Changed the image generation section in the system prompt so the assistant continues to respond after the image card completes instead of stopping early.
- Changed the internet tools section to include a rule that the assistant should search again on a fresh question instead of reusing stale results from earlier conversation context.
- Changed the brand voice section to include the same search-again rule for fresh questions.
- Changed notification behavior so completion notifications fire exactly once per completed message instead of potentially duplicating due to two separate useEffect hooks watching overlapping state.

### Added

- Added new CSS styles for `.full-stage`, `.full-stage-caption`, `.full-stage-progress`, `.error-stage-content`, `.generated-image-actions`, and `.image-card-toggle` classes used by the redesigned image generation card.
- Added an Edit button (Pencil icon) next to the Download button on each generated image, wired through an `onEditImage` callback that provides the source image data URL, prompt, provider, and model.
- Added a `lastVersion` field to the AppState interface and the DesktopStore loader so the app can detect version changes.
- Added `clearLocalDataOnVersionUpdate` logic: when the setting is enabled and the stored version does not match the running version, local state is cleared on startup.
- Added a `search again on fresh question` rule to the internet tools and brand voice sections of the system prompt so the assistant fetches current sources instead of recycling old search results.
- Added project identity facts to the system prompt identity section: open-source, Electron/React/Windows, not affiliated with Coder remote-workspace.
- Added `release:0.0.39` npm script following the same release pipeline pattern.

### Fixed

- Fixed the assistant loop in both `chat:send` handler and `continueAssistantFromLatestState` so after image generation plans are executed, the assistant continues to request a follow-up AI response instead of breaking out without generating a text reply. The assistant now describes the generated image or takes the next user-requested action.
- Fixed the `triedModels` field in provider error blocks so it only lists models that were actually attempted during the fallback chain, not every candidate model in the configuration.
- Fixed notification deduplication in ChatWorkspace by merging the two separate completion-detection useEffects into a single hook with a `lastNotifiedRef` guard that prevents duplicate native notifications for the same message.

### Release

- Prepared version `0.0.39` as a feature release with a redesigned image generation card (full-stage thinking, collapsible results, Edit and Download actions, client-side 4x upscale), updated logos, system prompt improvements, AI continuation after image generation, notification deduplication, clear-local-data-on-version-update setting, accurate provider error reporting, and refreshed documentation.

## [0.0.38] - 2026-06-15

### Changed

- Changed manual bug reports from settings to send a GitHub issue directly when a `CODER_DESKTOP_GITHUB_TOKEN`, `CODER_DESKTOP_BUG_REPORT_TOKEN`, `GH_TOKEN`, or `GITHUB_TOKEN` environment variable is set on this computer. The user no longer needs to manually copy or paste anything into GitHub.
- Changed like and dislike feedback to send the public issue to GitHub through the same token flow. The browser tab that used to open with the prefilled issue is gone.
- Changed the hourly diagnostic scan so it no longer triggers a cascade of high severity GitHub issues when GitHub authentication is not configured locally.
- Changed the image generation card during thinking so the black and white spews animation now fills the whole card with the prompt title and description anchored underneath, instead of a small framed animation inside a separate loading box.
- Changed the image generation card after generation so it shows the active provider status header and the generated image, with a clear Download action in place of the previous copy link.

### Added

- Added a Download button for every generated image. The download uses Electron's native save dialog and reveals the saved file in the system file explorer.
- Added regression tests that confirm manual bug reports, automated bug reports, and feedback never open an external URL, and that the diagnostic scan stays quiet when GitHub is not configured.

### Fixed

- Fixed bug reporting so the app no longer spawns `git credential fill` and no longer opens a browser with a prefilled issue link as a fallback. Manual reports now either send directly to GitHub through the configured token or save locally with a clear next step message.
- Fixed the very long status text and giant URL that overflowed the Local settings notice after a manual bug report. The notice now shows a short, human readable summary and wraps cleanly inside the panel.
- Fixed the Security panel in dark mode where a gray rectangle appeared behind the permission switch text. The dark mode panel and switch backgrounds are now consistent across the Personalization, Security, and Local settings pages.
- Fixed the like and dislike buttons (and the Copy and feedback status text) wrapping off the side of chat bubbles on narrow widths by allowing the controls row to wrap and respecting the bubble width.
- Fixed the image generation prompt so it no longer renders its own Copy button above the animation. The whole card now reads as one stage during thinking and as the result plus Download action after the image arrives.

### Release

- Prepared version `0.0.38` as a patch release with safer bug reporting, no more browser open or Git credential triggers, dark mode Security panel cleanup, like and dislike button wrapping, an image generation animation that fills the card, a native Download action for generated images, regression tests, and refreshed documentation.

## [0.0.35] - 2026-06-07

### Changed

- Replaced the image-generation loading surface with the black-and-white spews animation asset and verified it renders with strong contrast.
- Improved Settings readability, tab spacing, provider label logos, dark-mode contrast, and mobile layout while keeping regular settings controls icon-free.
- Strengthened assistant instructions so repository-specific answers come from source inspection and normal responses no longer repeat the greeting-style working question.
- Updated workspace guidance so the assistant uses real user paths, including the current Windows user home, Desktop, and Downloads folders, instead of placeholder paths.

### Fixed

- Fixed long pasted one-line content so data URLs and other very long strings wrap inside chat cards instead of scrolling horizontally forever.
- Fixed generated image links so completed image data is persisted as short `coder-image://` app links and copied with the same Copy to Copied behavior as chat messages.
- Fixed generated image display so cards can render from local image data while still copying the short app link.
- Fixed desktop icon generation so the packaged black logo is rendered with a transparent background.
- Fixed public repository prompt-location questions so they are treated as source-code questions instead of hidden-prompt disclosure attempts.
- Fixed direct Windows path detection so `C:/...` paths are recognized and file paths are read as files rather than listed as folders.
- Fixed stop handling so cancellation does not create fake provider failures, retry loops, or duplicate stopped messages.

### Release

- Prepared version `0.0.35` as a patch release with chat wrapping fixes, real-path workspace handling, image link persistence, settings polish, logo transparency, UI verification, regression testing, and refreshed downloads.

## [0.0.34] - 2026-06-07

### Changed

- Removed the event-themed personalization option from settings, stored personalization state, safe settings-tool requests, and current documentation.
- Cleaned up Settings with icon-free tabs, larger text, clearer selected states, stronger dark-mode contrast, and a cleaner mobile tab layout.
- Rebuilt the light and dark Coder Desktop logo assets with transparent backgrounds.
- Standardized Copy buttons so chat, output, and generated-image copy actions share the same Copy to Copied behavior.

### Fixed

- Fixed generated image Copy link so data URL images copy a short working object URL instead of a long inline data string.
- Fixed chat feedback metadata so messages without timing no longer show a placeholder.

### Release

- Prepared version `0.0.34` as a patch release with settings cleanup, transparent logo assets, generated-image copy-link fixes, UI polish, regression testing, and refreshed downloads.

## [0.0.33] - 2026-06-07

### Changed

- Changed update notices to show the new version with one `Click here to install` action instead of the previous two-button prompt.
- Changed the settings update action to use `Click here to install` wording for the same GitHub download handoff.

### Release

- Prepared version `0.0.33` as a small follow-up release for update-card wording and download handoff clarity.

## [0.0.32] - 2026-06-06

### Added

- Added background provider health checks that run without a manual settings button and report sanitized evidence only when problems occur.
- Added a safe AI settings tool that lets the assistant change allowed preferences such as theme, completion feedback, notifications, and Max Let Me Knows.
- Added one to three image generation support with a single response that never exceeds the requested count.
- Added Copy image link actions for generated images.
- Added the black-and-white spews image-generation animation as a project asset.
- Added regression tests for update install handoff, safe AI settings changes, NVIDIA FLUX image fallback, and multi-image generation.

### Changed

- Changed update notices to show `Install` and `Not Now`.
- Changed Install so it opens the matching GitHub Release asset for the user's operating system instead of trying to install directly or closing the app.
- Moved the Light mode and Dark mode toggle into Settings and persisted the selected theme across launches.
- Changed image generation to use NVIDIA FLUX models only.
- Changed image generation failures to continue through configured NVIDIA FLUX fallback models and show one concise failure message.
- Changed provider health checks so broken configured image models, including 404 responses, are removed when a working FLUX fallback remains.
- Strengthened image prompt guidance so generated prompts are descriptive, editable, and optimized for visual models.
- Simplified personalization settings copy and visual treatment.
- Removed filled logo backgrounds from visible app logo rendering and the renderer favicon.

### Fixed

- Fixed chat cancellation so stopping generation immediately prevents provider-error retries and automatic continuation.
- Fixed image generation loops that could create more images than requested or continue after success.
- Fixed generated image cards so multiple images display cleanly in one response on desktop and mobile.
- Fixed the chat scroll behavior so generated image cards are not covered by the composer.
- Fixed generated image cards so provider labels are no longer shown in the visible layout.

### Release

- Prepared version `0.0.32` as a patch release with safer update downloads, background provider health checks, FLUX-only image generation, cancellation fixes, UI polish, regression tests, and refreshed downloads.

## [0.0.31] - 2026-06-06

### Added

- Added the new Coder Desktop logo artwork, with the dark logo used in light mode and the light logo used in dark mode.
- Added regenerated Windows and macOS package icons from the new logo artwork.
- Added expanded personalization polish for progress, active states, motion, and completion feedback.
- Added regression coverage for continuation prompt leakage, selected-provider image generation, provider-test skipped setup states, and NVIDIA image model 404 handling.

### Changed

- Changed image generation to always use the active provider selected in settings, even when an assistant image request names another provider.
- Changed image generation timeouts and same-provider fallback attempts so simple failures return much faster instead of waiting around two minutes.
- Changed provider testing so missing API keys are skipped as setup work instead of counted as failures.
- Changed NVIDIA image model checks so account-specific 404 responses do not remove known NVIDIA image models or open noisy high-severity reports.
- Changed app typography so code blocks, command output, percentages, durations, and report details inherit the same app-wide font.
- Improved settings and chat motion with calmer panel transitions, hover polish, progress styling, and personalization-aware active states.

### Fixed

- Fixed a critical issue where private continuation recovery text such as `Coder Desktop continuation correction` could appear as a visible chat message if a provider echoed internal context.
- Fixed provider test reports so expected setup gaps, fallback timeouts, and NVIDIA image availability checks do not create duplicate high-severity GitHub issues.
- Fixed image generation feedback so a selected NVIDIA image failure is not overwritten by OpenAI setup messaging.
- Fixed typo handling for direct image requests such as `generat an image of a dog`.

### Release

- Prepared version `0.0.31` as a patch release with refreshed logo assets, personalization polish, prompt-leak prevention, safer provider testing, selected-provider image generation, app-wide font consistency, UI polish, regression tests, and refreshed downloads.

## [0.0.30] - 2026-06-06

### Added

- Added a provider test in settings that checks configured base URLs, primary models, fallback models, and supported image generation models from the trusted main process.
- Added provider-test cleanup that removes failing fallback or image models, promotes a working fallback when the primary model fails, and reports sanitized technical evidence for the app developer without API keys.
- Added custom accent color personalization with theme-aware contrast protection so user-selected colors stay readable in light and dark mode.

### Changed

- Changed settings to auto-save immediately when a setting changes and removed the manual Save settings button.
- Changed Max Let Me Knows into a button-style switch that enables strict Let Me Know behavior instead of a slider-style control.
- Changed the AI functionality settings tab icon to a brain.
- Changed strict Let Me Know mode so the assistant asks before making assumptions when missing details could affect the result.

### Fixed

- Fixed update installation handoff so clicking the new-version download action verifies the downloaded file and confirms the helper process starts before the app quits.
- Fixed the update failure path so a helper launch problem shows an update error instead of closing the app without installing.
- Fixed dark-mode update visuals by removing the new-version shimmer from update notices and progress bars while dark mode is active.

### Release

- Prepared version `0.0.30` as a patch release with update handoff reliability, dark-mode update UI cleanup, auto-saving settings, stricter clarification behavior, provider testing, custom personalization, screenshot verification, interaction checks, and refreshed downloads.

## [0.0.29] - 2026-06-06

### Fixed

- Fixed the settings modal layout so tab navigation stays in a stable sidebar on desktop and a horizontal tab rail on mobile.
- Fixed settings content transparency during normal use so the chat page no longer visually bleeds through settled settings panels.
- Fixed the mobile starter card so it keeps a usable width, readable heading, and stacked action buttons instead of collapsing into a narrow column.
- Fixed the providers settings action placement so Save settings is visible in the panel heading instead of clipping at the bottom of the modal.

### Changed

- Tightened settings panel responsive rules so provider cards, personalization controls, and tab content use the intended grid layout after all legacy CSS rules load.
- Improved mobile chat spacing around the starter card and composer area to keep the first screen readable on narrow devices.

### Release

- Prepared version `0.0.29` as a patch release with settings and chat UI polish, screenshot verification, interaction checks, and refreshed downloads.

## [0.0.28] - 2026-06-06

### Added

- Added full-screen tabbed settings for providers, access, personalization, AI functionality, and local maintenance.
- Added a Personalization tab with button tone choices, finished-card animation control, and desktop completion notification control.
- Added an AI functionality setting for Max Let Me Knows, disabled by default, so users can make clarification cards stricter when they want less inference.
- Added native completion notifications for Windows and macOS through the trusted main process.

### Changed

- Changed prompt privacy handling from a hard preflight refusal into a hidden review hint so normal questions are not blocked by false positives.
- Changed the Ask for approval description to say "Always ask before creating edits or using the internet."
- Changed image model selection so only the primary provider can hold an active selected image model.
- Changed chat guidance so missing save locations, workspace choices, and other blocking details use Let Me Know cards instead of plain text stalls.
- Changed prompt guidance for greetings, research summaries, progress cards, Windows shell syntax, install discovery, and source-backed answers.

### Fixed

- Fixed local file and shell tools so they no longer fall back to the home folder or follow absolute paths outside the selected workspace.
- Fixed stop handling so late provider, image, internet, PowerShell, or workspace results do not overwrite a stopped chat.
- Fixed queued prompts so stopping a chat clears queued work for that chat.
- Fixed image generation cancellation so abort signals are passed into image provider requests.
- Fixed default image model state so fresh installs do not start with multiple providers showing selected image models.

### Security

- Enforced selected-workspace boundaries for file reads, file writes, folder actions, and shell commands.
- Preserved renderer isolation by exposing only narrow settings and notification IPC methods through preload.
- Kept provider API keys out of public renderer state while adding the new settings.

### Release

- Prepared version `0.0.28` as a patch release with settings organization, prompt privacy false-positive handling, workspace boundary enforcement, cancellation fixes, and completion feedback.

## [0.0.27] - 2026-06-05

### Fixed

- Fixed the app UI version display so it is generated from `package.json` instead of staying on an old hard-coded value.
- Fixed Windows update relaunch behavior so the updater only starts an executable whose file version matches the installed update.
- Fixed a path-order issue where an old `Coder Desktop.exe` could reopen after a newer installer completed successfully.

### Changed

- Changed development, test, typecheck, package, and release scripts to sync the shared app version before running.
- Changed the Windows installer helper to clean staged update artifacts after a successful verified relaunch.
- Changed update documentation to explain that verified relaunch paths must match the expected installed version.

### Added

- Added safe post-install cleanup for older Coder Desktop release artifacts in the user's Downloads folder.
- Added cleanup for app-owned Coder Desktop update staging folders in Downloads and the temp directory.
- Added regression tests for old Coder Desktop download cleanup and version-safe updater relaunch scripts.
- Added release packaging support for version `0.0.27`.

### Removed

- Removed the stale hard-coded renderer version that caused newer installs to show `0.0.19`.

### Improved

- Improved installer reliability by preventing the app from reopening an older executable after the installer succeeds.
- Improved release cleanliness by removing old Coder Desktop installer, portable, ZIP, blockmap, DMG, MSI, and AppImage artifacts from earlier versions.
- Improved download cleanup safety by leaving unrelated user downloads and current-version Coder Desktop artifacts alone.

### Security

- Kept cleanup narrow to app-owned staging folders and direct Coder Desktop release artifact filenames from older versions.
- Kept renderer version display aligned with package metadata so users can verify the installed build more confidently.

### Release

- Prepared version `0.0.27` as a patch release with installer version correctness, verified Windows relaunch behavior, generated shared version metadata, safe old-download cleanup, and updated release documentation.

## [0.0.26] - 2026-06-05

### Fixed

- Fixed the Windows release pipeline so future certificate-backed builds no longer force Electron Builder signing off.
- Fixed Windows ZIP packaging so each backup ZIP contains a root-level `Coder Desktop.exe` and a plain start guide.
- Fixed release verification so missing Windows ZIP launch files are caught before publishing.
- Fixed Windows trust report generation so GitHub-hosted runners continue publishing when Authenticode inspection is unavailable.

### Changed

- Changed Windows packaging to detect `CSC_LINK`, `CSC_KEY_PASSWORD`, `WIN_CSC_LINK`, and `WIN_CSC_KEY_PASSWORD` before deciding whether to build signed or unsigned artifacts.
- Changed unsigned Windows builds to keep explicit Coder Desktop product metadata on the app executable, portable executable, and installer.
- Changed NSIS packaging metadata to create predictable Coder Desktop shortcuts and uninstall display names.

### Added

- Added a Windows release verification script that checks required Windows artifacts, ZIP contents, and Authenticode status.
- Added a generated Windows trust report for each release folder so maintainers can see signing status and artifact checks.
- Added manifest metadata that points Windows ZIP users to the recommended launch file, `Coder Desktop.exe`.
- Added release packaging support for version `0.0.26`.

### Removed

- Removed packaging behavior that would permanently prevent Windows signing even when a signing certificate is available.

### Improved

- Improved the Windows download experience by keeping installer, portable EXE, and ZIP backup paths available together.
- Improved SmartScreen readiness by strengthening metadata consistency, official-source guidance, signing awareness, and release validation.
- Improved download documentation around the Windows ZIP backup and its single primary launch file.

### Security

- Kept the SmartScreen guidance honest: Coder Desktop can reduce suspicious release signals, but trusted signing and reputation are still required for the strongest Windows trust.
- Kept release verification focused on official versioned artifacts so users are guided toward the GitHub Release source of truth.

### Release

- Prepared version `0.0.26` as a patch release with Windows release trust hardening, signing-aware packaging, ZIP backup launch guidance, and release verification.

## [0.0.25] - 2026-06-05

### Fixed

- Fixed image generation routing so a selected NVIDIA image request no longer falls through to OpenAI and reports `gpt-image-1.5` or an OpenAI API-key error.
- Fixed active-provider image requests so `qwen-image` failures remain reported as NVIDIA image model failures.
- Fixed image generation failure descriptions so they say Coder Desktop tried the selected image provider instead of implying a hidden provider switch.

### Changed

- Changed image generation retry behavior to stay inside the selected provider and only try compatible models from that provider.
- Changed assistant image-generation guidance so the model does not claim cross-provider image fallback will happen silently.

### Added

- Added regression tests for active NVIDIA `qwen-image` failures with missing OpenAI keys.
- Added regression tests that prevent OpenAI image endpoints from being called after a selected NVIDIA image model fails.
- Added release packaging support for version `0.0.25`.

### Removed

- Removed silent cross-provider image fallback from the image generation path.

### Improved

- Improved image generation report accuracy by keeping the provider and model context aligned with the selected image provider.
- Improved image-generation documentation to explain same-provider retry behavior clearly.

### Security

- Kept image failure reports provider-specific so diagnostic issue bodies do not imply the app used a different provider than the selected one.

### Release

- Prepared version `0.0.25` as a patch release with same-provider image retries, NVIDIA image failure regression coverage, clearer image reporting, and updated release packaging.

## [0.0.24] - 2026-06-05

### Fixed

- Fixed provider no-output paths so they create sanitized background issue reports instead of only showing a chat error card.
- Fixed automatic report fallback behavior so background reports save pending issue files quietly when direct GitHub issue creation is unavailable.
- Fixed renderer-side JavaScript errors and unhandled promise rejections so they are captured by the automatic bug reporter.

### Changed

- Changed automatic issue reporting to keep provider, renderer, crash, tool, and diagnostic scan failures in one sanitized reporting pipeline.
- Changed report payloads to include recent sanitized report-log events, process uptime, free memory, Node version, and Electron version.
- Changed the reporter daily limit to support more real failures while still deduping fingerprints and preventing repeated issue spam.

### Added

- Added provider-specific reporting for provider error cards, status codes, failed models, and no usable provider output.
- Added an hourly diagnostic scan that records healthy scans and reports issue-report backlogs or app-state inconsistencies.
- Added a settings `Report bug` button with an optional note field for manual public GitHub issue creation.
- Added tests for quiet automatic fallback reports, manual fallback reports, provider error reports, and hourly diagnostic scans.
- Added release packaging support for version `0.0.24`.

### Removed

- Removed automatic browser fallback openings from background bug reports when direct GitHub issue creation is unavailable.

### Improved

- Improved bug report usefulness by attaching sanitized system information and recent report activity.
- Improved privacy behavior by keeping background reports quiet and continuing to redact common keys, tokens, home paths, file contents, and raw chat history.
- Improved manual reporting so users can send optional context from settings without needing to write a full GitHub issue by hand.

### Security

- Kept automatic and manual report bodies sanitized before GitHub issue creation.
- Kept report spam control through fingerprint dedupe and daily safety limits.
- Kept automatic reports local and queued when GitHub credentials are unavailable instead of exposing details through an unexpected browser window.

### Release

- Prepared version `0.0.24` as a patch release with stronger automatic bug reporting, provider failure reporting, hourly diagnostics, and a manual settings report path.

## [0.0.23] - 2026-06-05

### Fixed

- Fixed prompt privacy detection so obfuscated, misspelled, translated, encoded, and indirect hidden-instruction disclosure attempts are blocked before reaching a provider.
- Fixed overly broad prompt-injection detection so normal defensive education such as `explain prompt injection defense` is not treated as a hidden-prompt extraction attempt.
- Fixed startup prompt probes such as `what prompt did you get at startup` so they are handled by the privacy guard.
- Fixed self-rule probes such as requests to list the rules the assistant must follow.

### Changed

- Changed prompt privacy matching to normalize common leetspeak, spacing tricks, zero-width characters, and frequent typo variants before detection.
- Changed the security prompt to separate benign cybersecurity education from requests that enable credential theft, covert access, persistence, evasion, phishing, exfiltration, or destructive actions.
- Changed hidden instruction handling so fictional, translated, encoded, JSON, markdown, and log-style disclosure requests stay behind the same privacy boundary.

### Added

- Added ethical coding guidance for transparent code, user-authorized changes, safe diagnostics, secret handling, and confirmation before broad or destructive actions.
- Added regression tests for typo-aware prompt disclosure blocking.
- Added regression tests for false positives around prompt-writing help, prompt privacy improvements, and high-level prompt-injection education.
- Added release packaging support for version `0.0.23`.

### Removed

- Removed blunt prompt-injection keyword blocking that could reject normal defensive learning requests.

### Improved

- Improved low-false-positive system prompt blockage by requiring protected hidden-instruction topics and disclosure intent for normal-language probes.
- Improved AI safety guidance so mixed-use security requests keep defensive value while removing exploit-operational details.
- Improved provider prompt clarity around hidden system prompts, developer prompts, tool routing instructions, compacted hidden context, and internal prompt sections.

### Security

- Strengthened main-process hidden prompt disclosure detection before provider calls.
- Kept hidden instructions from being disclosed through summaries, section names, exact locations, translations, roleplay, encoded output, markdown, JSON, logs, or tool output.
- Added clearer ethical coding and cybersecurity boundaries without blocking normal development, diagnostics, local repair, secure coding, threat modeling, or educational work.

### Release

- Prepared version `0.0.23` as a patch release with stronger prompt privacy blocking, typo-aware detection, ethical coding guidance, and safer security boundaries.

## [0.0.22] - 2026-06-05

### Fixed

- Fixed keyword-based automatic tool runs so local commands, web searches, file actions, and image jobs no longer run before the assistant explicitly requests a tool.
- Fixed the `reload your system prompts` path so it is handled by the prompt privacy guard instead of triggering a local information command.
- Fixed provider drafts that only say `I will search`, `Let me pull that`, or similar stall text by quietly re-prompting the provider to request the needed tool or answer fully.
- Fixed research continuation guidance for current entertainment, quote origin, and complete-list questions so the assistant is pushed to search, fetch, and continue instead of stopping after status text.

### Changed

- Changed chat orchestration so user messages go to the provider first, and only provider-requested tool blocks can run local or internet actions.
- Changed the system prompt to include a refreshed current-turn context after every user message and after tool results.
- Changed internet research instructions to cover newest, latest, trailers, release details, source-backed quote questions, and every-reference list requests more explicitly.
- Changed hidden instruction handling so reload, refresh, reread, or rerun requests for hidden prompts are treated as private-instruction requests.

### Added

- Added anti-stall continuation logic that retries hidden provider drafts when they promise work without using tools or answering.
- Added tests for system prompt reload privacy handling.
- Added tests for stalled provider drafts such as `Let me pull the detailed lists` and `Grabbing the full lists`.
- Added release packaging support for version `0.0.22`.

### Removed

- Removed runtime use of direct keyword detectors from `chat:send`.
- Removed automatic local command execution based only on user text keywords.

### Improved

- Improved source-backed research behavior for requests that need web searches and page reads.
- Improved chat reliability when the user says `keep going`, `you stopped`, or points out that the assistant stalled.
- Improved current time freshness by making each provider turn carry refreshed runtime context.

### Security

- Kept local command execution behind provider-requested tool blocks and existing security permissions.
- Kept hidden prompt reload and disclosure requests from reaching local tools.

### Release

- Prepared version `0.0.22` as a patch release with safer tool orchestration, refreshed turn context, anti-stall provider continuation, and stricter prompt privacy handling.

## [0.0.21] - 2026-06-05

### Fixed

- Fixed NVIDIA image generation failures where the final card could incorrectly mention a missing OpenAI API key after a NVIDIA request failed.
- Fixed NVIDIA FLUX image generation so FLUX.1 models use the NVIDIA GenAI endpoint instead of the OpenAI Images endpoint.
- Fixed image fallback reporting so the provider the user selected remains the provider shown in the final error card.
- Fixed stale image model ordering in the browser preview settings data.

### Changed

- Changed OpenAI image model defaults to include the current `gpt-image-2` model before earlier GPT Image models.
- Changed NVIDIA image model defaults to include `qwen-image-2512`, `qwen-image`, `flux.2-klein-4b`, and FLUX.1 models.
- Changed NVIDIA image request handling so hosted FLUX models and OpenAI-compatible image models use separate request paths.

### Added

- Added regression tests for NVIDIA FLUX endpoint routing.
- Added regression tests that prevent OpenAI fallback configuration errors from overwriting NVIDIA image errors.
- Added release packaging support for version `0.0.21`.

### Removed

- Removed the misleading path where a missing OpenAI image key could become the visible failure reason for a NVIDIA image request.

### Improved

- Improved image model accuracy using current OpenAI and NVIDIA documentation.
- Improved image generation diagnostics so users can understand which provider and model actually failed.
- Improved fallback behavior by keeping configuration skips separate from real provider request failures.

### Security

- Kept API keys out of image generation error details while still showing enough provider and model context to debug.

### Release

- Prepared version `0.0.21` as a patch release with NVIDIA image generation routing, image model accuracy, and clearer provider failure reporting.

## [0.0.20] - 2026-06-05

### Fixed

- Fixed update availability for users on `0.0.19` by preparing a newer packaged release version for the updater to detect.
- Fixed hidden prompt disclosure handling so requests for exact system or developer instructions are answered safely before reaching a provider.
- Fixed image retry behavior so short follow-ups such as `try again` reuse the latest image prompt in the current chat.
- Fixed image request detection so capability questions such as `can you create images` do not accidentally start generation.

### Changed

- Changed image generation cards and fallback behavior so unavailable selected image models can fall back to compatible image models.
- Changed assistant instruction privacy guidance so the model must not invent or reveal internal prompt locations, section names, or exact hidden text.
- Changed image request detection to tolerate common misspellings such as `iameg`, `imgae`, and `iamge`.

### Added

- Added regression tests for prompt disclosure requests, image retry prompts, image typo detection, and image capability questions.
- Added version `0.0.20` release packaging support.

### Removed

- Removed the path where prompt-location questions could be answered as if hidden instructions were user-visible documentation.

### Improved

- Improved updater clarity by shipping the current fixes as a real next version instead of relying on source-only commits.
- Improved image generation recovery when a provider rejects a selected image model.
- Improved chat behavior around image follow-ups so users can retry without rewriting the full prompt.

### Security

- Kept hidden system prompts, developer instructions, tool routing rules, and internal prompt sections out of user-visible chat responses.
- Kept prompt privacy enforcement in the main process so protected requests do not need to be sent to a provider.

### Release

- Prepared version `0.0.20` as a patch release with updater availability, prompt privacy, image retry, and image generation fallback improvements.

## [0.0.19] - 2026-06-04

### Fixed

- Fixed NVIDIA image model scanning so known NVIDIA image models such as `qwen-image`, `flux_1-dev`, and `flux_1-schnell` are offered instead of incorrectly saying NVIDIA has no image generation support.
- Fixed approval continuation so approving a web search, page read, or follow-up internet action keeps the assistant working instead of ending the turn early.
- Fixed visible `ApprovalPendingError` failures when one approved tool action led to another approval request.
- Fixed leaked reasoning and raw tool markup by stripping loose `</think>` tags and hidden reasoning blocks before messages reach chat.
- Fixed provider setup replies so missing API key or disabled provider messages do not automatically trigger a fake continue flow.
- Fixed copied assistant messages by making the end-of-message copy action use the shared copy control.

### Changed

- Changed pasted link handling so Coder Desktop does not automatically read a URL unless the user clearly asks to read, inspect, fetch, open, check, summarize, pull, extract, or scan it.
- Changed internet approval descriptions to use human-readable purposes instead of exposing raw URLs as the main approval text.
- Changed chat working indicators so the assistant keeps the shimmer thinking text while the chat list uses a very slow pulse without flashing, dots, or bold text.
- Changed the assistant system prompt to include the current year, date, local time, and time zone for better time-sensitive answers.
- Changed repository guidance so Coder Desktop treats `elijahshepherd/Coder-Desktop` as the canonical project repository and uses GitHub or web tools when local workspace files are not available.

### Added

- Added a delete chat button for chat list items.
- Added an empty-state getting-started card with setup guidance and direct actions for providers, access, and creating a new chat.
- Added Git credential fallback support for GitHub issue creation so feedback and automatic bug reports can publish without requiring the GitHub CLI.
- Added tests for explicit URL reading, NVIDIA image model fallback, prompt time context, store cleanup, and deleting chats.

### Removed

- Removed the seeded `Welcome to Coder Desktop` chat from new app state.
- Removed legacy welcome chats from stored state during migration.
- Removed automatic URL reading from plain correction messages or pasted links with no explicit read intent.

### Improved

- Improved web approval recovery so follow-up page reads can continue the same assistant run after approval.
- Improved feedback and bug reporting reliability by using stored GitHub credentials when environment tokens are not present.
- Improved onboarding by replacing the default chat with a clean starter card that explains what to do first.
- Improved chat session isolation by allowing the app to create a chat only when the user starts one or sends a message.
- Improved assistant tool guidance for GitHub source questions, selected workspaces, and internet-backed repository inspection.

### Security

- Kept GitHub issue reporting token lookup inside the main process and avoided exposing provider keys, private chat history, or workspace file contents.
- Kept URL reads approval-gated and removed automatic link-reading behavior for unrequested links.
- Kept hidden reasoning and internal tool markup out of user-visible chat output.

### Release

- Prepared version `0.0.19` as a patch release with chat cleanup, approval continuation fixes, NVIDIA image model repair, issue reporting improvements, tests, versioned release notes, and packaged Windows and macOS downloads.

## [0.0.18] - 2026-06-04

### Fixed

- Fixed Windows updater handoff so the helper waits for Coder Desktop processes instead of only the first app process.
- Fixed installer relaunch confidence by verifying that the installed executable reports the expected new version before reopening the app.
- Fixed silent update failures so the helper can open the installer visibly as a fallback instead of leaving the app closed.

### Changed

- Changed the generated Windows installer to close stale Coder Desktop processes before replacing application files.
- Changed updater logging so process waiting, silent installer exit codes, version checks, and fallback installer launches are recorded in the local temp update log.

### Added

- Added installer-side process cleanup through the custom NSIS include.
- Added updater tests for full Coder Desktop process waiting, forced cleanup, expected-version checks, and fallback installer behavior.

### Removed

- Removed the weak assumption that a completed installer process automatically means the installed app version changed.

### Improved

- Improved legacy update recovery for users upgrading from versions whose helper scripts closed the app before the installer completed.
- Improved Windows update reliability when Electron child processes briefly remain alive after the main process exits.

### Security

- Kept update repair local to the user's computer and did not add any remote code execution path.
- Kept updater diagnostics in a local temp log without provider keys, chat contents, or workspace files.

### Release

- Prepared version `0.0.18` as a Windows updater reliability release with hardened installer handoff behavior, version verification, fallback recovery, tests, release notes, and packaging updates.

## [0.0.17] - 2026-06-04

### Fixed

- Fixed the assistant fallback that could insert "I need one more detail before I can continue."
- Fixed empty provider responses so they create provider error cards that can auto continue.
- Fixed provider-error continuation so completed tool cards remain usable for the next step.
- Fixed web search so one failed public result page does not stop the whole search.
- Fixed web batch fetching so readable pages still appear when another page is blocked.
- Fixed GitHub page fetching by retrying blob URLs through raw GitHub file URLs.

### Changed

- Changed chat working animation to a quiet pulse and slight text weight shift.
- Changed tool working cards to use subtle pulse feedback instead of spinning edge beams.
- Changed assistant instructions to require source-backed searches for quote, lyric, line origin, song, video, and niche source questions.
- Changed assistant instructions to use GitHub, git history, raw files, repository pages, and alternate public sources before saying content is unavailable.

### Added

- Added tests for quote-origin and GitHub source request detection.
- Added tests for fallback web search behavior.
- Added tests for raw GitHub fetch retries.
- Added tests for partial batch web fetch recovery.

### Removed

- Removed user-facing "Send continue" wording from provider fallback paths.

### Improved

- Improved research resilience for public web, GitHub, and repository source requests.
- Improved provider recovery when a model returns empty output or fails after completed tool work.

### Security

- Continued to sanitize internet tool errors before they reach chat cards.
- Kept provider keys out of tests, documentation, release notes, and committed files.

### Release

- Prepared version `0.0.17` with calmer working states, stronger source-backed research behavior, provider continuation fixes, tests, release notes, and real download packaging.

## [0.0.16] - 2026-06-04

### Fixed

- Fixed Windows installer updates so Coder Desktop relaunches after the silent installer finishes.
- Fixed updater scripts so they no longer wait on the parent process, which could make the app close and appear to do nothing.
- Fixed the active Coder logo source so the renderer uses the exact provided SVG mark with dark and light mode inversion.

### Changed

- Changed Windows installer relaunch behavior to try the current executable path and standard user install folders.
- Changed packaged icon generation so PNG, ICO, and ICNS assets come from the same SVG source.

### Added

- Added an icon generation script for rebuilding desktop package icons from the Coder Desktop SVG.
- Added updater tests for installer relaunch script behavior and fallback executable paths.

### Improved

- Improved updater logging by writing installer handoff details to a local temporary update log.
- Improved dark mode logo rendering by applying the existing inversion style to the exact SVG logo asset.

### Security

- Kept updater relaunch scripts local to the user's computer and avoided adding any remote execution path.

### Release

- Prepared version `0.0.16` as a patch release for the Windows update relaunch issue and exact logo source.

## [0.0.15] - 2026-06-04

### Fixed

- Fixed missing end-of-message actions by adding hover controls for copy, like, dislike, and response timing.
- Fixed silent renderer and main-process failures so they can become sanitized automatic bug reports instead of disappearing.

### Changed

- Changed provider settings to include image generation model scanning for each provider.
- Changed assistant instructions so image generation can be requested as a first-class chat tool.
- Changed local reporting to rate-limit duplicate reports and daily report volume before opening GitHub issues.

### Added

- Added message feedback reports that can create public GitHub issues labeled Like or Dislike.
- Added optional feedback notes so users can explain what worked or what should improve.
- Added an automatic bug report service for renderer errors, main-process failures, provider failures, update failures, internet tool failures, workspace tool failures, and image generation failures.
- Added privacy filtering for issue reports, including API key redaction, home path redaction, chat trimming, and stack trimming.
- Added image model scanning for OpenAI, Claude, and NVIDIA provider cards.
- Added image generation activity cards with prompt copy, generation animation, generated image preview, and fallback-aware errors.
- Added tests for hidden bug report detection, report dedupe, feedback issue payloads, image model scanning, and image tool request parsing.

### Removed

- Removed the future-roadmap status from image models and automatic bug reporting because both are now implemented in version `0.0.15`.

### Improved

- Improved settings documentation around image models and provider support.
- Improved chat workflow documentation for response actions and generated image cards.
- Improved security documentation for automatic public issue reporting and privacy filtering.

### Security

- Kept all bug and feedback reporting in the Electron main process.
- Kept raw provider keys, local credentials, raw chat history, private file contents, and unneeded sensitive paths out of public issue reports.
- Added report fingerprints, a twenty-four-hour duplicate cooldown, and a daily report limit to reduce issue spam.

### Release

- Prepared version `0.0.15` with message feedback, automatic bug reporting, image model scanning, image generation cards, tests, documentation, and release notes.

## [0.0.14] - 2026-06-04

### Fixed

- Fixed update downloads so locked files in the previous update folder no longer block installation.
- Fixed installer update behavior so setup assets run through the installer path instead of the portable replacement path.
- Fixed update installation so it no longer opens the download location for the user.
- Fixed chat titles for greetings, Donald Trump website requests, and Parker YouTube searches.
- Fixed message identity display so You and Coder labels are hidden by default and can be restored in settings.
- Fixed the active Coder logo source so the app uses the provided PNG image instead of recreated SVG assets.

### Changed

- Changed working tool cards to use a slower black or white edge orbit animation.
- Changed the corner update notice to feel closer to the existing todo card style.
- Changed public web search to try multiple public search surfaces before returning no results.
- Changed provider and renderer text repair to remove em dash output before it reaches the visible chat.

### Added

- Added a settings header version pill.
- Added auto continue after provider errors with a settings toggle.
- Added a manual Continue button on provider error cards when auto continue is turned off.
- Added rich Markdown links with site favicons and readable labels.
- Added staged file metrics so create and write cards can show pending added lines before completion.
- Added tests for unique update download names, security settings persistence, and intent-based chat titles.

### Removed

- Removed active SVG favicon and icon sources from the app asset path.

### Improved

- Improved the assistant system prompt so it is stricter about using real file, folder, shell, internet, progress, and question tools.
- Improved update reliability by staging update assets with unique filenames.
- Improved internet fetch previews by including public page metadata when available.
- Improved packaged icon assets by regenerating them from the provided Coder Desktop image.

### Security

- Kept updater asset selection and download installation inside the Electron main process.
- Kept automatic provider continuation controlled by a saved security setting.
- Kept internet searching limited to legal public pages, metadata, indexed results, and direct public fetches.

### Release

- Prepared version `0.0.14` with updater fixes, prompt improvements, UI polish, icon regeneration, tests, release documentation, and real download packaging.

## [0.0.13] - 2026-06-04

### Fixed

- Fixed leaked `<coding-questions>` payloads so raw structured question JSON no longer appears in chat.
- Fixed file and shell card headers that showed cramped metric numbers beside the title.
- Fixed direct folder inspection so explicit Windows paths such as `C:\Users\Elijah (General)\Downloads\Development\Starland` are used instead of the default folder.
- Fixed direct MIT license file requests so Coder Desktop creates the real `LICENSE.md` file in the requested folder.
- Fixed Ask for approval mode so internet use is treated as an approval question instead of a hard denial.
- Fixed Markdown heading rendering for deeper headings such as `####`.
- Fixed common provider mojibake characters before rendering chat content.
- Fixed dark-mode switch contrast in settings.

### Changed

- Changed NVIDIA defaults to `z-ai/glm-5.1` with `mistralai/mistral-nemotron` as the first fallback.
- Changed tool cards so the assistant sends a short intent message before cards appear.
- Changed provider error cards so timeout and status details stay expanded.
- Changed tool-card loading to use a soft border beam instead of internal spinner lines.
- Changed the Coder mark to prioritize the D shape with a curved divider and smaller C.
- Changed the first-install entry animation to use the exact black dot side wave motion from the provided reference.

### Added

- Added a stop button for the active chat request.
- Added first-install onboarding with a local profile saved on this computer.
- Added provider diagnostics that scan model and Base URL reachability when settings change.
- Added a topbar progress shortcut when todo progress exists in the chat.
- Added wider web search source collection.

### Removed

- Removed the extra wrench-style avatar beside tool cards.
- Removed collapsed metric counts from tool card headers.

### Improved

- Improved Let Me Know cards so answers can only be sent once.
- Improved source and tool-card readability in dense chats.
- Improved mobile layout for tool cards and progress popovers.
- Improved tests for structured tag stripping, explicit folder inspection, direct license creation, and absolute folder listing.

### Security

- Kept first-install profile data local to the app data folder.
- Kept provider diagnostics inside the main process so API keys are not exposed to the renderer.
- Kept Ask for approval mode visible and approval-oriented for internet use.

### Release

- Prepared version `0.0.13` with UI polish, structured output fixes, provider scans, onboarding, stop behavior, updated logo assets, tests, and release packaging.
- Published version `0.0.13` with real Windows and macOS downloads on the GitHub Release page.

## [0.0.12] - 2026-06-03

### Fixed

- Fixed provider fallback behavior so timeout, rate limit, and temporary provider failures can try configured fallback models before showing an error card.
- Fixed update version comparison so same-version installs are normalized and not offered again.
- Fixed local shell command behavior for scoped package names and kept compatible tool requests able to run together.
- Fixed raw tool markup handling so `<coder-tool>` payloads and provider tool-call wrapper tokens are stripped from visible chat output.
- Fixed web URL prompts so pasted links can create a web page read card directly.
- Fixed the installed app identity by regenerating Windows, macOS, browser, and packaged PNG icon assets from the Coder mark.

### Changed

- Changed local file tools to support explicit absolute paths while still using the preferred working folder or home folder when appropriate.
- Changed provider defaults to faster and more practical current defaults, including NVIDIA `openai/gpt-oss-120b` with high reasoning.
- Changed provider settings to save provider, model, API key, fallback, and reasoning changes immediately across the app.
- Changed the assistant system prompt to be more general, more capable, less code-only, and clearer about available local, internet, and safety tools.
- Changed tool card completion wording from active phrases such as `Getting` or `Editing` to completed phrases such as `Got` or `Edited`.

### Added

- Added up to three fallback model fields per provider.
- Added model-aware reasoning effort controls.
- Added provider error cards with expandable details and copy support.
- Added direct web search detection for documentation, downloads, requirements, specs, and repository research prompts.
- Added tests for tool markup stripping, same-version update comparison, absolute path local file tools, and completed card wording.
- Added a `docs/features` guide folder covering chat workflow, local tools, security, providers, updates, and downloads.

### Removed

- Removed active extension behavior from the documented feature set until extensions have a clear implemented purpose.
- Removed stale workspace-only security claims from current documentation.

### Improved

- Improved independent chat sessions so queued prompts and loading state stay attached to the correct chat.
- Improved Markdown rendering and copy controls for code, tables, command chips, outputs, and provider errors.
- Improved source display for web cards with source icons and expandable source lists.
- Improved visual consistency by keeping active states, notices, and provider selection neutral.
- Improved release documentation with longer, feature-specific guides and clearer user-facing release notes.

### Security

- Added clearer dangerous-command guidance to the provider system prompt without blocking normal development work.
- Kept internet tools, local file tools, shell commands, update checks, and provider secrets in the main process boundary.
- Kept absolute path work permission-gated and visible through chat tool cards.

### Release

- Prepared version `0.0.12` with provider fallbacks, direct web support, absolute path local tools, update-loop fixes, refreshed documentation, regenerated icons, tests, and release packaging.

## [0.0.11] - 2026-06-03

### Fixed

- Fixed the sidebar footer spacing so settings and theme controls no longer interfere with the last chat item.
- Fixed the packaged app icon and favicon to use the Coder Desktop mark instead of the older generated mark.
- Fixed security state migration so older installs receive the new access mode and internet access fields safely.

### Changed

- Changed settings access from a floating corner button into a real sidebar footer control.
- Changed the Coder mark to a rounded square diagonal `C/D` design that follows light and dark themes.
- Changed the assistant system prompt so large tasks, unclear requests, internet work, and installation requests use structured app behavior.
- Changed chat status controls so access mode can be adjusted directly beside the model and date.

### Added

- Added todo progress cards for larger AI tasks, with active, done, and pending states.
- Added Let me know clarification cards with recommended options and custom answers.
- Added chat access modes for `Ask for approval`, `Approve for me`, and `Full access`.
- Added internet tool requests for web search and public page fetching.
- Added IIFE guidance so the AI can check whether software is installed, search official sources, and guide installation safely.
- Added tests for structured progress cards, clarification cards, and internet tool requests.

### Removed

- Removed the old floating settings button from the main workspace surface.
- Removed stale settings button CSS from the renderer stylesheet.

### Improved

- Improved responsive behavior for progress cards, clarification cards, access controls, settings, and sidebar footer controls.
- Improved the security panel with an internet access permission.
- Improved release icon assets for Windows, macOS, Linux, and browser favicon paths.
- Improved provider prompt guidance so the AI can work progressively instead of returning one large static response.

### Security

- Added explicit internet access gating through both the security panel and chat access mode.
- Kept web search and page fetching inside main-process tools instead of renderer-owned network behavior.
- Kept installation guidance restricted to official sources, platform matching, and visible tool cards.

### Release

- Prepared version `0.0.11` with structured chat planning, clarification, internet tools, access controls, UI polish, updated icons, tests, and release packaging.

## [0.0.10] - 2026-06-03

### Fixed

- Fixed the update checker so it no longer offers to reinstall the same installed version.
- Fixed Windows workspace shell execution so scoped package names such as `@codex` are passed literally instead of being treated as PowerShell variables.
- Fixed new chats inheriting the active loading state from another chat.
- Fixed chat title generation for Discord bot testing requests so titles summarize the actual task instead of copying filler words.
- Fixed tool activity surfaces so elapsed millisecond text is no longer shown on chat cards.

### Changed

- Changed workspace shell commands to run through the native command shell while keeping Windows PowerShell information cards separate.
- Changed provider requests to use a longer safety window for slower NVIDIA, Claude, or OpenAI responses.
- Changed provider tool guidance so the AI can request several independent local tool actions in one response.
- Changed chat tool cards to open as compact expandable rows with command or path previews.

### Added

- Added multi-tool parsing for provider responses with more than one `<coder-tool>` block.
- Added batched execution for compatible local tool requests.
- Added per-chat loading indicators in the chat list.
- Added tests for scoped shell command arguments, multi-tool parsing, Windows PowerShell batching, and Discord bot title summaries.
- Added version `0.0.10` release notes and download documentation.

### Removed

- Removed same-version refresh prompts from the update flow.
- Removed visible millisecond duration text from tool cards and tool-result context.

### Improved

- Improved command-card density so shell, file, folder, and Windows information activity stays readable in long chats.
- Improved multi-chat behavior so each chat can work as its own session.
- Improved local command reliability on Windows by preserving quoted arguments.

### Security

- Kept file, folder, shell, and PowerShell tools behind the existing local security settings.
- Kept file-changing tool actions ordered so dependent shell commands do not race ahead of workspace edits.
- Kept update installation tied to newer GitHub release versions instead of same-version asset timestamps.

### Release

- Prepared version `0.0.10` with critical update, shell, provider, chat-session, and compact activity-card corrections.

## [0.0.9] - 2026-06-03

### Fixed

- Fixed the browser renderer fallback so it no longer creates simulated desktop tool activity, simulated update prompts, or simulated download paths.
- Fixed the browser fallback response so it clearly explains that local tools require the desktop app.
- Fixed mobile composer spacing so the bottom-right settings button no longer covers the date or model status.
- Fixed stale overview documentation that still described the removed right-side diff rail.

### Changed

- Changed message identity marks to clean icon-only visuals instead of boxed text avatars.
- Changed the brand and welcome marks to render without decorative holders.
- Changed current project badges and download documentation to point to version `0.0.9`.

### Added

- Added a `0.0.9` release script entry.
- Added version `0.0.9` release notes and download documentation.

### Removed

- Removed simulated preview-only desktop behavior from the browser fallback state.

### Improved

- Improved custom UI polish around provider cards, security switches, settings, mobile status spacing, and welcome screens.
- Improved release documentation so the current app surface is described as chat plus local activity cards.
- Improved browser preview persistence by clearing older fake preview state.

### Security

- Kept browser previews read-only so local files, folders, shell commands, provider calls, and update installs stay inside the desktop bridge.
- Kept workspace and shell tool capabilities behind the existing security settings.

### Release

- Prepared version `0.0.9` with verified UI polish, test coverage, release notes, and new download packaging.

## [0.0.8] - 2026-06-03

### Fixed

- Fixed the AI tool loop so provider-requested local tools can run through chat instead of being limited to Windows information cards.
- Fixed the security panel so read files, edit files, shell commands, and permission prompts are all visible and understandable.
- Fixed preview mode messaging so file and shell tools are no longer described as reserved for a later version.

### Changed

- Changed the provider system prompt to include workspace tool request formats for reading, editing, creating, deleting, and running shell commands.
- Changed chat tool rendering to use one shared activity card design across file, folder, shell, and PowerShell actions.
- Changed new installs so file editing is enabled by default alongside file reading and shell command access.

### Added

- Added AI-accessible read file, list files, edit file, create file, delete file, create folder, delete folder, and shell command tools.
- Added clean activity cards for file and shell tools, including edit summaries such as `+45 -31`.
- Added folder create/delete IPC endpoints for the desktop bridge.
- Added tests for workspace create/delete behavior and the provider tool request parser.
- Added version `0.0.8` release notes and download documentation.

### Removed

- Removed stale preview wording that treated local file and shell tools as unavailable.
- Removed the planned extension toggle, schema examples, and extension ZIP packaging because extension execution is not a working feature yet.

### Improved

- Improved tool-result compaction so local activity output becomes useful provider context without flooding the chat.
- Improved visual consistency between PowerShell cards and workspace file or shell cards.
- Improved release workflow behavior so current-version setup installers, ZIP archives, blockmaps, and manifests publish together.

### Security

- Kept file and folder operations scoped to the selected workspace.
- Kept path traversal and symlink protections around workspace file operations.
- Kept shell commands behind the shell command security setting.

### Release

- Prepared version `0.0.8` with real Windows setup, Windows ZIP, macOS ZIP, manifest, release notes, and GitHub Release workflow support.

## [0.0.7] - 2026-06-03

### Fixed

- Fixed the AI prompt so Coder Desktop no longer tells providers that local command tools are unavailable when safe PowerShell information commands are enabled.
- Fixed chat sending so user messages and tool activity appear while work is running instead of waiting for one final response.
- Fixed update detection so same-version release refreshes can be offered when a release asset is newer than the installed executable.
- Fixed the GitHub Release publishing workflow so it checks out Git LFS assets before uploading release downloads.

### Changed

- Changed the provider system prompt into a branded, sectioned Coder Desktop prompt with explicit local tool state.
- Changed workspace command execution to run through PowerShell directly so PowerShell cmdlets work correctly.
- Changed update notice wording so same-version refreshes do not claim to be a different version.
- Changed security settings to include a custom Windows PowerShell permission switch.

### Added

- Added Windows PowerShell activity cards for safe information commands.
- Added command grouping for requests such as processor details, system information, networking, services, running processes, date, hostname, and current user.
- Added a `windows-ps-group` tool request format for provider-driven command use.
- Added renderer state updates from the main process so chat activity can update progressively.
- Added tests for PowerShell command grouping, provider prompt tool context, same-version update refreshes, and tool-result compaction.
- Added version `0.0.7` release notes and download documentation.

### Removed

- Removed old prompt wording that described command tools as reserved for a later release.

### Improved

- Improved chat readability by keeping PowerShell output inside compact custom cards.
- Improved tool safety by allowing only approved read-only information commands through the automatic PowerShell command path.
- Improved release reliability by preparing a real Windows x64 ZIP artifact for version `0.0.7`.

### Security

- Kept destructive, permission-changing, installation, deletion, shutdown, credential, registry-writing, firewall-changing, and disk-formatting commands out of the automatic PowerShell tool path.
- Kept command execution behind the Windows PowerShell security setting.
- Kept update discovery and asset selection inside the Electron main process.

### Release

- Prepared version `0.0.7` with a real Windows x64 ZIP download, extension ZIP package, manifest, release notes, and GitHub Release workflow support.

## [0.0.6] - 2026-06-02

### Fixed

- Fixed provider prompts so the AI receives the current workspace and security permission state before every live provider request.
- Fixed chat rendering so assistant and user messages use the normal app font instead of showing all chat text as monospace code.
- Fixed Windows update asset priority so the updater prefers real setup installers over portable executables when both are available.
- Fixed confusing tool messaging so version `0.0.6` no longer claims file or shell access.
- Fixed collapsed sidebar behavior so it respects the adjustable width system on desktop breakpoints.

### Changed

- Changed provider request assembly to compact older chat history before sending it to the provider.
- Changed OpenAI-compatible and Claude provider calls to use a smaller response cap so answers stay readable.
- Changed local fallback provider responses to render as Markdown.
- Changed the right rail into a focused diff-only review surface.
- Changed settings to open from a bottom-right centered card instead of the sidebar or rail.
- Changed security settings to show extension and permission prompt controls only.

### Added

- Added a tool-aware system prompt that explains file and shell tools are reserved for a later release.
- Added Markdown rendering for headings, lists, links, inline code, blockquotes, and fenced code blocks.
- Added provider prompt tests that verify reserved tool-state awareness and chat compaction behavior.
- Added workspace tool tests for the dormant local-tool foundation that will return in a later release.
- Added version `0.0.6` release notes and download documentation.
- Added an adjustable and collapsible sidebar.
- Added smooth motion for sidebar changes, new chats, settings, and review surfaces.
- Added a bottom-right settings button and centered settings modal.

### Removed

- Removed the old chat-body behavior that forced every message into a single preformatted block.
- Removed the visible files rail surface for this version.
- Removed the visible shell rail surface for this version.
- Removed the old sidebar settings entry.
- Removed unused renderer file and shell panel components.
- Removed preview-only file editing and shell command behavior.

### Improved

- Improved long conversation handling by preserving recent messages and summarizing older context before provider calls.
- Improved update installation behavior by launching the Windows installer after download.
- Improved the preview chat response so it demonstrates real Markdown and desktop tool awareness.
- Improved the diff empty state with direct awaiting-code wording.
- Improved settings layout by placing provider and security controls in one centered card.

### Security

- Reserved file and shell tools for a later version and removed them from the visible interface.
- Kept extension access limited to the trusted manifest model.
- Kept provider keys in the existing local secret storage flow.
- Kept update discovery and installation in the Electron main process.

### Release

- Prepared version `0.0.6` with real Windows installers, Windows ZIP archives, extension ZIP package, manifest, and macOS workflow support.

## [0.0.5] - 2026-06-02

### Fixed

- Fixed the workspace tools rail so the review button opens and closes it correctly.
- Fixed new empty chats so they show the centered build screen instead of an unfinished message area.
- Fixed chat titles so the first user request becomes a short 3 to 5 word summary.
- Fixed shell empty states so the panel no longer presents placeholder output as if a command ran.

### Changed

- Rebuilt the renderer around custom-styled controls for provider selection, switches, buttons, scroll surfaces, and empty states.
- Removed the topbar provider selector, open button, and commit button.
- Removed unfinished automations, skills, projects, and footer note items from the sidebar.
- Changed the sidebar section label from threads to chats.
- Moved security controls into settings.

### Added

- Added a custom workspace tools scroller for the right rail tabs.
- Added a terminal-style shell panel that runs commands through the desktop command API.
- Added provider marks beside provider cards and composer model status.
- Added selected-provider beam animation, theme wave animation, and metal send button animation.
- Added version `0.0.5` release notes and download documentation.

### Removed

- Removed the separate security rail tab.
- Removed the logs rail tab.
- Removed native checkbox and radio control rendering from provider and security settings.

### Improved

- Improved dark mode with a true black sidebar and clearer sidebar rows.
- Improved light mode with a white sidebar and calmer contrast.
- Improved diff and file empty states with short, direct wording.
- Improved responsive behavior for narrow screens.

### Security

- Kept shell execution behind the existing local security permission and workspace requirement.
- Kept provider API keys inside the existing local settings and secret storage flow.

### Release

- Prepared version `0.0.5` with real Windows and extension download artifacts, plus macOS workflow support.

## [0.0.4] - 2026-06-02

### Fixed

- Fixed update asset selection so Windows portable downloads are preferred over setup executables when both exist.

### Changed

- Changed startup behavior to quietly check GitHub Releases for newer Coder Desktop versions.

### Added

- Added an update service in the Electron main process.
- Added a corner update card that appears only when a newer compatible version is available.
- Added update download progress, install-ready, and retry states.
- Added Windows portable replacement support for updater-enabled releases.

### Improved

- Improved release automation so macOS workflow builds can upload real macOS ZIP assets directly to GitHub Releases.
- Improved update testing with unit coverage for version comparison and platform asset selection.

### Security

- Kept update discovery and download URL selection inside the trusted Electron main process.
- Limited automatic replacement to Windows portable executables launched from a known portable path.

### Release

- Prepared version `0.0.4` with real Windows and macOS download artifacts.

## [0.0.3] - 2026-06-02

### Fixed

- Removed hard-coded project entries from the sidebar.
- Changed unfinished diff wording to production review wording.
- Hardened workspace file tools against symlink-based workspace escape.

### Changed

- Changed release status language to production-ready release wording.
- Changed sidebar projects to use real recent workspace paths.
- Changed the Electron window to run the renderer with sandboxing enabled.

### Added

- Added safer external navigation handling and default-deny permission requests.
- Added realpath validation for workspace reads and writes.
- Added command length validation for shell tools.
- Added focus-visible styling and smoother UI motion.
- Added version `0.0.3` release notes and download documentation.

### Removed

- Removed unused release and changelog draft files.
- Removed empty download marker files.
- Removed the unused manual release workflow that did not publish from versioned download folders.

### Improved

- Improved provider setting sanitization and provider URL validation.
- Improved responsive behavior and narrow-device spacing.
- Improved composer, rail, tab, and diff empty-state animations.

### Security

- Restricted external links to safe protocols.
- Restricted plain http provider base URLs to local hosts.
- Sanitized security settings received from IPC.
- Rejected oversized file reads through local file tools.

### Release

- Prepared the project for real `0.0.3` Windows, macOS, and extension artifacts.

## [0.0.2] - 2026-06-02

### Fixed

- Changed the first-pass desktop interface into a Codex-like workspace that better matches the requested product direction.

### Changed

- Changed the primary app layout to a calm sidebar, centered build canvas, floating composer, and review rail.
- Updated the release scripts so download artifacts are generated from the package version.

### Added

- Added a light and dark visual system for the desktop workspace.
- Added a GitHub Release publishing workflow for tagged releases.
- Added `0.0.2` release notes and download documentation.

### Removed

- Removed the visually heavy dashboard-style treatment from the renderer.

### Improved

- Improved the diff viewer with line columns, change counts, and a more useful empty state.
- Improved responsive behavior for narrower app windows.

### Security

- Preserved existing default-deny controls for file edits, shell commands, and extensions.

### Release

- Added version `0.0.2` packaging support and release automation.

## [0.0.1] - 2026-06-01

### Fixed

- Created the first stable project foundation for the desktop app.

### Changed

- Changed the empty initial README into complete project documentation.

### Added

- Added the Electron, React, TypeScript, and Vite application foundation.
- Added OpenAI, Claude, and NVIDIA provider configuration.
- Added local chats, chat search, settings, security controls, file tools, shell tools, and diff review.
- Added GitHub workflows, issue forms, release documentation, and download archive structure.

### Removed

- Removed the empty initial repository state.

### Improved

- Added workspace path safety checks and local API key storage through an Electron secrets vault.

### Security

- Added default-deny controls for file editing, shell commands, and extensions.

### Release

- Added Electron Builder and NSIS packaging configuration for version `0.0.1`.
