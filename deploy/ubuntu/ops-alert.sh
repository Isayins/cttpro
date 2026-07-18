#!/usr/bin/env bash
set -Eeuo pipefail

APP_HOME="${APP_HOME:-/opt/cttpro}"
ENV_FILE="${ENV_FILE:-${APP_HOME}/.env}"
MESSAGE="${1:-cttpro alert}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a
fi

WEBHOOK_URL="${APP_OPS_ALERT_WEBHOOK_URL:-}"
if [[ -z "${WEBHOOK_URL}" ]]; then
  echo "Alert webhook is not configured: ${MESSAGE}" >&2
  exit 0
fi

ESCAPED="${MESSAGE//\\/\\\\}"
ESCAPED="${ESCAPED//\"/\\\"}"
curl -fsS --max-time 10 \
  -H 'Content-Type: application/json' \
  --data-binary "{\"text\":\"${ESCAPED}\"}" \
  "${WEBHOOK_URL}" >/dev/null
