#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/.env}"
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

BACKUP_DIR="$(cd "${BACKUP_DIR}" && pwd)"
for file in database.sql.gz uploads.tar.gz SHA256SUMS; do
  if [[ ! -f "${BACKUP_DIR}/${file}" ]]; then
    echo "Missing backup file: ${BACKUP_DIR}/${file}" >&2
    exit 1
  fi
done
(
  cd "${BACKUP_DIR}"
  sha256sum -c SHA256SUMS
)

COMPOSE=(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")
"${COMPOSE[@]}" stop java-backend
trap 'echo "Restore failed; java-backend remains stopped." >&2' ERR

"${COMPOSE[@]}" exec -T mysql sh -c '
  case "$MYSQL_DATABASE" in
    ""|*[!A-Za-z0-9_]*) echo "Unsafe MYSQL_DATABASE" >&2; exit 1 ;;
  esac
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS \`$MYSQL_DATABASE\`; CREATE DATABASE \`$MYSQL_DATABASE\`;"
'
gzip -dc "${BACKUP_DIR}/database.sql.gz" \
  | "${COMPOSE[@]}" exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'

gzip -dc "${BACKUP_DIR}/uploads.tar.gz" \
  | "${COMPOSE[@]}" run --rm -T --no-deps --entrypoint sh java-backend -c \
      'rm -rf /app/uploads/* /app/uploads/.[!.]* /app/uploads/..?*; tar -C /app/uploads -xf -'

"${COMPOSE[@]}" exec -T redis redis-cli FLUSHDB >/dev/null
"${COMPOSE[@]}" up -d java-backend
trap - ERR

echo "Restore completed from: ${BACKUP_DIR}"
