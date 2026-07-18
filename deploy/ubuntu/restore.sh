#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_HOME="${APP_HOME:-/opt/cttpro}"
ENV_FILE="${ENV_FILE:-${APP_HOME}/.env}"
APP_CONTROL="${APP_CONTROL:-systemd}"
APP_SERVICE="${APP_SERVICE:-java-backend}"
BACKUP_DIR="${1:-}"

if [[ "${RESTORE_CONFIRM:-}" != "RESTORE" ]]; then
  echo "Set RESTORE_CONFIRM=RESTORE to confirm destructive restoration." >&2
  exit 1
fi
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing environment file: ${ENV_FILE}" >&2
  exit 1
fi
if [[ -z "${BACKUP_DIR}" || ! -d "${BACKUP_DIR}" ]]; then
  echo "Usage: RESTORE_CONFIRM=RESTORE bash restore.sh <backup-directory>" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "${ENV_FILE}"
set +a
for command in mysql tar gzip sha256sum redis-cli; do
  command -v "${command}" >/dev/null 2>&1 || { echo "Missing command: ${command}" >&2; exit 1; }
done

BACKUP_DIR="$(cd "${BACKUP_DIR}" && pwd)"
for file in database.sql.gz uploads.tar.gz SHA256SUMS; do
  [[ -f "${BACKUP_DIR}/${file}" ]] || { echo "Missing backup file: ${file}" >&2; exit 1; }
done
(
  cd "${BACKUP_DIR}"
  sha256sum -c SHA256SUMS
)

JDBC_URL="${SPRING_DATASOURCE_URL:-jdbc:mysql://127.0.0.1:3306/idncar}"
if [[ ! "${JDBC_URL}" =~ ^jdbc:mysql://([^/:]+)(:([0-9]+))?/([^?]+) ]]; then
  echo "Unsupported SPRING_DATASOURCE_URL; set BACKUP_DB_HOST, BACKUP_DB_PORT and BACKUP_DB_NAME." >&2
  exit 1
fi
DB_HOST="${BACKUP_DB_HOST:-${BASH_REMATCH[1]}}"
DB_PORT="${BACKUP_DB_PORT:-${BASH_REMATCH[3]:-3306}}"
DB_NAME="${BACKUP_DB_NAME:-${BASH_REMATCH[4]}}"
DB_USER="${BACKUP_DB_USER:-${SPRING_DATASOURCE_USERNAME:-root}}"
DB_PASSWORD="${BACKUP_DB_PASSWORD:-${SPRING_DATASOURCE_PASSWORD:-}}"
if [[ ! "${DB_NAME}" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "Unsafe database name: ${DB_NAME}" >&2
  exit 1
fi
UPLOAD_DIR="${APP_UPLOAD_BASE_DIR:-uploads}"
[[ "${UPLOAD_DIR}" == /* ]] || UPLOAD_DIR="${APP_HOME}/${UPLOAD_DIR}"
mkdir -p "${UPLOAD_DIR}"
UPLOAD_DIR="$(cd "${UPLOAD_DIR}" && pwd)"
if [[ -z "${UPLOAD_DIR}" || "${UPLOAD_DIR}" == "/" ]]; then
  echo "Unsafe upload directory: ${UPLOAD_DIR}" >&2
  exit 1
fi

case "${APP_CONTROL}" in
  systemd)
    systemctl stop "${APP_SERVICE}"
    ;;
  nohup)
    APP_HOME="${APP_HOME}" ENV_FILE="${ENV_FILE}" bash "${SCRIPT_DIR}/java-backend-nohup.sh" stop
    ;;
  *)
    echo "APP_CONTROL must be systemd or nohup." >&2
    exit 1
    ;;
esac
trap 'echo "Restore failed; backend remains stopped." >&2' ERR

MYSQL_PWD="${DB_PASSWORD}" mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" \
  -e "DROP DATABASE IF EXISTS \`${DB_NAME}\`; CREATE DATABASE \`${DB_NAME}\`;"
gzip -dc "${BACKUP_DIR}/database.sql.gz" \
  | MYSQL_PWD="${DB_PASSWORD}" mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" "${DB_NAME}"

find "${UPLOAD_DIR}" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
tar -C "${UPLOAD_DIR}" -xzf "${BACKUP_DIR}/uploads.tar.gz"

REDIS_ARGS=(-h "${SPRING_DATA_REDIS_HOST:-127.0.0.1}" -p "${SPRING_DATA_REDIS_PORT:-6379}")
if [[ -n "${SPRING_DATA_REDIS_PASSWORD:-}" ]]; then
  REDIS_ARGS+=(--no-auth-warning -a "${SPRING_DATA_REDIS_PASSWORD}")
fi
redis-cli "${REDIS_ARGS[@]}" FLUSHDB >/dev/null

if [[ "${APP_CONTROL}" == "systemd" ]]; then
  systemctl start "${APP_SERVICE}"
else
  APP_HOME="${APP_HOME}" ENV_FILE="${ENV_FILE}" bash "${SCRIPT_DIR}/java-backend-nohup.sh" start
fi
trap - ERR

echo "Restore completed from: ${BACKUP_DIR}"
