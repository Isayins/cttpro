#!/usr/bin/env bash
set -Eeuo pipefail

APP_HOME="${APP_HOME:-/opt/cttpro}"
APP_SERVICE="${APP_SERVICE:-java-backend}"
SERVICE_USER="${SERVICE_USER:-${SUDO_USER:-}}"
JAVA_BIN="${JAVA_BIN:-$(command -v java || true)}"
JAVA_OPTS="${JAVA_OPTS:--Duser.timezone=Asia/Shanghai -Xms512m -Xmx1024m}"
UNIT_FILE="/etc/systemd/system/${APP_SERVICE}.service"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer as root." >&2
  exit 1
fi
[[ -n "${JAVA_BIN}" && -x "${JAVA_BIN}" ]] || { echo "Java executable not found." >&2; exit 1; }
[[ -n "${SERVICE_USER}" && "${SERVICE_USER}" != "root" ]] || { echo "Set SERVICE_USER to the non-root backend account." >&2; exit 1; }
[[ -f "${APP_HOME}/.env" ]] || { echo "Missing environment file: ${APP_HOME}/.env" >&2; exit 1; }
[[ -f "${APP_HOME}/java-backend.jar" ]] || { echo "Missing backend JAR: ${APP_HOME}/java-backend.jar" >&2; exit 1; }
id "${SERVICE_USER}" >/dev/null 2>&1 || { echo "Unknown service user: ${SERVICE_USER}" >&2; exit 1; }

if [[ -f "${UNIT_FILE}" ]]; then
  cp -a "${UNIT_FILE}" "${UNIT_FILE}.bak.$(date '+%Y%m%d-%H%M%S')"
fi

cat > "${UNIT_FILE}" <<EOF
[Unit]
Description=cttpro Java backend
After=network-online.target mysql.service redis-server.service
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${APP_HOME}
EnvironmentFile=${APP_HOME}/.env
ExecStart=${JAVA_BIN} ${JAVA_OPTS} -jar ${APP_HOME}/java-backend.jar
Restart=on-failure
RestartSec=5
SuccessExitStatus=143

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${APP_SERVICE}"
systemctl restart "${APP_SERVICE}"
echo "Installed ${UNIT_FILE}"
