#!/usr/bin/env bash
set -euo pipefail

version="$(node -p "require('./package.json').version")"
versionPrefix="v$version"

npm run build
npm exec electron-builder -- --mac zip --x64 --arm64

mkdir -p "downloads/$versionPrefix/macOS"
cp "release/Coder-Desktop-$version-mac-x64.zip" "downloads/$versionPrefix/macOS/"
cp "release/Coder-Desktop-$version-mac-arm64.zip" "downloads/$versionPrefix/macOS/"
npm run release:manifest
