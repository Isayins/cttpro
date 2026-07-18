#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$(uname -s)" != "Linux" ]]; then
  echo "Host release smoke test skipped outside Linux."
  exit 0
fi
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "${TEST_ROOT}"' EXIT

APP_HOME="${TEST_ROOT}/app"
FRONTEND_HOME="${TEST_ROOT}/frontend"
FAKE_BIN="${TEST_ROOT}/bin"
mkdir -p "${APP_HOME}/incoming/release-1/dist" "${FRONTEND_HOME}/dist" "${FAKE_BIN}"
printf 'old jar\n' > "${APP_HOME}/java-backend.jar"
printf 'new jar\n' > "${APP_HOME}/incoming/release-1/java-backend.jar"
printf 'old frontend\n' > "${FRONTEND_HOME}/dist/index.html"
printf 'new frontend\n' > "${APP_HOME}/incoming/release-1/dist/index.html"

cat > "${FAKE_BIN}/systemctl" <<EOF
#!/usr/bin/env bash
if [[ "\${1:-}" == "cat" ]]; then
  echo "ExecStart=/usr/bin/java -jar ${APP_HOME}/java-backend.jar"
fi
EOF
cat > "${FAKE_BIN}/curl" <<'EOF'
#!/usr/bin/env bash
echo '{"status":"UP"}'
EOF
cat > "${FAKE_BIN}/nginx" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "${FAKE_BIN}/systemctl" "${FAKE_BIN}/curl" "${FAKE_BIN}/nginx"

PATH="${FAKE_BIN}:${PATH}" APP_HOME="${APP_HOME}" FRONTEND_HOME="${FRONTEND_HOME}" \
  bash "${SCRIPT_DIR}/deploy-host-release.sh" release-1

grep -q 'new jar' "${APP_HOME}/java-backend.jar"
grep -q 'new frontend' "${FRONTEND_HOME}/dist/index.html"

PATH="${FAKE_BIN}:${PATH}" APP_HOME="${APP_HOME}" FRONTEND_HOME="${FRONTEND_HOME}" \
  bash "${SCRIPT_DIR}/deploy-host-release.sh" --rollback

grep -q 'old jar' "${APP_HOME}/java-backend.jar"
grep -q 'old frontend' "${FRONTEND_HOME}/dist/index.html"
echo "Host release smoke test passed."
