from __future__ import annotations

import argparse
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pandas as pd
import pymysql
from pymysql.cursors import DictCursor


DEFAULT_DB_HOST = "127.0.0.1"
DEFAULT_DB_PORT = 3306
DEFAULT_DB_USER = "root"
DEFAULT_DB_PASSWORD = "root"
DEFAULT_DB_NAME = "quant"
DEFAULT_TARGET_TABLE = "stock_daily_unadjusted_2026"
DEFAULT_TEMPLATE_TABLE = "stock_daily_unadjusted_2002"
DEFAULT_SOURCE_DIR = r"I:\Stock\Stock\Everyday2\UnAdjustedStock"
DEFAULT_START_DATE = "20260101"


COLUMN_MAPPING = {
    "日期": "trade_date",
    "代码": "symbol",
    "名称": "name",
    "所属行业": "industry",
    "开盘价": "open_price",
    "最高价": "high_price",
    "最低价": "low_price",
    "收盘价": "close_price",
    "前收盘价": "prev_close_price",
    "成交量（股）": "volume_shares",
    "成交额（元）": "turnover_value",
    "换手率": "turnover_rate",
    "涨幅%": "pct_change",
    "振幅%": "amplitude",
    "是否ST": "is_st",
    "量比": "volume_ratio",
    "3日涨幅%": "pct_change_3d",
    "6日涨幅%": "pct_change_6d",
    "10日涨幅%": "pct_change_10d",
    "25日涨幅%": "pct_change_25d",
    "是否涨停": "is_limit_up",
    "总股本（股）": "total_shares",
    "流通股本（股）": "float_shares",
    "总市值（元）": "total_market_cap",
    "流通市值（元）": "float_market_cap",
    "滚动市盈率": "pe_ttm",
    "市净率": "pb",
    "滚动市销率": "ps_ttm",
    "5日线": "ma_5",
    "10日线": "ma_10",
    "20日线": "ma_20",
    "30日线": "ma_30",
    "60日线": "ma_60",
    "120日线": "ma_120",
    "250日线": "ma_250",
    "上市时间": "listing_date",
    "退市时间": "delisting_date",
}

INSERT_COLUMNS = [
    "trade_date",
    "symbol",
    "name",
    "industry",
    "adjustment_type",
    "source_layout",
    "open_price",
    "high_price",
    "low_price",
    "close_price",
    "prev_close_price",
    "volume_shares",
    "turnover_value",
    "turnover_rate",
    "pct_change",
    "amplitude",
    "is_st",
    "volume_ratio",
    "pct_change_3d",
    "pct_change_6d",
    "pct_change_10d",
    "pct_change_25d",
    "is_limit_up",
    "total_shares",
    "float_shares",
    "total_market_cap",
    "float_market_cap",
    "pe_ttm",
    "pb",
    "ps_ttm",
    "ma_5",
    "ma_10",
    "ma_20",
    "ma_30",
    "ma_60",
    "ma_120",
    "ma_250",
    "listing_date",
    "delisting_date",
    "source_file",
]

NUMERIC_COLUMNS = [
    "open_price",
    "high_price",
    "low_price",
    "close_price",
    "prev_close_price",
    "volume_shares",
    "turnover_value",
    "turnover_rate",
    "pct_change",
    "amplitude",
    "volume_ratio",
    "pct_change_3d",
    "pct_change_6d",
    "pct_change_10d",
    "pct_change_25d",
    "total_shares",
    "float_shares",
    "total_market_cap",
    "float_market_cap",
    "pe_ttm",
    "pb",
    "ps_ttm",
    "ma_5",
    "ma_10",
    "ma_20",
    "ma_30",
    "ma_60",
    "ma_120",
    "ma_250",
]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Incrementally import local unadjusted CSV files into MySQL.")
    parser.add_argument("--db-host", default=DEFAULT_DB_HOST)
    parser.add_argument("--db-port", type=int, default=DEFAULT_DB_PORT)
    parser.add_argument("--db-user", default=DEFAULT_DB_USER)
    parser.add_argument("--db-password", default=DEFAULT_DB_PASSWORD)
    parser.add_argument("--db-name", default=DEFAULT_DB_NAME)
    parser.add_argument("--target-table", default=DEFAULT_TARGET_TABLE)
    parser.add_argument("--template-table", default=DEFAULT_TEMPLATE_TABLE)
    parser.add_argument("--source-dir", default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--start-date", default=DEFAULT_START_DATE)
    parser.add_argument("--end-date", default=datetime.now().strftime("%Y%m%d"))
    parser.add_argument("--symbols", help="Comma-separated symbol whitelist, e.g. 000001,000002")
    parser.add_argument("--symbol-limit", type=int)
    return parser


def connect(args: argparse.Namespace) -> pymysql.connections.Connection:
    return pymysql.connect(
        host=args.db_host,
        port=args.db_port,
        user=args.db_user,
        password=args.db_password,
        database=args.db_name,
        charset="utf8mb4",
        autocommit=True,
        cursorclass=DictCursor,
    )


def table_exists(connection: pymysql.connections.Connection, table_name: str) -> bool:
    with connection.cursor() as cursor:
        cursor.execute("SHOW TABLES LIKE %s", (table_name,))
        return cursor.fetchone() is not None


def ensure_target_table(
    connection: pymysql.connections.Connection,
    target_table: str,
    template_table: str,
) -> None:
    if table_exists(connection, target_table):
        return
    if not table_exists(connection, template_table):
        raise RuntimeError(
            f"Target table `{target_table}` does not exist and template table `{template_table}` was not found."
        )
    with connection.cursor() as cursor:
        cursor.execute(f"CREATE TABLE `{target_table}` LIKE `{template_table}`")
    print(f"Created table `{target_table}` from template `{template_table}`.")


def load_latest_trade_dates(connection: pymysql.connections.Connection, target_table: str) -> dict[str, date]:
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT symbol, MAX(trade_date) AS latest_trade_date
            FROM `{target_table}`
            WHERE symbol IS NOT NULL
              AND symbol <> ''
            GROUP BY symbol
            """
        )
        return {
            str(row["symbol"]).zfill(6): row["latest_trade_date"]
            for row in cursor.fetchall()
            if row.get("symbol") and row.get("latest_trade_date")
        }


def list_source_files(source_dir: Path, symbols: set[str] | None = None, symbol_limit: int | None = None) -> list[Path]:
    files = sorted(source_dir.glob("*.csv"))
    if symbols:
        files = [path for path in files if path.stem in symbols]
    if symbol_limit and symbol_limit > 0:
        files = files[:symbol_limit]
    return files


def normalize_dataframe(frame: pd.DataFrame, source_file: Path) -> pd.DataFrame:
    normalized = frame.rename(columns=COLUMN_MAPPING).copy()
    missing_columns = [column for column in COLUMN_MAPPING.values() if column not in normalized.columns]
    if missing_columns:
        raise ValueError(f"Missing columns in {source_file.name}: {missing_columns}")

    normalized["trade_date"] = pd.to_datetime(normalized["trade_date"], errors="coerce")
    normalized["symbol"] = normalized["symbol"].apply(lambda value: str(value).split(".")[0].zfill(6))
    normalized["name"] = normalized["name"].apply(_normalize_text)
    normalized["industry"] = normalized["industry"].apply(_normalize_text)
    normalized["adjustment_type"] = "unadjusted"
    normalized["source_layout"] = "by_code"
    normalized["source_file"] = str(source_file)

    for date_column in ("listing_date", "delisting_date"):
        normalized[date_column] = normalized[date_column].apply(_parse_date_value)

    normalized["is_st"] = normalized["is_st"].apply(_parse_yes_no)
    normalized["is_limit_up"] = normalized["is_limit_up"].apply(_parse_yes_no)

    for column in NUMERIC_COLUMNS:
        normalized[column] = pd.to_numeric(normalized[column], errors="coerce")

    return normalized


def filter_increment_rows(
    frame: pd.DataFrame,
    *,
    latest_trade_date: date | None,
    min_insert_date: date,
    max_insert_date: date,
) -> pd.DataFrame:
    filtered = frame.loc[
        frame["trade_date"].notna()
        & (frame["trade_date"].dt.date >= min_insert_date)
        & (frame["trade_date"].dt.date <= max_insert_date)
    ].copy()
    if latest_trade_date is not None:
        filtered = filtered.loc[filtered["trade_date"].dt.date > latest_trade_date]
    return filtered


def build_payloads(frame: pd.DataFrame) -> list[tuple[Any, ...]]:
    payloads: list[tuple[Any, ...]] = []
    for _, row in frame.iterrows():
        payloads.append(tuple(_serialize_value(column, row[column]) for column in INSERT_COLUMNS))
    return payloads


def _serialize_value(column: str, value: Any) -> Any:
    if column in {"trade_date", "listing_date", "delisting_date"}:
        if value is None or (hasattr(pd, "isna") and pd.isna(value)):
            return None
        if isinstance(value, pd.Timestamp):
            return value.date()
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        return _parse_date_value(value)

    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass

    if column in {"symbol", "name", "industry", "adjustment_type", "source_layout", "source_file"}:
        return _normalize_text(value)
    if column in {"is_st", "is_limit_up"}:
        return _parse_yes_no(value)
    if column in {"volume_shares", "total_shares", "float_shares"}:
        return _to_int(value)
    return _to_float(value)


def insert_payloads(connection: pymysql.connections.Connection, target_table: str, payloads: list[tuple[Any, ...]]) -> int:
    if not payloads:
        return 0

    placeholders = ", ".join(["%s"] * len(INSERT_COLUMNS))
    columns_sql = ", ".join(INSERT_COLUMNS)
    with connection.cursor() as cursor:
        cursor.executemany(
            f"INSERT INTO `{target_table}` ({columns_sql}) VALUES ({placeholders})",
            payloads,
        )
        return int(cursor.rowcount or 0)


def _normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if text in {"", "-", "nan", "None", "null"}:
        return None
    return text


def _parse_yes_no(value: Any) -> int | None:
    if value is None:
        return None
    text = str(value).strip()
    if text in {"", "-", "nan", "None", "null"}:
        return None
    if text in {"是", "Y", "y", "true", "True", "1"}:
        return 1
    if text in {"否", "N", "n", "false", "False", "0"}:
        return 0
    try:
        return 1 if float(text) != 0 else 0
    except ValueError:
        return None


def _parse_date_value(value: Any) -> date | None:
    text = _normalize_text(value)
    if text is None:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int(value: Any) -> int | None:
    numeric = _to_float(value)
    if numeric is None:
        return None
    return int(numeric)


def main() -> None:
    args = build_parser().parse_args()
    source_dir = Path(args.source_dir)
    if not source_dir.exists():
        raise RuntimeError(f"Source directory does not exist: {source_dir}")

    min_insert_date = datetime.strptime(args.start_date, "%Y%m%d").date()
    max_insert_date = datetime.strptime(args.end_date, "%Y%m%d").date()
    symbols = {item.strip() for item in args.symbols.split(",") if item.strip()} if args.symbols else None

    connection = connect(args)
    try:
        ensure_target_table(connection, args.target_table, args.template_table)

        latest_trade_dates = load_latest_trade_dates(connection, args.target_table)
        source_files = list_source_files(source_dir, symbols=symbols, symbol_limit=args.symbol_limit)
        if not source_files:
            raise RuntimeError("No source CSV files found for import.")

        inserted_rows = 0
        success_count = 0
        error_items: list[tuple[str, str]] = []

        print(f"Target table: {args.db_name}.{args.target_table}")
        print(f"Source directory: {source_dir}")
        print(f"CSV files: {len(source_files)}")
        print(f"Increment window: {args.start_date} -> {args.end_date}")

        for index, csv_path in enumerate(source_files, start=1):
            symbol = csv_path.stem.zfill(6)
            latest_trade_date = latest_trade_dates.get(symbol)
            try:
                frame = pd.read_csv(csv_path, encoding="utf-8")
                normalized = normalize_dataframe(frame, csv_path)
                delta = filter_increment_rows(
                    normalized,
                    latest_trade_date=latest_trade_date,
                    min_insert_date=min_insert_date,
                    max_insert_date=max_insert_date,
                )
                payloads = build_payloads(delta)
                affected = insert_payloads(connection, args.target_table, payloads)
                inserted_rows += len(payloads)
                success_count += 1
                print(
                    f"[{index}/{len(source_files)}] {symbol} csv_rows={len(frame)} inserted={len(payloads)} "
                    f"affected={affected} latest={latest_trade_date}"
                )
            except Exception as exc:
                error_items.append((symbol, str(exc)))
                print(f"[{index}/{len(source_files)}] {symbol} ERROR: {exc}")

        print("---")
        print(f"Files processed: {len(source_files)}")
        print(f"Success count: {success_count}")
        print(f"Inserted rows: {inserted_rows}")
        print(f"Error count: {len(error_items)}")
        if error_items:
            for symbol, error in error_items[:20]:
                print(f"ERROR {symbol}: {error}")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
