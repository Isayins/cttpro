from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path


DEFAULT_DB_HOST = "127.0.0.1"
DEFAULT_DB_PORT = 5432
DEFAULT_DB_USER = "postgres"
DEFAULT_DB_PASSWORD = ""
DEFAULT_DB_NAME = "quant"
DEFAULT_DB_SCHEMA = "tushare_data"
DEFAULT_MARKET_DATA_SCHEMA = "market_data"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Refresh analytics views for Tushare PostgreSQL schema.")
    parser.add_argument("--db-host", default=DEFAULT_DB_HOST)
    parser.add_argument("--db-port", type=int, default=DEFAULT_DB_PORT)
    parser.add_argument("--db-user", default=DEFAULT_DB_USER)
    parser.add_argument("--db-password", default=DEFAULT_DB_PASSWORD)
    parser.add_argument("--db-name", default=DEFAULT_DB_NAME)
    parser.add_argument("--db-schema", default=DEFAULT_DB_SCHEMA)
    parser.add_argument("--market-data-schema", default=DEFAULT_MARKET_DATA_SCHEMA)
    return parser


def load_sync_module():
    path = Path(__file__).resolve().parent / "run_tushare_postgres_sync.py"
    spec = importlib.util.spec_from_file_location("run_tushare_postgres_sync", str(path))
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def main() -> None:
    args = build_parser().parse_args()
    module = load_sync_module()
    store = module.PostgresQuantStore(args)
    store.refresh_analytics_views()
    print(f"Refreshed analytics views for {args.db_name}.{args.db_schema}")


if __name__ == "__main__":
    main()
