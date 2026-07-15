from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:
    def load_dotenv(*_args, **_kwargs) -> bool:
        return False


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _get_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _get_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _get_csv(name: str, default: str) -> tuple[str, ...]:
    raw = os.getenv(name, default)
    return tuple(item.strip() for item in raw.split(",") if item.strip())


def _get_price_source(name: str, default: str) -> str:
    aliases = {
        "raw": "kline",
        "legacy": "kline",
    }
    valid = {"kline", "forward", "unadjusted"}
    value = os.getenv(name, default).strip().lower()
    normalized = aliases.get(value, value)
    return normalized if normalized in valid else default


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("QUANT_APP_NAME", "Python stock service")
    app_version: str = os.getenv("QUANT_APP_VERSION", "1.0.0")
    db_host: str = os.getenv("STOCK_DB_HOST", "localhost")
    db_port: int = _get_int("STOCK_DB_PORT", 3306)
    db_user: str = os.getenv("STOCK_DB_USER", "root")
    db_password: str = os.getenv("STOCK_DB_PASSWORD", "")
    db_name: str = os.getenv("STOCK_DB_NAME", "idncar")
    db_connect_timeout_seconds: int = _get_int("STOCK_DB_CONNECT_TIMEOUT_SECONDS", 5)
    db_read_timeout_seconds: int = _get_int("STOCK_DB_READ_TIMEOUT_SECONDS", 120)
    db_write_timeout_seconds: int = _get_int("STOCK_DB_WRITE_TIMEOUT_SECONDS", 120)
    service_port: int = _get_int("QUANT_SERVICE_PORT", 8735)
    default_symbol: str = os.getenv("QUANT_DEFAULT_SYMBOL", "")
    candle_limit: int = _get_int("QUANT_CANDLE_LIMIT", 60)
    screener_amount_lookback_days: int = _get_int("QUANT_SCREENER_AMOUNT_LOOKBACK_DAYS", 20)
    screener_min_avg_amount_k: int = _get_int("QUANT_SCREENER_MIN_AVG_AMOUNT_K", 300000)
    screener_min_latest_amount_k: int = _get_int("QUANT_SCREENER_MIN_LATEST_AMOUNT_K", 150000)
    screener_min_float_market_cap_w: int = _get_int("QUANT_SCREENER_MIN_FLOAT_MARKET_CAP_W", 500000)
    screener_min_total_market_cap_w: int = _get_int("QUANT_SCREENER_MIN_TOTAL_MARKET_CAP_W", 0)
    screener_min_listed_days: int = _get_int("QUANT_SCREENER_MIN_LISTED_DAYS", 120)
    screener_exclude_st: bool = _get_bool("QUANT_SCREENER_EXCLUDE_ST", True)
    screener_exclude_bse: bool = _get_bool("QUANT_SCREENER_EXCLUDE_BSE", True)
    screener_exclude_suspended: bool = _get_bool("QUANT_SCREENER_EXCLUDE_SUSPENDED", True)
    screener_exclude_non_listing_status: bool = _get_bool("QUANT_SCREENER_EXCLUDE_NON_LISTING_STATUS", True)
    screener_prefilter_bars: int = _get_int("QUANT_SCREENER_PREFILTER_BARS", 260)
    screener_strategy_bars: int = _get_int("QUANT_SCREENER_STRATEGY_BARS", 756)
    screener_batch_symbol_limit: int = _get_int("QUANT_SCREENER_BATCH_SYMBOL_LIMIT", 200)
    display_price_source: str = _get_price_source("QUANT_DISPLAY_PRICE_SOURCE", "unadjusted")
    signal_price_source: str = _get_price_source("QUANT_SIGNAL_PRICE_SOURCE", "forward")
    snapshot_cache_ttl_seconds: int = _get_int("QUANT_SNAPSHOT_CACHE_TTL_SECONDS", 8)
    screener_cache_ttl_seconds: int = _get_int("QUANT_SCREENER_CACHE_TTL_SECONDS", 20)
    screener_job_retention_seconds: int = _get_int("QUANT_SCREENER_JOB_RETENTION_SECONDS", 600)
    screener_job_poll_interval_ms: int = _get_int("QUANT_SCREENER_JOB_POLL_INTERVAL_MS", 1500)
    stocks_cache_ttl_seconds: int = _get_int("QUANT_STOCKS_CACHE_TTL_SECONDS", 300)
    rows_cache_ttl_seconds: int = _get_int("QUANT_ROWS_CACHE_TTL_SECONDS", 20)
    database_bundle_cache_ttl_seconds: int = _get_int("QUANT_DATABASE_BUNDLE_CACHE_TTL_SECONDS", 180)
    strategy_analysis_cache_ttl_seconds: int = _get_int("QUANT_STRATEGY_ANALYSIS_CACHE_TTL_SECONDS", 20)
    refresh_interval_seconds: int = _get_int("QUANT_REFRESH_INTERVAL_SECONDS", 15)
    ping_interval_seconds: int = _get_int("QUANT_PING_INTERVAL_SECONDS", 20)
    tushare_token: str = os.getenv("TUSHARE_TOKEN", "")
    tushare_http_url: str = os.getenv("TUSHARE_HTTP_URL", "http://lianghua.nanyangqiankun.top")
    tushare_default_start_date: str = os.getenv("TUSHARE_DEFAULT_START_DATE", "20240101")
    tushare_default_market: str = os.getenv("TUSHARE_DEFAULT_MARKET", "E")
    tushare_default_status: str = os.getenv("TUSHARE_DEFAULT_STATUS", "L")
    tushare_stock_statuses: tuple[str, ...] = _get_csv("TUSHARE_STOCK_STATUSES", "L,D,P")
    tushare_fund_statuses: tuple[str, ...] = _get_csv("TUSHARE_FUND_STATUSES", "L,D,I")
    tushare_fund_markets: tuple[str, ...] = _get_csv("TUSHARE_FUND_MARKETS", "E")
    tushare_index_markets: tuple[str, ...] = _get_csv("TUSHARE_INDEX_MARKETS", "CSI,SSE,SZSE,CICC,SW,MSCI")
    tushare_ths_index_types: tuple[str, ...] = _get_csv("TUSHARE_THS_INDEX_TYPES", "N,I,R,S,ST,TH,BB")
    tushare_industry_sources: tuple[str, ...] = _get_csv("TUSHARE_INDUSTRY_SOURCES", "SW2021")
    tushare_news_sources: tuple[str, ...] = _get_csv("TUSHARE_NEWS_SOURCES", "sina,wallstreetcn,10jqka,eastmoney,cls,yicai")
    tushare_major_news_sources: tuple[str, ...] = _get_csv(
        "TUSHARE_MAJOR_NEWS_SOURCES",
        "\u65b0\u6d6a\u8d22\u7ecf,\u540c\u82b1\u987a\u8d22\u7ecf,\u8d22\u8054\u793e,\u7b2c\u4e00\u8d22\u7ecf",
    )
    tushare_index_ann_sources: tuple[str, ...] = _get_csv(
        "TUSHARE_INDEX_ANN_SOURCES",
        "\u4e2d\u8bc1\u6307\u6570,\u56fd\u8bc1\u6307\u6570,\u6052\u751f\u6307\u6570,\u534e\u8bc1\u6307\u6570",
    )
    tushare_request_pause_ms: int = _get_int("TUSHARE_REQUEST_PAUSE_MS", 150)
    tushare_bulk_symbol_limit: int = _get_int("TUSHARE_BULK_SYMBOL_LIMIT", 0)


settings = Settings()
