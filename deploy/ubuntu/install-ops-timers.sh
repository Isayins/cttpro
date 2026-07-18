#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_HOME="${APP_HOME:-/opt/cttpro}"
BIN_DIR="${APP_HOME}/bin"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer as root." >&2
  exit 1
fi
[[ -f "${APP_HOME}/.env" ]] || { echo "Missing environment file: ${APP_HOME}/.env" >&2; exit 1; }

install -d -m 0755 "${BIN_DIR}"
install -m 0755 "${SCRIPT_DIR}/backup.sh" "${BIN_DIR}/backup.sh"
install -m 0755 "${SCRIPT_DIR}/ops-alert.sh" "${BIN_DIR}/ops-alert.sh"
install -m 0755 "${SCRIPT_DIR}/ops-health-check.sh" "${BIN_DIR}/ops-health-check.sh"

cat > /etc/systemd/system/cttpro-backup.service <<EOF
[Unit]
Description=cttpro database and uploads backup

[Service]
Type=oneshot
Environment=APP_HOME=${APP_HOME}
Environment=ENV_FILE=${APP_HOME}/.env
ExecStart=${BIN_DIR}/backup.sh
EOF

cat > /etc/systemd/system/cttpro-backup.timer <<'EOF'
[Unit]
Description=Run cttpro backup daily

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true
RandomizedDelaySec=10m

[Install]
WantedBy=timers.target
EOF

cat > /etc/systemd/system/cttpro-health.service <<EOF
[Unit]
Description=Check cttpro backend health

[Service]
Type=oneshot
Environment=APP_HOME=${APP_HOME}
Environment=ENV_FILE=${APP_HOME}/.env
ExecStart=${BIN_DIR}/ops-health-check.sh
EOF

cat > /etc/systemd/system/cttpro-health.timer <<'EOF'
[Unit]
Description=Check cttpro backend every five minutes

[Timer]
OnBootSec=2m
OnUnitActiveSec=5m
AccuracySec=30s

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now cttpro-backup.timer cttpro-health.timer
echo "Installed cttpro backup and health timers."
