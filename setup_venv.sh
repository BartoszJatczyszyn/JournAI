#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Preferred major.minor
PY_SERIES="3.13"
VENV_DIR="$PROJECT_DIR/.venv"
REQ_FILE="$PROJECT_DIR/requirements.txt"

info() { echo -e "\033[1;34m[INFO]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
err()  { echo -e "\033[1;31m[ERR ]\033[0m $*"; }

has_cmd() { command -v "$1" >/dev/null 2>&1; }

pick_pyenv_version() {
  # Prefer stable X.Y.Z, fallback to rc if needed
  local series="$1"
  local versions
  versions=$(pyenv install --list | sed 's/^ *//' | grep -E "^${series}(\\.|$)" || true)
  if [ -z "$versions" ]; then
    return 1
  fi
  # Prefer lines like 3.13.Z where Z is digits only
  local stable
  stable=$(echo "$versions" | grep -E "^${series}\\.[0-9]+$" | tail -n1 || true)
  if [ -n "$stable" ]; then
    echo "$stable"
    return 0
  fi
  # Fallback: pick the latest available (could be rc)
  echo "$versions" | tail -n1
}

PY_BIN=""
SELECTED_PY=""

# 1) Ensure Python 3.13 is available (prefer pyenv if present)
if has_cmd pyenv; then
  info "Using pyenv to manage Python ${PY_SERIES}.x"
  SELECTED_PY=$(pick_pyenv_version "$PY_SERIES" || true)
  if [ -z "$SELECTED_PY" ]; then
    err "Could not find any ${PY_SERIES}.x version in pyenv. Try: brew update && brew upgrade pyenv"
    exit 1
  fi
  if ! pyenv versions --bare | grep -qx "$SELECTED_PY"; then
    info "Installing Python $SELECTED_PY via pyenv (this may take a while)"
    export PYTHON_CONFIGURE_OPTS="--enable-shared"
    export CFLAGS="-O2"
    pyenv install "$SELECTED_PY"
  else
    info "Python $SELECTED_PY already installed in pyenv"
  fi
  info "Setting local pyenv version to $SELECTED_PY"
  (cd "$PROJECT_DIR" && pyenv local "$SELECTED_PY")
  # Resolve pyenv python within the project directory context
  PY_BIN="$(cd "$PROJECT_DIR" && pyenv which python)"
elif has_cmd python3.13; then
  info "Found system python3.13 ($(python3.13 -V))"
  PY_BIN="python3.13"
else
  err "python3.13 not found and pyenv is not installed.\nPlease install Python ${PY_SERIES}.x or install pyenv and re-run.\n- macOS (brew): brew install pyenv && echo 'eval \"$(pyenv init -)\"' >> ~/.zshrc\n- Linux: https://github.com/pyenv/pyenv#installation"
  exit 1
fi

# 2) Create or recreate virtual environment if Python version/series mismatches
if [ -d "$VENV_DIR" ]; then
  info "Virtualenv already exists at $VENV_DIR; verifying Python version"
  # shellcheck disable=SC1090
  source "$VENV_DIR/bin/activate"
  CURRENT_SERIES=$(python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
  CURRENT_FULL=$(python -c 'import sys; import platform; print(platform.python_version())')
  deactivate || true
  # If SELECTED_PY is empty (system python3.13 path used), only check series
  if [ -n "${SELECTED_PY:-}" ]; then
    if [ "$CURRENT_FULL" != "$SELECTED_PY" ]; then
      warn "Existing venv uses Python $CURRENT_FULL; recreating for $SELECTED_PY"
      rm -rf "$VENV_DIR"
      info "Creating virtualenv at $VENV_DIR using $PY_BIN"
      "$PY_BIN" -m venv "$VENV_DIR"
    else
      info "Existing venv matches desired version $SELECTED_PY"
    fi
  else
    if [ "$CURRENT_SERIES" != "$PY_SERIES" ]; then
      warn "Existing venv uses Python $CURRENT_SERIES; recreating for $PY_SERIES"
      rm -rf "$VENV_DIR"
      info "Creating virtualenv at $VENV_DIR using $PY_BIN"
      "$PY_BIN" -m venv "$VENV_DIR"
    else
      info "Existing venv matches desired series $PY_SERIES"
    fi
  fi
else
  info "Creating virtualenv at $VENV_DIR using $PY_BIN"
  "$PY_BIN" -m venv "$VENV_DIR"
fi

# 3) Activate and upgrade pip/setuptools/wheel
# shellcheck disable=SC1090
source "$VENV_DIR/bin/activate"
python -V
pip install --upgrade pip setuptools wheel

# 4) Install project dependencies
if [ -f "$REQ_FILE" ]; then
  info "Installing dependencies from $REQ_FILE"
  pip install -U -r "$REQ_FILE"
else
  warn "No requirements.txt found at $REQ_FILE; skipping"
fi

info "Done. To activate: source $VENV_DIR/bin/activate"
