# Release Notes Template

All release notes in `docs/releases/{version}.md` must follow this format. The GitHub Actions publish workflow uses this file as the release body.

---

## Required Format

```
# {Five-word summary}

Short 1 sentence explaining the change.

---

## Highlights

- Key user-facing change
- Another highlight

## Added

- New feature or capability
- New platform support

## Removed

- Deprecated feature removed
- Artifact type no longer produced

## Other Changes

- Internal refactor
- Build improvement
- Dependency update

---

## Install

**Windows**: Download `Coder-Desktop-{version}-setup-win-x64.exe` and run it. The installer supports automatic updates.

**macOS (Intel)**: Download `Coder-Desktop-{version}-mac-x64.zip`, extract, and move `Coder Desktop.app` to Applications.

**macOS (Apple Silicon)**: Download `Coder-Desktop-{version}-mac-arm64.zip`, extract, and move `Coder Desktop.app` to Applications.

All artifacts include SHA256 checksums in the release manifest.

---

## Notes

- Any limitations, requirements, or important information
- macOS builds must run on macOS (GitHub Actions or local)
- Windows SmartScreen may warn on unsigned builds
```

---

## Example (v0.1.0)

```
# First public release of Coder Desktop

Coder Desktop 0.1.0 introduces the initial local-first AI coding workspace with Windows installer and macOS ZIP distributions.

---

## Highlights

- Windows NSIS installer with automatic update support
- macOS universal ZIP packages for Intel and Apple Silicon

## Added

- Chat interface with multiple AI provider support (OpenAI, Claude, NVIDIA)
- Local file tools (read, write, list, diff, create, delete)
- Shell command execution with workspace scoping
- Windows PowerShell information commands
- Internet search and page fetching
- Provider configuration with API key storage
- Settings panel with security, personalization, AI functionality tabs
- Image generation with NVIDIA FLUX models
- Message feedback (like/dislike) and bug reporting
- Automatic update checks via GitHub Releases
- Versioned download folders with SHA256 manifest

## Removed

- Portable EXE builds (repository size reduction)

## Other Changes

- Streamlined build pipeline for compact NSIS installer ZIPs
- macOS builds now run exclusively on GitHub Actions macOS runners

---

## Install

**Windows**: Download `Coder-Desktop-0.1.0-setup-win-x64.exe` and run it. The installer supports automatic updates.

**macOS (Intel)**: Download `Coder-Desktop-0.1.0-mac-x64.zip`, extract, and move `Coder Desktop.app` to Applications.

**macOS (Apple Silicon)**: Download `Coder-Desktop-0.1.0-mac-arm64.zip`, extract, and move `Coder Desktop.app` to Applications.

All artifacts include SHA256 checksums in the release manifest.

---

## Notes

- macOS application ZIPs must be built on macOS or by the macOS GitHub Actions workflow.
- Windows SmartScreen may warn on unsigned builds; a trusted code-signing certificate is recommended for production.
- This is an early release — expect rough edges and rapid iteration.
```