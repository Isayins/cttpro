#!/usr/bin/env bash
set -euo pipefail

# Nohup runner for the Spring Boot backend.
# Usage:
#   bash java-backend-nohup.sh start
#   bash java-backend-nohup.sh stop
#   bash java-backend-nohup.sh restart
#   bash java-backend-nohup.sh status
#   bash java-backend-nohup.sh logs
#
# Common overrides:
#   APP_HOME=/opt/cttpro
#   JAR=/opt/cttpro/java-backend-1.0.0.jar
#   ENV_FILE=/opt/cttpro/.env
#   JAVA_OPTS="-Duser.timezone=Asia/Shanghai -Xms512m -Xmx1024m"

APP_NAME="${APP_NAME:-java-backend}"
APP_HOME="${APP_HOME:-/opt/cttpro}"
ENV_FILE="${ENV_FILE:-$APP_HOME/.env}"
LOG_DIR="${LOG_DIR:-$APP_HOME/logs}"
LOG_FILE="${LOG_FILE:-$LOG_DIR/$APP_NAME.log}"
PID_FILE="${PID_FILE:-$APP_HOME/$APP_NAME.pid}"
JAVA_BIN="${JAVA_BIN:-java}"
JAVA_OPTS="${JAVA_OPTS:--Duser.timezone=Asia/Shanghai -Xms512m -Xmx1024m}"
APP_ARGS="${APP_ARGS:-}"
STOP_TIMEOUT="${STOP_TIMEOUT:-30}"
LOG_TAIL_LINES="${LOG_TAIL_LINES:-200}"

find_latest_jar() {
  if [[ -n "${JAR:-}" ]]; then
    printf '%s\n' "$JAR"
    return
  fi

  find "$APP_HOME" "$APP_HOME/artifacts" \
    -maxdepth 1 \
    -type f \
    -name 'java-backend-*.jar' \
    -printf '%T@ %p\n' 2>/dev/null \
    | sort -nr \
    | head -n 1 \
    | cut -d' ' -f2-
}

is_running() {
  [[ -f "$PID_FILE" ]] || return 1
  local pid
  pid="$(cat "$PID_FILE")"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
  fi
}

start_app() {
  mkdir -p "$APP_HOME" "$LOG_DIR"

  if is_running; then
    echo "$APP_NAME is already running, pid=$(cat "$PID_FILE")"
    exit 0
  fi

  local jar_path
  jar_path="$(find_latest_jar)"
  if [[ -z "$jar_path" || ! -f "$jar_path" ]]; then
    echo "Jar not found. Set JAR=/path/to/java-backend.jar or put java-backend-*.jar under $APP_HOME."
    exit 1
  fi

  load_env
  cd "$APP_HOME"

  echo "Starting $APP_NAME"
  echo "Jar: $jar_path"
  echo "Log: $LOG_FILE"

  # Intentionally allow word splitting for JAVA_OPTS and APP_ARGS.
  # shellcheck disable=SC2086
  nohup "$JAVA_BIN" $JAVA_OPTS -jar "$jar_path" $APP_ARGS >> "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"

  sleep 1
  if is_running; then
    echo "$APP_NAME started, pid=$(cat "$PID_FILE")"
  else
    echo "$APP_NAME failed to start. Last log lines:"
    tail -n 80 "$LOG_FILE" || true
    exit 1
  fi
}

stop_app() {
  if ! is_running; then
    echo "$APP_NAME is not running"
    rm -f "$PID_FILE"
    exit 0
  fi

  local pid
  pid="$(cat "$PID_FILE")"
  echo "Stopping $APP_NAME, pid=$pid"
  kill "$pid" 2>/dev/null || true

  local waited=0
  while kill -0 "$pid" 2>/dev/null; do
    if [[ "$waited" -ge "$STOP_TIMEOUT" ]]; then
      echo "Graceful stop timed out after ${STOP_TIMEOUT}s, killing pid=$pid"
      kill -9 "$pid" 2>/dev/null || true
      break
    fi
    sleep 1
    waited=$((waited + 1))
  done

  rm -f "$PID_FILE"
  echo "$APP_NAME stopped"
}

status_app() {
  if is_running; then
    echo "$APP_NAME is running, pid=$(cat "$PID_FILE")"
  else
    echo "$APP_NAME is stopped"
    [[ -f "$PID_FILE" ]] && echo "Stale pid file: $PID_FILE"
  fi
  echo "App home: $APP_HOME"
  echo "Log file: $LOG_FILE"
}

logs_app() {
  mkdir -p "$LOG_DIR"
  touch "$LOG_FILE"
  tail -n "$LOG_TAIL_LINES" -f "$LOG_FILE"
}

case "${1:-start}" in
  start)
    start_app
    ;;
  stop)
    stop_app
    ;;
  restart)
    stop_app
    start_app
    ;;
  status)
    status_app
    ;;
  logs)
    logs_app
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    exit 2
    ;;
esac
