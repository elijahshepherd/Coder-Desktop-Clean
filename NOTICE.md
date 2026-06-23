# Notices

Coder Desktop is built with open-source dependencies from the JavaScript, Electron, React, TypeScript, and desktop packaging ecosystem.

This notice file is a project-level reminder that dependency licenses and notices should be reviewed during release preparation.

## Dependency Notice Expectations

Release preparation should include:

- Reviewing production dependencies.
- Reviewing Electron and Electron Builder notices.
- Checking whether bundled dependencies require attribution.
- Keeping license files available when required.
- Including third-party notices with distributable artifacts when required.
- Avoiding removal of required license text from packaged output.

## Project Notice

Coder Desktop is maintained by Elijah Shepherd. Official releases should be distributed through the official repository and GitHub Releases.

Dependency ownership remains with the respective dependency authors and maintainers.

## Release Review

Before publishing a release, confirm:

- `package-lock.json` reflects the intended dependency tree.
- The app builds from the committed source.
- Release artifacts are real and match the manifest.
- Required license and notice obligations are reviewed.

This file is not a full dependency license inventory. It is a release hygiene document for the project.
