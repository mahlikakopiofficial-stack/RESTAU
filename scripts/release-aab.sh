#!/usr/bin/env bash
set -euo pipefail

VERSION_NAME="${1:-1.0}"
VERSION_CODE="${2:-1}"
TAG="android-v${VERSION_NAME}-${VERSION_CODE}"

echo "===== PINOYAMBULA ANDROID RELEASE ====="
echo "Version:      $VERSION_NAME"
echo "Version code: $VERSION_CODE"
echo "Release tag:  $TAG"
echo

if ! [[ "$VERSION_CODE" =~ ^[0-9]+$ ]]; then
  echo "FAIL: version code must be numeric"
  exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "FAIL: tag already exists: $TAG"
  exit 1
fi

git fetch origin main

git diff --quiet
git diff --cached --quiet

git tag -a "$TAG" -m "PinoyAmbula Android release $VERSION_NAME ($VERSION_CODE)"
git push origin "$TAG"

echo
echo "PASS: release tag pushed"
echo "GitHub Actions will now build the signed APK and AAB."
echo
echo "Open:"
echo "https://github.com/mahlikakopiofficial-stack/RESTAU/actions"
