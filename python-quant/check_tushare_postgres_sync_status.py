from __future__ import annotations

import argparse
import json
from typing import Any

import psycopg
from psycopg.rows import dict_row


DEFAULT_DB_HOST = "127.0.0.1"
DEFAULT_DB_PORT = 5432
DEFAULT_DB_USER = "postgres"
DEFAULT_DB_PASSWORD = ""
DEFAULT_DB_NAME = "quant"
DEFAULT_DB_SCHEMA = "tushare_data"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Show latest Tushare PostgreSQL sync status from quant.tushare_data.")
    parser.add_argument("--db-host", default=DEFAULT_DB_HOST)
    parser.add_argument("--db-port", type=int, default=DEFAULT_DB_PORT)
    parser.add_argument("--db-user", default=DEFAULT_DB_USER)
    parser.add_argument("--db-password", default=DEFAULT_DB_PASSWORD)
    parser.add_argument("--db-name", default=DEFAULT_DB_NAME)
    parser.add_argument("--db-schema", default=DEFAULT_DB_SCHEMA)
    return parser


def relation_exists(cur: psycopg.Cursor[Any], schema: str, relation_name: str) -> bool:
    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.views
            WHERE table_schema = %s
              AND table_name = %s
        ) AS exists_flag
        """,
        (schema, relation_name),
    )
    row = cur.fetchone() or {}
    return bool(row.get("exists_flag"))


def main() -> None:
    args = build_parser().parse_args()
    schema = str(args.db_schema).strip()
    with psycopg.connect(
        host=args.db_host,
        port=args.db_port,
        user=args.db_user,
        password=args.db_password,
        dbname=args.db_name,
        row_factory=dict_row,
    ) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT *
                FROM {schema}.vw_sync_job_latest
                LIMIT 1
                """
            )
            latest = cur.fetchone()
            if not latest:
                print(json.dumps({"message": "No sync job metadata found."}, ensure_ascii=False, indent=2))
                return

            snapshot_view_exists = relation_exists(cur, schema, "vw_stock_daily_snapshot")
            if snapshot_view_exists:
                cur.execute(
                    f"""
                    SELECT
                        COUNT(*) AS total_symbols,
                        MAX(trade_date) AS latest_trade_date
                    FROM {schema}.vw_stock_daily_snapshot
                    """
                )
            else:
                cur.execute(
                    f"""
                    SELECT
                        COUNT(*) AS total_symbols,
                        NULL::date AS latest_trade_date
                    FROM {schema}.stock_basic
                    """
                )
            snapshot = cur.fetchone() or {}

            payload: dict[str, Any] = {
                "jobId": latest.get("job_id"),
                "mode": latest.get("mode"),
                "status": latest.get("status"),
                "currentGroup": latest.get("current_group"),
                "startedAt": str(latest.get("started_at")) if latest.get("started_at") else None,
                "finishedAt": str(latest.get("finished_at")) if latest.get("finished_at") else None,
                "reportPath": latest.get("report_path"),
                "logPath": latest.get("log_path"),
                "statePath": latest.get("state_path"),
                "progressGroup": latest.get("group_name"),
                "progress": latest.get("progress_json"),
                "latestTradeDate": str(snapshot.get("latest_trade_date")) if snapshot.get("latest_trade_date") else None,
                "snapshotSymbolCount": snapshot.get("total_symbols"),
            }
            print(json.dumps(payload, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
