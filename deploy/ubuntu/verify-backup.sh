#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_DIR="${1:-}"
if [[ -z "${BACKUP_DIR}" || ! -d "${BACKUP_DIR}" ]]; then
  echo "Usage: bash verify-backup.sh <backup-directory>" >&2
  exit 1
fi
for command in gzip tar sha256sum awk; do
  command -v "${command}" >/dev/null 2>&1 || { echo "Missing command: ${command}" >&2; exit 1; }
done

BACKUP_DIR="$(cd "${BACKUP_DIR}" && pwd)"
for file in database.sql.gz uploads.tar.gz SHA256SUMS; do
  [[ -f "${BACKUP_DIR}/${file}" ]] || { echo "Missing backup file: ${file}" >&2; exit 1; }
done
if ! (cd "${BACKUP_DIR}" && sha256sum -c SHA256SUMS); then
  echo "Backup checksum verification failed." >&2
  exit 1
fi
if ! gzip -dc "${BACKUP_DIR}/database.sql.gz" | awk 'NF { found = 1 } END { exit !found }'; then
  echo "Database backup is empty or unreadable." >&2
  exit 1
fi
if ! tar -tzf "${BACKUP_DIR}/uploads.tar.gz" | awk '
  /^\// || /(^|\/)\.\.(\/|$)/ { unsafe = 1 }
  { found = 1 }
  END { exit !found || unsafe }
'; then
  echo "Upload backup is empty, unreadable, or contains unsafe paths." >&2
  exit 1
fi

echo "Backup verified: ${BACKUP_DIR}"
