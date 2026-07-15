#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_CONFIG="${SCRIPT_DIR}/nginx-host.conf"
TARGET_CONFIG="${1:-}"
AVATAR_FILE="${AVATAR_FILE:-}"
SITE_ORIGIN="${SITE_ORIGIN:-https://idncar.com}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer as root." >&2
  exit 1
fi

if [[ ! -f "${SOURCE_CONFIG}" ]]; then
  echo "Missing Nginx template: ${SOURCE_CONFIG}" >&2
  exit 1
fi

if [[ -z "${TARGET_CONFIG}" ]]; then
  TARGET_CONFIG="$(
    grep -RIlE 'server_name[[:space:]]+([^;[:space:]]+[[:space:]]+)*idncar\.com([[:space:];]|$)' \
      /etc/nginx/conf.d /etc/nginx/sites-enabled 2>/dev/null \
      | head -n 1
  )"
fi

if [[ -z "${TARGET_CONFIG}" || ! -e "${TARGET_CONFIG}" ]]; then
  echo "Unable to find the active idncar.com Nginx configuration." >&2
  echo "Pass its path as the first argument." >&2
  exit 1
fi

TARGET_CONFIG="$(readlink -f "${TARGET_CONFIG}")"
BACKUP_CONFIG="${TARGET_CONFIG}.bak.$(date '+%Y%m%d-%H%M%S')"
cp -a "${TARGET_CONFIG}" "${BACKUP_CONFIG}"
install -m 0644 "${SOURCE_CONFIG}" "${TARGET_CONFIG}"

rollback() {
  echo "Nginx validation failed; restoring ${BACKUP_CONFIG}" >&2
  cp -a "${BACKUP_CONFIG}" "${TARGET_CONFIG}"
  nginx -t
}

if ! nginx -t; then
  rollback
  exit 1
fi

if ! systemctl reload nginx; then
  rollback
  systemctl reload nginx || true
  exit 1
fi
echo "Installed ${TARGET_CONFIG}"
echo "Backup: ${BACKUP_CONFIG}"

if [[ -n "${AVATAR_FILE}" ]]; then
  for path in "/api/uploads/avatars/${AVATAR_FILE}" "/uploads/avatars/${AVATAR_FILE}"; do
    result="$(curl -fsS -o /dev/null -w '%{http_code} %{content_type}' "${SITE_ORIGIN}${path}")"
    echo "${path}: ${result}"
    if [[ "${result}" != 200\ image/* ]]; then
      echo "Avatar route verification failed: ${path}" >&2
      exit 1
    fi
  done
fi
