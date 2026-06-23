# Status Badges And Documentation Tags

![Official project](https://img.shields.io/badge/Official-Coder%20Desktop-111111?style=flat-square)
![Current version](https://img.shields.io/badge/Current%20version-0.1.0-2f3238?style=flat-square)
![GitHub release](https://img.shields.io/github/v/release/elijahshepherd/Coder-Desktop?style=flat-square&label=GitHub%20Release)
![CI](https://img.shields.io/github/actions/workflow/status/elijahshepherd/Coder-Desktop/ci.yml?branch=main&style=flat-square&label=CI)
![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-brightgreen?style=flat-square&logo=node.js&logoColor=white)
![Local tools](https://img.shields.io/badge/Local%20tools-main%20process-4e5158?style=flat-square)
![Read only open source](https://img.shields.io/badge/Open%20source-read--only-6f747d?style=flat-square)

This document explains how Coder Desktop uses badges and GitHub documentation tags. Badges should help readers understand status quickly. They should not replace real documentation.

> [!NOTE]
> Badges are public signals. They should describe the project honestly and stay aligned with the repository, package version, workflows, and release assets.

## Badge Groups

| Badge group | Meaning | Source of truth |
| --- | --- | --- |
| Official | Marks this repository as the official Coder Desktop project. | Repository ownership and project documentation. |
| Current version | Shows the current package and release version. | `package.json` and GitHub Releases. |
| GitHub Release | Shows the latest published release tag. | GitHub Releases. |
| CI | Shows whether the main test workflow is passing. | `.github/workflows/ci.yml`. |
| Runtime | Shows required local runtime tools such as Node.js. | `package.json` engines. |
| Desktop stack | Shows major technologies such as Electron, React, and TypeScript. | `package.json` dependencies and source layout. |
| Security posture | Shows local-first, read-only source policy, and permission model signals. | Security docs and project policy docs. |
| Platform support | Shows Windows and macOS release support. | Release notes, downloads, and workflows. |

## Current Badge Set

Use these badges near the top of the README or major overview documents:

```md
![Official project](https://img.shields.io/badge/Official-Coder%20Desktop-111111?style=flat-square)
![Current version](https://img.shields.io/badge/Current%20version-0.0.38-2f3238?style=flat-square)
![GitHub release](https://img.shields.io/github/v/release/elijahshepherd/Coder-Desktop?style=flat-square&label=GitHub%20Release)
![CI](https://img.shields.io/github/actions/workflow/status/elijahshepherd/Coder-Desktop/ci.yml?branch=main&style=flat-square&label=CI)
![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-brightgreen?style=flat-square&logo=node.js&logoColor=white)
```

> [!IMPORTANT]
> The Node.js badge should say `20+` because this repository currently declares `"node": ">=20"` in `package.json`.

## Documentation Tags

GitHub supports callout blocks that make important documentation easier to scan. Use them when the information changes how someone should read or use the page.

| Tag | Use it for |
| --- | --- |
| `> [!NOTE]` | Helpful context that is not a warning. |
| `> [!TIP]` | A practical recommendation or workflow shortcut. |
| `> [!IMPORTANT]` | A requirement readers should not miss. |
| `> [!WARNING]` | A risk that could cause problems if ignored. |
| `> [!CAUTION]` | A higher-risk warning, especially around local files, shell commands, secrets, or releases. |

Example:

```md
> [!WARNING]
> Do not publish API keys, local paths with secrets, or private project details in public issues.
```

## Badge Maintenance Rules

- Update the current version badge when `package.json` changes.
- Keep release badges linked to real GitHub Releases.
- Do not add badges for features that are not implemented.
- Do not imply a platform is fully supported unless it has a real release artifact.
- Prefer short badge labels that explain the fact directly.
- Keep badge colors readable in both light and dark GitHub themes.

> [!CAUTION]
> A badge can create trust very quickly. If a badge says a download, platform, workflow, or security posture is ready, the repository should have evidence for that claim.

## Good Badge Examples

These badges are clear because they describe verifiable project facts:

```md
![Local tools](https://img.shields.io/badge/Local%20tools-main%20process-4e5158?style=flat-square)
![Windows](https://img.shields.io/badge/Windows-installer%20%7C%20ZIP-0078d4?style=flat-square&logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-zip%20builds-999999?style=flat-square&logo=apple&logoColor=white)
```

## Bad Badge Examples

Avoid badges that overstate the project:

- Do not say `production signed` unless signing is configured and verified.
- Do not say `all platforms` unless Windows, macOS, and Linux all have real release files.
- Do not add badges for planned features that are not part of the current app.
- Do not say `Node.js 18+` when the package requires Node.js 20 or newer.

## Official Channels

Official project information should point to:

- Repository: [elijahshepherd/Coder-Desktop](https://github.com/elijahshepherd/Coder-Desktop)
- Releases: [Coder Desktop Releases](https://github.com/elijahshepherd/Coder-Desktop/releases)
- Downloads folder: [downloads](../downloads)
- Security policy: [SECURITY.md](../SECURITY.md)

> [!TIP]
> If a badge makes a claim, link the nearby documentation to the page that proves the claim.
