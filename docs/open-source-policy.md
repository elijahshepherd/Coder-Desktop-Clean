# Open Source Policy

![Official project](https://img.shields.io/badge/Official-Coder%20Desktop-111111?style=flat-square)
![Open source posture](https://img.shields.io/badge/Open%20source-read--only-5865f2?style=flat-square)
![Public inspection](https://img.shields.io/badge/Public%20inspection-welcome-6cd7b6?style=flat-square)
![Pull requests](https://img.shields.io/badge/Pull%20requests-invited%20only-d97706?style=flat-square)
![Releases](https://img.shields.io/badge/Releases-official%20channels-0d8c73?style=flat-square)

Coder Desktop is published for public inspection and transparency. The source is available so users can read it, audit it, learn from it, and understand how the desktop app works.

The project is open for reading, but it is not open for public contribution by default.

> [!NOTE]
> Read-only open source means the repository is available for learning, inspection, and transparency, while project direction and release control stay centralized.

> [!IMPORTANT]
> Official releases come from Elijah Shepherd's Coder Desktop repository and GitHub Releases. Forks are not official Coder Desktop builds.

## Public Inspection

Users may inspect the repository to understand:

- How the desktop application is structured.
- How local tools are guarded.
- How provider settings are handled.
- How release artifacts are organized.
- How GitHub automation works.
- How security boundaries are documented.

This transparency is important because Coder Desktop is a local-first tool with provider settings, update logic, release artifacts, and planned local file and shell tools.

> [!TIP]
> The best public use of this repository is learning how the app is built, checking release files, reading the security model, and reporting clear issues.

## Contribution Posture

Public pull requests are not accepted by default. Elijah Shepherd may invite a specific contribution when needed, but the normal public posture is read-only.

This policy keeps project direction, release quality, security decisions, and product design under direct maintainer control.

> [!WARNING]
> Do not open pull requests unless the maintainer explicitly asks for one. Use issues for reports, questions, and release download problems.

## Issues

Issues may be used for:

- Bug reports.
- Security-adjacent concerns that do not expose sensitive exploit details.
- Documentation corrections.
- Release download problems.
- Packaging problems.
- Feature feedback.

Issues should be written clearly and respectfully. Reports should include enough information to reproduce the problem when possible.

## Pull Requests

Pull requests should not be opened unless the maintainer explicitly asks for one. Uninvited pull requests may be closed without review.

If a contribution is invited, it should:

- Stay focused.
- Follow the existing architecture.
- Include verification.
- Avoid unrelated refactoring.
- Avoid changing release files unless requested.
- Respect the capitalization and UI style standards.

## Forks

The repository license controls what others may do with copies of the code. Review [../LICENSE.md](../LICENSE.md) before redistributing, modifying, or publishing a derivative work.

Even when a fork exists, it is not an official Coder Desktop release unless Elijah Shepherd publishes it through the official repository or release channel.

> [!CAUTION]
> Desktop apps can become powerful local tools. Only install builds from sources you trust.

## Release Authority

Official releases should come from:

- The official repository.
- The official GitHub Releases page.
- Versioned download folders that match release manifests.

Users should avoid downloading builds from unknown mirrors or unofficial channels unless they fully trust the source.

> [!IMPORTANT]
> The official release page should contain real assets, not placeholders. Users should be able to download an actual app package for their platform.

## Why This Policy Exists

Coder Desktop is a desktop app that may work with provider keys, release downloads, and future local tools. A read-only contribution posture reduces accidental churn and keeps sensitive decisions centralized.

The goal is not to keep people away. The goal is to keep the project understandable, stable, and under clear ownership.
