# Coder Desktop 0.0.11 Downloads

This folder contains release artifacts for Coder Desktop `0.0.11`.

These files are intended to match the assets published on the GitHub Release page for `v0.0.11`.

## Included Artifacts

- `Coder-Desktop-0.0.11-setup-win-x64.exe`.
- `Coder-Desktop-0.0.11-setup-win-x64.exe.blockmap`.
- `Coder-Desktop-0.0.11-win-x64.zip`.
- `Coder-Desktop-0.0.11-win-arm64.zip`.
- `Coder-Desktop-0.0.11-mac-x64.zip`.
- `Coder-Desktop-0.0.11-mac-arm64.zip`.
- `manifest.json`.

macOS ZIP artifacts are built by the GitHub Actions macOS runner and published through GitHub Releases.

## Choosing A Download

- Windows setup installer: use `Coder-Desktop-0.0.11-setup-win-x64.exe`.
- Windows ZIP archive: use `Coder-Desktop-0.0.11-win-x64.zip`.
- Windows ARM64 ZIP archive: use `Coder-Desktop-0.0.11-win-arm64.zip`.
- macOS Intel ZIP archive: use `Coder-Desktop-0.0.11-mac-x64.zip` from the GitHub Release after the macOS workflow publishes it.
- macOS Apple silicon ZIP archive: use `Coder-Desktop-0.0.11-mac-arm64.zip` from the GitHub Release after the macOS workflow publishes it.

## Manifest

`manifest.json` records artifact sizes and SHA-256 hashes after artifacts are built.

Use the manifest attached to the GitHub Release to confirm that a downloaded artifact matches the expected size and hash.

## Notes

The Windows setup installer and ZIP archives are real packaged desktop application downloads after the release build completes. The setup installer is the preferred Windows download for users who want a normal installed desktop app.

Version `0.0.11` adds todo progress cards, Let me know clarification cards, chat access modes, internet tools, safer installation guidance, sidebar footer cleanup, and refreshed Coder Desktop icons.
