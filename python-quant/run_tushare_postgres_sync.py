from __future__ import annotations

import argparse
import hashlib
import json
import logging
import math
import os
import re
import sys
import time
import traceback
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

import psycopg
from psycopg.rows import dict_row
import tushare as ts


DEFAULT_DB_HOST = "127.0.0.1"
DEFAULT_DB_PORT = 5432
DEFAULT_DB_USER = "postgres"
DEFAULT_DB_PASSWORD = ""
DEFAULT_DB_NAME = "quant"
DEFAULT_DB_SCHEMA = "tushare_data"
DEFAULT_MARKET_DATA_SCHEMA = "market_data"
DEFAULT_TUSHARE_HTTP_URL = "http://tsy.xiaodefa.cn"
DEFAULT_FULL_START_DATE = "20000101"
DEFAULT_TUSHARE_PAUSE_MS = 350
DEFAULT_DB_CONNECT_TIMEOUT_SECONDS = 30
DEFAULT_DB_CONNECT_RETRIES = 5
DEFAULT_DB_CONNECT_RETRY_SLEEP_SECONDS = 2.0
DEFAULT_STK_MINS_TRADE_DAYS = 1
DEFAULT_STK_MINS_FULL_BACKFILL_TRADE_DAYS = 5
DEFAULT_REFRESH_ANALYTICS_VIEWS = False
ALL_SYNC_GROUPS = (
    "reference",
    "klineDaily",
    "marketRaw",
    "announcementRaw",
    "contentRaw",
    "rangeRaw",
    "independentApis",
    "financialStatements",
    "symbolExtras",
)


@dataclass(frozen=True)
class RawTradeDateSpec:
    name: str
    api_name: str
    dataset_key: str
    extra_params: tuple[tuple[str, str], ...] = ()


@dataclass(frozen=True)
class RawCalendarDateSpec:
    name: str
    api_name: str
    dataset_key: str
    date_param: str = "date"
    extra_params: tuple[tuple[str, str], ...] = ()


@dataclass(frozen=True)
class RawRangeSpec:
    name: str
    api_name: str
    dataset_key: str
    start_param: str = "start_date"
    end_param: str = "end_date"
    extra_params: tuple[tuple[str, str], ...] = ()


@dataclass(frozen=True)
class SymbolFinancialSpec:
    name: str
    api_name: str
    target_table: str


@dataclass(frozen=True)
class SymbolRawSpec:
    name: str
    api_name: str
    dataset_key: str
    start_param: str | None = "start_date"
    end_param: str | None = "end_date"
    extra_params: tuple[tuple[str, str], ...] = ()


RAW_TRADE_DATE_SPECS: tuple[RawTradeDateSpec, ...] = (
    RawTradeDateSpec("daily_basic", "daily_basic", "daily_basic"),
    RawTradeDateSpec("moneyflow", "moneyflow", "moneyflow"),
    RawTradeDateSpec("bak_daily", "bak_daily", "bak_daily"),
    RawTradeDateSpec("cyq_perf", "cyq_perf", "cyq_perf"),
    RawTradeDateSpec("stk_nineturn", "stk_nineturn", "stk_nineturn"),
    RawTradeDateSpec("stk_limit", "stk_limit", "stk_limit"),
    RawTradeDateSpec("suspend_d", "suspend_d", "suspend_d"),
    RawTradeDateSpec("stk_auction_o", "stk_auction_o", "stk_auction_o"),
    RawTradeDateSpec("stk_auction_c", "stk_auction_c", "stk_auction_c"),
    RawTradeDateSpec("top_list", "top_list", "top_list"),
    RawTradeDateSpec("top_inst", "top_inst", "top_inst"),
    RawTradeDateSpec("margin", "margin", "margin"),
    RawTradeDateSpec("margin_detail", "margin_detail", "margin_detail"),
    RawTradeDateSpec("margin_secs", "margin_secs", "margin_secs"),
    RawTradeDateSpec("hk_hold", "hk_hold", "hk_hold"),
    RawTradeDateSpec("hsgt_top10_sh", "hsgt_top10", "hsgt_top10_sh", (("market_type", "1"),)),
    RawTradeDateSpec("hsgt_top10_sz", "hsgt_top10", "hsgt_top10_sz", (("market_type", "3"),)),
)

RAW_ANN_DATE_SPECS: tuple[RawCalendarDateSpec, ...] = (
    RawCalendarDateSpec("forecast", "forecast", "forecast", "ann_date"),
    RawCalendarDateSpec("express", "express", "express", "ann_date"),
    RawCalendarDateSpec("dividend", "dividend", "dividend", "ann_date"),
    RawCalendarDateSpec("stk_holdernumber", "stk_holdernumber", "stk_holdernumber", "ann_date"),
    RawCalendarDateSpec("top10_holders", "top10_holders", "top10_holders", "ann_date"),
    RawCalendarDateSpec("top10_floatholders", "top10_floatholders", "top10_floatholders", "ann_date"),
    RawCalendarDateSpec("stk_holdertrade", "stk_holdertrade", "stk_holdertrade", "ann_date"),
)

RAW_CALENDAR_SPECS: tuple[RawCalendarDateSpec, ...] = (
    RawCalendarDateSpec("cctv_news", "cctv_news", "cctv_news"),
    RawCalendarDateSpec("index_global", "index_global", "index_global"),
)

RAW_RANGE_SPECS: tuple[RawRangeSpec, ...] = (
    RawRangeSpec("report_rc", "report_rc", "report_rc"),
    RawRangeSpec("moneyflow_hsgt", "moneyflow_hsgt", "moneyflow_hsgt"),
    RawRangeSpec("block_trade", "block_trade", "block_trade"),
    RawRangeSpec("repurchase", "repurchase", "repurchase"),
)

SYMBOL_FINANCIAL_SPECS: tuple[SymbolFinancialSpec, ...] = (
    SymbolFinancialSpec("income", "income", "stock_income"),
    SymbolFinancialSpec("balancesheet", "balancesheet", "stock_balancesheet"),
    SymbolFinancialSpec("cashflow", "cashflow", "stock_cashflow"),
    SymbolFinancialSpec("fina_indicator", "fina_indicator", "stock_fina_indicator"),
)

SYMBOL_RAW_SPECS: tuple[SymbolRawSpec, ...] = (
    SymbolRawSpec("fina_audit", "fina_audit", "fina_audit"),
    SymbolRawSpec("fina_mainbz_product", "fina_mainbz", "fina_mainbz_product", extra_params=(("type", "P"),)),
    SymbolRawSpec("fina_mainbz_region", "fina_mainbz", "fina_mainbz_region", extra_params=(("type", "D"),)),
    SymbolRawSpec("pledge_stat", "pledge_stat", "pledge_stat", start_param=None, end_param=None),
    SymbolRawSpec("pledge_detail", "pledge_detail", "pledge_detail", start_param=None, end_param=None),
)
RAW_TRADE_DATE_DATASET_NAMES = tuple(spec.name for spec in RAW_TRADE_DATE_SPECS)
RAW_ANN_DATASET_NAMES = tuple(spec.name for spec in RAW_ANN_DATE_SPECS)
RAW_CALENDAR_DATASET_NAMES = tuple(spec.name for spec in RAW_CALENDAR_SPECS)
RAW_RANGE_DATASET_NAMES = tuple(spec.name for spec in RAW_RANGE_SPECS)
SYMBOL_FINANCIAL_DATASET_NAMES = tuple(spec.name for spec in SYMBOL_FINANCIAL_SPECS)
SYMBOL_RAW_DATASET_NAMES = tuple(spec.name for spec in SYMBOL_RAW_SPECS)


class TushareGateway:
    def __init__(self, token: str, http_url: str) -> None:
        self._ensure_no_proxy_for_host(http_url)
        ts.set_token(token)
        self.pro = ts.pro_api(token)
        self.pro._DataApi__token = token
        self.pro._DataApi__http_url = http_url

    @staticmethod
    def _ensure_no_proxy_for_host(http_url: str) -> None:
        parsed = urlparse(http_url or "")
        host = (parsed.hostname or "").strip()
        if not host:
            return

        existing = os.environ.get("NO_PROXY") or os.environ.get("no_proxy") or ""
        entries = [item.strip() for item in existing.split(",") if item.strip()]
        lowered = {item.lower() for item in entries}
        if host.lower() not in lowered:
            entries.append(host)
        joined = ",".join(entries)
        os.environ["NO_PROXY"] = joined
        os.environ["no_proxy"] = joined

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


class PostgresQuantStore:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.schema = validate_identifier(args.db_schema, "schema")
        self.market_data_schema = validate_optional_identifier(getattr(args, "market_data_schema", None), "market data schema")

    def connect(self) -> psycopg.Connection[Any]:
        retries = max(1, int(getattr(self.args, "db_connect_retries", DEFAULT_DB_CONNECT_RETRIES)))
        connect_timeout = max(1, int(getattr(self.args, "db_connect_timeout", DEFAULT_DB_CONNECT_TIMEOUT_SECONDS)))
        retry_sleep = max(0.0, float(getattr(self.args, "db_connect_retry_sleep", DEFAULT_DB_CONNECT_RETRY_SLEEP_SECONDS)))
        last_error: Exception | None = None
        for attempt in range(1, retries + 1):
            try:
                return psycopg.connect(
                    host=self.args.db_host,
                    port=self.args.db_port,
                    user=self.args.db_user,
                    password=self.args.db_password,
                    dbname=self.args.db_name,
                    connect_timeout=connect_timeout,
                    row_factory=dict_row,
                    autocommit=True,
                )
            except psycopg.Error as exc:
                last_error = exc
                if attempt >= retries:
                    break
                time.sleep(retry_sleep)
        raise last_error or RuntimeError("Unable to connect to PostgreSQL")

    def execute(self, sql: str, params: tuple[Any, ...] | None = None) -> int:
        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params or ())
                return cur.rowcount or 0

    def fetch_all(self, sql: str, params: tuple[Any, ...] | None = None) -> list[dict[str, Any]]:
        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params or ())
                return list(cur.fetchall())

    def fetch_one(self, sql: str, params: tuple[Any, ...] | None = None) -> dict[str, Any] | None:
        rows = self.fetch_all(sql, params)
        return rows[0] if rows else None

    def execute_many(self, sql: str, payloads: list[tuple[Any, ...]]) -> int:
        if not payloads:
            return 0
        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.executemany(sql, payloads)
                return cur.rowcount or 0

    def ensure_base_tables(self) -> None:
        self.execute(f"CREATE SCHEMA IF NOT EXISTS {self.schema}")
        ddl = [
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.sync_job_runs (
                job_id TEXT PRIMARY KEY,
                mode TEXT NOT NULL,
                status TEXT NOT NULL,
                db_name TEXT NOT NULL,
                schema_name TEXT NOT NULL,
                current_group TEXT,
                started_at TIMESTAMP NOT NULL,
                finished_at TIMESTAMP,
                report_path TEXT,
                log_path TEXT,
                state_path TEXT,
                error_message TEXT,
                payload_json JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"CREATE INDEX IF NOT EXISTS idx_sync_job_runs_status_started ON {self.schema}.sync_job_runs(status, started_at DESC)",
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.sync_job_progress (
                job_id TEXT NOT NULL,
                group_name TEXT NOT NULL,
                progress_json JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (job_id, group_name),
                CONSTRAINT fk_sync_job_progress_job
                    FOREIGN KEY (job_id)
                    REFERENCES {self.schema}.sync_job_runs(job_id)
                    ON DELETE CASCADE
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.stock_basic (
                ts_code TEXT PRIMARY KEY,
                symbol TEXT,
                name TEXT,
                area TEXT,
                industry TEXT,
                fullname TEXT,
                enname TEXT,
                market TEXT,
                exchange TEXT,
                curr_type TEXT,
                list_status TEXT,
                list_date DATE,
                delist_date DATE,
                is_hs TEXT,
                act_name TEXT,
                act_ent_type TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"CREATE INDEX IF NOT EXISTS idx_stock_basic_symbol ON {self.schema}.stock_basic(symbol)",
            f"CREATE INDEX IF NOT EXISTS idx_stock_basic_list_status ON {self.schema}.stock_basic(list_status)",
            f"CREATE INDEX IF NOT EXISTS idx_stock_basic_list_date ON {self.schema}.stock_basic(list_date)",
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.trade_cal (
                exchange TEXT NOT NULL,
                cal_date DATE NOT NULL,
                is_open SMALLINT,
                pretrade_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (exchange, cal_date)
            )
            """,
            f"CREATE INDEX IF NOT EXISTS idx_trade_cal_open_date ON {self.schema}.trade_cal(is_open, cal_date)",
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.stock_adj_factor (
                ts_code TEXT NOT NULL,
                trade_date DATE NOT NULL,
                adj_factor NUMERIC(24, 10),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code, trade_date)
            )
            """,
            f"CREATE INDEX IF NOT EXISTS idx_stock_adj_factor_trade_date ON {self.schema}.stock_adj_factor(trade_date)",
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.tushare_raw_data (
                id BIGSERIAL PRIMARY KEY,
                dataset_key TEXT NOT NULL,
                scope_key TEXT,
                ts_code TEXT,
                entity_key TEXT,
                trade_date DATE,
                end_date DATE,
                ann_date DATE,
                raw_json JSONB NOT NULL,
                source TEXT,
                dedupe_key TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"CREATE INDEX IF NOT EXISTS idx_tushare_raw_lookup ON {self.schema}.tushare_raw_data(dataset_key, ts_code, trade_date, end_date, ann_date)",
            f"CREATE INDEX IF NOT EXISTS idx_tushare_raw_entity ON {self.schema}.tushare_raw_data(dataset_key, entity_key)",
            f"CREATE INDEX IF NOT EXISTS idx_tushare_raw_trade_date ON {self.schema}.tushare_raw_data(dataset_key, trade_date)",
            f"CREATE INDEX IF NOT EXISTS idx_tushare_raw_ann_date ON {self.schema}.tushare_raw_data(dataset_key, ann_date)",
            f"CREATE INDEX IF NOT EXISTS idx_tushare_raw_end_date ON {self.schema}.tushare_raw_data(dataset_key, end_date)",
            f"CREATE INDEX IF NOT EXISTS idx_tushare_raw_json ON {self.schema}.tushare_raw_data USING GIN(raw_json)",
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.stock_minute_1m (
                ts_code TEXT NOT NULL,
                trade_time TIMESTAMP NOT NULL,
                open NUMERIC(20, 6),
                high NUMERIC(20, 6),
                low NUMERIC(20, 6),
                close NUMERIC(20, 6),
                vol NUMERIC(24, 6),
                amount NUMERIC(24, 6),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code, trade_time)
            )
            """,
            f"CREATE INDEX IF NOT EXISTS idx_stock_minute_1m_trade_time ON {self.schema}.stock_minute_1m(trade_time)",
            f"CREATE INDEX IF NOT EXISTS idx_stock_minute_1m_trade_date_symbol ON {self.schema}.stock_minute_1m((trade_time::date), ts_code)",
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.stock_daily_basic (
                ts_code TEXT NOT NULL,
                trade_date DATE NOT NULL,
                close NUMERIC(20, 6),
                turnover_rate NUMERIC(20, 6),
                turnover_rate_f NUMERIC(20, 6),
                volume_ratio NUMERIC(20, 6),
                pe NUMERIC(24, 8),
                pe_ttm NUMERIC(24, 8),
                pb NUMERIC(24, 8),
                ps NUMERIC(24, 8),
                ps_ttm NUMERIC(24, 8),
                dv_ratio NUMERIC(20, 6),
                dv_ttm NUMERIC(20, 6),
                total_share NUMERIC(24, 6),
                float_share NUMERIC(24, 6),
                free_share NUMERIC(24, 6),
                total_mv NUMERIC(24, 6),
                circ_mv NUMERIC(24, 6),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code, trade_date)
            )
            """,
            f"CREATE INDEX IF NOT EXISTS idx_stock_daily_basic_trade_date ON {self.schema}.stock_daily_basic(trade_date)",
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.stock_moneyflow (
                ts_code TEXT NOT NULL,
                trade_date DATE NOT NULL,
                buy_sm_vol NUMERIC(24, 6),
                buy_sm_amount NUMERIC(24, 6),
                sell_sm_vol NUMERIC(24, 6),
                sell_sm_amount NUMERIC(24, 6),
                buy_md_vol NUMERIC(24, 6),
                buy_md_amount NUMERIC(24, 6),
                sell_md_vol NUMERIC(24, 6),
                sell_md_amount NUMERIC(24, 6),
                buy_lg_vol NUMERIC(24, 6),
                buy_lg_amount NUMERIC(24, 6),
                sell_lg_vol NUMERIC(24, 6),
                sell_lg_amount NUMERIC(24, 6),
                buy_elg_vol NUMERIC(24, 6),
                buy_elg_amount NUMERIC(24, 6),
                sell_elg_vol NUMERIC(24, 6),
                sell_elg_amount NUMERIC(24, 6),
                net_mf_vol NUMERIC(24, 6),
                net_mf_amount NUMERIC(24, 6),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code, trade_date)
            )
            """,
            f"CREATE INDEX IF NOT EXISTS idx_stock_moneyflow_trade_date ON {self.schema}.stock_moneyflow(trade_date)",
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.stock_cyq_perf (
                ts_code TEXT NOT NULL,
                trade_date DATE NOT NULL,
                his_low NUMERIC(20, 6),
                his_high NUMERIC(20, 6),
                cost_5pct NUMERIC(20, 6),
                cost_15pct NUMERIC(20, 6),
                cost_50pct NUMERIC(20, 6),
                cost_85pct NUMERIC(20, 6),
                cost_95pct NUMERIC(20, 6),
                weight_avg NUMERIC(20, 6),
                winner_rate NUMERIC(20, 6),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code, trade_date)
            )
            """,
            f"CREATE INDEX IF NOT EXISTS idx_stock_cyq_perf_trade_date ON {self.schema}.stock_cyq_perf(trade_date)",
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.stock_price_limit (
                ts_code TEXT NOT NULL,
                trade_date DATE NOT NULL,
                up_limit NUMERIC(20, 6),
                down_limit NUMERIC(20, 6),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code, trade_date)
            )
            """,
            f"CREATE INDEX IF NOT EXISTS idx_stock_price_limit_trade_date ON {self.schema}.stock_price_limit(trade_date)",
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.stock_auction_open (
                ts_code TEXT NOT NULL,
                trade_date DATE NOT NULL,
                close NUMERIC(20, 6),
                open NUMERIC(20, 6),
                high NUMERIC(20, 6),
                low NUMERIC(20, 6),
                vol NUMERIC(24, 6),
                amount NUMERIC(24, 6),
                vwap NUMERIC(20, 6),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code, trade_date)
            )
            """,
            f"CREATE INDEX IF NOT EXISTS idx_stock_auction_open_trade_date ON {self.schema}.stock_auction_open(trade_date)",
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.stock_auction_close (
                ts_code TEXT NOT NULL,
                trade_date DATE NOT NULL,
                close NUMERIC(20, 6),
                open NUMERIC(20, 6),
                high NUMERIC(20, 6),
                low NUMERIC(20, 6),
                vol NUMERIC(24, 6),
                amount NUMERIC(24, 6),
                vwap NUMERIC(20, 6),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code, trade_date)
            )
            """,
            f"CREATE INDEX IF NOT EXISTS idx_stock_auction_close_trade_date ON {self.schema}.stock_auction_close(trade_date)",
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.stock_nineturn (
                ts_code TEXT NOT NULL,
                trade_date DATE NOT NULL,
                freq TEXT NOT NULL DEFAULT 'daily',
                open NUMERIC(20, 6),
                high NUMERIC(20, 6),
                low NUMERIC(20, 6),
                close NUMERIC(20, 6),
                vol NUMERIC(24, 6),
                amount NUMERIC(24, 6),
                up_count INTEGER,
                down_count INTEGER,
                nine_up_turn NUMERIC(20, 6),
                nine_down_turn NUMERIC(20, 6),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code, trade_date, freq)
            )
            """,
            f"CREATE INDEX IF NOT EXISTS idx_stock_nineturn_trade_date ON {self.schema}.stock_nineturn(trade_date)",
        ]
        for table_name in ("stock_income", "stock_balancesheet", "stock_cashflow", "stock_fina_indicator"):
            ddl.append(
                f"""
                CREATE TABLE IF NOT EXISTS {self.schema}.{table_name} (
                    ts_code TEXT NOT NULL,
                    ann_date DATE,
                    f_ann_date DATE,
                    end_date DATE NOT NULL,
                    report_type TEXT NOT NULL DEFAULT '',
                    comp_type TEXT,
                    end_type TEXT,
                    raw_json JSONB NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (ts_code, end_date, ann_date, report_type)
                )
                """
            )
            ddl.append(f"CREATE INDEX IF NOT EXISTS idx_{table_name}_end_date ON {self.schema}.{table_name}(end_date)")
            ddl.append(f"CREATE INDEX IF NOT EXISTS idx_{table_name}_ann_date ON {self.schema}.{table_name}(ann_date)")
        for sql in ddl:
            self.execute(sql)
        self.refresh_job_views()
        if getattr(self.args, "refresh_analytics_views", DEFAULT_REFRESH_ANALYTICS_VIEWS):
            self.refresh_analytics_views()

    def ensure_kline_table(self, year_suffix: str) -> str:
        table_name = f"stock_daily_unadjusted_20{year_suffix}"
        self.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.{table_name} (
                ts_code TEXT NOT NULL,
                trade_date DATE NOT NULL,
                open NUMERIC(20, 6),
                high NUMERIC(20, 6),
                low NUMERIC(20, 6),
                close NUMERIC(20, 6),
                pre_close NUMERIC(20, 6),
                change_value NUMERIC(20, 6),
                pct_chg NUMERIC(20, 6),
                vol NUMERIC(24, 6),
                amount NUMERIC(24, 6),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code, trade_date)
            )
            """
        )
        self.execute(f"CREATE INDEX IF NOT EXISTS idx_{table_name}_trade_date ON {self.schema}.{table_name}(trade_date)")
        return table_name

    def refresh_analytics_views(self) -> None:
        union_sql = self._build_union_view_sql()
        enriched_sql = self._build_enriched_view_sql()
        snapshot_sql = self._build_snapshot_view_sql()
        self.execute(f"DROP VIEW IF EXISTS {self.schema}.vw_stock_daily_snapshot")
        self.execute(f"DROP VIEW IF EXISTS {self.schema}.vw_stock_daily_enriched_all")
        self.execute(f"DROP VIEW IF EXISTS {self.schema}.vw_stock_daily_unadjusted_all")
        self.execute(
            f"""
            CREATE VIEW {self.schema}.vw_stock_daily_unadjusted_all AS
            {union_sql}
            """
        )
        self.execute(
            f"""
            CREATE VIEW {self.schema}.vw_stock_daily_enriched_all AS
            {enriched_sql}
            """
        )
        self.execute(
            f"""
            CREATE VIEW {self.schema}.vw_stock_daily_snapshot AS
            {snapshot_sql}
            """
        )

    def refresh_job_views(self) -> None:
        self.execute(f"DROP VIEW IF EXISTS {self.schema}.vw_sync_job_latest")
        self.execute(
            f"""
            CREATE VIEW {self.schema}.vw_sync_job_latest AS
            SELECT
                r.job_id,
                r.mode,
                r.status,
                r.db_name,
                r.schema_name,
                r.current_group,
                r.started_at,
                r.finished_at,
                r.report_path,
                r.log_path,
                r.state_path,
                r.error_message,
                r.payload_json,
                p.group_name,
                p.progress_json,
                p.updated_at AS progress_updated_at
            FROM {self.schema}.sync_job_runs r
            LEFT JOIN LATERAL (
                SELECT group_name, progress_json, updated_at
                FROM {self.schema}.sync_job_progress sp
                WHERE sp.job_id = r.job_id
                ORDER BY updated_at DESC, group_name DESC
                LIMIT 1
            ) p ON TRUE
            WHERE r.started_at = (
                SELECT MAX(r2.started_at)
                FROM {self.schema}.sync_job_runs r2
            )
            """
        )

    def _external_market_data_tables(self) -> list[str]:
        if not self.market_data_schema:
            return []
        rows = self.fetch_all(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_name ~ '^stock_daily_unadjusted_[0-9]{4}$'
            ORDER BY table_name
            """,
            (self.market_data_schema,),
        )
        return [str(row["table_name"]) for row in rows if row.get("table_name")]

    def _local_market_data_tables(self) -> list[str]:
        rows = self.fetch_all(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_name ~ '^stock_daily_unadjusted_[0-9]{4}$'
            ORDER BY table_name
            """,
            (self.schema,),
        )
        return [str(row["table_name"]) for row in rows if row.get("table_name")]

    def _build_union_view_sql(self) -> str:
        external_table_names = self._external_market_data_tables()
        local_table_names = self._local_market_data_tables()
        if not external_table_names and not local_table_names:
            return """
            SELECT
                CAST(NULL AS TEXT) AS ts_code,
                CAST(NULL AS DATE) AS trade_date,
                CAST(NULL AS TEXT) AS source_table,
                CAST(NULL AS NUMERIC(20, 6)) AS open,
                CAST(NULL AS NUMERIC(20, 6)) AS high,
                CAST(NULL AS NUMERIC(20, 6)) AS low,
                CAST(NULL AS NUMERIC(20, 6)) AS close,
                CAST(NULL AS NUMERIC(20, 6)) AS pre_close,
                CAST(NULL AS NUMERIC(20, 6)) AS change_value,
                CAST(NULL AS NUMERIC(20, 6)) AS pct_chg,
                CAST(NULL AS NUMERIC(24, 6)) AS vol,
                CAST(NULL AS NUMERIC(24, 6)) AS amount,
                CAST(NULL AS TIMESTAMP) AS created_at,
                CAST(NULL AS TIMESTAMP) AS updated_at
            WHERE FALSE
            """
        selects: list[str] = []
        if self.market_data_schema:
            selects.extend(
                [
                    f"""
                    SELECT
                        {market_data_symbol_to_ts_code_sql('m.symbol')} AS ts_code,
                        m.trade_date,
                        '{self.market_data_schema}.{table_name}'::text AS source_table,
                        m.open_price AS open,
                        m.high_price AS high,
                        m.low_price AS low,
                        m.close_price AS close,
                        m.prev_close_price AS pre_close,
                        (
                            CASE
                                WHEN m.prev_close_price IS NULL THEN NULL
                                ELSE m.close_price - m.prev_close_price
                            END
                        ) AS change_value,
                        m.pct_change AS pct_chg,
                        m.volume_shares::numeric AS vol,
                        m.turnover_value AS amount,
                        NULL::timestamp AS created_at,
                        NULL::timestamp AS updated_at
                    FROM {self.market_data_schema}.{table_name} m
                    """
                    for table_name in external_table_names
                ]
            )
        selects.extend(
            [
                f"""
                SELECT
                    l.ts_code, l.trade_date, '{self.schema}.{table_name}'::text AS source_table,
                    l.open, l.high, l.low, l.close, l.pre_close,
                    l.change_value, l.pct_chg, l.vol, l.amount, l.created_at, l.updated_at
                FROM {self.schema}.{table_name} l
                {"WHERE NOT EXISTS (SELECT 1 FROM " + self.market_data_schema + "." + table_name + " m WHERE " + market_data_symbol_to_ts_code_sql("m.symbol") + " = l.ts_code AND m.trade_date = l.trade_date)" if self.market_data_schema and table_name in external_table_names else ""}
                """
                for table_name in local_table_names
            ]
        )
        return "\nUNION ALL\n".join(selects)

    def _build_enriched_view_sql(self) -> str:
        return f"""
        SELECT
            q.ts_code,
            q.trade_date,
            q.source_table,
            q.open,
            q.high,
            q.low,
            q.close,
            q.pre_close,
            q.change_value,
            q.pct_chg,
            q.vol,
            q.amount,
            s.symbol,
            s.name,
            s.area,
            s.industry,
            s.market,
            s.exchange,
            s.list_status,
            s.list_date,
            d.turnover_rate,
            d.turnover_rate_f,
            d.volume_ratio,
            d.pe,
            d.pe_ttm,
            d.pb,
            d.ps,
            d.ps_ttm,
            d.dv_ratio,
            d.dv_ttm,
            d.total_share,
            d.float_share,
            d.free_share,
            d.total_mv,
            d.circ_mv,
            mf.buy_sm_amount,
            mf.sell_sm_amount,
            mf.buy_md_amount,
            mf.sell_md_amount,
            mf.buy_lg_amount,
            mf.sell_lg_amount,
            mf.buy_elg_amount,
            mf.sell_elg_amount,
            mf.net_mf_amount,
            cyq.his_low,
            cyq.his_high,
            cyq.cost_5pct,
            cyq.cost_15pct,
            cyq.cost_50pct,
            cyq.cost_85pct,
            cyq.cost_95pct,
            cyq.weight_avg,
            cyq.winner_rate,
            lim.up_limit,
            lim.down_limit,
            ao.vwap AS auction_open_vwap,
            ac.vwap AS auction_close_vwap,
            nt.freq AS nineturn_freq,
            nt.up_count,
            nt.down_count,
            nt.nine_up_turn,
            nt.nine_down_turn
        FROM {self.schema}.vw_stock_daily_unadjusted_all q
        LEFT JOIN {self.schema}.stock_basic s
            ON s.ts_code = q.ts_code
        LEFT JOIN {self.schema}.stock_daily_basic d
            ON d.ts_code = q.ts_code
           AND d.trade_date = q.trade_date
        LEFT JOIN {self.schema}.stock_moneyflow mf
            ON mf.ts_code = q.ts_code
           AND mf.trade_date = q.trade_date
        LEFT JOIN {self.schema}.stock_cyq_perf cyq
            ON cyq.ts_code = q.ts_code
           AND cyq.trade_date = q.trade_date
        LEFT JOIN {self.schema}.stock_price_limit lim
            ON lim.ts_code = q.ts_code
           AND lim.trade_date = q.trade_date
        LEFT JOIN {self.schema}.stock_auction_open ao
            ON ao.ts_code = q.ts_code
           AND ao.trade_date = q.trade_date
        LEFT JOIN {self.schema}.stock_auction_close ac
            ON ac.ts_code = q.ts_code
           AND ac.trade_date = q.trade_date
        LEFT JOIN {self.schema}.stock_nineturn nt
            ON nt.ts_code = q.ts_code
           AND nt.trade_date = q.trade_date
           AND nt.freq = 'daily'
        """

    def _build_snapshot_view_sql(self) -> str:
        return f"""
        WITH latest_trade AS (
            SELECT
                ts_code,
                MAX(trade_date) AS trade_date
            FROM {self.schema}.vw_stock_daily_unadjusted_all
            GROUP BY ts_code
        )
        SELECT
            q.ts_code,
            q.trade_date,
            q.source_table,
            q.open,
            q.high,
            q.low,
            q.close,
            q.pre_close,
            q.change_value,
            q.pct_chg,
            q.vol,
            q.amount,
            s.symbol,
            s.name,
            s.area,
            s.industry,
            s.market,
            s.exchange,
            s.list_status,
            s.list_date,
            d.turnover_rate,
            d.turnover_rate_f,
            d.volume_ratio,
            d.pe,
            d.pe_ttm,
            d.pb,
            d.ps,
            d.ps_ttm,
            d.total_share,
            d.float_share,
            d.free_share,
            d.total_mv,
            d.circ_mv,
            mf.net_mf_amount,
            mf.buy_lg_amount,
            mf.sell_lg_amount,
            cyq.weight_avg,
            cyq.winner_rate,
            lim.up_limit,
            lim.down_limit,
            ao.vwap AS auction_open_vwap,
            ac.vwap AS auction_close_vwap,
            nt.freq AS nineturn_freq,
            nt.up_count,
            nt.down_count,
            nt.nine_up_turn,
            nt.nine_down_turn
        FROM latest_trade picked
        INNER JOIN {self.schema}.vw_stock_daily_unadjusted_all q
            ON q.ts_code = picked.ts_code
           AND q.trade_date = picked.trade_date
        LEFT JOIN {self.schema}.stock_basic s
            ON s.ts_code = q.ts_code
        LEFT JOIN {self.schema}.stock_daily_basic d
            ON d.ts_code = q.ts_code
           AND d.trade_date = q.trade_date
        LEFT JOIN {self.schema}.stock_moneyflow mf
            ON mf.ts_code = q.ts_code
           AND mf.trade_date = q.trade_date
        LEFT JOIN {self.schema}.stock_cyq_perf cyq
            ON cyq.ts_code = q.ts_code
           AND cyq.trade_date = q.trade_date
        LEFT JOIN {self.schema}.stock_price_limit lim
            ON lim.ts_code = q.ts_code
           AND lim.trade_date = q.trade_date
        LEFT JOIN {self.schema}.stock_auction_open ao
            ON ao.ts_code = q.ts_code
           AND ao.trade_date = q.trade_date
        LEFT JOIN {self.schema}.stock_auction_close ac
            ON ac.ts_code = q.ts_code
           AND ac.trade_date = q.trade_date
        LEFT JOIN {self.schema}.stock_nineturn nt
            ON nt.ts_code = q.ts_code
           AND nt.trade_date = q.trade_date
           AND nt.freq = 'daily'
        """

    def upsert_job_run(
        self,
        *,
        job_id: str,
        mode: str,
        status: str,
        current_group: str | None,
        started_at: datetime,
        finished_at: datetime | None,
        report_path: Path,
        log_path: Path,
        state_path: Path,
        error_message: str | None,
        payload: dict[str, Any] | None,
    ) -> int:
        payload_json = dumps_jsonb(payload or {})
        return self.execute(
            f"""
            INSERT INTO {self.schema}.sync_job_runs (
                job_id, mode, status, db_name, schema_name, current_group, started_at, finished_at,
                report_path, log_path, state_path, error_message, payload_json
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s::jsonb
            )
            ON CONFLICT (job_id) DO UPDATE SET
                status = EXCLUDED.status,
                current_group = EXCLUDED.current_group,
                finished_at = EXCLUDED.finished_at,
                report_path = EXCLUDED.report_path,
                log_path = EXCLUDED.log_path,
                state_path = EXCLUDED.state_path,
                error_message = EXCLUDED.error_message,
                payload_json = EXCLUDED.payload_json,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                job_id,
                mode,
                status,
                self.args.db_name,
                self.schema,
                current_group,
                started_at,
                finished_at,
                str(report_path),
                str(log_path),
                str(state_path),
                error_message,
                payload_json,
            ),
        )

    def upsert_job_progress(self, job_id: str, group_name: str, progress: dict[str, Any]) -> int:
        return self.execute(
            f"""
            INSERT INTO {self.schema}.sync_job_progress (
                job_id, group_name, progress_json
            ) VALUES (
                %s, %s, %s::jsonb
            )
            ON CONFLICT (job_id, group_name) DO UPDATE SET
                progress_json = EXCLUDED.progress_json,
                updated_at = CURRENT_TIMESTAMP
            """,
            (job_id, group_name, dumps_jsonb(progress)),
        )

    def upsert_stock_basic(self, rows: list[dict[str, Any]]) -> int:
        payloads = [
            (
                row.get("ts_code"),
                row.get("symbol"),
                row.get("name"),
                row.get("area"),
                row.get("industry"),
                row.get("fullname"),
                row.get("enname"),
                row.get("market"),
                row.get("exchange"),
                row.get("curr_type"),
                row.get("list_status"),
                to_date(row.get("list_date")),
                to_date(row.get("delist_date")),
                row.get("is_hs"),
                row.get("act_name"),
                row.get("act_ent_type"),
            )
            for row in rows
            if row.get("ts_code")
        ]
        return self.execute_many(
            f"""
            INSERT INTO {self.schema}.stock_basic (
                ts_code, symbol, name, area, industry, fullname, enname, market,
                exchange, curr_type, list_status, list_date, delist_date, is_hs,
                act_name, act_ent_type
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s, %s
            )
            ON CONFLICT (ts_code) DO UPDATE SET
                symbol = EXCLUDED.symbol,
                name = EXCLUDED.name,
                area = EXCLUDED.area,
                industry = EXCLUDED.industry,
                fullname = EXCLUDED.fullname,
                enname = EXCLUDED.enname,
                market = EXCLUDED.market,
                exchange = EXCLUDED.exchange,
                curr_type = EXCLUDED.curr_type,
                list_status = EXCLUDED.list_status,
                list_date = EXCLUDED.list_date,
                delist_date = EXCLUDED.delist_date,
                is_hs = EXCLUDED.is_hs,
                act_name = EXCLUDED.act_name,
                act_ent_type = EXCLUDED.act_ent_type,
                updated_at = CURRENT_TIMESTAMP
            """,
            payloads,
        )

    def upsert_trade_cal(self, rows: list[dict[str, Any]]) -> int:
        payloads = [
            (
                row.get("exchange"),
                to_date(row.get("cal_date")),
                row.get("is_open"),
                to_date(row.get("pretrade_date")),
            )
            for row in rows
            if row.get("exchange") and row.get("cal_date")
        ]
        return self.execute_many(
            f"""
            INSERT INTO {self.schema}.trade_cal (exchange, cal_date, is_open, pretrade_date)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (exchange, cal_date) DO UPDATE SET
                is_open = EXCLUDED.is_open,
                pretrade_date = EXCLUDED.pretrade_date,
                updated_at = CURRENT_TIMESTAMP
            """,
            payloads,
        )

    def upsert_kline_daily(self, rows: list[dict[str, Any]]) -> int:
        grouped: dict[str, list[tuple[Any, ...]]] = {}
        for row in rows:
            trade_date = normalize_tushare_date(row.get("trade_date"))
            ts_code = row.get("ts_code")
            if not trade_date or not ts_code:
                continue
            year_suffix = trade_date[2:4]
            grouped.setdefault(year_suffix, []).append(
                (
                    ts_code,
                    to_date(trade_date),
                    to_float(row.get("open")),
                    to_float(row.get("high")),
                    to_float(row.get("low")),
                    to_float(row.get("close")),
                    to_float(row.get("pre_close")),
                    to_float(row.get("change")),
                    to_float(row.get("pct_chg")),
                    to_float(row.get("vol")),
                    to_float(row.get("amount")),
                )
            )
        affected = 0
        for year_suffix, payloads in grouped.items():
            table_name = self.ensure_kline_table(year_suffix)
            affected += self.execute_many(
                f"""
                INSERT INTO {self.schema}.{table_name} (
                    ts_code, trade_date, open, high, low, close,
                    pre_close, change_value, pct_chg, vol, amount
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s
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
                """,
                payloads,
            )
        return affected

    def upsert_adj_factor(self, rows: list[dict[str, Any]]) -> int:
        payloads = [
            (row.get("ts_code"), to_date(row.get("trade_date")), to_float(row.get("adj_factor")))
            for row in rows
            if row.get("ts_code") and row.get("trade_date")
        ]
        return self.execute_many(
            f"""
            INSERT INTO {self.schema}.stock_adj_factor (ts_code, trade_date, adj_factor)
            VALUES (%s, %s, %s)
            ON CONFLICT (ts_code, trade_date) DO UPDATE SET
                adj_factor = EXCLUDED.adj_factor,
                updated_at = CURRENT_TIMESTAMP
            """,
            payloads,
        )

    def upsert_financial_rows(self, table_name: str, rows: list[dict[str, Any]]) -> int:
        payloads = [
            (
                row.get("ts_code"),
                to_date(row.get("ann_date")),
                to_date(row.get("f_ann_date")),
                to_date(row.get("end_date")),
                str(row.get("report_type") or ""),
                row.get("comp_type"),
                row.get("end_type"),
                dumps_jsonb(row),
            )
            for row in rows
            if row.get("ts_code") and row.get("end_date")
        ]
        return self.execute_many(
            f"""
            INSERT INTO {self.schema}.{table_name} (
                ts_code, ann_date, f_ann_date, end_date, report_type, comp_type, end_type, raw_json
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s::jsonb
            )
            ON CONFLICT (ts_code, end_date, ann_date, report_type) DO UPDATE SET
                f_ann_date = EXCLUDED.f_ann_date,
                comp_type = EXCLUDED.comp_type,
                end_type = EXCLUDED.end_type,
                raw_json = EXCLUDED.raw_json,
                updated_at = CURRENT_TIMESTAMP
            """,
            payloads,
        )

    def upsert_raw_rows(
        self,
        *,
        api_name: str,
        dataset_key: str,
        scope_key: str | None,
        request_params: dict[str, Any],
        rows: list[dict[str, Any]],
    ) -> int:
        payloads = [
            (
                dataset_key,
                scope_key,
                resolve_raw_ts_code(row, scope_key, request_params),
                resolve_raw_entity_key(row, scope_key, request_params),
                to_date(row.get("trade_date")),
                to_date(row.get("end_date")),
                to_date(row.get("ann_date")),
                dumps_jsonb(row),
                api_name,
                build_raw_dedupe_key(api_name, dataset_key, scope_key, row),
            )
            for row in rows
        ]
        return self.execute_many(
            f"""
            INSERT INTO {self.schema}.tushare_raw_data (
                dataset_key, scope_key, ts_code, entity_key, trade_date, end_date, ann_date,
                raw_json, source, dedupe_key
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s,
                %s::jsonb, %s, %s
            )
            ON CONFLICT (dedupe_key) DO UPDATE SET
                scope_key = EXCLUDED.scope_key,
                ts_code = EXCLUDED.ts_code,
                entity_key = EXCLUDED.entity_key,
                trade_date = EXCLUDED.trade_date,
                end_date = EXCLUDED.end_date,
                ann_date = EXCLUDED.ann_date,
                raw_json = EXCLUDED.raw_json,
                source = EXCLUDED.source,
                updated_at = CURRENT_TIMESTAMP
            """,
            payloads,
        )

    def upsert_stk_mins(self, rows: list[dict[str, Any]]) -> int:
        payloads = [
            (
                row.get("ts_code"),
                to_timestamp(row.get("trade_time")),
                to_float(row.get("open")),
                to_float(row.get("high")),
                to_float(row.get("low")),
                to_float(row.get("close")),
                to_float(row.get("vol")),
                to_float(row.get("amount")),
            )
            for row in rows
            if row.get("ts_code") and row.get("trade_time")
        ]
        return self.execute_many(
            f"""
            INSERT INTO {self.schema}.stock_minute_1m (
                ts_code, trade_time, open, high, low, close, vol, amount
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (ts_code, trade_time) DO UPDATE SET
                open = EXCLUDED.open,
                high = EXCLUDED.high,
                low = EXCLUDED.low,
                close = EXCLUDED.close,
                vol = EXCLUDED.vol,
                amount = EXCLUDED.amount,
                updated_at = CURRENT_TIMESTAMP
            """,
            payloads,
        )

    def upsert_daily_basic(self, rows: list[dict[str, Any]]) -> int:
        payloads = [
            (
                row.get("ts_code"),
                to_date(row.get("trade_date")),
                to_float(row.get("close")),
                to_float(row.get("turnover_rate")),
                to_float(row.get("turnover_rate_f")),
                to_float(row.get("volume_ratio")),
                to_float(row.get("pe")),
                to_float(row.get("pe_ttm")),
                to_float(row.get("pb")),
                to_float(row.get("ps")),
                to_float(row.get("ps_ttm")),
                to_float(row.get("dv_ratio")),
                to_float(row.get("dv_ttm")),
                to_float(row.get("total_share")),
                to_float(row.get("float_share")),
                to_float(row.get("free_share")),
                to_float(row.get("total_mv")),
                to_float(row.get("circ_mv")),
            )
            for row in rows
            if row.get("ts_code") and row.get("trade_date")
        ]
        return self.execute_many(
            f"""
            INSERT INTO {self.schema}.stock_daily_basic (
                ts_code, trade_date, close, turnover_rate, turnover_rate_f, volume_ratio,
                pe, pe_ttm, pb, ps, ps_ttm, dv_ratio, dv_ttm, total_share, float_share,
                free_share, total_mv, circ_mv
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s
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
            """,
            payloads,
        )

    def upsert_moneyflow(self, rows: list[dict[str, Any]]) -> int:
        payloads = [
            (
                row.get("ts_code"),
                to_date(row.get("trade_date")),
                to_float(row.get("buy_sm_vol")),
                to_float(row.get("buy_sm_amount")),
                to_float(row.get("sell_sm_vol")),
                to_float(row.get("sell_sm_amount")),
                to_float(row.get("buy_md_vol")),
                to_float(row.get("buy_md_amount")),
                to_float(row.get("sell_md_vol")),
                to_float(row.get("sell_md_amount")),
                to_float(row.get("buy_lg_vol")),
                to_float(row.get("buy_lg_amount")),
                to_float(row.get("sell_lg_vol")),
                to_float(row.get("sell_lg_amount")),
                to_float(row.get("buy_elg_vol")),
                to_float(row.get("buy_elg_amount")),
                to_float(row.get("sell_elg_vol")),
                to_float(row.get("sell_elg_amount")),
                to_float(row.get("net_mf_vol")),
                to_float(row.get("net_mf_amount")),
            )
            for row in rows
            if row.get("ts_code") and row.get("trade_date")
        ]
        return self.execute_many(
            f"""
            INSERT INTO {self.schema}.stock_moneyflow (
                ts_code, trade_date, buy_sm_vol, buy_sm_amount, sell_sm_vol, sell_sm_amount,
                buy_md_vol, buy_md_amount, sell_md_vol, sell_md_amount, buy_lg_vol, buy_lg_amount,
                sell_lg_vol, sell_lg_amount, buy_elg_vol, buy_elg_amount, sell_elg_vol, sell_elg_amount,
                net_mf_vol, net_mf_amount
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s, %s
            )
            ON CONFLICT (ts_code, trade_date) DO UPDATE SET
                buy_sm_vol = EXCLUDED.buy_sm_vol,
                buy_sm_amount = EXCLUDED.buy_sm_amount,
                sell_sm_vol = EXCLUDED.sell_sm_vol,
                sell_sm_amount = EXCLUDED.sell_sm_amount,
                buy_md_vol = EXCLUDED.buy_md_vol,
                buy_md_amount = EXCLUDED.buy_md_amount,
                sell_md_vol = EXCLUDED.sell_md_vol,
                sell_md_amount = EXCLUDED.sell_md_amount,
                buy_lg_vol = EXCLUDED.buy_lg_vol,
                buy_lg_amount = EXCLUDED.buy_lg_amount,
                sell_lg_vol = EXCLUDED.sell_lg_vol,
                sell_lg_amount = EXCLUDED.sell_lg_amount,
                buy_elg_vol = EXCLUDED.buy_elg_vol,
                buy_elg_amount = EXCLUDED.buy_elg_amount,
                sell_elg_vol = EXCLUDED.sell_elg_vol,
                sell_elg_amount = EXCLUDED.sell_elg_amount,
                net_mf_vol = EXCLUDED.net_mf_vol,
                net_mf_amount = EXCLUDED.net_mf_amount,
                updated_at = CURRENT_TIMESTAMP
            """,
            payloads,
        )

    def upsert_cyq_perf(self, rows: list[dict[str, Any]]) -> int:
        payloads = [
            (
                row.get("ts_code"),
                to_date(row.get("trade_date")),
                to_float(row.get("his_low")),
                to_float(row.get("his_high")),
                to_float(row.get("cost_5pct")),
                to_float(row.get("cost_15pct")),
                to_float(row.get("cost_50pct")),
                to_float(row.get("cost_85pct")),
                to_float(row.get("cost_95pct")),
                to_float(row.get("weight_avg")),
                to_float(row.get("winner_rate")),
            )
            for row in rows
            if row.get("ts_code") and row.get("trade_date")
        ]
        return self.execute_many(
            f"""
            INSERT INTO {self.schema}.stock_cyq_perf (
                ts_code, trade_date, his_low, his_high, cost_5pct, cost_15pct,
                cost_50pct, cost_85pct, cost_95pct, weight_avg, winner_rate
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s
            )
            ON CONFLICT (ts_code, trade_date) DO UPDATE SET
                his_low = EXCLUDED.his_low,
                his_high = EXCLUDED.his_high,
                cost_5pct = EXCLUDED.cost_5pct,
                cost_15pct = EXCLUDED.cost_15pct,
                cost_50pct = EXCLUDED.cost_50pct,
                cost_85pct = EXCLUDED.cost_85pct,
                cost_95pct = EXCLUDED.cost_95pct,
                weight_avg = EXCLUDED.weight_avg,
                winner_rate = EXCLUDED.winner_rate,
                updated_at = CURRENT_TIMESTAMP
            """,
            payloads,
        )

    def upsert_price_limit(self, rows: list[dict[str, Any]]) -> int:
        payloads = [
            (
                row.get("ts_code"),
                to_date(row.get("trade_date")),
                to_float(row.get("up_limit")),
                to_float(row.get("down_limit")),
            )
            for row in rows
            if row.get("ts_code") and row.get("trade_date")
        ]
        return self.execute_many(
            f"""
            INSERT INTO {self.schema}.stock_price_limit (
                ts_code, trade_date, up_limit, down_limit
            ) VALUES (
                %s, %s, %s, %s
            )
            ON CONFLICT (ts_code, trade_date) DO UPDATE SET
                up_limit = EXCLUDED.up_limit,
                down_limit = EXCLUDED.down_limit,
                updated_at = CURRENT_TIMESTAMP
            """,
            payloads,
        )

    def upsert_stock_auction(self, table_name: str, rows: list[dict[str, Any]]) -> int:
        payloads = [
            (
                row.get("ts_code"),
                to_date(row.get("trade_date")),
                to_float(row.get("close")),
                to_float(row.get("open")),
                to_float(row.get("high")),
                to_float(row.get("low")),
                to_float(row.get("vol")),
                to_float(row.get("amount")),
                to_float(row.get("vwap")),
            )
            for row in rows
            if row.get("ts_code") and row.get("trade_date")
        ]
        return self.execute_many(
            f"""
            INSERT INTO {self.schema}.{table_name} (
                ts_code, trade_date, close, open, high, low, vol, amount, vwap
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (ts_code, trade_date) DO UPDATE SET
                close = EXCLUDED.close,
                open = EXCLUDED.open,
                high = EXCLUDED.high,
                low = EXCLUDED.low,
                vol = EXCLUDED.vol,
                amount = EXCLUDED.amount,
                vwap = EXCLUDED.vwap,
                updated_at = CURRENT_TIMESTAMP
            """,
            payloads,
        )

    def upsert_nineturn(self, rows: list[dict[str, Any]]) -> int:
        payloads = [
            (
                row.get("ts_code"),
                to_date(row.get("trade_date")),
                str(row.get("freq") or "daily"),
                to_float(row.get("open")),
                to_float(row.get("high")),
                to_float(row.get("low")),
                to_float(row.get("close")),
                to_float(row.get("vol")),
                to_float(row.get("amount")),
                to_int(row.get("up_count")),
                to_int(row.get("down_count")),
                to_float(row.get("nine_up_turn")),
                to_float(row.get("nine_down_turn")),
            )
            for row in rows
            if row.get("ts_code") and row.get("trade_date")
        ]
        return self.execute_many(
            f"""
            INSERT INTO {self.schema}.stock_nineturn (
                ts_code, trade_date, freq, open, high, low, close, vol, amount,
                up_count, down_count, nine_up_turn, nine_down_turn
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s
            )
            ON CONFLICT (ts_code, trade_date, freq) DO UPDATE SET
                open = EXCLUDED.open,
                high = EXCLUDED.high,
                low = EXCLUDED.low,
                close = EXCLUDED.close,
                vol = EXCLUDED.vol,
                amount = EXCLUDED.amount,
                up_count = EXCLUDED.up_count,
                down_count = EXCLUDED.down_count,
                nine_up_turn = EXCLUDED.nine_up_turn,
                nine_down_turn = EXCLUDED.nine_down_turn,
                updated_at = CURRENT_TIMESTAMP
            """,
            payloads,
        )

    def upsert_structured_trade_date_dataset(self, dataset_key: str, rows: list[dict[str, Any]]) -> int:
        if not rows:
            return 0
        if dataset_key == "daily_basic":
            return self.upsert_daily_basic(rows)
        if dataset_key == "moneyflow":
            return self.upsert_moneyflow(rows)
        if dataset_key == "cyq_perf":
            return self.upsert_cyq_perf(rows)
        if dataset_key == "stk_limit":
            return self.upsert_price_limit(rows)
        if dataset_key == "stk_auction_o":
            return self.upsert_stock_auction("stock_auction_open", rows)
        if dataset_key == "stk_auction_c":
            return self.upsert_stock_auction("stock_auction_close", rows)
        if dataset_key == "stk_nineturn":
            return self.upsert_nineturn(rows)
        return 0


class TusharePostgresSyncRunner:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.root_dir = Path(__file__).resolve().parent
        self.state_dir = self.root_dir / "state"
        self.report_dir = self.root_dir / "reports" / "tushare-postgres-sync"
        self.log_dir = self.root_dir / "logs" / "tushare-postgres-sync"
        self.today = datetime.now().date()
        self.started_at = datetime.now()
        self.job_id = datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:8]
        self.report_path = self.report_dir / self.today.strftime("%Y%m%d") / f"{args.mode}-{self.job_id}.json"
        self.log_path = self.log_dir / f"{self.today.strftime('%Y%m%d')}-{args.mode}-{self.job_id}.log"
        state_suffix = str(getattr(args, "state_file_suffix", "") or "").strip()
        self.state_path = self.state_dir / f"tushare-postgres-sync-{args.mode}{state_suffix}.json"
        self.logger = logging.getLogger("tushare_postgres_sync")
        self.gateway = TushareGateway(args.tushare_token, args.tushare_http_url)
        self.store = PostgresQuantStore(args)
        self.state: dict[str, Any] = {"groups": {}}
        self.current_group: str | None = None

    def run(self) -> dict[str, Any]:
        self._ensure_dirs()
        self._configure_logging()
        if not getattr(self.args, "skip_setup", False):
            self.store.ensure_base_tables()
        if self.args.reset_state and self.state_path.exists():
            self.state_path.unlink()
        self.state = self._load_state()

        payload: dict[str, Any] = {
            "jobId": self.job_id,
            "mode": self.args.mode,
            "db": {
                "host": self.args.db_host,
                "port": self.args.db_port,
                "name": self.args.db_name,
                "schema": self.args.db_schema,
            },
            "startedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "steps": {},
        }
        self._persist_job_run(status="running", payload=payload)
        try:
            if self.group_enabled("reference"):
                self.set_current_group("reference", payload)
                payload["steps"]["reference"] = self.sync_reference()
            if self.group_enabled("klineDaily"):
                self.set_current_group("klineDaily", payload)
                payload["steps"]["klineDaily"] = self.sync_daily_quotes()
            if self.group_enabled("marketRaw"):
                self.set_current_group("marketRaw", payload)
                payload["steps"]["marketRaw"] = self.sync_raw_trade_dates()
            if self.group_enabled("announcementRaw"):
                self.set_current_group("announcementRaw", payload)
                payload["steps"]["announcementRaw"] = self.sync_calendar_specs(
                    "announcementRaw",
                    self.ann_date_range(),
                    self.selected_announcement_specs(),
                )
            if self.group_enabled("contentRaw"):
                self.set_current_group("contentRaw", payload)
                payload["steps"]["contentRaw"] = self.sync_calendar_specs(
                    "contentRaw",
                    self.content_date_range(),
                    self.selected_content_specs(),
                )
            if self.group_enabled("rangeRaw"):
                self.set_current_group("rangeRaw", payload)
                payload["steps"]["rangeRaw"] = self.sync_range_specs()
            if self.group_enabled("independentApis"):
                self.set_current_group("independentApis", payload)
                payload["steps"]["independentApis"] = self.sync_independent_datasets()
            if self.args.mode == "full" and self.group_enabled("financialStatements"):
                self.set_current_group("financialStatements", payload)
                payload["steps"]["financialStatements"] = self.sync_symbol_financials()
            if self.args.mode == "full" and self.group_enabled("symbolExtras"):
                self.set_current_group("symbolExtras", payload)
                payload["steps"]["symbolExtras"] = self.sync_symbol_raw_extras()
            payload["finishedAt"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            payload["status"] = "completed"
        except Exception as exc:
            payload["finishedAt"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            payload["status"] = "failed"
            payload["error"] = str(exc)
            payload["traceback"] = traceback.format_exc()
            self.logger.exception("PostgreSQL sync failed")
            raise
        finally:
            self.report_path.parent.mkdir(parents=True, exist_ok=True)
            self.report_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            finished_at = datetime.now()
            self._persist_job_run(
                status=str(payload.get("status") or "unknown"),
                payload=payload,
                finished_at=finished_at,
                error_message=payload.get("error"),
            )
        return payload

    def set_current_group(self, group_name: str, payload: dict[str, Any]) -> None:
        self.current_group = group_name
        self._persist_job_run(status="running", payload=payload)

    def group_enabled(self, group_name: str) -> bool:
        allowed = parse_group_names(self.args.only_groups)
        if not allowed:
            return True
        return group_name in allowed

    def _persist_job_run(
        self,
        *,
        status: str,
        payload: dict[str, Any],
        finished_at: datetime | None = None,
        error_message: str | None = None,
    ) -> None:
        self.store.upsert_job_run(
            job_id=self.job_id,
            mode=self.args.mode,
            status=status,
            current_group=self.current_group,
            started_at=self.started_at,
            finished_at=finished_at,
            report_path=self.report_path,
            log_path=self.log_path,
            state_path=self.state_path,
            error_message=error_message,
            payload=payload,
        )

    def sync_reference(self) -> dict[str, Any]:
        stock_rows = merge_rows_by_key(
            self.gateway.fetch("stock_basic", exchange="", list_status=status)
            for status in ("L", "D", "P")
        )
        stock_affected = self.store.upsert_stock_basic(stock_rows)
        start_date = self.kline_start_date() if self.args.mode != "daily" else self.end_date()
        sse_rows = self.gateway.fetch("trade_cal", exchange="SSE", start_date=start_date, end_date=self.end_date())
        szse_rows = self.gateway.fetch("trade_cal", exchange="SZSE", start_date=start_date, end_date=self.end_date())
        sse_affected = self.store.upsert_trade_cal(sse_rows)
        szse_affected = self.store.upsert_trade_cal(szse_rows)
        return {
            "stockBasic": {"count": len(stock_rows), "affectedRows": stock_affected},
            "tradeCalSSE": {"count": len(sse_rows), "affectedRows": sse_affected},
            "tradeCalSZSE": {"count": len(szse_rows), "affectedRows": szse_affected},
        }

    def sync_daily_quotes(self) -> dict[str, Any]:
        trade_dates = self.trade_dates_between(self.kline_start_date(), self.end_date())
        group_state = self.group_state("klineDaily")
        offset = int(group_state.get("offset", 0)) if self.args.mode == "full" else 0
        totals = {"daily": 0, "adj_factor": 0}
        affected = 0
        errors = 0
        for index, trade_date in enumerate(trade_dates[offset:], start=offset):
            try:
                daily_rows = self.gateway.fetch("daily", trade_date=trade_date)
                adj_rows = self.gateway.fetch("adj_factor", trade_date=trade_date)
                totals["daily"] += len(daily_rows)
                totals["adj_factor"] += len(adj_rows)
                affected += self.store.upsert_kline_daily(daily_rows)
                affected += self.store.upsert_adj_factor(adj_rows)
            except Exception as exc:
                errors += 1
                self.logger.warning("daily quotes failed for %s: %s", trade_date, exc)
            self.pause()
            if self.args.mode == "full":
                group_state["offset"] = index + 1
                self.save_state()
        return {
            "dateCount": len(trade_dates),
            "recordCount": totals,
            "affectedRows": affected,
            "errorCount": errors,
            "startDate": trade_dates[0] if trade_dates else None,
            "endDate": trade_dates[-1] if trade_dates else None,
        }

    def sync_raw_trade_dates(self) -> dict[str, Any]:
        specs = self.selected_raw_trade_specs()
        trade_dates = self.trade_dates_between(self.raw_trade_start_date(), self.end_date())
        group_state = self.group_state("marketRaw")
        offset = int(group_state.get("offset", 0)) if self.args.mode == "full" else 0
        totals = {spec.name: 0 for spec in specs}
        affected = 0
        structured_affected = 0
        errors = 0
        for index, trade_date in enumerate(trade_dates[offset:], start=offset):
            for spec in specs:
                params = {"trade_date": trade_date, **dict(spec.extra_params)}
                try:
                    rows = self.gateway.fetch(spec.api_name, **params)
                    totals[spec.name] += len(rows)
                    affected += self.store.upsert_raw_rows(
                        api_name=spec.api_name,
                        dataset_key=spec.dataset_key,
                        scope_key=trade_date,
                        request_params=params,
                        rows=rows,
                    )
                    structured_affected += self.store.upsert_structured_trade_date_dataset(spec.dataset_key, rows)
                except Exception as exc:
                    errors += 1
                    self.logger.warning("%s failed for %s: %s", spec.name, trade_date, exc)
                self.pause()
            if self.args.mode == "full":
                group_state["offset"] = index + 1
                self.save_state()
        return {
            "dateCount": len(trade_dates),
            "recordCount": totals,
            "affectedRows": affected,
            "structuredAffectedRows": structured_affected,
            "errorCount": errors,
            "startDate": trade_dates[0] if trade_dates else None,
            "endDate": trade_dates[-1] if trade_dates else None,
        }

    def sync_calendar_specs(
        self,
        group_name: str,
        dates: list[str],
        specs: tuple[RawCalendarDateSpec, ...],
    ) -> dict[str, Any]:
        totals = {spec.name: 0 for spec in specs}
        affected = 0
        errors = 0
        group_state = self.group_state(group_name)
        offset = int(group_state.get("offset", 0)) if self.args.mode == "full" else 0
        for index, day in enumerate(dates[offset:], start=offset):
            for spec in specs:
                params = {spec.date_param: day, **dict(spec.extra_params)}
                try:
                    rows = self.gateway.fetch(spec.api_name, **params)
                    totals[spec.name] += len(rows)
                    affected += self.store.upsert_raw_rows(
                        api_name=spec.api_name,
                        dataset_key=spec.dataset_key,
                        scope_key=day,
                        request_params=params,
                        rows=rows,
                    )
                except Exception as exc:
                    errors += 1
                    self.logger.warning("%s failed for %s: %s", spec.name, day, exc)
                self.pause()
            if self.args.mode == "full":
                group_state["offset"] = index + 1
                self.save_state()
        return {
            "dateCount": len(dates),
            "recordCount": totals,
            "affectedRows": affected,
            "errorCount": errors,
            "startDate": dates[0] if dates else None,
            "endDate": dates[-1] if dates else None,
        }

    def sync_range_specs(self) -> dict[str, Any]:
        specs = self.selected_range_specs()
        start_date = self.range_start_date()
        end_date = self.end_date()
        totals = {spec.name: 0 for spec in specs}
        affected = 0
        errors = 0
        for spec in specs:
            params = {spec.start_param: start_date, spec.end_param: end_date, **dict(spec.extra_params)}
            try:
                rows = self.gateway.fetch(spec.api_name, **params)
                totals[spec.name] = len(rows)
                affected += self.store.upsert_raw_rows(
                    api_name=spec.api_name,
                    dataset_key=spec.dataset_key,
                    scope_key=f"{start_date}:{end_date}",
                    request_params=params,
                    rows=rows,
                )
            except Exception as exc:
                errors += 1
                self.logger.warning("%s failed: %s", spec.name, exc)
            self.pause()
        return {"startDate": start_date, "endDate": end_date, "recordCount": totals, "affectedRows": affected, "errorCount": errors}

    def sync_independent_datasets(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "stk_auction_o": "included in marketRaw",
            "stk_auction_c": "included in marketRaw",
            "stk_nineturn": "included in marketRaw",
        }
        if not self.args.enable_stk_mins:
            result["stk_mins"] = {"enabled": False}
            return result

        trade_dates = self.trade_dates_between(self.stk_mins_start_date(), self.end_date())
        symbols = self.load_active_symbols()
        if self.args.stk_mins_limit_symbols:
            symbols = symbols[: self.args.stk_mins_limit_symbols]
        totals = 0
        affected = 0
        errors = 0
        group_state = self.group_state("stkMins")
        date_offset = int(group_state.get("dateOffset", 0)) if self.args.mode == "full" else 0
        symbol_offset = int(group_state.get("symbolOffset", 0)) if self.args.mode == "full" else 0
        for d_index, trade_date in enumerate(trade_dates[date_offset:], start=date_offset):
            active_symbol_offset = symbol_offset if d_index == date_offset else 0
            for s_index, ts_code in enumerate(symbols[active_symbol_offset:], start=active_symbol_offset):
                try:
                    rows = self.gateway.fetch(
                        "stk_mins",
                        ts_code=ts_code,
                        start_date=f"{trade_date[:4]}-{trade_date[4:6]}-{trade_date[6:8]} 09:30:00",
                        end_date=f"{trade_date[:4]}-{trade_date[4:6]}-{trade_date[6:8]} 15:00:00",
                        freq="1min",
                    )
                    totals += len(rows)
                    affected += self.store.upsert_stk_mins(rows)
                except Exception as exc:
                    errors += 1
                    self.logger.warning("stk_mins failed for %s %s: %s", trade_date, ts_code, exc)
                self.pause()
                if self.args.mode == "full":
                    group_state["dateOffset"] = d_index
                    group_state["symbolOffset"] = s_index + 1
                    self.save_state()
            if self.args.mode == "full":
                group_state["dateOffset"] = d_index + 1
                group_state["symbolOffset"] = 0
                self.save_state()
        result["stk_mins"] = {
            "enabled": True,
            "tradeDateCount": len(trade_dates),
            "symbolCount": len(symbols),
            "recordCount": totals,
            "affectedRows": affected,
            "errorCount": errors,
        }
        return result

    def sync_symbol_financials(self) -> dict[str, Any]:
        specs = self.selected_financial_specs()
        symbols = self.load_active_symbols()
        totals = {spec.name: 0 for spec in specs}
        affected = 0
        errors = 0
        group_state = self.group_state("financialStatements")
        offset = int(group_state.get("offset", 0))
        for index, ts_code in enumerate(symbols[offset:], start=offset):
            for spec in specs:
                try:
                    rows = self.gateway.fetch(spec.api_name, ts_code=ts_code, start_date=self.args.full_start_date, end_date=self.end_date())
                    totals[spec.name] += len(rows)
                    affected += self.store.upsert_financial_rows(spec.target_table, rows)
                except Exception as exc:
                    errors += 1
                    self.logger.warning("%s failed for %s: %s", spec.name, ts_code, exc)
                self.pause()
            group_state["offset"] = index + 1
            self.save_state()
        return {"symbolCount": len(symbols), "recordCount": totals, "affectedRows": affected, "errorCount": errors}

    def sync_symbol_raw_extras(self) -> dict[str, Any]:
        specs = self.selected_symbol_raw_specs()
        symbols = self.load_active_symbols()
        totals = {spec.name: 0 for spec in specs}
        affected = 0
        errors = 0
        group_state = self.group_state("symbolExtras")
        offset = int(group_state.get("offset", 0))
        for index, ts_code in enumerate(symbols[offset:], start=offset):
            for spec in specs:
                params = {"ts_code": ts_code, **dict(spec.extra_params)}
                if spec.start_param:
                    params[spec.start_param] = self.args.full_start_date
                if spec.end_param:
                    params[spec.end_param] = self.end_date()
                try:
                    rows = self.gateway.fetch(spec.api_name, **params)
                    totals[spec.name] += len(rows)
                    affected += self.store.upsert_raw_rows(
                        api_name=spec.api_name,
                        dataset_key=spec.dataset_key,
                        scope_key=ts_code,
                        request_params=params,
                        rows=rows,
                    )
                except Exception as exc:
                    errors += 1
                    self.logger.warning("%s failed for %s: %s", spec.name, ts_code, exc)
                self.pause()
            group_state["offset"] = index + 1
            self.save_state()
        return {"symbolCount": len(symbols), "recordCount": totals, "affectedRows": affected, "errorCount": errors}

    def load_active_symbols(self) -> list[str]:
        allowed_statuses = ("L", "P", "D") if self.args.mode == "full" else ("L", "P")
        rows = self.store.fetch_all(
            f"""
            SELECT ts_code
            FROM {self.args.db_schema}.stock_basic
            WHERE ts_code IS NOT NULL
              AND (list_status IS NULL OR list_status = ANY(%s))
            ORDER BY ts_code
            """,
            (list(allowed_statuses),),
        )
        return [str(row["ts_code"]) for row in rows if row.get("ts_code")]

    def selected_raw_trade_specs(self) -> tuple[RawTradeDateSpec, ...]:
        allowed = parse_named_values(self.args.only_trade_date_datasets, RAW_TRADE_DATE_DATASET_NAMES, "trade-date dataset")
        if not allowed:
            return RAW_TRADE_DATE_SPECS
        return tuple(spec for spec in RAW_TRADE_DATE_SPECS if spec.name in allowed)

    def selected_announcement_specs(self) -> tuple[RawCalendarDateSpec, ...]:
        allowed = parse_named_values(self.args.only_ann_datasets, RAW_ANN_DATASET_NAMES, "announcement dataset")
        if not allowed:
            return RAW_ANN_DATE_SPECS
        return tuple(spec for spec in RAW_ANN_DATE_SPECS if spec.name in allowed)

    def selected_content_specs(self) -> tuple[RawCalendarDateSpec, ...]:
        allowed = parse_named_values(self.args.only_content_datasets, RAW_CALENDAR_DATASET_NAMES, "content dataset")
        if not allowed:
            return RAW_CALENDAR_SPECS
        return tuple(spec for spec in RAW_CALENDAR_SPECS if spec.name in allowed)

    def selected_range_specs(self) -> tuple[RawRangeSpec, ...]:
        allowed = parse_named_values(self.args.only_range_datasets, RAW_RANGE_DATASET_NAMES, "range dataset")
        if not allowed:
            return RAW_RANGE_SPECS
        return tuple(spec for spec in RAW_RANGE_SPECS if spec.name in allowed)

    def selected_financial_specs(self) -> tuple[SymbolFinancialSpec, ...]:
        allowed = parse_named_values(self.args.only_financial_datasets, SYMBOL_FINANCIAL_DATASET_NAMES, "financial dataset")
        if not allowed:
            return SYMBOL_FINANCIAL_SPECS
        return tuple(spec for spec in SYMBOL_FINANCIAL_SPECS if spec.name in allowed)

    def selected_symbol_raw_specs(self) -> tuple[SymbolRawSpec, ...]:
        allowed = parse_named_values(self.args.only_symbol_extra_datasets, SYMBOL_RAW_DATASET_NAMES, "symbol extra dataset")
        if not allowed:
            return SYMBOL_RAW_SPECS
        return tuple(spec for spec in SYMBOL_RAW_SPECS if spec.name in allowed)

    def kline_start_date(self) -> str:
        latest = self.latest_kline_date()
        if self.args.mode == "daily":
            if latest is None:
                return self.end_date()
            return (latest - timedelta(days=1)).strftime("%Y%m%d")
        if self.args.mode == "full":
            if self.args.force_full_kline_start:
                return self.args.full_start_date
            if latest is not None:
                return (latest - timedelta(days=1)).strftime("%Y%m%d")
            return self.args.full_start_date
        if latest is None:
            return self.args.full_start_date
        return (latest - timedelta(days=1)).strftime("%Y%m%d")

    def raw_trade_start_date(self) -> str:
        if self.args.mode == "full":
            return self.args.full_start_date
        latest = self.latest_raw_trade_date()
        if latest is None:
            return self.kline_start_date()
        return (latest - timedelta(days=1)).strftime("%Y%m%d")

    def ann_date_range(self) -> list[str]:
        start_date = self.args.full_start_date if self.args.mode == "full" else (self.today - timedelta(days=30)).strftime("%Y%m%d")
        return calendar_dates(start_date, self.end_date())

    def content_date_range(self) -> list[str]:
        start_date = self.args.full_start_date if self.args.mode == "full" else (self.today - timedelta(days=7)).strftime("%Y%m%d")
        return calendar_dates(start_date, self.end_date())

    def range_start_date(self) -> str:
        if self.args.mode == "full":
            return self.args.full_start_date
        latest = self.latest_dataset_date("moneyflow_hsgt", "trade_date")
        if latest is None:
            return self.raw_trade_start_date()
        return (latest - timedelta(days=1)).strftime("%Y%m%d")

    def stk_mins_start_date(self) -> str:
        if self.args.mode == "full":
            if self.args.stk_mins_full_backfill_trade_days > 0:
                trade_dates = self.trade_dates_between(self.args.full_start_date, self.end_date())
                if trade_dates:
                    return trade_dates[-min(len(trade_dates), self.args.stk_mins_full_backfill_trade_days)]
            return self.args.full_start_date
        latest = self.latest_stk_minute_date()
        if latest is None:
            return self.trade_dates_between(self.end_date(), self.end_date())[-self.args.stk_mins_trade_days] if self.trade_dates_between(self.end_date(), self.end_date()) else self.end_date()
        return (latest - timedelta(days=self.args.stk_mins_trade_days - 1)).strftime("%Y%m%d")

    def end_date(self) -> str:
        return self.args.end_date or self.today.strftime("%Y%m%d")

    def latest_kline_date(self) -> date | None:
        rows = self.store.fetch_all(
            """
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_name ~ '^stock_daily_unadjusted_[0-9]{4}$'
              AND table_schema = ANY(%s)
            ORDER BY table_schema, table_name
            """,
            (build_schema_array(self.args.db_schema, getattr(self.args, "market_data_schema", None)),),
        )
        latest_values: list[date] = []
        for row in rows:
            table_schema = row["table_schema"]
            table_name = row["table_name"]
            latest = self.store.fetch_one(f"SELECT MAX(trade_date) AS latest FROM {table_schema}.{table_name}")
            if latest and latest.get("latest"):
                latest_values.append(latest["latest"])
        return max(latest_values) if latest_values else None

    def latest_raw_trade_date(self) -> date | None:
        candidates = [self.latest_dataset_date(spec.dataset_key, "trade_date") for spec in RAW_TRADE_DATE_SPECS]
        valid = [value for value in candidates if value is not None]
        return max(valid) if valid else None

    def latest_stk_minute_date(self) -> date | None:
        row = self.store.fetch_one(f"SELECT MAX(trade_time::date) AS latest FROM {self.args.db_schema}.stock_minute_1m")
        return row.get("latest") if row and row.get("latest") else None

    def latest_dataset_date(self, dataset_key: str, column_name: str) -> date | None:
        row = self.store.fetch_one(
            f"""
            SELECT MAX({column_name}) AS latest
            FROM {self.args.db_schema}.tushare_raw_data
            WHERE dataset_key = %s
            """,
            (dataset_key,),
        )
        return row.get("latest") if row and row.get("latest") else None

    def trade_dates_between(self, start_date: str, end_date: str) -> list[str]:
        rows = self.gateway.fetch("trade_cal", exchange="SSE", start_date=start_date, end_date=end_date)
        open_dates = [str(row["cal_date"]) for row in rows if row.get("cal_date") and int(row.get("is_open") or 0) == 1]
        return open_dates

    def group_state(self, name: str) -> dict[str, Any]:
        groups = self.state.setdefault("groups", {})
        if name not in groups:
            groups[name] = {"offset": 0}
        return groups[name]

    def load_state(self) -> dict[str, Any]:
        if not self.state_path.exists():
            return {"groups": {}}
        try:
            return json.loads(self.state_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {"groups": {}}

    def _load_state(self) -> dict[str, Any]:
        return self.load_state()

    def save_state(self) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        self.state_path.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")
        groups = self.state.get("groups", {})
        for group_name, group_state in groups.items():
            if isinstance(group_state, dict):
                self.store.upsert_job_progress(self.job_id, group_name, group_state)
        self.store.upsert_job_run(
            job_id=self.job_id,
            mode=self.args.mode,
            status="running",
            current_group=self.current_group,
            started_at=self.started_at,
            finished_at=None,
            report_path=self.report_path,
            log_path=self.log_path,
            state_path=self.state_path,
            error_message=None,
            payload={
                "jobId": self.job_id,
                "mode": self.args.mode,
                "currentGroup": self.current_group,
                "state": self.state,
            },
        )

    def pause(self) -> None:
        time.sleep(max(0, self.args.tushare_pause_ms) / 1000.0)

    def _ensure_dirs(self) -> None:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.report_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir.mkdir(parents=True, exist_ok=True)

    def _configure_logging(self) -> None:
        self.logger.setLevel(logging.INFO)
        self.logger.handlers.clear()
        formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
        file_handler = logging.FileHandler(self.log_path, encoding="utf-8")
        file_handler.setFormatter(formatter)
        self.logger.addHandler(file_handler)
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setFormatter(formatter)
        self.logger.addHandler(stream_handler)


def merge_rows_by_key(groups: Iterable[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    ordered: list[str] = []
    for rows in groups:
        for row in rows:
            key = str(row.get("ts_code") or row.get("symbol") or row.get("code") or "").strip()
            if not key:
                continue
            if key not in merged:
                merged[key] = dict(row)
                ordered.append(key)
            else:
                merged[key].update({k: v for k, v in row.items() if v not in (None, "")})
    return [merged[key] for key in ordered]


def validate_identifier(value: str, label: str) -> str:
    text = str(value or "").strip()
    if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", text):
        return text
    raise ValueError(f"Invalid PostgreSQL {label}: {value}")


def validate_optional_identifier(value: str | None, label: str) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    return validate_identifier(text, label)


def market_data_symbol_to_ts_code_sql(field_expr: str) -> str:
    return f"""
    CASE
        WHEN {field_expr} IS NULL OR {field_expr} = '' THEN NULL
        WHEN {field_expr} LIKE '%%.%%' THEN {field_expr}
        WHEN {field_expr} ~ '^(60|68|90)' THEN {field_expr} || '.SH'
        WHEN {field_expr} ~ '^(00|001|002|003|20|30)' THEN {field_expr} || '.SZ'
        WHEN {field_expr} ~ '^(4|8|92)' THEN {field_expr} || '.BJ'
        ELSE {field_expr}
    END
    """


def build_schema_array(*schema_names: str | None) -> list[str]:
    result: list[str] = []
    for schema_name in schema_names:
        normalized = validate_optional_identifier(schema_name, "schema array item")
        if normalized and normalized not in result:
            result.append(normalized)
    return result


def parse_group_names(values: list[str] | tuple[str, ...] | None) -> set[str]:
    if not values:
        return set()
    result: set[str] = set()
    for raw_value in values:
        for item in str(raw_value or "").split(","):
            name = item.strip()
            if not name:
                continue
            if name not in ALL_SYNC_GROUPS:
                raise ValueError(
                    f"Unsupported sync group: {name}. Valid groups: {', '.join(ALL_SYNC_GROUPS)}"
                )
            result.add(name)
    return result


def parse_named_values(
    values: list[str] | tuple[str, ...] | None,
    valid_names: tuple[str, ...],
    label: str,
) -> set[str]:
    if not values:
        return set()
    valid = set(valid_names)
    result: set[str] = set()
    for raw_value in values:
        for item in str(raw_value or "").split(","):
            name = item.strip()
            if not name:
                continue
            if name not in valid:
                raise ValueError(
                    f"Unsupported {label}: {name}. Valid values: {', '.join(valid_names)}"
                )
            result.add(name)
    return result


def normalize_tushare_date(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"none", "null", "nan", "nat"}:
        return None
    if " " in text:
        text = text.split(" ", 1)[0]
    if len(text) == 8 and text.isdigit():
        return text
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, fmt).strftime("%Y%m%d")
        except ValueError:
            continue
    return None


def to_date(value: Any) -> date | None:
    normalized = normalize_tushare_date(value)
    if normalized is None:
        return None
    return datetime.strptime(normalized, "%Y%m%d").date()


def to_timestamp(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y%m%d%H%M%S"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def to_float(value: Any) -> float | None:
    if value in (None, "", "None", "null", "nan", "NaN"):
        return None
    try:
        converted = float(value)
    except (TypeError, ValueError):
        return None
    return converted if math.isfinite(converted) else None


def to_int(value: Any) -> int | None:
    if value in (None, "", "None", "null", "nan", "NaN"):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def sanitize_json_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, dict):
        return {str(key): sanitize_json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [sanitize_json_value(item) for item in value]
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, datetime):
        return value.isoformat(sep=" ")
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    if text.lower() in {"nan", "nat", "none", "null", "<na>"}:
        return None
    try:
        converted = float(value)
        if math.isfinite(converted):
            return value
        return None
    except (TypeError, ValueError):
        return value


def sanitize_json_row(row: dict[str, Any]) -> dict[str, Any]:
    return {str(key): sanitize_json_value(value) for key, value in row.items()}


def dumps_jsonb(row: dict[str, Any]) -> str:
    return json.dumps(sanitize_json_row(row), ensure_ascii=False, sort_keys=True, default=str, allow_nan=False)


def resolve_raw_ts_code(row: dict[str, Any], scope_key: str | None, request_params: dict[str, Any]) -> str | None:
    for field in ("ts_code", "con_code", "index_code", "code", "symbol"):
        value = row.get(field) or request_params.get(field)
        if value not in (None, ""):
            return str(value)
    if scope_key and looks_like_security_code(scope_key):
        return scope_key
    return None


def resolve_raw_entity_key(row: dict[str, Any], scope_key: str | None, request_params: dict[str, Any]) -> str | None:
    return (
        resolve_raw_ts_code(row, scope_key, request_params)
        or str(row.get("trade_date") or row.get("ann_date") or row.get("end_date") or row.get("date") or scope_key or "")
        or None
    )


def looks_like_security_code(value: str) -> bool:
    text = value.strip()
    return "." in text and len(text) >= 8


def build_raw_dedupe_key(api_name: str, dataset_key: str, scope_key: str | None, row: dict[str, Any]) -> str:
    parts: list[str] = [f"api={api_name}", f"dataset={dataset_key}"]
    if scope_key:
        parts.append(f"scope={scope_key}")
    for field_group in (
        ("ts_code", "trade_date"),
        ("ts_code", "ann_date", "end_date"),
        ("ts_code", "end_date"),
        ("trade_date", "ts_code"),
        ("date", "title"),
        ("trade_time", "ts_code"),
    ):
        if all(row.get(field) not in (None, "") for field in field_group):
            parts.extend(f"{field}={row.get(field)}" for field in field_group)
            return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()
    normalized = dumps_jsonb(row)
    parts.append(normalized)
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()


def calendar_dates(start_date: str, end_date: str) -> list[str]:
    current = datetime.strptime(start_date, "%Y%m%d").date()
    end_value = datetime.strptime(end_date, "%Y%m%d").date()
    dates: list[str] = []
    while current <= end_value:
        dates.append(current.strftime("%Y%m%d"))
        current += timedelta(days=1)
    return dates


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Sync Tushare datasets into PostgreSQL for local quant analysis.")
    parser.add_argument("--mode", choices=("daily", "weekend", "full"), default="daily")
    parser.add_argument("--db-host", default=DEFAULT_DB_HOST)
    parser.add_argument("--db-port", type=int, default=DEFAULT_DB_PORT)
    parser.add_argument("--db-user", default=DEFAULT_DB_USER)
    parser.add_argument("--db-password", default=DEFAULT_DB_PASSWORD)
    parser.add_argument("--db-name", default=DEFAULT_DB_NAME)
    parser.add_argument("--db-connect-timeout", type=int, default=DEFAULT_DB_CONNECT_TIMEOUT_SECONDS)
    parser.add_argument("--db-connect-retries", type=int, default=DEFAULT_DB_CONNECT_RETRIES)
    parser.add_argument("--db-connect-retry-sleep", type=float, default=DEFAULT_DB_CONNECT_RETRY_SLEEP_SECONDS)
    parser.add_argument("--db-schema", default=DEFAULT_DB_SCHEMA)
    parser.add_argument("--market-data-schema", default=DEFAULT_MARKET_DATA_SCHEMA)
    parser.add_argument("--tushare-token", required=True)
    parser.add_argument("--tushare-http-url", default=DEFAULT_TUSHARE_HTTP_URL)
    parser.add_argument("--tushare-pause-ms", type=int, default=DEFAULT_TUSHARE_PAUSE_MS)
    parser.add_argument("--full-start-date", default=DEFAULT_FULL_START_DATE)
    parser.add_argument("--end-date")
    parser.add_argument("--reset-state", action="store_true")
    parser.add_argument(
        "--skip-setup",
        action="store_true",
        help="Skip base schema/table/view initialization for parallel workers when setup has already been completed.",
    )
    parser.add_argument(
        "--state-file-suffix",
        default="",
        help="Optional suffix appended to the mode-specific state file name so multiple jobs can run safely in parallel.",
    )
    parser.add_argument(
        "--only-groups",
        action="append",
        help="Comma-separated sync groups to run. Valid values: " + ", ".join(ALL_SYNC_GROUPS),
    )
    parser.add_argument(
        "--only-trade-date-datasets",
        action="append",
        help="Comma-separated marketRaw trade-date datasets. Valid values: " + ", ".join(RAW_TRADE_DATE_DATASET_NAMES),
    )
    parser.add_argument(
        "--only-ann-datasets",
        action="append",
        help="Comma-separated announcementRaw datasets. Valid values: " + ", ".join(RAW_ANN_DATASET_NAMES),
    )
    parser.add_argument(
        "--only-content-datasets",
        action="append",
        help="Comma-separated contentRaw datasets. Valid values: " + ", ".join(RAW_CALENDAR_DATASET_NAMES),
    )
    parser.add_argument(
        "--only-range-datasets",
        action="append",
        help="Comma-separated rangeRaw datasets. Valid values: " + ", ".join(RAW_RANGE_DATASET_NAMES),
    )
    parser.add_argument(
        "--only-financial-datasets",
        action="append",
        help="Comma-separated financialStatements datasets. Valid values: " + ", ".join(SYMBOL_FINANCIAL_DATASET_NAMES),
    )
    parser.add_argument(
        "--only-symbol-extra-datasets",
        action="append",
        help="Comma-separated symbolExtras datasets. Valid values: " + ", ".join(SYMBOL_RAW_DATASET_NAMES),
    )
    parser.add_argument(
        "--force-full-kline-start",
        action="store_true",
        help="In full mode, replay klineDaily from --full-start-date instead of resuming from latest kline date.",
    )
    parser.add_argument("--enable-stk-mins", action="store_true")
    parser.add_argument("--stk-mins-trade-days", type=int, default=DEFAULT_STK_MINS_TRADE_DAYS)
    parser.add_argument("--stk-mins-full-backfill-trade-days", type=int, default=DEFAULT_STK_MINS_FULL_BACKFILL_TRADE_DAYS)
    parser.add_argument("--stk-mins-limit-symbols", type=int)
    parser.add_argument("--refresh-analytics-views", action="store_true")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    parse_group_names(args.only_groups)
    parse_named_values(args.only_trade_date_datasets, RAW_TRADE_DATE_DATASET_NAMES, "trade-date dataset")
    parse_named_values(args.only_ann_datasets, RAW_ANN_DATASET_NAMES, "announcement dataset")
    parse_named_values(args.only_content_datasets, RAW_CALENDAR_DATASET_NAMES, "content dataset")
    parse_named_values(args.only_range_datasets, RAW_RANGE_DATASET_NAMES, "range dataset")
    parse_named_values(args.only_financial_datasets, SYMBOL_FINANCIAL_DATASET_NAMES, "financial dataset")
    parse_named_values(args.only_symbol_extra_datasets, SYMBOL_RAW_DATASET_NAMES, "symbol extra dataset")
    runner = TusharePostgresSyncRunner(args)
    payload = runner.run()
    print(json.dumps({"jobId": payload["jobId"], "status": payload["status"], "reportPath": str(runner.report_path)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
