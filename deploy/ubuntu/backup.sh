#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/.env}"
BACKUP_ROOT="${BACKUP_ROOT:-${SCRIPT_DIR}/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing environment file: ${ENV_FILE}" >&2
  exit 1
fi
if [[ ! "${BACKUP_RETENTION_DAYS}" =~ ^[0-9]+$ ]]; then
  echo "BACKUP_RETENTION_DAYS must be a non-negative integer." >&2
  exit 1
fi

mkdir -p "${BACKUP_ROOT}"
BACKUP_ROOT="$(cd "${BACKUP_ROOT}" && pwd)"
if [[ -z "${BACKUP_ROOT}" || "${BACKUP_ROOT}" == "/" ]]; then
  echo "Unsafe backup root: ${BACKUP_ROOT}" >&2
  exit 1
fi

COMPOSE=(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")
STAMP="$(date '+%Y%m%d-%H%M%S')"
TEMP_DIR="${BACKUP_ROOT}/.${STAMP}.tmp"
FINAL_DIR="${BACKUP_ROOT}/${STAMP}"
mkdir "${TEMP_DIR}"
trap 'rm -rf -- "${TEMP_DIR}"' EXIT

"${COMPOSE[@]}" exec -T mysql sh -c \
  'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --events --triggers --set-gtid-purged=OFF "$MYSQL_DATABASE"' \
  | gzip > "${TEMP_DIR}/database.sql.gz"

"${COMPOSE[@]}" exec -T java-backend tar -C /app/uploads -czf - . \
  > "${TEMP_DIR}/uploads.tar.gz"

(
  cd "${TEMP_DIR}"
  sha256sum database.sql.gz uploads.tar.gz > SHA256SUMS
)

mv "${TEMP_DIR}" "${FINAL_DIR}"
trap - EXIT
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime "+${BACKUP_RETENTION_DAYS}" -exec rm -rf -- {} +

echo "Backup created: ${FINAL_DIR}"
