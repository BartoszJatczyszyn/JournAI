#!/usr/bin/env bash
set -euo pipefail

# This wrapper ensures a venv is available and runs the GarminDb setup CLI
# located at AI/Diary-AI-BE/app/cli/setup_garmindb.py

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
VENV_DIR="$PROJECT_DIR/.venv"
TARGET="$PROJECT_DIR/Diary-AI-BE/app/cli/setup_garmindb.py"

info() { echo -e "\033[1;34m[INFO]\033[0m $*"; }
err()  { echo -e "\033[1;31m[ERR ]\033[0m $*"; }

if [ ! -f "$TARGET" ]; then
  err "Cannot find setup_garmindb.py at: $TARGET"
  err "Make sure you run this from the AI project directory."
  exit 1
fi

# 1) Ensure venv exists and dependencies are installed
if [ ! -d "$VENV_DIR" ]; then
  info "Virtualenv not found. Bootstrapping with setup_venv.sh"
  "$PROJECT_DIR/setup_venv.sh"
else
  info "Using existing virtualenv at $VENV_DIR"
fi

# 2) Activate venv
# shellcheck disable=SC1090
source "$VENV_DIR/bin/activate"

# 3) Optionally set PYTHONPATH for project modules (not strictly required by the CLI)
export PYTHONPATH="$PROJECT_DIR/Diary-AI-BE/app:${PYTHONPATH:-}"

# 4) Ensure GarminDb and its parsing dependencies are present
info "Installing GarminDb and parsing dependencies (fitfile, tcxfile, fitparse, fitdecode, idbutils)"
python -m pip install --disable-pip-version-check -q garmindb fitfile tcxfile fitparse fitdecode idbutils || true

# 5) Run the CLI, forwarding all args
info "Running GarminDb setup CLI"
python -u "$TARGET" "$@"
