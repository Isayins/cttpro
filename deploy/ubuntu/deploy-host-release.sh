#!/usr/bin/env bash
set -Eeuo pipefail

APP_HOME="${APP_HOME:-/opt/cttpro}"
FRONTEND_HOME="${FRONTEND_HOME:-/var/www/html/cttpro}"
APP_SERVICE="${APP_SERVICE:-java-backend}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:9091/actuator/health}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-90}"
RELEASE_ID="${1:-}"

BACKEND_RELEASES="${APP_HOME}/releases"
FRONTEND_RELEASES="${FRONTEND_HOME}/releases"
CURRENT_BACKEND="${APP_HOME}/java-backend.jar"
PREVIOUS_BACKEND="${APP_HOME}/java-backend.previous.jar"
CURRENT_FRONTEND="${FRONTEND_HOME}/dist"
PREVIOUS_FRONTEND="${FRONTEND_HOME}/dist.previous"

require_command() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing command: $1" >&2; exit 1; }
}

health_check() {
  local waited=0
  while [[ "${waited}" -lt "${HEALTH_TIMEOUT_SECONDS}" ]]; do
    if curl -fsS "${HEALTH_URL}" | grep -q '"status"[[:space:]]*:[[:space:]]*"UP"'; then
      return 0
    fi
    sleep 2
    waited=$((waited + 2))
  done
  return 1
}

restart_backend() {
  systemctl restart "${APP_SERVICE}"
  health_check
}

absolute_target() {
  readlink -f "$1" 2>/dev/null || true
}

atomic_link() {
  local target="$1"
  local link="$2"
  ln -sfn "${target}" "${link}"
}

preserve_regular_path() {
  local path="$1"
  local releases="$2"
  local label="$3"
  if [[ -e "${path}" && ! -L "${path}" ]]; then
    local legacy="${releases}/legacy-${label}-$(date '+%Y%m%d-%H%M%S')"
    mv "${path}" "${legacy}"
    atomic_link "${legacy}" "${path}"
  fi
}

rollback_to() {
  local backend_target="$1"
  local frontend_target="$2"
  echo "Release failed; restoring previous version." >&2
  if [[ -n "${backend_target}" && -e "${backend_target}" ]]; then
    atomic_link "${backend_target}" "${CURRENT_BACKEND}"
    systemctl restart "${APP_SERVICE}" || true
  fi
  if [[ -n "${frontend_target}" && -d "${frontend_target}" ]]; then
    atomic_link "${frontend_target}" "${CURRENT_FRONTEND}"
    nginx -t && systemctl reload nginx || true
  fi
}

deploy_release() {
  if [[ ! "${RELEASE_ID}" =~ ^[A-Za-z0-9._-]+$ ]]; then
    echo "Usage: bash deploy-host-release.sh <release-id>" >&2
    exit 2
  fi

  local incoming="${APP_HOME}/incoming/${RELEASE_ID}"
  local incoming_jar="${incoming}/java-backend.jar"
  local incoming_dist="${incoming}/dist"
  [[ -s "${incoming_jar}" ]] || { echo "Missing release JAR: ${incoming_jar}" >&2; exit 1; }
  [[ -f "${incoming_dist}/index.html" ]] || { echo "Missing frontend index: ${incoming_dist}/index.html" >&2; exit 1; }
  if ! systemctl cat "${APP_SERVICE}" | grep -Fq "${CURRENT_BACKEND}"; then
    echo "${APP_SERVICE} must start ${CURRENT_BACKEND}; run install-backend-service.sh first." >&2
    exit 1
  fi

  mkdir -p "${BACKEND_RELEASES}" "${FRONTEND_RELEASES}"
  preserve_regular_path "${CURRENT_BACKEND}" "${BACKEND_RELEASES}" backend
  preserve_regular_path "${CURRENT_FRONTEND}" "${FRONTEND_RELEASES}" frontend

  local backend_release="${BACKEND_RELEASES}/${RELEASE_ID}.jar"
  local frontend_release="${FRONTEND_RELEASES}/${RELEASE_ID}"
  install -m 0644 "${incoming_jar}" "${backend_release}"
  rm -rf -- "${frontend_release}"
  cp -a "${incoming_dist}" "${frontend_release}"

  local old_backend old_frontend
  old_backend="$(absolute_target "${CURRENT_BACKEND}")"
  old_frontend="$(absolute_target "${CURRENT_FRONTEND}")"
  [[ -n "${old_backend}" && -e "${old_backend}" ]] || { echo "Current backend release is missing." >&2; exit 1; }
  [[ -n "${old_frontend}" && -d "${old_frontend}" ]] || { echo "Current frontend release is missing." >&2; exit 1; }

  atomic_link "${old_backend}" "${PREVIOUS_BACKEND}"
  atomic_link "${old_frontend}" "${PREVIOUS_FRONTEND}"
  atomic_link "${backend_release}" "${CURRENT_BACKEND}"
  if ! restart_backend; then
    rollback_to "${old_backend}" "${old_frontend}"
    exit 1
  fi

  atomic_link "${frontend_release}" "${CURRENT_FRONTEND}"
  if ! nginx -t || ! systemctl reload nginx; then
    rollback_to "${old_backend}" "${old_frontend}"
    exit 1
  fi

  if [[ -d "${incoming}/ops" ]]; then
    install -d -m 0755 "${APP_HOME}/deploy/ubuntu"
    install -m 0755 "${incoming}/ops/"*.sh "${APP_HOME}/deploy/ubuntu/"
    if [[ -d "${APP_HOME}/bin" ]]; then
      for script in verify-backup.sh backup.sh ops-alert.sh ops-health-check.sh; do
        [[ ! -f "${incoming}/ops/${script}" ]] || install -m 0755 "${incoming}/ops/${script}" "${APP_HOME}/bin/${script}"
      done
    fi
  fi

  rm -rf -- "${incoming}"
  echo "Release deployed: ${RELEASE_ID}"
}

rollback_release() {
  local old_backend old_frontend previous_backend previous_frontend
  old_backend="$(absolute_target "${CURRENT_BACKEND}")"
  old_frontend="$(absolute_target "${CURRENT_FRONTEND}")"
  previous_backend="$(absolute_target "${PREVIOUS_BACKEND}")"
  previous_frontend="$(absolute_target "${PREVIOUS_FRONTEND}")"
  [[ -n "${previous_backend}" && -e "${previous_backend}" ]] || { echo "Previous backend release is missing." >&2; exit 1; }
  [[ -n "${previous_frontend}" && -d "${previous_frontend}" ]] || { echo "Previous frontend release is missing." >&2; exit 1; }

  atomic_link "${previous_backend}" "${CURRENT_BACKEND}"
  if ! restart_backend; then
    atomic_link "${old_backend}" "${CURRENT_BACKEND}"
    systemctl restart "${APP_SERVICE}" || true
    echo "Rollback backend failed; restored current release." >&2
    exit 1
  fi
  atomic_link "${previous_frontend}" "${CURRENT_FRONTEND}"
  if ! nginx -t || ! systemctl reload nginx; then
    rollback_to "${old_backend}" "${old_frontend}"
    exit 1
  fi
  atomic_link "${old_backend}" "${PREVIOUS_BACKEND}"
  atomic_link "${old_frontend}" "${PREVIOUS_FRONTEND}"
  echo "Rollback completed."
}

for command in curl grep nginx systemctl; do
  require_command "${command}"
done

if [[ "${RELEASE_ID}" == "--rollback" ]]; then
  rollback_release
else
  deploy_release
fi
