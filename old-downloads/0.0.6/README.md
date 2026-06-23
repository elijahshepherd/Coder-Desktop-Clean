# Coder Desktop 0.0.6 Downloads

This folder contains the release artifacts for Coder Desktop `0.0.6`.

These files match the assets published on the GitHub Release page for `v0.0.6` after the release build completes.

## Included Artifacts

- `Coder-Desktop-0.0.6-setup-win-x64.exe`
- `Coder-Desktop-0.0.6-win-x64.zip`
- `Coder-Desktop-0.0.6-setup-win-arm64.exe`
- `Coder-Desktop-0.0.6-win-arm64.zip`
- `Coder-Desktop-0.0.6-mac-x64.zip`
- `Coder-Desktop-0.0.6-mac-arm64.zip`
- `manifest.json`

## Choosing A Download

Use the artifact that matches your device:

- Windows x64 installer: use `Coder-Desktop-0.0.6-setup-win-x64.exe`.
- Windows ARM64 installer: use `Coder-Desktop-0.0.6-setup-win-arm64.exe`.
- Windows ZIP users: choose the matching `win-x64.zip` or `win-arm64.zip`.
- macOS Intel: use `Coder-Desktop-0.0.6-mac-x64.zip`.
- macOS Apple Silicon: use `Coder-Desktop-0.0.6-mac-arm64.zip`.

## Manifest

`manifest.json` records artifact sizes and SHA-256 hashes after artifacts are built.

Use the manifest to confirm that a downloaded artifact matches the expected size and hash.

## Notes

Windows artifacts are built locally on Windows. macOS artifacts are built on macOS through the GitHub Actions workflow.

The Windows setup files install Coder Desktop as a real desktop application. The ZIP files are provided for users who prefer a portable archive.
