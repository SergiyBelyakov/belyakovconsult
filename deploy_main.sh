#!/usr/bin/env bash
# Publish the complete archived site to main without rewriting Git history.
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$HERE/site"
REMOTE="https://github.com/SergiyBelyakov/belyakovconsult.git"

if ! command -v git >/dev/null 2>&1; then
  echo "Git is required. Install Xcode Command Line Tools (xcode-select --install)." >&2
  exit 1
fi
if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required." >&2
  exit 1
fi
if [[ ! -f "$SOURCE/index.html" || ! -f "$SOURCE/data-journey/index.html" ]]; then
  echo "Cannot locate site files next to this script." >&2
  exit 1
fi

TMP="$(mktemp -d "${TMPDIR:-/tmp}/bc-main-deploy.XXXXXXXX")"
trap 'rm -rf "$TMP"' EXIT

echo "Fetching current main branch..."
git clone --quiet --single-branch --branch main "$REMOTE" "$TMP/repo"
cd "$TMP/repo"
BEFORE="$(git rev-parse HEAD)"

# Deliberately delete files not present in the new archive; preserve .git metadata.
rsync -a --delete --exclude='.git/' "$SOURCE/" "$TMP/repo/"

git add --all
if git diff --cached --quiet; then
  echo "main already matches the supplied project. Nothing to push."
  exit 0
fi

echo "Files that will be replaced:"
git diff --cached --stat

if ! git var GIT_AUTHOR_IDENT >/dev/null 2>&1; then
  echo "Set your Git identity first:" >&2
  echo '  git config --global user.name "Your Name"' >&2
  echo '  git config --global user.email "you@example.com"' >&2
  exit 1
fi

git commit --quiet -m "Update WebGL 360 metal glass neon data journey"

echo "Pushing complete replacement to origin/main..."
# A regular push, without --force. It fails safely if the remote branch moved.
git push origin HEAD:main

echo "Published successfully."
echo "Previous commit: $BEFORE"
echo "New commit: $(git rev-parse HEAD)"
echo "Repository: https://github.com/SergiyBelyakov/belyakovconsult"
