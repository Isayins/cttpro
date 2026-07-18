#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_HOME="${APP_HOME:-/opt/cttpro}"
ENV_FILE="${ENV_FILE:-${APP_HOME}/.env}"
BACKUP_ROOT="${BACKUP_ROOT:-${APP_HOME}/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing environment file: ${ENV_FILE}" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
. "${ENV_FILE}"
set +a

for command in mysqldump tar gzip sha256sum; do
  command -v "${command}" >/dev/null 2>&1 || { echo "Missing command: ${command}" >&2; exit 1; }
done
if [[ ! "${BACKUP_RETENTION_DAYS}" =~ ^[0-9]+$ ]]; then
  echo "BACKUP_RETENTION_DAYS must be a non-negative integer." >&2
  exit 1
fi

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
UPLOAD_DIR="${APP_UPLOAD_BASE_DIR:-uploads}"
[[ "${UPLOAD_DIR}" == /* ]] || UPLOAD_DIR="${APP_HOME}/${UPLOAD_DIR}"
if [[ ! -d "${UPLOAD_DIR}" ]]; then
  echo "Upload directory does not exist: ${UPLOAD_DIR}" >&2
  exit 1
fi

mkdir -p "${BACKUP_ROOT}"
BACKUP_ROOT="$(cd "${BACKUP_ROOT}" && pwd)"
if [[ -z "${BACKUP_ROOT}" || "${BACKUP_ROOT}" == "/" ]]; then
  echo "Unsafe backup root: ${BACKUP_ROOT}" >&2
  exit 1
fi

STAMP="$(date '+%Y%m%d-%H%M%S')"
TEMP_DIR="${BACKUP_ROOT}/.${STAMP}.tmp"
FINAL_DIR="${BACKUP_ROOT}/${STAMP}"
mkdir "${TEMP_DIR}"
trap 'rm -rf -- "${TEMP_DIR}"' EXIT

MYSQL_PWD="${DB_PASSWORD}" mysqldump -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" \
  --single-transaction --routines --events --triggers --set-gtid-purged=OFF "${DB_NAME}" \
  | gzip > "${TEMP_DIR}/database.sql.gz"
tar -C "${UPLOAD_DIR}" -czf "${TEMP_DIR}/uploads.tar.gz" .
(
  cd "${TEMP_DIR}"
  sha256sum database.sql.gz uploads.tar.gz > SHA256SUMS
)

mv "${TEMP_DIR}" "${FINAL_DIR}"
trap - EXIT
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime "+${BACKUP_RETENTION_DAYS}" -exec rm -rf -- {} +

echo "Backup created: ${FINAL_DIR}"
