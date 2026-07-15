#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER="${ROOT_DIR}/run_sync.sh"

DEFAULT_START_DATE="${PYTHON_QUANT_SYNC_START_DATE:-${START_DATE:-20240101}}"
END_DATE="${END_DATE:-}"
LIMIT="${LIMIT:-0}"
CHUNK_YEARS="${PYTHON_QUANT_SYNC_CHUNK_YEARS:-1}"
LOG_DIR_INPUT="${PYTHON_QUANT_LOG_DIR:-${ROOT_DIR}/logs}"
CHECKPOINT_FILE_INPUT="${PYTHON_QUANT_CHECKPOINT_FILE:-${ROOT_DIR}/state/full-sync.checkpoint}"
USE_CHECKPOINT=1
START_DATE_EXPLICIT=0

resolve_path() {
  local candidate="$1"
  if [[ "${candidate}" = /* ]]; then
    printf '%s\n' "${candidate}"
    return
  fi
  printf '%s\n' "${ROOT_DIR}/${candidate#./}"
}

LOG_DIR="$(resolve_path "${LOG_DIR_INPUT}")"
CHECKPOINT_FILE="$(resolve_path "${CHECKPOINT_FILE_INPUT}")"
STATE_DIR="$(dirname "${CHECKPOINT_FILE}")"

mkdir -p "${LOG_DIR}" "${STATE_DIR}"

RUN_AT="$(date '+%Y%m%d-%H%M%S')"
LOG_FILE="${LOG_DIR}/full-sync-${RUN_AT}.log"
LATEST_LOG="${LOG_DIR}/full-sync-latest.log"
ln -sfn "$(basename "${LOG_FILE}")" "${LATEST_LOG}"
exec > >(tee -a "${LOG_FILE}") 2>&1

echo "== Python Quant Tushare sync started at $(date '+%F %T') =="
echo "Log file: ${LOG_FILE}"
echo "Latest log: ${LATEST_LOG}"
echo "Tail live: tail -f ${LATEST_LOG}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --start-date)
      DEFAULT_START_DATE="$2"
      START_DATE_EXPLICIT=1
      shift 2
      ;;
    --end-date)
      END_DATE="$2"
      shift 2
      ;;
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    --chunk-years)
      CHUNK_YEARS="$2"
      shift 2
      ;;
    --no-checkpoint)
      USE_CHECKPOINT=0
      shift
      ;;
    *)
      echo "Unsupported argument: $1" >&2
      exit 1
      ;;
  esac
done

normalize_date() {
  date -d "$1" '+%Y%m%d'
}

offset_date() {
  local base_date="$1"
  shift
  date -d "${base_date:0:4}-${base_date:4:2}-${base_date:6:2} $*" '+%Y%m%d'
}

next_day() {
  offset_date "$1" "+1 day"
}

chunk_end_date() {
  local chunk_start="$1"
  local global_end="$2"
  local chunk_years="$3"

  if [[ "${chunk_years}" -le 0 ]]; then
    printf '%s\n' "${global_end}"
    return
  fi

  local candidate_end
  candidate_end="$(offset_date "${chunk_start}" "+${chunk_years} year -1 day")"
  if [[ "${candidate_end}" > "${global_end}" ]]; then
    printf '%s\n' "${global_end}"
    return
  fi

  printf '%s\n' "${candidate_end}"
}

END_DATE="${END_DATE:-$(date '+%Y%m%d')}"
END_DATE="$(normalize_date "${END_DATE}")"

START_DATE="${DEFAULT_START_DATE}"
if [[ "${USE_CHECKPOINT}" -eq 1 && "${START_DATE_EXPLICIT}" -eq 0 && -f "${CHECKPOINT_FILE}" ]]; then
  LAST_SUCCESS_DATE="$(tr -d '[:space:]' < "${CHECKPOINT_FILE}")"
  if [[ "${LAST_SUCCESS_DATE}" =~ ^[0-9]{8}$ ]]; then
    START_DATE="$(next_day "${LAST_SUCCESS_DATE}")"
  fi
fi
START_DATE="$(normalize_date "${START_DATE}")"

if ! [[ "${CHUNK_YEARS}" =~ ^[0-9]+$ ]]; then
  echo "Invalid --chunk-years value: ${CHUNK_YEARS}" >&2
  exit 1
fi

if [[ "${START_DATE}" > "${END_DATE}" ]]; then
  echo "No new date range to sync."
  echo "Effective start date ${START_DATE} is after end date ${END_DATE}."
  exit 0
fi

run_cmd() {
  echo
  echo ">>> Running: $*"
  "${RUNNER}" "$@"
}

echo "Effective start date: ${START_DATE}"
echo "Effective end date: ${END_DATE}"
echo "Checkpoint file: ${CHECKPOINT_FILE}"
echo "Limit: ${LIMIT}"
echo "Chunk years: ${CHUNK_YEARS}"
echo "Checkpoint enabled: ${USE_CHECKPOINT}"

CURRENT_START_DATE="${START_DATE}"
CHUNK_INDEX=1
while [[ "${CURRENT_START_DATE}" < "${END_DATE}" || "${CURRENT_START_DATE}" == "${END_DATE}" ]]; do
  CURRENT_END_DATE="$(chunk_end_date "${CURRENT_START_DATE}" "${END_DATE}" "${CHUNK_YEARS}")"
  COMMON_ARGS=(--start-date "${CURRENT_START_DATE}" --end-date "${CURRENT_END_DATE}")
  if [[ "${LIMIT}" != "0" ]]; then
    COMMON_ARGS+=(--limit "${LIMIT}")
  fi

  echo
  echo "== Chunk ${CHUNK_INDEX}: ${CURRENT_START_DATE} -> ${CURRENT_END_DATE} =="
  run_cmd all-ingestion "${COMMON_ARGS[@]}"
  run_cmd raw-by-trade-dates --api-name ggt_daily "${COMMON_ARGS[@]}"
  run_cmd raw-by-trade-dates --api-name ggt_top10 "${COMMON_ARGS[@]}"
  run_cmd raw-by-trade-dates --api-name bak_daily "${COMMON_ARGS[@]}"
  run_cmd raw-by-trade-dates --api-name limit_list_d "${COMMON_ARGS[@]}"
  run_cmd raw-by-trade-dates --api-name limit_list_ths "${COMMON_ARGS[@]}"

  if [[ "${USE_CHECKPOINT}" -eq 1 ]]; then
    printf '%s\n' "${CURRENT_END_DATE}" > "${CHECKPOINT_FILE}"
    echo "Updated checkpoint: ${CHECKPOINT_FILE} -> ${CURRENT_END_DATE}"
  fi

  if [[ "${CURRENT_END_DATE}" == "${END_DATE}" ]]; then
    break
  fi

  CURRENT_START_DATE="$(next_day "${CURRENT_END_DATE}")"
  CHUNK_INDEX="$((CHUNK_INDEX + 1))"
done

echo
echo "== Static sync tasks =="
run_cmd raw-api --api-name hm_list

echo "== Python Quant Tushare sync finished at $(date '+%F %T') =="
