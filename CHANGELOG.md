# Changelog

## [0.1.4] - 2026-07-23

### Fixed
- **Fixed missing `diff` module in production builds** - Removed erroneous `!**/node_modules/**` exclude from `electron-builder.yml` that was stripping all production dependencies from the ASAR archive. The `diff` package (used by the main process for file diffs) is now properly included in the packaged app.
- CI workflow now triggers on `master` branch (default branch) in addition to `main`, so packaging regressions are caught earlier

## [0.1.3] - 2026-07-23

### Changed
- Updated app logo and icon across the entire application
- New brand identity with inverted variant for dark mode

## [0.1.0] - 2026-06-22

### Added

- Reset version to 0.1.0 due to the project growing too large in the previous repository.
- This version marks a fresh start in a new repository, continuing from version 0.0.44.