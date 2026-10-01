#!/usr/bin/env bash
set -euo pipefail

echo "===== PINOYAMBULA ANDROID RELEASE ====="

git fetch origin main --tags

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "FAIL: working tree has uncommitted changes"
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "FAIL: current branch is '$CURRENT_BRANCH'; switch to main first"
  exit 1
fi

LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse origin/main)"

if [ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]; then
  echo "Local main is behind/ahead of origin/main. Fast-forwarding..."
  git pull --ff-only origin main
fi

if [ "$#" -eq 0 ]; then
  LATEST_TAG="$(git for-each-ref --sort=-creatordate --format='%(refname:strip=2)' 'refs/tags/android-v*' | head -n1 || true)"

  if [ -z "$LATEST_TAG" ]; then
    VERSION_NAME="1.0.0"
    VERSION_CODE="1"
  elif [[ "$LATEST_TAG" =~ ^android-v([0-9]+)\.([0-9]+)(\.([0-9]+))?-([0-9]+)$ ]]; then
    MAJOR="${BASH_REMATCH[1]}"
    MINOR="${BASH_REMATCH[2]}"
    PATCH="${BASH_REMATCH[4]:-0}"
    LAST_CODE="${BASH_REMATCH[5]}"

    PATCH=$((PATCH + 1))
    VERSION_CODE=$((LAST_CODE + 1))
    VERSION_NAME="${MAJOR}.${MINOR}.${PATCH}"
  else
    echo "FAIL: could not parse latest Android release tag: $LATEST_TAG"
    echo "Expected format: android-v1.2.3-4"
    exit 1
  fi
elif [ "$#" -eq 2 ]; then
  VERSION_NAME="$1"
  VERSION_CODE="$2"
else
  echo "Usage:"
  echo "  ./scripts/release-aab.sh"
  echo "  ./scripts/release-aab.sh <version-name> <version-code>"
  exit 1
fi

if ! [[ "$VERSION_NAME" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
  echo "FAIL: invalid version name: $VERSION_NAME"
  exit 1
fi

if ! [[ "$VERSION_CODE" =~ ^[0-9]+$ ]]; then
  echo "FAIL: version code must be numeric"
  exit 1
fi

TAG="android-v${VERSION_NAME}-${VERSION_CODE}"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "FAIL: tag already exists: $TAG"
  exit 1
fi

echo "Version:      $VERSION_NAME"
echo "Version code: $VERSION_CODE"
echo "Release tag:  $TAG"
echo

git tag -a "$TAG" -m "PinoyAmbula Android release $VERSION_NAME ($VERSION_CODE)"
git push origin "$TAG"

echo
echo "PASS: release tag pushed"
echo "GitHub Actions will now build the signed APK and AAB."
echo
echo "Open:"
echo "https://github.com/mahlikakopiofficial-stack/RESTAU/actions"
