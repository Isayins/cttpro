from __future__ import annotations

import argparse
import json
import math
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd
import psycopg
from psycopg.rows import dict_row
import tushare as ts


DEFAULT_DB_HOST = "127.0.0.1"
DEFAULT_DB_PORT = 5432
DEFAULT_DB_USER = "postgres"
DEFAULT_DB_PASSWORD = ""
DEFAULT_DB_NAME = "quant"
DEFAULT_SOURCE_SCHEMA = "tushare_data"
DEFAULT_TARGET_SCHEMA = "market_data"
DEFAULT_BATCH_SIZE = 2000
DEFAULT_TUSHARE_HTTP_URL = "http://tsy.xiaodefa.cn"

PRICE_WINDOWS = (5, 10, 20, 30, 60, 120, 250)
RETURN_WINDOWS = (
    (3, "pct_change_3d"),
    (6, "pct_change_6d"),
    (10, "pct_change_10d"),
    (25, "pct_change_25d"),
)
TARGET_COLUMNS = [
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


@dataclass(frozen=True)
class YearPlan:
    year: int
    start_date: date
    end_date: date
    trade_dates: tuple[date, ...]


def validate_identifier(value: str, label: str) -> str:
    text = str(value or "").strip()
    if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", text):
        return text
    raise ValueError(f"Invalid PostgreSQL {label}: {value}")


def parse_date(value: str | None) -> date | None:
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in ("%Y%m%d", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Unsupported date format: {value}")


def chunked(items: list[Any], size: int) -> list[list[Any]]:
    return [items[index:index + size] for index in range(0, len(items), size)]


def float_or_none(value: Any, *, digits: int = 6) -> float | None:
    if value is None:
        return None
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return round(value, digits)
    if isinstance(value, (np.floating,)):
        numeric = float(value)
        if math.isnan(numeric) or math.isinf(numeric):
            return None
        return round(numeric, digits)
    if pd.isna(value):
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(numeric) or math.isinf(numeric):
        return None
    return round(numeric, digits)


def int_or_none(value: Any) -> int | None:
    if value is None or pd.isna(value):
        return None
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


def str_or_none(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


def date_or_none(value: Any) -> date | None:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    try:
        return pd.to_datetime(value, errors="coerce").date()
    except Exception:
        return None


class PostgresStore:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.source_schema = validate_identifier(args.source_schema, "source schema")
        self.target_schema = validate_identifier(args.target_schema, "target schema")

    def connect(self, *, autocommit: bool = False) -> psycopg.Connection[Any]:
        return psycopg.connect(
            host=self.args.db_host,
            port=self.args.db_port,
            user=self.args.db_user,
            password=self.args.db_password,
            dbname=self.args.db_name,
            row_factory=dict_row,
            connect_timeout=10,
            autocommit=autocommit,
        )

    def fetch_all(self, sql: str, params: tuple[Any, ...] | None = None) -> list[dict[str, Any]]:
        with self.connect(autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params or ())
                return list(cur.fetchall())

    def fetch_one(self, sql: str, params: tuple[Any, ...] | None = None) -> dict[str, Any] | None:
        rows = self.fetch_all(sql, params)
        return rows[0] if rows else None

    def table_exists(self, schema_name: str, table_name: str) -> bool:
        row = self.fetch_one(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_name = %s
            LIMIT 1
            """,
            (schema_name, table_name),
        )
        return bool(row)


class TushareGateway:
    def __init__(self, token: str, http_url: str) -> None:
        ts.set_token(token)
        self.pro = ts.pro_api(token)
        self.pro._DataApi__token = token
        self.pro._DataApi__http_url = http_url

    @staticmethod
    def _records(frame: Any) -> list[dict[str, Any]]:
        if frame is None:
            return []
        if hasattr(frame, "to_dict"):
            return list(frame.to_dict(orient="records"))
        return list(frame or [])

    def fetch(self, api_name: str, **kwargs: Any) -> list[dict[str, Any]]:
        api = getattr(self.pro, api_name)
        return self._records(api(**kwargs))


class MarketDataBackfillRunner:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.store = PostgresStore(args)
        self.gateway = (
            TushareGateway(args.tushare_token, args.tushare_http_url)
            if str(args.tushare_token or "").strip()
            else None
        )
        self._daily_cache_by_year: dict[int, dict[str, list[dict[str, Any]]]] = {}

    def run(self) -> dict[str, Any]:
        plans = self._resolve_year_plans()
        results: list[dict[str, Any]] = []

        for plan in plans:
            result = self._backfill_year(plan)
            if result is not None:
                results.append(result)

        return {
            "dbName": self.args.db_name,
            "sourceSchema": self.store.source_schema,
            "targetSchema": self.store.target_schema,
            "dryRun": self.args.dry_run,
            "results": results,
        }

    def _resolve_year_plans(self) -> list[YearPlan]:
        manual_start = parse_date(self.args.start_date)
        manual_end = parse_date(self.args.end_date)
        target_years = self._resolve_target_years(manual_start, manual_end)
        plans: list[YearPlan] = []

        for year in target_years:
            auto_start = self._resolve_auto_start_date(year)
            start_date = manual_start or auto_start
            end_date = manual_end or self._resolve_default_end_date(year)
            start_date = max(start_date, date(year, 1, 1))
            end_date = min(end_date, date(year, 12, 31))
            if start_date > end_date:
                continue

            trade_dates = self._trade_dates_between(start_date, end_date)
            if not trade_dates:
                continue

            plans.append(
                YearPlan(
                    year=year,
                    start_date=trade_dates[0],
                    end_date=trade_dates[-1],
                    trade_dates=trade_dates,
                )
            )
        return plans

    def _resolve_target_years(self, manual_start: date | None, manual_end: date | None) -> list[int]:
        if self.args.year:
            return sorted({int(year) for year in self.args.year})
        if manual_start or manual_end:
            start_year = (manual_start or manual_end).year
            end_year = (manual_end or manual_start).year
            return list(range(start_year, end_year + 1))
        return [datetime.now().year]

    @staticmethod
    def _resolve_default_end_date(year: int) -> date:
        today = datetime.now().date()
        return min(today, date(year, 12, 31))

    def _resolve_auto_start_date(self, year: int) -> date:
        target_tables = [
            self._target_unadjusted_table_name(year),
            self._target_forward_table_name(year),
        ]
        latest_dates: list[date] = []
        for table_name in target_tables:
            if not self.store.table_exists(self.store.target_schema, table_name):
                continue
            row = self.store.fetch_one(
                f"SELECT MAX(trade_date) AS max_trade_date FROM {self.store.target_schema}.{table_name}"
            )
            max_trade_date = row["max_trade_date"] if row else None
            if max_trade_date is not None:
                latest_dates.append(max_trade_date)
        if latest_dates:
            return min(latest_dates) + timedelta(days=1)
        return date(year, 1, 1)

    def _backfill_year(self, plan: YearPlan) -> dict[str, Any] | None:
        refreshed = self._refresh_source_trade_dates(plan.year, plan.trade_dates) if self.gateway is not None else {}
        source_df = self._load_source_daily_frame(plan.year, plan.start_date, plan.end_date)
        if source_df.empty:
            return None

        source_df = source_df.sort_values(["symbol", "trade_date"]).reset_index(drop=True)
        symbols = sorted(source_df["symbol"].dropna().astype(str).unique().tolist())
        unadjusted_df = self._build_unadjusted_frame(source_df, plan.year)
        forward_df = self._build_forward_frame(source_df, plan.year)

        history_unadjusted_df = self._load_history_close_frame(
            price_kind="unadjusted",
            year=plan.year,
            start_date=plan.start_date,
            symbols=symbols,
        )
        history_forward_df = self._load_history_close_frame(
            price_kind="forward_adjusted",
            year=plan.year,
            start_date=plan.start_date,
            symbols=symbols,
        )

        final_unadjusted_df = self._attach_price_metrics(history_unadjusted_df, unadjusted_df)
        final_forward_df = self._attach_price_metrics(history_forward_df, forward_df)

        if not self.args.dry_run:
            self._replace_target_range(
                table_name=self._target_unadjusted_table_name(plan.year),
                start_date=plan.start_date,
                end_date=plan.end_date,
                payload_df=final_unadjusted_df,
            )
            self._replace_target_range(
                table_name=self._target_forward_table_name(plan.year),
                start_date=plan.start_date,
                end_date=plan.end_date,
                payload_df=final_forward_df,
            )

        return {
            "year": plan.year,
            "startDate": plan.start_date.isoformat(),
            "endDate": plan.end_date.isoformat(),
            "tradeDateCount": len(plan.trade_dates),
            "symbolCount": len(symbols),
            "unadjustedRows": int(len(final_unadjusted_df)),
            "forwardAdjustedRows": int(len(final_forward_df)),
            "sourceRefresh": refreshed,
        }

    def _refresh_source_trade_dates(self, year: int, trade_dates: tuple[date, ...]) -> dict[str, int]:
        if self.gateway is None:
            return {}

        refreshed = {
            "daily": 0,
            "daily_basic": 0,
            "adj_factor": 0,
            "stk_limit": 0,
        }
        cache = {
            "daily": [],
            "daily_basic": [],
            "adj_factor": [],
            "price_limit": [],
        }
        for trade_date in trade_dates:
            trade_date_text = trade_date.strftime("%Y%m%d")

            daily_rows = self.gateway.fetch("daily", trade_date=trade_date_text)
            cache["daily"].extend(daily_rows)
            refreshed["daily"] += len(daily_rows)

            daily_basic_rows = self.gateway.fetch("daily_basic", trade_date=trade_date_text)
            cache["daily_basic"].extend(daily_basic_rows)
            refreshed["daily_basic"] += len(daily_basic_rows)
            if not self.args.dry_run:
                self._upsert_source_daily_basic_rows(daily_basic_rows)

            adj_factor_rows = self.gateway.fetch("adj_factor", trade_date=trade_date_text)
            cache["adj_factor"].extend(adj_factor_rows)
            refreshed["adj_factor"] += len(adj_factor_rows)
            if not self.args.dry_run:
                self._upsert_source_adj_factor_rows(adj_factor_rows)

            price_limit_rows = self.gateway.fetch("stk_limit", trade_date=trade_date_text)
            cache["price_limit"].extend(price_limit_rows)
            refreshed["stk_limit"] += len(price_limit_rows)
            if not self.args.dry_run:
                self._upsert_source_price_limit_rows(price_limit_rows)

        self._daily_cache_by_year[year] = cache
        return refreshed

    def _load_source_daily_frame(self, year: int, start_date: date, end_date: date) -> pd.DataFrame:
        cache = self._daily_cache_by_year.get(year)
        if cache is not None:
            return self._load_source_daily_frame_from_cache(cache, start_date=start_date, end_date=end_date)

        source_table = self._source_table_name(year)
        if not self.store.table_exists(self.store.source_schema, source_table):
            return pd.DataFrame()
        rows = self.store.fetch_all(
            f"""
            SELECT
                d.trade_date,
                d.ts_code,
                SPLIT_PART(d.ts_code, '.', 1) AS symbol,
                b.name,
                b.industry,
                b.list_date AS listing_date,
                b.delist_date AS delisting_date,
                d.open,
                d.high,
                d.low,
                d.close,
                d.pre_close,
                d.pct_chg,
                d.vol,
                d.amount,
                db.turnover_rate,
                db.volume_ratio,
                db.pe_ttm,
                db.pb,
                db.ps_ttm,
                db.total_share,
                db.float_share,
                db.total_mv,
                db.circ_mv,
                af.adj_factor,
                pl.up_limit
            FROM {self.store.source_schema}.{source_table} d
            LEFT JOIN {self.store.source_schema}.stock_basic b
                ON b.ts_code = d.ts_code
            LEFT JOIN {self.store.source_schema}.stock_daily_basic db
                ON db.ts_code = d.ts_code
               AND db.trade_date = d.trade_date
            LEFT JOIN {self.store.source_schema}.stock_adj_factor af
                ON af.ts_code = d.ts_code
               AND af.trade_date = d.trade_date
            LEFT JOIN {self.store.source_schema}.stock_price_limit pl
                ON pl.ts_code = d.ts_code
               AND pl.trade_date = d.trade_date
            WHERE d.trade_date BETWEEN %s AND %s
            ORDER BY symbol, d.trade_date
            """,
            (start_date, end_date),
        )
        frame = pd.DataFrame(rows)
        if frame.empty:
            return frame

        frame["trade_date"] = pd.to_datetime(frame["trade_date"])
        frame["listing_date"] = pd.to_datetime(frame["listing_date"], errors="coerce")
        frame["delisting_date"] = pd.to_datetime(frame["delisting_date"], errors="coerce")
        numeric_columns = [
            "open",
            "high",
            "low",
            "close",
            "pre_close",
            "pct_chg",
            "vol",
            "amount",
            "turnover_rate",
            "volume_ratio",
            "pe_ttm",
            "pb",
            "ps_ttm",
            "total_share",
            "float_share",
            "total_mv",
            "circ_mv",
            "adj_factor",
            "up_limit",
        ]
        for column_name in numeric_columns:
            frame[column_name] = pd.to_numeric(frame[column_name], errors="coerce")
        return frame

    def _load_source_daily_frame_from_cache(
        self,
        cache: dict[str, list[dict[str, Any]]],
        *,
        start_date: date,
        end_date: date,
    ) -> pd.DataFrame:
        daily_frame = pd.DataFrame(cache.get("daily", []))
        if daily_frame.empty:
            return daily_frame

        daily_frame["trade_date"] = pd.to_datetime(daily_frame["trade_date"], errors="coerce")
        daily_frame = daily_frame.loc[
            daily_frame["trade_date"].notna()
            & (daily_frame["trade_date"].dt.date >= start_date)
            & (daily_frame["trade_date"].dt.date <= end_date)
        ].copy()
        if daily_frame.empty:
            return daily_frame

        daily_frame["ts_code"] = daily_frame["ts_code"].astype("string")
        daily_frame["symbol"] = daily_frame["ts_code"].str.split(".").str[0]

        ts_codes = [
            code
            for code in sorted(daily_frame["ts_code"].dropna().astype(str).unique().tolist())
            if code
        ]
        support_dates = [
            value.strftime("%Y-%m-%d")
            for value in sorted(daily_frame["trade_date"].dt.date.unique().tolist())
        ]

        stock_basic_frame = self._fetch_stock_basic_frame(ts_codes)
        daily_basic_frame = self._normalize_support_trade_frame(
            cache.get("daily_basic", []),
            supported_dates=support_dates,
            value_columns=(
                "turnover_rate",
                "volume_ratio",
                "pe_ttm",
                "pb",
                "ps_ttm",
                "total_share",
                "float_share",
                "total_mv",
                "circ_mv",
            ),
        )
        adj_factor_frame = self._normalize_support_trade_frame(
            cache.get("adj_factor", []),
            supported_dates=support_dates,
            value_columns=("adj_factor",),
        )
        price_limit_frame = self._normalize_support_trade_frame(
            cache.get("price_limit", []),
            supported_dates=support_dates,
            value_columns=("up_limit",),
        )

        merged = daily_frame.merge(stock_basic_frame, how="left", on="ts_code")
        merged = merged.merge(daily_basic_frame, how="left", on=["ts_code", "trade_date"])
        merged = merged.merge(adj_factor_frame, how="left", on=["ts_code", "trade_date"])
        merged = merged.merge(price_limit_frame, how="left", on=["ts_code", "trade_date"])

        merged["listing_date"] = pd.to_datetime(merged["listing_date"], errors="coerce")
        merged["delisting_date"] = pd.to_datetime(merged["delisting_date"], errors="coerce")
        numeric_columns = [
            "open",
            "high",
            "low",
            "close",
            "pre_close",
            "pct_chg",
            "vol",
            "amount",
            "turnover_rate",
            "volume_ratio",
            "pe_ttm",
            "pb",
            "ps_ttm",
            "total_share",
            "float_share",
            "total_mv",
            "circ_mv",
            "adj_factor",
            "up_limit",
        ]
        for column_name in numeric_columns:
            if column_name in merged.columns:
                merged[column_name] = pd.to_numeric(merged[column_name], errors="coerce")

        return merged.sort_values(["symbol", "trade_date"]).reset_index(drop=True)

    def _fetch_stock_basic_frame(self, ts_codes: list[str]) -> pd.DataFrame:
        if not ts_codes:
            return pd.DataFrame(
                columns=["ts_code", "name", "industry", "listing_date", "delisting_date"]
            )
        rows = self.store.fetch_all(
            f"""
            SELECT
                ts_code,
                name,
                industry,
                list_date AS listing_date,
                delist_date AS delisting_date
            FROM {self.store.source_schema}.stock_basic
            WHERE ts_code = ANY(%s)
            """,
            (ts_codes,),
        )
        frame = pd.DataFrame(rows)
        if frame.empty:
            return pd.DataFrame(
                columns=["ts_code", "name", "industry", "listing_date", "delisting_date"]
            )
        frame["ts_code"] = frame["ts_code"].astype("string")
        return frame

    @staticmethod
    def _normalize_support_trade_frame(
        rows: list[dict[str, Any]],
        *,
        supported_dates: list[str],
        value_columns: tuple[str, ...],
    ) -> pd.DataFrame:
        frame = pd.DataFrame(rows)
        if frame.empty:
            return frame
        frame["trade_date"] = pd.to_datetime(frame["trade_date"], errors="coerce")
        frame["ts_code"] = frame["ts_code"].astype("string")
        if supported_dates:
            allowed_dates = pd.to_datetime(pd.Series(supported_dates), errors="coerce")
            frame = frame.loc[frame["trade_date"].isin(set(allowed_dates.dropna().tolist()))].copy()
        keep_columns = ["ts_code", "trade_date", *[name for name in value_columns if name in frame.columns]]
        return frame[keep_columns]

    def _trade_dates_between(self, start_date: date, end_date: date) -> tuple[date, ...]:
        if start_date > end_date:
            return ()

        if self.gateway is not None:
            rows = self.gateway.fetch(
                "trade_cal",
                exchange="SSE",
                start_date=start_date.strftime("%Y%m%d"),
                end_date=end_date.strftime("%Y%m%d"),
            )
            return tuple(
                sorted(
                    {
                        date_or_none(row.get("cal_date"))
                        for row in rows
                        if int(row.get("is_open") or 0) == 1 and date_or_none(row.get("cal_date")) is not None
                    }
                )
            )

        rows = self.store.fetch_all(
            f"""
            SELECT cal_date
            FROM {self.store.source_schema}.trade_cal
            WHERE exchange = 'SSE'
              AND is_open = 1
              AND cal_date BETWEEN %s AND %s
            ORDER BY cal_date
            """,
            (start_date, end_date),
        )
        return tuple(row["cal_date"] for row in rows if row.get("cal_date") is not None)

    def _build_unadjusted_frame(self, source_df: pd.DataFrame, year: int) -> pd.DataFrame:
        frame = source_df.copy()
        frame["adjustment_type"] = "unadjusted"
        frame["source_layout"] = "by_date"
        frame["open_price"] = frame["open"]
        frame["high_price"] = frame["high"]
        frame["low_price"] = frame["low"]
        frame["close_price"] = frame["close"]
        frame["prev_close_price"] = frame["pre_close"]
        frame["volume_shares"] = np.rint(frame["vol"] * 100.0)
        frame["turnover_value"] = frame["amount"] * 1000.0
        frame["pct_change"] = frame["pct_chg"]
        frame["amplitude"] = np.where(
            frame["pre_close"].notna() & (frame["pre_close"] != 0),
            (frame["high"] - frame["low"]) / frame["pre_close"] * 100.0,
            np.nan,
        )
        frame["is_st"] = frame["name"].fillna("").str.upper().str.contains("ST", regex=False)
        frame["is_limit_up"] = np.where(
            frame["up_limit"].notna() & frame["close"].notna(),
            frame["close"] >= (frame["up_limit"] - 1e-9),
            False,
        )
        frame["total_shares"] = np.rint(frame["total_share"] * 10000.0)
        frame["float_shares"] = np.rint(frame["float_share"] * 10000.0)
        frame["total_market_cap"] = frame["total_mv"] * 10000.0
        frame["float_market_cap"] = frame["circ_mv"] * 10000.0
        frame["source_file"] = frame["trade_date"].dt.strftime(
            f"tushare://market_data/unadjusted/{year}/%Y-%m-%d"
        )
        for window in PRICE_WINDOWS:
            frame[f"ma_{window}"] = np.nan
        for _, column_name in RETURN_WINDOWS:
            frame[column_name] = np.nan
        return frame

    def _build_forward_frame(self, source_df: pd.DataFrame, year: int) -> pd.DataFrame:
        frame = self._build_unadjusted_frame(source_df, year)
        latest_factor_map = (
            source_df[["symbol", "trade_date", "adj_factor"]]
            .sort_values(["symbol", "trade_date"])
            .groupby("symbol", as_index=True)["adj_factor"]
            .last()
            .fillna(1.0)
            .to_dict()
        )
        current_factor = source_df["adj_factor"].fillna(1.0)
        latest_factor = source_df["symbol"].map(latest_factor_map).fillna(1.0)
        ratio = current_factor / latest_factor.replace(0, np.nan)
        ratio = ratio.replace([np.inf, -np.inf], np.nan).fillna(1.0)

        for column_name in ("open_price", "high_price", "low_price", "close_price", "prev_close_price"):
            frame[column_name] = frame[column_name] * ratio

        frame["adjustment_type"] = "forward_adjusted"
        frame["source_file"] = frame["trade_date"].dt.strftime(
            f"tushare://market_data/forward_adjusted/{year}/%Y-%m-%d"
        )
        return frame

    def _load_history_close_frame(
        self,
        *,
        price_kind: str,
        year: int,
        start_date: date,
        symbols: list[str],
    ) -> pd.DataFrame:
        table_candidates = [
            self._target_table_name(price_kind, year - 1),
            self._target_table_name(price_kind, year),
        ]
        frames: list[pd.DataFrame] = []
        for table_name in table_candidates:
            if not self.store.table_exists(self.store.target_schema, table_name):
                continue
            rows = self.store.fetch_all(
                f"""
                SELECT symbol, trade_date, close_price
                FROM {self.store.target_schema}.{table_name}
                WHERE trade_date < %s
                  AND symbol = ANY(%s)
                """,
                (start_date, symbols),
            )
            if rows:
                table_frame = pd.DataFrame(rows)
                table_frame["trade_date"] = pd.to_datetime(table_frame["trade_date"])
                table_frame["close_price"] = pd.to_numeric(table_frame["close_price"], errors="coerce")
                frames.append(table_frame)

        if not frames:
            return pd.DataFrame(columns=["symbol", "trade_date", "close_price"])

        history_df = pd.concat(frames, ignore_index=True)
        history_df = history_df.sort_values(["symbol", "trade_date"]).groupby("symbol", as_index=False).tail(250)
        return history_df.reset_index(drop=True)

    def _attach_price_metrics(self, history_df: pd.DataFrame, payload_df: pd.DataFrame) -> pd.DataFrame:
        history_stub = history_df[["symbol", "trade_date", "close_price"]].copy()
        history_stub["__is_new"] = False

        working_df = payload_df.copy()
        working_df["__is_new"] = True
        combined_df = pd.concat([history_stub, working_df], ignore_index=True, sort=False)
        combined_df = combined_df.sort_values(["symbol", "trade_date"]).reset_index(drop=True)

        grouped_close = combined_df.groupby("symbol", sort=False)["close_price"]
        for window in PRICE_WINDOWS:
            combined_df[f"ma_{window}"] = grouped_close.transform(
                lambda series, current_window=window: series.rolling(current_window, min_periods=current_window).mean()
            )
        for lag, column_name in RETURN_WINDOWS:
            combined_df[column_name] = grouped_close.transform(
                lambda series, current_lag=lag: (series / series.shift(current_lag) - 1.0) * 100.0
            )

        result_df = combined_df.loc[combined_df["__is_new"]].copy()
        result_df["trade_date"] = result_df["trade_date"].dt.date
        result_df["listing_date"] = pd.to_datetime(result_df["listing_date"], errors="coerce").dt.date
        result_df["delisting_date"] = pd.to_datetime(result_df["delisting_date"], errors="coerce").dt.date

        numeric_columns = [
            "open_price",
            "high_price",
            "low_price",
            "close_price",
            "prev_close_price",
            "turnover_value",
            "turnover_rate",
            "pct_change",
            "amplitude",
            "volume_ratio",
            "pct_change_3d",
            "pct_change_6d",
            "pct_change_10d",
            "pct_change_25d",
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
        for column_name in numeric_columns:
            result_df[column_name] = pd.to_numeric(result_df[column_name], errors="coerce").round(6)

        return result_df[TARGET_COLUMNS].reset_index(drop=True)

    def _replace_target_range(
        self,
        *,
        table_name: str,
        start_date: date,
        end_date: date,
        payload_df: pd.DataFrame,
    ) -> None:
        if not self.store.table_exists(self.store.target_schema, table_name):
            raise RuntimeError(f"Target table not found: {self.store.target_schema}.{table_name}")

        delete_sql = f"""
        DELETE FROM {self.store.target_schema}.{table_name}
        WHERE trade_date BETWEEN %s AND %s
        """
        insert_sql = f"""
        INSERT INTO {self.store.target_schema}.{table_name} (
            {", ".join(TARGET_COLUMNS)}
        ) VALUES (
            {", ".join(["%s"] * len(TARGET_COLUMNS))}
        )
        """
        records = [self._row_to_record(row) for row in payload_df.to_dict(orient="records")]

        with self.store.connect(autocommit=False) as conn:
            with conn.cursor() as cur:
                cur.execute(delete_sql, (start_date, end_date))
                for batch in chunked(records, max(1, int(self.args.batch_size))):
                    cur.executemany(insert_sql, batch)
            conn.commit()

    def _upsert_source_daily_rows(self, year: int, rows: list[dict[str, Any]]) -> int:
        if not rows:
            return 0
        table_name = self._source_table_name(year)
        sql = f"""
        INSERT INTO {self.store.source_schema}.{table_name} (
            ts_code,
            trade_date,
            open,
            high,
            low,
            close,
            pre_close,
            change_value,
            pct_chg,
            vol,
            amount
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        ON CONFLICT (ts_code, trade_date) DO UPDATE SET
            open = EXCLUDED.open,
            high = EXCLUDED.high,
            low = EXCLUDED.low,
            close = EXCLUDED.close,
            pre_close = EXCLUDED.pre_close,
            change_value = EXCLUDED.change_value,
            pct_chg = EXCLUDED.pct_chg,
            vol = EXCLUDED.vol,
            amount = EXCLUDED.amount,
            updated_at = CURRENT_TIMESTAMP
        """
        payloads = [
            (
                str_or_none(row.get("ts_code")),
                date_or_none(row.get("trade_date")),
                float_or_none(row.get("open")),
                float_or_none(row.get("high")),
                float_or_none(row.get("low")),
                float_or_none(row.get("close")),
                float_or_none(row.get("pre_close")),
                float_or_none(row.get("change") if row.get("change") is not None else row.get("change_value")),
                float_or_none(row.get("pct_chg")),
                float_or_none(row.get("vol")),
                float_or_none(row.get("amount")),
            )
            for row in rows
        ]
        self._execute_many(sql, payloads)
        return len(payloads)

    def _upsert_source_daily_basic_rows(self, rows: list[dict[str, Any]]) -> int:
        if not rows:
            return 0
        sql = f"""
        INSERT INTO {self.store.source_schema}.stock_daily_basic (
            ts_code,
            trade_date,
            close,
            turnover_rate,
            turnover_rate_f,
            volume_ratio,
            pe,
            pe_ttm,
            pb,
            ps,
            ps_ttm,
            dv_ratio,
            dv_ttm,
            total_share,
            float_share,
            free_share,
            total_mv,
            circ_mv
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        ON CONFLICT (ts_code, trade_date) DO UPDATE SET
            close = EXCLUDED.close,
            turnover_rate = EXCLUDED.turnover_rate,
            turnover_rate_f = EXCLUDED.turnover_rate_f,
            volume_ratio = EXCLUDED.volume_ratio,
            pe = EXCLUDED.pe,
            pe_ttm = EXCLUDED.pe_ttm,
            pb = EXCLUDED.pb,
            ps = EXCLUDED.ps,
            ps_ttm = EXCLUDED.ps_ttm,
            dv_ratio = EXCLUDED.dv_ratio,
            dv_ttm = EXCLUDED.dv_ttm,
            total_share = EXCLUDED.total_share,
            float_share = EXCLUDED.float_share,
            free_share = EXCLUDED.free_share,
            total_mv = EXCLUDED.total_mv,
            circ_mv = EXCLUDED.circ_mv,
            updated_at = CURRENT_TIMESTAMP
        """
        payloads = [
            (
                str_or_none(row.get("ts_code")),
                date_or_none(row.get("trade_date")),
                float_or_none(row.get("close")),
                float_or_none(row.get("turnover_rate")),
                float_or_none(row.get("turnover_rate_f")),
                float_or_none(row.get("volume_ratio")),
                float_or_none(row.get("pe")),
                float_or_none(row.get("pe_ttm")),
                float_or_none(row.get("pb")),
                float_or_none(row.get("ps")),
                float_or_none(row.get("ps_ttm")),
                float_or_none(row.get("dv_ratio")),
                float_or_none(row.get("dv_ttm")),
                float_or_none(row.get("total_share")),
                float_or_none(row.get("float_share")),
                float_or_none(row.get("free_share")),
                float_or_none(row.get("total_mv")),
                float_or_none(row.get("circ_mv")),
            )
            for row in rows
        ]
        self._execute_many(sql, payloads)
        return len(payloads)

    def _upsert_source_adj_factor_rows(self, rows: list[dict[str, Any]]) -> int:
        if not rows:
            return 0
        sql = f"""
        INSERT INTO {self.store.source_schema}.stock_adj_factor (
            ts_code,
            trade_date,
            adj_factor
        ) VALUES (
            %s, %s, %s
        )
        ON CONFLICT (ts_code, trade_date) DO UPDATE SET
            adj_factor = EXCLUDED.adj_factor,
            updated_at = CURRENT_TIMESTAMP
        """
        payloads = [
            (
                str_or_none(row.get("ts_code")),
                date_or_none(row.get("trade_date")),
                float_or_none(row.get("adj_factor")),
            )
            for row in rows
        ]
        self._execute_many(sql, payloads)
        return len(payloads)

    def _upsert_source_price_limit_rows(self, rows: list[dict[str, Any]]) -> int:
        if not rows:
            return 0
        sql = f"""
        INSERT INTO {self.store.source_schema}.stock_price_limit (
            ts_code,
            trade_date,
            up_limit,
            down_limit
        ) VALUES (
            %s, %s, %s, %s
        )
        ON CONFLICT (ts_code, trade_date) DO UPDATE SET
            up_limit = EXCLUDED.up_limit,
            down_limit = EXCLUDED.down_limit,
            updated_at = CURRENT_TIMESTAMP
        """
        payloads = [
            (
                str_or_none(row.get("ts_code")),
                date_or_none(row.get("trade_date")),
                float_or_none(row.get("up_limit")),
                float_or_none(row.get("down_limit")),
            )
            for row in rows
        ]
        self._execute_many(sql, payloads)
        return len(payloads)

    def _execute_many(self, sql: str, payloads: list[tuple[Any, ...]]) -> None:
        if not payloads:
            return
        with self.store.connect(autocommit=False) as conn:
            with conn.cursor() as cur:
                for batch in chunked(payloads, max(1, int(self.args.batch_size))):
                    cur.executemany(sql, batch)
            conn.commit()

    def _row_to_record(self, row: dict[str, Any]) -> tuple[Any, ...]:
        return (
            date_or_none(row.get("trade_date")),
            str_or_none(row.get("symbol")),
            str_or_none(row.get("name")),
            str_or_none(row.get("industry")),
            row.get("adjustment_type"),
            row.get("source_layout"),
            float_or_none(row.get("open_price")),
            float_or_none(row.get("high_price")),
            float_or_none(row.get("low_price")),
            float_or_none(row.get("close_price")),
            float_or_none(row.get("prev_close_price")),
            int_or_none(row.get("volume_shares")),
            float_or_none(row.get("turnover_value")),
            float_or_none(row.get("turnover_rate")),
            float_or_none(row.get("pct_change")),
            float_or_none(row.get("amplitude")),
            bool(row.get("is_st")) if row.get("is_st") is not None else False,
            float_or_none(row.get("volume_ratio")),
            float_or_none(row.get("pct_change_3d")),
            float_or_none(row.get("pct_change_6d")),
            float_or_none(row.get("pct_change_10d")),
            float_or_none(row.get("pct_change_25d")),
            bool(row.get("is_limit_up")) if row.get("is_limit_up") is not None else False,
            int_or_none(row.get("total_shares")),
            int_or_none(row.get("float_shares")),
            float_or_none(row.get("total_market_cap")),
            float_or_none(row.get("float_market_cap")),
            float_or_none(row.get("pe_ttm")),
            float_or_none(row.get("pb")),
            float_or_none(row.get("ps_ttm")),
            float_or_none(row.get("ma_5")),
            float_or_none(row.get("ma_10")),
            float_or_none(row.get("ma_20")),
            float_or_none(row.get("ma_30")),
            float_or_none(row.get("ma_60")),
            float_or_none(row.get("ma_120")),
            float_or_none(row.get("ma_250")),
            date_or_none(row.get("listing_date")),
            date_or_none(row.get("delisting_date")),
            str_or_none(row.get("source_file")),
        )

    @staticmethod
    def _source_table_name(year: int) -> str:
        return f"stock_daily_unadjusted_{year}"

    @staticmethod
    def _target_unadjusted_table_name(year: int) -> str:
        return f"stock_daily_unadjusted_{year}"

    @staticmethod
    def _target_forward_table_name(year: int) -> str:
        return f"stock_daily_forward_adjusted_{year}"

    def _target_table_name(self, price_kind: str, year: int) -> str:
        if price_kind == "unadjusted":
            return self._target_unadjusted_table_name(year)
        if price_kind == "forward_adjusted":
            return self._target_forward_table_name(year)
        raise ValueError(f"Unsupported price kind: {price_kind}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Backfill tushare daily data into quant.market_data and generate forward-adjusted rows."
    )
    parser.add_argument("--db-host", default=DEFAULT_DB_HOST)
    parser.add_argument("--db-port", type=int, default=DEFAULT_DB_PORT)
    parser.add_argument("--db-user", default=DEFAULT_DB_USER)
    parser.add_argument("--db-password", default=DEFAULT_DB_PASSWORD)
    parser.add_argument("--db-name", default=DEFAULT_DB_NAME)
    parser.add_argument("--source-schema", default=DEFAULT_SOURCE_SCHEMA)
    parser.add_argument("--target-schema", default=DEFAULT_TARGET_SCHEMA)
    parser.add_argument("--tushare-token")
    parser.add_argument("--tushare-http-url", default=DEFAULT_TUSHARE_HTTP_URL)
    parser.add_argument("--year", action="append", type=int)
    parser.add_argument("--start-date")
    parser.add_argument("--end-date")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--dry-run", action="store_true")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    payload = MarketDataBackfillRunner(args).run()
    print(json.dumps(payload, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
