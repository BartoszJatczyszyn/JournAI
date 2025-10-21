#!/usr/bin/env bash
set -euo pipefail

# setup_python_env.sh
# - Uninstalls all pyenv-managed Python versions (optional --force)
# - Installs the latest stable CPython via pyenv (or a version provided via --python)
# - Creates a virtual environment at AI/.venv and installs requirements
#
# Usage:
#   bash AI/Diary-AI-BE/scripts/setup_python_env.sh [--force] [--python X.Y.Z]
#
# Notes:
# - Requires pyenv to be installed and available on PATH.
# - Does NOT remove system Python (only pyenv installs).
# - If requirements fail on latest Python, try a compatible version, e.g. --python 3.11.9

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT_DIR="$REPO_ROOT/AI"
VENV_DIR="$PROJECT_DIR/.venv"
REQ_FILE="$PROJECT_DIR/requirements.txt"

FORCE_UNINSTALL=0
REQUESTED_PYTHON=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)
      FORCE_UNINSTALL=1
      shift
      ;;
    --python)
      REQUESTED_PYTHON="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

say() { echo -e "\033[1;34m[setup]\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $*"; }
err() { echo -e "\033[1;31m[error]\033[0m $*"; }

ensure_pyenv() {
  if ! command -v pyenv >/dev/null 2>&1; then
    err "pyenv not found on PATH. Ensure it's installed and loaded in your shell (zshrc/zprofile)."
    exit 1
  fi
}

latest_stable_python() {
  # Get latest X.Y.Z from pyenv install -l list of CPython.
  # Filter plain semantic versions, remove pre-releases.
  pyenv install -l 2>/dev/null \
    | sed 's/^ *//' \
    | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' \
    | tail -1
}

uninstall_all_pyenv_versions() {
  say "Uninstalling all pyenv Python versions (excluding 'system')..."
  local versions
  versions="$(pyenv versions --bare || true)"
  if [[ -z "$versions" ]]; then
    say "No pyenv versions found. Skipping."
    return
  fi

  if [[ $FORCE_UNINSTALL -ne 1 ]]; then
    echo "This will uninstall the following versions:" >&2
    for v in $versions; do echo "  - $v"; done
    read -r -p "Type YES to proceed: " CONFIRM
    if [[ "$CONFIRM" != "YES" ]]; then
      warn "Uninstall cancelled by user."
      return
    fi
  fi

  for v in $versions; do
    if [[ "$v" == "system" || -z "$v" ]]; then
      continue
    fi
    say "pyenv uninstall -f $v"
    pyenv uninstall -f "$v" || warn "Failed to uninstall $v (continuing)"
  done
}

install_python_version() {
  local version="$1"
  say "Installing Python $version via pyenv (if not present)..."
  if pyenv versions --bare | grep -qx "$version"; then
    say "Python $version already installed in pyenv."
  else
    pyenv install -s "$version"
  fi
  say "Setting local pyenv version to $version for project..."
  (cd "$PROJECT_DIR" && pyenv local "$version")
}

create_venv_and_install() {
  local version="$1"
  local pybin
  pybin="$(pyenv prefix "$version")/bin/python"
  if [[ ! -x "$pybin" ]]; then
    err "Python binary not found for $version at $pybin"
    exit 1
  fi

  say "Creating virtual environment at $VENV_DIR ..."
  rm -rf "$VENV_DIR"
  "$pybin" -m venv "$VENV_DIR"
  source "$VENV_DIR/bin/activate"
  python -m pip install --upgrade pip setuptools wheel

  if [[ -f "$REQ_FILE" ]]; then
    say "Installing requirements from $REQ_FILE ..."
    if ! pip install -r "$REQ_FILE"; then
      warn "Installing requirements failed. This project pins some older versions that might not support Python $version."
      warn "Consider using a compatible Python, e.g.: --python 3.11.9"
      warn "Or update requirements to versions compatible with $version."
      return 1
    fi
  else
    warn "Requirements file not found at $REQ_FILE. Skipping."
  fi
}

main() {
  ensure_pyenv

  local version
  if [[ -n "$REQUESTED_PYTHON" ]]; then
    version="$REQUESTED_PYTHON"
  else
    # Default to the requested project version
    version="3.13.5"
  fi
  say "Target Python version: $version"

  uninstall_all_pyenv_versions
  install_python_version "$version"

  if ! create_venv_and_install "$version"; then
    warn "Virtualenv created, but requirements installation failed. You can still activate the venv and adjust dependencies."
  else
    say "Environment ready."
  fi

  cat <<EOF

Next steps:
1) Activate the environment:
   source "$VENV_DIR/bin/activate"

2) Verify Python:
   python --version

3) Run backend (example):
   python "$PROJECT_DIR/scripts/start_backend.py" || python "$PROJECT_DIR/scripts/backend_api.py"

To retry with a specific Python version (e.g., 3.11.9 if dependencies require it):
   bash AI/scripts/setup_python_env.sh --force --python 3.11.9
EOF
}

main "$@"
