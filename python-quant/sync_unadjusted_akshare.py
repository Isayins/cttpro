from __future__ import annotations

import argparse
import math
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

import akshare as ak
import pandas as pd
import pymysql
from pymysql.cursors import DictCursor


DEFAULT_DB_HOST = "127.0.0.1"
DEFAULT_DB_PORT = 3306
DEFAULT_DB_USER = "root"
DEFAULT_DB_PASSWORD = "root"
DEFAULT_DB_NAME = "quant"
DEFAULT_TARGET_TABLE = "stock_daily_unadjusted_2026"
DEFAULT_REFERENCE_TABLE = "stock_daily_unadjusted_2025"
DEFAULT_START_DATE = "20260101"


@dataclass
class SymbolMeta:
    symbol: str
    name: str | None
    industry: str | None
    listing_date: date | None
    delisting_date: date | None
    is_st: int | None
    total_shares: int | None
    float_shares: int | None
    pe_ttm: float | None
    pb: float | None
    ps_ttm: float | None
    reference_close: float | None


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Incrementally sync 2026 unadjusted A-share data into MySQL with AKShare.")
    parser.add_argument("--db-host", default=DEFAULT_DB_HOST)
    parser.add_argument("--db-port", type=int, default=DEFAULT_DB_PORT)
    parser.add_argument("--db-user", default=DEFAULT_DB_USER)
    parser.add_argument("--db-password", default=DEFAULT_DB_PASSWORD)
    parser.add_argument("--db-name", default=DEFAULT_DB_NAME)
    parser.add_argument("--target-table", default=DEFAULT_TARGET_TABLE)
    parser.add_argument("--reference-table", default=DEFAULT_REFERENCE_TABLE)
    parser.add_argument("--start-date", default=DEFAULT_START_DATE)
    parser.add_argument("--end-date", default=datetime.now().strftime("%Y%m%d"))
    parser.add_argument("--symbols", help="Comma-separated symbol whitelist, e.g. 000001,000002")
    parser.add_argument("--symbol-limit", type=int)
    parser.add_argument("--pause-seconds", type=float, default=0.15)
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


def load_symbol_universe(connection: pymysql.connections.Connection, target_table: str, reference_table: str) -> list[str]:
    symbols: list[str] = []
    with connection.cursor() as cursor:
        for table_name in (reference_table, target_table):
            if not table_exists(connection, table_name):
                continue
            cursor.execute(f"SELECT DISTINCT symbol FROM `{table_name}` WHERE symbol IS NOT NULL AND symbol <> '' ORDER BY symbol")
            symbols.extend(str(row["symbol"]).strip() for row in cursor.fetchall() if row.get("symbol"))
    return sorted(dict.fromkeys(symbols))


def load_latest_meta_map(
    connection: pymysql.connections.Connection,
    target_table: str,
    reference_table: str,
) -> dict[str, SymbolMeta]:
    tables = [table_name for table_name in (target_table, reference_table) if table_exists(connection, table_name)]
    if not tables:
        return {}

    union_sql = " UNION ALL ".join(
        f"""
        SELECT
            symbol,
            name,
            industry,
            listing_date,
            delisting_date,
            is_st,
            total_shares,
            float_shares,
            pe_ttm,
            pb,
            ps_ttm,
            close_price,
            trade_date
        FROM `{table_name}`
        """
        for table_name in tables
    )

    query = f"""
    SELECT
        latest.symbol,
        latest.name,
        latest.industry,
        latest.listing_date,
        latest.delisting_date,
        latest.is_st,
        latest.total_shares,
        latest.float_shares,
        latest.pe_ttm,
        latest.pb,
        latest.ps_ttm,
        latest.close_price
    FROM (
        SELECT
            merged.*,
            ROW_NUMBER() OVER (PARTITION BY merged.symbol ORDER BY merged.trade_date DESC) AS rn
        FROM (
            {union_sql}
        ) merged
        WHERE merged.symbol IS NOT NULL
          AND merged.symbol <> ''
    ) latest
    WHERE latest.rn = 1
    ORDER BY latest.symbol
    """

    meta_map: dict[str, SymbolMeta] = {}
    with connection.cursor() as cursor:
        cursor.execute(query)
        for row in cursor.fetchall():
            symbol = str(row["symbol"]).strip()
            meta_map[symbol] = SymbolMeta(
                symbol=symbol,
                name=_normalize_text(row.get("name")),
                industry=_normalize_text(row.get("industry")),
                listing_date=row.get("listing_date"),
                delisting_date=row.get("delisting_date"),
                is_st=_to_int(row.get("is_st")),
                total_shares=_to_int(row.get("total_shares")),
                float_shares=_to_int(row.get("float_shares")),
                pe_ttm=_to_float(row.get("pe_ttm")),
                pb=_to_float(row.get("pb")),
                ps_ttm=_to_float(row.get("ps_ttm")),
                reference_close=_to_float(row.get("close_price")),
            )
    return meta_map


def load_latest_trade_dates(connection: pymysql.connections.Connection, target_table: str) -> dict[str, date]:
    if not table_exists(connection, target_table):
        return {}

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
            str(row["symbol"]).strip(): row["latest_trade_date"]
            for row in cursor.fetchall()
            if row.get("symbol") and row.get("latest_trade_date")
        }


def load_name_map_from_akshare() -> dict[str, str]:
    spot = ak.stock_info_a_code_name()
    if spot is None or spot.empty:
        return {}

    columns = list(spot.columns)
    symbol_column = "code" if "code" in columns else "代码" if "代码" in columns else columns[0]
    name_column = "name" if "name" in columns else "名称" if "名称" in columns else columns[1]

    mapping: dict[str, str] = {}
    for _, row in spot.iterrows():
        symbol = str(row[symbol_column]).strip()
        name = _normalize_text(row[name_column])
        if symbol:
            mapping[symbol] = name or symbol
    return mapping


def resolve_fetch_start_date(start_date: str, latest_trade_date: date | None) -> str:
    base_start = datetime.strptime(start_date, "%Y%m%d").date()
    if latest_trade_date is None:
        return (base_start - timedelta(days=420)).strftime("%Y%m%d")
    lookback_start = latest_trade_date - timedelta(days=420)
    return min(base_start, lookback_start).strftime("%Y%m%d")


def fetch_symbol_history(symbol: str, start_date: str, end_date: str) -> pd.DataFrame:
    frame = ak.stock_zh_a_hist(symbol=symbol, period="daily", start_date=start_date, end_date=end_date, adjust="")
    if frame is None or frame.empty:
        return pd.DataFrame()

    renamed = frame.rename(
        columns={
            "日期": "trade_date",
            "股票代码": "symbol",
            "开盘": "open_price",
            "收盘": "close_price",
            "最高": "high_price",
            "最低": "low_price",
            "成交量": "volume_lots",
            "成交额": "turnover_value",
            "振幅": "amplitude",
            "涨跌幅": "pct_change",
            "涨跌额": "change_value",
            "换手率": "turnover_rate",
        }
    ).copy()

    if renamed.empty:
        return renamed

    renamed["trade_date"] = pd.to_datetime(renamed["trade_date"])
    renamed["symbol"] = symbol
    numeric_columns = [
        "open_price",
        "close_price",
        "high_price",
        "low_price",
        "volume_lots",
        "turnover_value",
        "amplitude",
        "pct_change",
        "change_value",
        "turnover_rate",
    ]
    for column in numeric_columns:
        renamed[column] = pd.to_numeric(renamed[column], errors="coerce")

    renamed["volume_shares"] = (renamed["volume_lots"].fillna(0) * 100).round().astype("Int64")
    renamed["prev_close_price"] = renamed["close_price"].shift(1)

    for window in (5, 10, 20, 30, 60, 120, 250):
        renamed[f"ma_{window}"] = renamed["close_price"].rolling(window=window, min_periods=window).mean()

    for lag in (3, 6, 10, 25):
        renamed[f"pct_change_{lag}d"] = (renamed["close_price"] / renamed["close_price"].shift(lag) - 1) * 100

    return renamed


def build_insert_rows(
    frame: pd.DataFrame,
    *,
    symbol: str,
    latest_trade_date: date | None,
    min_insert_date: date,
    max_insert_date: date,
    meta: SymbolMeta | None,
    fallback_name: str | None,
) -> list[tuple[Any, ...]]:
    if frame.empty:
        return []

    filtered = frame.loc[
        (frame["trade_date"].dt.date >= min_insert_date)
        & (frame["trade_date"].dt.date <= max_insert_date)
    ].copy()
    if latest_trade_date is not None:
        filtered = filtered.loc[filtered["trade_date"].dt.date > latest_trade_date]
    if filtered.empty:
        return []

    reference_name = meta.name if meta and meta.name else fallback_name or symbol
    reference_industry = meta.industry if meta else None
    listing_date = meta.listing_date if meta else None
    delisting_date = meta.delisting_date if meta else None
    total_shares = meta.total_shares if meta else None
    float_shares = meta.float_shares if meta else None

    rows: list[tuple[Any, ...]] = []
    for _, row in filtered.iterrows():
        close_price = _to_float(row.get("close_price"))
        reference_close = meta.reference_close if meta else None
        is_st = _infer_st_flag(reference_name, meta.is_st if meta else None)
        rows.append(
            (
                row["trade_date"].date(),
                symbol,
                reference_name,
                reference_industry,
                "unadjusted",
                "akshare_hist",
                _to_decimal(row.get("open_price")),
                _to_decimal(row.get("high_price")),
                _to_decimal(row.get("low_price")),
                _to_decimal(close_price),
                _to_decimal(row.get("prev_close_price")),
                _to_int(row.get("volume_shares")),
                _to_decimal(row.get("turnover_value")),
                _to_decimal(row.get("turnover_rate")),
                _to_decimal(row.get("pct_change")),
                _to_decimal(row.get("amplitude")),
                is_st,
                None,
                _to_decimal(row.get("pct_change_3d")),
                _to_decimal(row.get("pct_change_6d")),
                _to_decimal(row.get("pct_change_10d")),
                _to_decimal(row.get("pct_change_25d")),
                _infer_limit_up(symbol, reference_name, _to_float(row.get("pct_change"))),
                total_shares,
                float_shares,
                _to_decimal(close_price * total_shares if close_price is not None and total_shares is not None else None),
                _to_decimal(close_price * float_shares if close_price is not None and float_shares is not None else None),
                _scaled_metric(meta.pe_ttm if meta else None, close_price, reference_close),
                _scaled_metric(meta.pb if meta else None, close_price, reference_close),
                _scaled_metric(meta.ps_ttm if meta else None, close_price, reference_close),
                _to_decimal(row.get("ma_5")),
                _to_decimal(row.get("ma_10")),
                _to_decimal(row.get("ma_20")),
                _to_decimal(row.get("ma_30")),
                _to_decimal(row.get("ma_60")),
                _to_decimal(row.get("ma_120")),
                _to_decimal(row.get("ma_250")),
                listing_date,
                delisting_date,
                "akshare://stock_zh_a_hist",
            )
        )
    return rows


def insert_rows(connection: pymysql.connections.Connection, target_table: str, rows: list[tuple[Any, ...]]) -> int:
    if not rows:
        return 0

    with connection.cursor() as cursor:
        cursor.executemany(
            f"""
            INSERT INTO `{target_table}` (
                trade_date, symbol, name, industry, adjustment_type, source_layout,
                open_price, high_price, low_price, close_price, prev_close_price,
                volume_shares, turnover_value, turnover_rate, pct_change, amplitude,
                is_st, volume_ratio, pct_change_3d, pct_change_6d, pct_change_10d,
                pct_change_25d, is_limit_up, total_shares, float_shares,
                total_market_cap, float_market_cap, pe_ttm, pb, ps_ttm,
                ma_5, ma_10, ma_20, ma_30, ma_60, ma_120, ma_250,
                listing_date, delisting_date, source_file
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s
            )
            """,
            rows,
        )
        return int(cursor.rowcount or 0)


def _normalize_text(value: Any) -> str | None:
    if value in (None, ""):
        return None
    text = str(value).strip()
    return text or None


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, str) and value.strip() == "":
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(numeric):
        return None
    return numeric


def _to_decimal(value: Any) -> Decimal | None:
    numeric = _to_float(value)
    if numeric is None:
        return None
    return Decimal(f"{numeric:.6f}")


def _to_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, str) and value.strip() == "":
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _scaled_metric(metric: float | None, latest_close: float | None, reference_close: float | None) -> Decimal | None:
    if metric is None or latest_close is None or reference_close in (None, 0):
        return None if metric is None else _to_decimal(metric)
    return _to_decimal(metric * latest_close / reference_close)


def _infer_st_flag(name: str | None, fallback: int | None) -> int | None:
    if name:
        normalized = name.upper().replace(" ", "")
        if "ST" in normalized:
            return 1
    return fallback


def _infer_limit_up(symbol: str, name: str | None, pct_change: float | None) -> int | None:
    if pct_change is None:
        return None

    threshold = 9.8
    if name and "ST" in name.upper().replace(" ", ""):
        threshold = 4.8
    elif symbol.startswith(("300", "301", "688")):
        threshold = 19.8
    elif symbol.startswith(("430", "830", "831", "832", "833", "834", "835", "836", "837", "838", "839", "870", "871", "872", "873", "874", "875", "876", "877", "878", "879", "880", "881", "882", "883", "884", "885", "886", "887", "888", "920")):
        threshold = 29.8
    return 1 if pct_change >= threshold else 0


def main() -> None:
    args = build_parser().parse_args()
    min_insert_date = datetime.strptime(args.start_date, "%Y%m%d").date()
    max_insert_date = datetime.strptime(args.end_date, "%Y%m%d").date()

    with connect(args) as connection:
        if not table_exists(connection, args.target_table):
            raise RuntimeError(f"Target table `{args.target_table}` does not exist in `{args.db_name}`.")

        universe = load_symbol_universe(connection, args.target_table, args.reference_table)
        if args.symbols:
            whitelist = {item.strip() for item in args.symbols.split(",") if item.strip()}
            universe = [symbol for symbol in universe if symbol in whitelist]
        if args.symbol_limit and args.symbol_limit > 0:
            universe = universe[: args.symbol_limit]
        if not universe:
            raise RuntimeError("No symbols found in the reference universe.")

        meta_map = load_latest_meta_map(connection, args.target_table, args.reference_table)
        latest_trade_dates = load_latest_trade_dates(connection, args.target_table)
        fallback_names = load_name_map_from_akshare()

        inserted_rows = 0
        success_count = 0
        error_items: list[tuple[str, str]] = []

        print(f"Target table: {args.db_name}.{args.target_table}")
        print(f"Universe size: {len(universe)}")
        print(f"Increment window: {args.start_date} -> {args.end_date}")

        for index, symbol in enumerate(universe, start=1):
            latest_trade_date = latest_trade_dates.get(symbol)
            fetch_start_date = resolve_fetch_start_date(args.start_date, latest_trade_date)
            try:
                frame = fetch_symbol_history(symbol, fetch_start_date, args.end_date)
                payloads = build_insert_rows(
                    frame,
                    symbol=symbol,
                    latest_trade_date=latest_trade_date,
                    min_insert_date=min_insert_date,
                    max_insert_date=max_insert_date,
                    meta=meta_map.get(symbol),
                    fallback_name=fallback_names.get(symbol),
                )
                affected = insert_rows(connection, args.target_table, payloads)
                inserted_rows += len(payloads)
                success_count += 1
                print(
                    f"[{index}/{len(universe)}] {symbol} fetched={len(frame)} inserted={len(payloads)} affected={affected} latest={latest_trade_date}"
                )
            except Exception as exc:
                error_items.append((symbol, str(exc)))
                print(f"[{index}/{len(universe)}] {symbol} ERROR: {exc}")
            if args.pause_seconds > 0:
                time.sleep(args.pause_seconds)

    print("---")
    print(f"Symbols processed: {len(universe)}")
    print(f"Success count: {success_count}")
    print(f"Inserted rows: {inserted_rows}")
    print(f"Error count: {len(error_items)}")
    if error_items:
        for symbol, error in error_items[:20]:
            print(f"ERROR {symbol}: {error}")


if __name__ == "__main__":
    main()
