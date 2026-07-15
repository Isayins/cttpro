#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="${ROOT_DIR}/.venv/bin/python"

if [ ! -x "${VENV_PYTHON}" ]; then
  echo "Missing virtualenv python: ${VENV_PYTHON}" >&2
  echo "Run ./bootstrap_ubuntu.sh first." >&2
  exit 1
fi

cd "${ROOT_DIR}"
export PYTHONPATH="${ROOT_DIR}:${PYTHONPATH:-}"

exec "${VENV_PYTHON}" "${ROOT_DIR}/sync_tushare.py" "$@"
