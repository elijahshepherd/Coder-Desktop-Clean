#!/usr/bin/env bash
set -euo pipefail

version="$(node -p "require('./package.json').version")"

npm run build
npm exec electron-builder -- --mac zip --x64 --arm64

mkdir -p "downloads/$version"
cp "release/Coder-Desktop-$version-mac-x64.zip" "downloads/$version/"
cp "release/Coder-Desktop-$version-mac-arm64.zip" "downloads/$version/"
npm run release:manifest
