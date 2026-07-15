#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
ENV_FILE="${SCRIPT_DIR}/.env"
ENV_EXAMPLE="${SCRIPT_DIR}/.env.example"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

fail() {
  printf '\nERROR: %s\n' "$*" >&2
  exit 1
}

random_base64() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 64 | tr -d '\n'
  else
    head -c 64 /dev/urandom | base64 | tr -d '\n'
  fi
}

random_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 24
  else
    od -An -N24 -tx1 /dev/urandom | tr -d ' \n'
  fi
}

set_env_value() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "${ENV_FILE}"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "${ENV_FILE}"
  else
    printf '%s=%s\n' "${key}" "${value}" >>"${ENV_FILE}"
  fi
}

get_env_value() {
  local key="$1"
  grep -E "^${key}=" "${ENV_FILE}" | tail -n 1 | cut -d= -f2- || true
}

prepare_env() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    cp "${ENV_EXAMPLE}" "${ENV_FILE}"
    log "已创建 ${ENV_FILE}"
  fi

  local mysql_password jwt_secret hotmail_secret
  mysql_password="$(get_env_value MYSQL_ROOT_PASSWORD)"
  jwt_secret="$(get_env_value JWT_SECRET)"
  hotmail_secret="$(get_env_value APP_HOTMAIL_ENCRYPTION_SECRET)"

  if [[ -z "${mysql_password}" || "${mysql_password}" == "change-me" ]]; then
    set_env_value MYSQL_ROOT_PASSWORD "$(random_hex)"
  fi

  if [[ -z "${jwt_secret}" || "${jwt_secret}" == "change-me-base64-secret" ]]; then
    set_env_value JWT_SECRET "$(random_base64)"
  fi

  if [[ -z "${hotmail_secret}" || "${hotmail_secret}" == "change-me-hotmail-encryption-secret" ]]; then
    set_env_value APP_HOTMAIL_ENCRYPTION_SECRET "$(random_base64)"
  fi
}

install_docker() {
  [[ "${INSTALL_DOCKER:-true}" == "true" ]] || fail "Docker 未安装。设置 INSTALL_DOCKER=true 或手动安装 Docker Compose Plugin 后重试。"
  command -v apt-get >/dev/null 2>&1 || fail "当前脚本只支持 Ubuntu/Debian apt 环境自动安装 Docker。"

  log "安装 Docker Engine 和 Compose Plugin"
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings

  if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  fi
  sudo chmod a+r /etc/apt/keyrings/docker.gpg

  # shellcheck disable=SC1091
  . /etc/os-release
  local codename="${VERSION_CODENAME:-jammy}"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${codename} stable" |
    sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo systemctl enable --now docker
}

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    install_docker
  fi

  if docker compose version >/dev/null 2>&1; then
    DOCKER_SUDO=""
    return
  fi

  if sudo docker compose version >/dev/null 2>&1; then
    DOCKER_SUDO="sudo"
    return
  fi

  install_docker
  if docker compose version >/dev/null 2>&1; then
    DOCKER_SUDO=""
  elif sudo docker compose version >/dev/null 2>&1; then
    DOCKER_SUDO="sudo"
  else
    fail "Docker Compose Plugin 不可用。"
  fi
}

compose() {
  if [[ -n "${DOCKER_SUDO:-}" ]]; then
    sudo docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
  else
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
  fi
}

main() {
  cd "${REPO_ROOT}"

  prepare_env
  ensure_docker

  log "校验 Compose 配置"
  compose config >/dev/null

  log "构建并启动 cttpro"
  compose up -d --build --remove-orphans

  log "当前服务状态"
  compose ps

  local http_port
  http_port="$(get_env_value HTTP_PORT)"
  log "部署完成：浏览器访问 http://<服务器IP>:${http_port:-80}"
}

main "$@"
