#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_HOME="${APP_HOME:-/opt/cttpro}"
ENV_FILE="${ENV_FILE:-${APP_HOME}/.env}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a
fi
HEALTH_URL="${APP_HEALTH_URL:-http://127.0.0.1:9091/actuator/health}"
STATUS_FILE="${APP_HEALTH_STATUS_FILE:-${APP_HOME}/health-status}"
mkdir -p "$(dirname "${STATUS_FILE}")"

PREVIOUS="UNKNOWN"
[[ ! -f "${STATUS_FILE}" ]] || PREVIOUS="$(cat "${STATUS_FILE}")"
if curl -fsS --max-time 10 "${HEALTH_URL}" | grep -q '"status"[[:space:]]*:[[:space:]]*"UP"'; then
  printf 'UP\n' > "${STATUS_FILE}.tmp"
  chmod 0644 "${STATUS_FILE}.tmp"
  mv "${STATUS_FILE}.tmp" "${STATUS_FILE}"
  if [[ "${PREVIOUS}" == "DOWN" ]]; then
    bash "${SCRIPT_DIR}/ops-alert.sh" "cttpro backend recovered on $(hostname)" || true
  fi
  exit 0
fi

printf 'DOWN\n' > "${STATUS_FILE}.tmp"
chmod 0644 "${STATUS_FILE}.tmp"
mv "${STATUS_FILE}.tmp" "${STATUS_FILE}"
if [[ "${PREVIOUS}" != "DOWN" ]]; then
  bash "${SCRIPT_DIR}/ops-alert.sh" "cttpro backend health check failed on $(hostname)" || true
fi
exit 1
