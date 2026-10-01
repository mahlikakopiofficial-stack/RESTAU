#!/usr/bin/env bash
set -euo pipefail

VERSION_NAME="${1:-1.0}"
VERSION_CODE="${2:-1}"

echo "Starting PinoyAmbula Android release"
echo "Version: $VERSION_NAME"
echo "Version code: $VERSION_CODE"
echo

gh workflow run android-release.yml \
  --ref main \
  -f "version_name=$VERSION_NAME" \
  -f "version_code=$VERSION_CODE"

echo
echo "Release workflow started."
echo "Open GitHub Actions:"
gh run list --workflow android-release.yml --limit 1 --json url,status,conclusion \
  --template '{{range .}}{{.url}}{{"\n"}}{{end}}'
