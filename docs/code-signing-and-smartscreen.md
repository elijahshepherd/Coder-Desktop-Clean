# Code Signing And SmartScreen

![Windows release trust](https://img.shields.io/badge/Windows-release%20trust-0078d4?style=flat-square&logo=windows&logoColor=white)
![SmartScreen](https://img.shields.io/badge/SmartScreen-reputation%20based-d97706?style=flat-square)
![Installer](https://img.shields.io/badge/Installer-NSIS-5865f2?style=flat-square)
![Portable ZIP](https://img.shields.io/badge/Portable%20ZIP-primary%20EXE-0078d4?style=flat-square)
![Manifest](https://img.shields.io/badge/Manifest-SHA--256-6cd7b6?style=flat-square)
![Signing](https://img.shields.io/badge/Signing-certificate%20required-111111?style=flat-square)

Windows SmartScreen reputation is a release trust issue, not only a code issue. Coder Desktop can provide correct app metadata, stable artifact names, icons, packaging configuration, and release automation. It cannot create Microsoft reputation by itself.

This document explains what the project supports and what a production release environment still needs.

> [!NOTE]
> SmartScreen is reputation based. A file can be built correctly and still receive a warning if the publisher, certificate, or file hash has not built enough trust yet.

> [!IMPORTANT]
> Coder Desktop can prepare real installers, metadata, manifests, and release assets. A trusted certificate and stable publisher identity are still needed for stronger Windows trust.

## What SmartScreen Is Looking At

SmartScreen can consider several signals:

- Whether the executable is signed.
- Whether the certificate is trusted.
- Whether the publisher has reputation.
- Whether the file hash has reputation.
- Whether the download source has reputation.
- Whether the file name, publisher, and metadata are stable.
- Whether the app has been reported as unsafe or suspicious.

An unsigned app can be safe and still trigger SmartScreen. A newly signed app can also trigger warnings until the publisher or file gains reputation.

> [!TIP]
> Stable release names, stable publisher identity, and consistent GitHub Release uploads help users and review systems recognize the app over time.

## Project-Level Support

Coder Desktop includes project support for:

- Stable product name.
- App icon.
- Windows executable metadata.
- Electron Builder configuration.
- Windows installer builds.
- Windows ZIP builds.
- A root-level `Coder Desktop.exe` inside each Windows ZIP backup.
- A plain `How to start Coder Desktop.txt` guide inside each Windows ZIP backup.
- NSIS installer configuration.
- Versioned download folders.
- Release manifests with sizes and hashes.
- Windows trust reports that show artifact checks and Authenticode status.
- GitHub Release publishing workflow.

These are important foundations. They make the app look like Coder Desktop instead of a generic Electron app and make release files easier to verify.

> [!WARNING]
> Correct metadata helps, but it does not replace code signing. Unsigned downloads can still trigger warnings.

## What The Project Cannot Guarantee Alone

The project cannot guarantee:

- No SmartScreen warning on first download.
- Immediate Microsoft reputation.
- Certificate trust without a real certificate.
- Reputation for every rebuilt hash.
- Reputation for files uploaded outside the normal release path.

SmartScreen is external to the codebase. It depends on signing, reputation, distribution history, and Microsoft systems.

> [!CAUTION]
> Rebuilding and replacing the same public release with different hashes can hurt trust. Prefer one clean build per public release.

## Recommended Windows Release Posture

A stronger Windows release should:

- Use an OV or EV code-signing certificate from a trusted certificate authority.
- Sign the unpacked app executable.
- Sign the NSIS installer.
- Sign any standalone portable executable if one is published in a future release.
- Timestamp signatures.
- Keep publisher name stable.
- Keep product name stable.
- Keep artifact names stable.
- Avoid rebuilding and replacing the same public release with different hashes.
- Upload files through a consistent GitHub Release path.
- Keep release notes clear and complete.

The most important point is consistency. A stable publisher, stable app identity, and stable distribution source help reputation build over time.

## Electron Builder Signing

Electron Builder can sign Windows artifacts when the release environment is configured.

Common environment variables:

```powershell
$env:CSC_LINK = "path-or-base64-certificate"
$env:CSC_KEY_PASSWORD = "certificate-password"
```

Release environments should protect these values. Do not commit certificates or passwords.

> [!CAUTION]
> Certificates and signing passwords are secrets. They should never appear in Git, logs, screenshots, issue comments, or release assets.

Coder Desktop release scripts are signing-aware. When a signing certificate is configured through `CSC_LINK` and `CSC_KEY_PASSWORD`, the Windows build path leaves Electron Builder signing enabled. When no certificate is configured, the build remains unsigned but still stamps Coder Desktop metadata and writes a trust report so maintainers can see exactly what shipped.

> [!IMPORTANT]
> An unsigned build can be a real build and still trigger SmartScreen. The unsigned path is only a fallback until a trusted signing setup is available.

## Release Builds

Coder Desktop currently publishes a Windows x64 setup installer, a Windows x64 portable executable, Windows ZIP archives, macOS ZIP archives, and matching release manifests through GitHub Releases. The setup installer is produced through the NSIS packaging path and should be signed in a trusted release environment when a certificate is available.

Release builds should:

- Use the real app icon.
- Use correct product metadata.
- Use consistent artifact names.
- Include Windows ZIP backup packages with a root-level `Coder Desktop.exe`.
- Be uploaded to the matching GitHub Release.
- Match the manifest hash.

> [!NOTE]
> Portable replacement support applies only when Coder Desktop is launched from a known portable executable path.

## NSIS Installer Builds

The repository includes NSIS configuration through Electron Builder. NSIS installer builds remain supported for environments with a trusted signing setup.

Installer builds should:

- Be signed.
- Be timestamped.
- Use the correct app name and publisher.
- Install to predictable locations.
- Avoid unnecessary elevation.
- Include an uninstall path.

The installer path is the normal Windows install and update path. Keep it signed, timestamped, and aligned with the public release manifest whenever a signing certificate is available.

## Windows ZIP Backup Builds

Windows ZIP packages are published alongside the standard installer so users have a portable backup download option.

Each ZIP should:

- Contain `Coder Desktop.exe` at the root of the extracted folder.
- Contain `How to start Coder Desktop.txt` at the root of the extracted folder.
- Keep the `resources` folder and other app files beside the executable.
- Use the same version number as the installer.
- Be listed in the release manifest.

Users should extract the ZIP first, then open `Coder Desktop.exe`. Running files directly from inside a compressed ZIP is not recommended because Windows may block file access or app resources.

> [!NOTE]
> A ZIP does not bypass SmartScreen. It gives users a portable backup path, while trusted signing and release reputation remain the correct long-term trust path.

## macOS Signing And Notarization

macOS ZIP builds can be created through the macOS workflow. A production macOS release should eventually include signing and notarization.

Recommended macOS release work:

- Sign the app bundle with an Apple Developer ID certificate.
- Notarize the app with Apple.
- Staple notarization when applicable.
- Keep bundle identifier stable.
- Keep app metadata stable.

Without signing and notarization, macOS users may see trust prompts or Gatekeeper warnings.

## Release Manifest

Each release folder should include a manifest with:

- Artifact name.
- Platform.
- Format.
- Size in bytes.
- SHA-256 hash.
- Git LFS storage indicator.

The manifest helps users and maintainers confirm that release assets are real and unchanged.

> [!IMPORTANT]
> The manifest should match the public release assets. If the GitHub Release asset changes, update and republish the manifest.

## Microsoft Review

If a signed release is still flagged, submit the file to Microsoft Security Intelligence for review. This is useful for false positives and reputation issues.

Use the official Microsoft submission path and include:

- The exact file.
- Publisher information.
- Release URL.
- Explanation of the app purpose.
- Confirmation that the file is expected and signed.

## Practical Release Checklist

Before publishing a Windows release:

- Build from a clean working tree.
- Run typecheck, tests, build, and audit.
- Confirm app metadata says `Coder Desktop`.
- Confirm the packaged app opens and is not blank.
- Confirm release files exist in the correct download folder.
- Confirm Windows ZIP files contain `Coder Desktop.exe` and `How to start Coder Desktop.txt`.
- Confirm the Windows trust report was generated.
- Confirm the manifest hashes match.
- Upload release files to GitHub Releases.
- Download the public EXE and compare its hash to the local build.
- Launch the public EXE once to confirm it opens as Coder Desktop.

This checklist does not replace signing, but it prevents many release quality problems.
