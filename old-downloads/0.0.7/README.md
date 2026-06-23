# Coder Desktop 0.0.7 Downloads

This folder contains the release artifacts for Coder Desktop `0.0.7`.

These files are intended to match the assets published on the GitHub Release page for `v0.0.7`.

## Included Artifacts

- `Coder-Desktop-0.0.7-win-x64.zip`
- `manifest.json`

## Choosing A Download

Use the artifact that matches your need:

- Windows x64 ZIP: use `Coder-Desktop-0.0.7-win-x64.zip`.

## Manifest

`manifest.json` records artifact sizes and SHA-256 hashes after artifacts are built.

Use the manifest to confirm that a downloaded artifact matches the expected size and hash.

## Notes

The Windows x64 ZIP is a real packaged desktop application archive. Extract it before running `Coder Desktop.exe`.

A Windows setup installer is not included in this local 0.0.7 folder because Windows Application Control blocked the generated NSIS installer stub on this computer during local packaging. The app source and release workflow remain prepared for installer publishing in a release environment that allows NSIS packaging.
