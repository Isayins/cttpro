#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "${TEST_ROOT}"' EXIT
APP_HOME="${TEST_ROOT}/app"
FAKE_BIN="${TEST_ROOT}/bin"
mkdir -p "${APP_HOME}/uploads" "${FAKE_BIN}"
printf 'upload\n' > "${APP_HOME}/uploads/file.txt"

cat > "${APP_HOME}/.env" <<EOF
SPRING_DATASOURCE_URL=jdbc:mysql://127.0.0.1:3306/idncar
SPRING_DATASOURCE_USERNAME=root
SPRING_DATASOURCE_PASSWORD=test
APP_UPLOAD_BASE_DIR=${APP_HOME}/uploads
BACKUP_REMOTE_TARGET=backup@example:/srv/cttpro
APP_OPS_ALERT_WEBHOOK_URL=https://alerts.example/test
EOF
cat > "${FAKE_BIN}/mysqldump" <<'EOF'
#!/usr/bin/env bash
echo 'CREATE TABLE test (id INT);'
EOF
cat > "${FAKE_BIN}/rsync" <<EOF
#!/usr/bin/env bash
echo "\$*" > "${TEST_ROOT}/rsync-call"
EOF
cat > "${FAKE_BIN}/curl" <<EOF
#!/usr/bin/env bash
if [[ "\$*" == *actuator/health* ]]; then
  [[ "\$(cat "${TEST_ROOT}/health-mode")" == "UP" ]] || exit 1
  echo '{"status":"UP"}'
else
  echo alert >> "${TEST_ROOT}/alerts"
fi
EOF
chmod +x "${FAKE_BIN}/mysqldump" "${FAKE_BIN}/rsync" "${FAKE_BIN}/curl"

PATH="${FAKE_BIN}:${PATH}" APP_HOME="${APP_HOME}" bash "${SCRIPT_DIR}/backup.sh"
grep -q '^status=SUCCESS$' "${APP_HOME}/backup-status.properties"
grep -q '^remoteSynced=true$' "${APP_HOME}/backup-status.properties"
[[ -s "${TEST_ROOT}/rsync-call" ]]

printf 'DOWN\n' > "${TEST_ROOT}/health-mode"
PATH="${FAKE_BIN}:${PATH}" APP_HOME="${APP_HOME}" bash "${SCRIPT_DIR}/ops-health-check.sh" && exit 1 || true
PATH="${FAKE_BIN}:${PATH}" APP_HOME="${APP_HOME}" bash "${SCRIPT_DIR}/ops-health-check.sh" && exit 1 || true
[[ "$(wc -l < "${TEST_ROOT}/alerts")" -eq 1 ]]
printf 'UP\n' > "${TEST_ROOT}/health-mode"
PATH="${FAKE_BIN}:${PATH}" APP_HOME="${APP_HOME}" bash "${SCRIPT_DIR}/ops-health-check.sh"
[[ "$(wc -l < "${TEST_ROOT}/alerts")" -eq 2 ]]
echo "Operations script smoke test passed."
