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
VMQ_HEALTH_URL="${APP_VMQ_HEALTH_URL:-http://127.0.0.1:9091/actuator/health/vmq}"
VMQ_STATUS_FILE="${APP_VMQ_HEALTH_STATUS_FILE:-${APP_HOME}/vmq-health-status}"
mkdir -p "$(dirname "${STATUS_FILE}")" "$(dirname "${VMQ_STATUS_FILE}")"

check_health() {
  local name="$1" url="$2" status_file="$3" previous="UNKNOWN"
  [[ ! -f "${status_file}" ]] || previous="$(cat "${status_file}")"
  if curl -fsS --max-time 10 "${url}" | grep -q '"status"[[:space:]]*:[[:space:]]*"UP"'; then
    printf 'UP\n' > "${status_file}.tmp"
    chmod 0644 "${status_file}.tmp"
    mv "${status_file}.tmp" "${status_file}"
    if [[ "${previous}" == "DOWN" ]]; then
      bash "${SCRIPT_DIR}/ops-alert.sh" "cttpro ${name} recovered on $(hostname)" || true
    fi
    return 0
  fi

  printf 'DOWN\n' > "${status_file}.tmp"
  chmod 0644 "${status_file}.tmp"
  mv "${status_file}.tmp" "${status_file}"
  if [[ "${previous}" != "DOWN" ]]; then
    bash "${SCRIPT_DIR}/ops-alert.sh" "cttpro ${name} health check failed on $(hostname)" || true
  fi
  return 1
}

check_health "backend" "${HEALTH_URL}" "${STATUS_FILE}" || exit 1
check_health "V免签 listener" "${VMQ_HEALTH_URL}" "${VMQ_STATUS_FILE}"
