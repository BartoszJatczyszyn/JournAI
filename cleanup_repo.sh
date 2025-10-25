#!/usr/bin/env bash
set -euo pipefail

confirm="yes"
if [[ "${1:-}" != "--yes" ]]; then
  read -r -p "This will remove build artifacts, caches, logs, and legacy wrappers. Continue? [y/N] " reply || reply=""
  case "$reply" in
    [yY][eE][sS]|[yY]) confirm="yes" ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

# Root of repo
cd "$(dirname "$0")"

echo "Removing Python __pycache__ directories..."
find Diary-AI-BE -type d -name '__pycache__' -prune -exec rm -rf {} + || true

echo "Removing frontend build artifacts..."
rm -rf Diary-AI-FE/frontend-react/build || true

echo "Removing logs..."
rm -f ./*.log || true

echo "Removing macOS .DS_Store files..."
find . -name '.DS_Store' -type f -delete || true

echo "Removing legacy wrapper 'temp_dailyJournal'..."
rm -f temp_dailyJournal || true

echo "Cleanup complete."