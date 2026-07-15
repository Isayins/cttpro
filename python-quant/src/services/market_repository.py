from __future__ import annotations

import re
import time
from typing import Any, TypeVar

from src.config import settings
from src.database import fetch_all, fetch_one


CacheKey = TypeVar("CacheKey")


class MarketRepository:
    PRICE_SOURCE_SPECS = {
        "kline": {
            "schema_regex": r"^kline[0-9]{2}_daily$",
            "safe_regex": r"kline\d{2}_daily",
            "label": "klineYY_daily",
        },
        "forward": {
            "schema_regex": r"^stock_daily_forward_[0-9]{4}$",
            "safe_regex": r"stock_daily_forward_\d{4}",
            "label": "stock_daily_forward_YYYY",
        },
        "unadjusted": {
            "schema_regex": r"^stock_daily_unadjusted_[0-9]{4}$",
            "safe_regex": r"stock_daily_unadjusted_\d{4}",
            "label": "stock_daily_unadjusted_YYYY",
        },
    }
    PRICE_SOURCE_FALLBACKS = {
        "forward": ("forward", "unadjusted", "kline"),
        "unadjusted": ("unadjusted", "kline", "forward"),
        "kline": ("kline", "unadjusted", "forward"),
    }

    def __init__(self) -> None:
        self._price_tables: dict[str, tuple[str, ...]] = {}
        self._table_exists_cache: dict[str, bool] = {}
        self._column_exists_cache: dict[tuple[str, str], bool] = {}
        self._stocks_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}
        self._rows_cache: dict[tuple[str, str, int], tuple[float, list[dict[str, Any]]]] = {}
        self._database_bundle_cache: dict[str, tuple[float, dict[str, Any]]] = {}
        self._strategy_bundle_cache: dict[str, tuple[float, dict[str, Any]]] = {}
        self._board_stats_cache: dict[str, tuple[float, dict[str, Any]]] = {}

    def resolve_symbol(self, symbol: str | None = None) -> str | None:
        for price_source in self._metadata_price_sources():
            matched_symbol = self._resolve_known_symbol(symbol, price_source=price_source)
            if matched_symbol:
                return matched_symbol

        for price_source in self._metadata_price_sources():
            matched_symbol = self._resolve_known_symbol(settings.default_symbol, price_source=price_source)
            if matched_symbol:
                return matched_symbol

        for price_source in self._metadata_price_sources():
            row = fetch_one(
                f"""
                SELECT k.ts_code
                FROM ({self._build_price_source("symbol_trade_date", price_source=price_source)}) k
                ORDER BY k.trade_date DESC, k.ts_code ASC
                LIMIT 1
                """
            )
            if row:
                return str(row["ts_code"])
        return None

    def list_stocks(self) -> list[dict[str, Any]]:
        cached_rows = self._read_ttl_cache(self._stocks_cache, "all")
        if cached_rows is not None:
            return cached_rows

        rows: list[dict[str, Any]] = []
        if self._table_exists("stock_basic"):
            rows.extend(self._list_stock_reference_rows(include_board_stats=False))
        if self._table_exists("etf_info"):
            rows.extend(self._list_fund_reference_rows())
        if self._table_exists("index_basic"):
            rows.extend(self._list_index_reference_rows())
        if rows:
            rows.sort(key=lambda item: str(item.get("symbol") or ""))
            self._write_ttl_cache(self._stocks_cache, "all", rows, settings.stocks_cache_ttl_seconds)
            return rows

        price_sources = self._available_price_sources(settings.display_price_source, "kline")
        rows = fetch_all(
            f"""
            SELECT DISTINCT
                k.ts_code AS symbol,
                {self._build_symbol_metadata_select("k", include_board_stats=False)}
            FROM ({self._build_combined_price_source("ts_code_only", price_sources=price_sources)}) k
            {self._build_symbol_metadata_joins("k", include_board_stats=False)}
            ORDER BY k.ts_code
            """
        )
        self._write_ttl_cache(self._stocks_cache, "all", rows, settings.stocks_cache_ttl_seconds)
        return rows

    def list_screenable_stocks(self) -> list[dict[str, Any]]:
        if self._table_exists("stock_basic"):
            return self._list_stock_reference_rows()

        price_source = self.resolve_price_source(settings.signal_price_source)
        return fetch_all(
            f"""
            SELECT DISTINCT
                k.ts_code AS symbol,
                {self._build_symbol_metadata_select("k", include_board_stats=False)}
            FROM ({self._build_price_source("ts_code_only", price_source=price_source)}) k
            {self._build_symbol_metadata_joins("k", include_board_stats=False)}
            WHERE s.ts_code IS NOT NULL
            ORDER BY k.ts_code
            """
        )

    def load_rows(self, symbol: str, limit: int, *, price_source: str | None = None) -> list[dict[str, Any]]:
        resolved_source = self.resolve_price_source(price_source or settings.signal_price_source)
        safe_limit = max(1, int(limit))
        cache_key = (resolved_source, symbol, safe_limit)
        cached_rows = self._read_ttl_cache(self._rows_cache, cache_key)
        if cached_rows is not None:
            return cached_rows

        source_sql, source_params = self._build_filtered_price_source("ohlcv", price_source=resolved_source, symbol=symbol)
        rows = fetch_all(
            f"""
            SELECT
                k.ts_code,
                k.trade_date,
                k.open,
                k.high,
                k.low,
                k.close,
                k.pre_close,
                k.pct_chg,
                k.vol,
                k.amount,
                k.turnover_rate,
                k.volume_ratio,
                k.float_market_cap,
                k.total_market_cap,
                k.pe_ttm,
                k.pb,
                k.ps_ttm,
                k.ma5,
                k.ma10,
                k.ma20,
                k.ma30,
                k.ma60,
                k.ma120,
                k.ma250,
                k.listing_date,
                k.adjustment_type,
                k.is_st,
                {self._build_symbol_metadata_select("k", include_board_stats=False)}
            FROM ({source_sql}) k
            {self._build_symbol_metadata_joins("k", include_board_stats=False)}
            ORDER BY k.trade_date DESC
            LIMIT %s
            """,
            source_params + (safe_limit,),
        )
        rows.reverse()
        rows = self._enrich_rows_with_board_stats(symbol, rows)
        self._write_ttl_cache(self._rows_cache, cache_key, rows, settings.rows_cache_ttl_seconds)
        return rows

    def load_latest_row(self, symbol: str, *, price_source: str | None = None) -> dict[str, Any] | None:
        rows = self.load_rows(symbol, 1, price_source=price_source)
        return rows[-1] if rows else None

    def load_latest_rows_map(
        self,
        symbols: list[str] | tuple[str, ...],
        *,
        price_source: str | None = None,
    ) -> dict[str, dict[str, Any]]:
        cleaned_symbols = [
            str(symbol).strip()
            for symbol in symbols
            if isinstance(symbol, str) and str(symbol).strip()
        ]
        if not cleaned_symbols:
            return {}

        resolved_source = self.resolve_price_source(price_source or settings.display_price_source)
        rows_by_symbol: dict[str, dict[str, Any]] = {}
        batch_size = max(1, settings.screener_batch_symbol_limit)

        for symbol_batch in self._chunk_symbols(cleaned_symbols, batch_size):
            source_sql, source_params = self._build_batch_filtered_price_source(
                "ohlcv",
                price_source=resolved_source,
                symbols=symbol_batch,
            )
            rows = fetch_all(
                f"""
                SELECT
                    k.ts_code,
                    k.trade_date,
                    k.open,
                    k.high,
                    k.low,
                    k.close,
                    k.pre_close,
                    k.pct_chg,
                    k.vol,
                    k.amount,
                    k.turnover_rate,
                    k.volume_ratio,
                    k.float_market_cap,
                    k.total_market_cap,
                    k.pe_ttm,
                    k.pb,
                    k.ps_ttm,
                    k.ma5,
                    k.ma10,
                    k.ma20,
                    k.ma30,
                    k.ma60,
                    k.ma120,
                    k.ma250,
                    k.listing_date,
                    k.adjustment_type,
                    k.is_st,
                    {self._build_symbol_metadata_select("k", include_board_stats=False)}
                FROM ({source_sql}) k
                INNER JOIN (
                    SELECT
                        latest.ts_code,
                        MAX(latest.trade_date) AS latest_trade_date
                    FROM ({source_sql}) latest
                    GROUP BY latest.ts_code
                ) picked
                    ON picked.ts_code = k.ts_code
                   AND picked.latest_trade_date = k.trade_date
                {self._build_symbol_metadata_joins("k", include_board_stats=False)}
                ORDER BY k.ts_code
                """,
                source_params + source_params,
            )
            for row in rows:
                symbol_key = str(row.get("ts_code") or "").strip()
                if symbol_key and symbol_key not in rows_by_symbol:
                    rows_by_symbol[symbol_key] = row

        return rows_by_symbol

    def load_prefilter_snapshots_map(
        self,
        symbols: list[str] | tuple[str, ...],
        *,
        price_source: str | None = None,
        lookback_days: int,
        required_bars: int,
    ) -> dict[str, dict[str, Any]]:
        cleaned_symbols = [
            str(symbol).strip()
            for symbol in symbols
            if isinstance(symbol, str) and str(symbol).strip()
        ]
        if not cleaned_symbols:
            return {}

        resolved_source = self.resolve_price_source(price_source or settings.signal_price_source)
        rows_by_symbol: dict[str, dict[str, Any]] = {}
        batch_size = max(1, settings.screener_batch_symbol_limit)
        safe_lookback_days = max(1, int(lookback_days))
        safe_required_bars = max(1, int(required_bars))
        window_bars = max(safe_lookback_days, safe_required_bars)

        for symbol_batch in self._chunk_symbols(cleaned_symbols, batch_size):
            source_sql, source_params = self._build_batch_filtered_price_source(
                "ohlcv",
                price_source=resolved_source,
                symbols=symbol_batch,
            )
            rows = fetch_all(
                f"""
                WITH ranked AS (
                    SELECT
                        k.ts_code,
                        k.trade_date,
                        k.amount,
                        k.turnover_rate,
                        k.volume_ratio,
                        k.float_market_cap,
                        k.total_market_cap,
                        k.pe_ttm,
                        k.pb,
                        k.listing_date,
                        k.adjustment_type,
                        k.is_st,
                        ROW_NUMBER() OVER (PARTITION BY k.ts_code ORDER BY k.trade_date DESC) AS rn
                    FROM ({source_sql}) k
                )
                SELECT
                    ranked.ts_code,
                    MAX(CASE WHEN ranked.rn = 1 THEN ranked.trade_date END) AS trade_date,
                    MAX(CASE WHEN ranked.rn = 1 THEN ranked.amount END) AS amount,
                    AVG(CASE WHEN ranked.rn <= %s THEN ranked.amount END) AS avg_amount_lookback,
                    MAX(CASE WHEN ranked.rn = 1 THEN ranked.turnover_rate END) AS turnover_rate,
                    MAX(CASE WHEN ranked.rn = 1 THEN ranked.volume_ratio END) AS volume_ratio,
                    MAX(CASE WHEN ranked.rn = 1 THEN ranked.float_market_cap END) AS float_market_cap,
                    MAX(CASE WHEN ranked.rn = 1 THEN ranked.total_market_cap END) AS total_market_cap,
                    MAX(CASE WHEN ranked.rn = 1 THEN ranked.pe_ttm END) AS pe_ttm,
                    MAX(CASE WHEN ranked.rn = 1 THEN ranked.pb END) AS pb,
                    MAX(CASE WHEN ranked.rn = 1 THEN ranked.listing_date END) AS listing_date,
                    MAX(CASE WHEN ranked.rn = 1 THEN ranked.adjustment_type END) AS adjustment_type,
                    MAX(CASE WHEN ranked.rn = 1 THEN ranked.is_st END) AS is_st,
                    COUNT(*) AS sampled_bars
                FROM ranked
                WHERE ranked.rn <= %s
                GROUP BY ranked.ts_code
                ORDER BY ranked.ts_code
                """,
                source_params + (safe_lookback_days, window_bars),
            )
            for row in rows:
                symbol_key = str(row.get("ts_code") or "").strip()
                if symbol_key and symbol_key not in rows_by_symbol:
                    rows_by_symbol[symbol_key] = row

        return rows_by_symbol

    def load_rows_map(
        self,
        symbols: list[str] | tuple[str, ...],
        limit: int,
        *,
        price_source: str | None = None,
    ) -> dict[str, list[dict[str, Any]]]:
        cleaned_symbols = [
            str(symbol).strip()
            for symbol in symbols
            if isinstance(symbol, str) and str(symbol).strip()
        ]
        if not cleaned_symbols:
            return {}

        resolved_source = self.resolve_price_source(price_source or settings.signal_price_source)
        rows_by_symbol = {symbol: [] for symbol in cleaned_symbols}
        batch_size = max(1, settings.screener_batch_symbol_limit)
        safe_limit = max(1, int(limit))

        for symbol_batch in self._chunk_symbols(cleaned_symbols, batch_size):
            source_sql, source_params = self._build_batch_filtered_price_source(
                "ohlcv",
                price_source=resolved_source,
                symbols=symbol_batch,
            )
            rows = fetch_all(
                f"""
                WITH ranked AS (
                    SELECT
                        k.ts_code,
                        k.trade_date,
                        k.open,
                        k.high,
                        k.low,
                        k.close,
                        k.pre_close,
                        k.pct_chg,
                        k.vol,
                        k.amount,
                        k.turnover_rate,
                        k.volume_ratio,
                        k.float_market_cap,
                        k.total_market_cap,
                        k.pe_ttm,
                        k.pb,
                        k.ps_ttm,
                        k.ma5,
                        k.ma10,
                        k.ma20,
                        k.ma30,
                        k.ma60,
                        k.ma120,
                        k.ma250,
                        k.listing_date,
                        k.adjustment_type,
                        k.is_st,
                        ROW_NUMBER() OVER (PARTITION BY k.ts_code ORDER BY k.trade_date DESC) AS rn
                    FROM ({source_sql}) k
                )
                SELECT
                    ranked.ts_code,
                    ranked.trade_date,
                    ranked.open,
                    ranked.high,
                    ranked.low,
                    ranked.close,
                    ranked.pre_close,
                    ranked.pct_chg,
                    ranked.vol,
                    ranked.amount,
                    ranked.turnover_rate,
                    ranked.volume_ratio,
                    ranked.float_market_cap,
                    ranked.total_market_cap,
                    ranked.pe_ttm,
                    ranked.pb,
                    ranked.ps_ttm,
                    ranked.ma5,
                    ranked.ma10,
                    ranked.ma20,
                    ranked.ma30,
                    ranked.ma60,
                    ranked.ma120,
                    ranked.ma250,
                    ranked.listing_date,
                    ranked.adjustment_type,
                    ranked.is_st
                FROM ranked
                WHERE ranked.rn <= %s
                ORDER BY ranked.ts_code, ranked.trade_date
                """,
                source_params + (safe_limit,),
            )
            for row in rows:
                symbol_key = str(row.get("ts_code") or "").strip()
                if symbol_key in rows_by_symbol:
                    rows_by_symbol[symbol_key].append(row)

        return {symbol: rows for symbol, rows in rows_by_symbol.items() if rows}

    def resolve_price_source(self, price_source: str | None = None) -> str:
        preferred = self._normalize_price_source(price_source or settings.signal_price_source)
        for candidate in self.PRICE_SOURCE_FALLBACKS[preferred]:
            if self._list_price_tables(candidate, required=False):
                return candidate

        available_patterns = ", ".join(spec["label"] for spec in self.PRICE_SOURCE_SPECS.values())
        raise RuntimeError(f"No supported market price tables found in {settings.db_name}. Expected one of: {available_patterns}")

    def get_active_price_sources(self) -> dict[str, str]:
        return {
            "display": self.resolve_price_source(settings.display_price_source),
            "signal": self.resolve_price_source(settings.signal_price_source),
        }

    def load_database_bundle(self, symbol: str) -> dict[str, Any]:
        cached_bundle = self._read_ttl_cache(self._database_bundle_cache, symbol)
        if cached_bundle is not None:
            return cached_bundle

        bundle = {
            "securityDetails": self.load_security_details(symbol),
            "financials": {
                "finaIndicator": self._load_latest_financial_record("stock_fina_indicator", symbol),
                "income": self._load_latest_financial_record("stock_income", symbol),
                "balanceSheet": self._load_latest_financial_record("stock_balancesheet", symbol),
                "cashflow": self._load_latest_financial_record("stock_cashflow", symbol),
            },
            "rawDatasets": {
                "dailyBasic": self._load_latest_raw_dataset(symbol, "daily_basic"),
                "moneyflow": self._load_latest_raw_dataset(symbol, "moneyflow"),
                "stkLimit": self._load_latest_raw_dataset(symbol, "stk_limit"),
                "suspendD": self._load_latest_raw_dataset(symbol, "suspend_d"),
                "fundNav": self._load_latest_raw_dataset(symbol, "fund_nav"),
                "fundShare": self._load_latest_raw_dataset(symbol, "fund_share"),
                "holderNumber": self._load_latest_raw_dataset(symbol, "stk_holdernumber"),
                "pledgeStat": self._load_latest_raw_dataset(symbol, "pledge_stat"),
            },
            "adjFactor": self._load_adj_factor_summary(symbol),
        }
        self._write_ttl_cache(
            self._database_bundle_cache,
            symbol,
            bundle,
            settings.database_bundle_cache_ttl_seconds,
        )
        return bundle

    def load_strategy_bundle(self, symbol: str) -> dict[str, Any]:
        cached_bundle = self._read_ttl_cache(self._strategy_bundle_cache, symbol)
        if cached_bundle is not None:
            return cached_bundle

        bundle = {
            "securityDetails": {},
            "financials": {
                "finaIndicator": self._load_latest_financial_record("stock_fina_indicator", symbol),
            },
            "rawDatasets": {
                "dailyBasic": self._load_latest_raw_dataset(symbol, "daily_basic"),
                "moneyflow": self._load_latest_raw_dataset(symbol, "moneyflow"),
            },
            "adjFactor": None,
        }
        self._write_ttl_cache(
            self._strategy_bundle_cache,
            symbol,
            bundle,
            settings.database_bundle_cache_ttl_seconds,
        )
        return bundle

    def load_screener_bundle(
        self,
        symbol: str,
        *,
        include_daily_basic: bool = True,
        include_moneyflow: bool = True,
        include_suspend: bool = True,
    ) -> dict[str, Any]:
        return {
            "securityDetails": {},
            "financials": {},
            "rawDatasets": {
                "dailyBasic": self._load_latest_raw_dataset(symbol, "daily_basic") if include_daily_basic else None,
                "moneyflow": self._load_latest_raw_dataset(symbol, "moneyflow") if include_moneyflow else None,
                "suspendD": self._load_latest_raw_dataset(symbol, "suspend_d") if include_suspend else None,
            },
            "adjFactor": None,
        }

    def load_screener_bundles_map(
        self,
        symbols: list[str] | tuple[str, ...],
        *,
        include_daily_basic: bool = True,
        include_moneyflow: bool = True,
        include_suspend: bool = True,
    ) -> dict[str, dict[str, Any]]:
        cleaned_symbols = [
            str(symbol).strip()
            for symbol in symbols
            if isinstance(symbol, str) and str(symbol).strip()
        ]
        if not cleaned_symbols:
            return {}

        bundles = {
            symbol: {
                "securityDetails": {},
                "financials": {},
                "rawDatasets": {
                    "dailyBasic": None,
                    "moneyflow": None,
                    "suspendD": None,
                },
                "adjFactor": None,
            }
            for symbol in cleaned_symbols
        }

        dataset_specs = (
            ("dailyBasic", "daily_basic", include_daily_basic),
            ("moneyflow", "moneyflow", include_moneyflow),
            ("suspendD", "suspend_d", include_suspend),
        )
        for dataset_alias, dataset_key, enabled in dataset_specs:
            if not enabled:
                continue
            raw_map = self.load_latest_raw_dataset_map(cleaned_symbols, dataset_key)
            for symbol, record in raw_map.items():
                if symbol in bundles:
                    bundles[symbol]["rawDatasets"][dataset_alias] = record

            missing_symbols = [
                symbol
                for symbol in cleaned_symbols
                if bundles[symbol]["rawDatasets"][dataset_alias] is None
            ]
            for symbol in missing_symbols:
                bundles[symbol]["rawDatasets"][dataset_alias] = self._load_latest_raw_dataset(symbol, dataset_key)

        return bundles

    def load_security_details(self, symbol: str) -> dict[str, Any]:
        if not symbol:
            return {}

        stock_join = "LEFT JOIN stock_basic s ON s.ts_code = k.ts_code" if self._table_exists("stock_basic") else ""
        etf_join = "LEFT JOIN etf_info e ON e.ts_code = k.ts_code" if self._table_exists("etf_info") else ""
        index_join = "LEFT JOIN index_basic i ON i.ts_code = k.ts_code" if self._table_exists("index_basic") else ""

        row = fetch_one(
            f"""
            SELECT
                k.ts_code AS symbol,
                {self._column_expr("stock_basic", "s", "fullname", "stockFullName")},
                {self._column_expr("stock_basic", "s", "enname", "stockEnglishName")},
                {self._column_expr("stock_basic", "s", "curr_type", "stockCurrency")},
                {self._column_expr("stock_basic", "s", "act_name", "stockActualController")},
                {self._column_expr("stock_basic", "s", "act_ent_type", "stockEntityType")},
                {self._column_expr("etf_info", "e", "fund_type", "fundType")},
                {self._column_expr("etf_info", "e", "invest_type", "fundInvestType")},
                {self._column_expr("etf_info", "e", "type", "fundStyleType")},
                {self._column_expr("etf_info", "e", "management", "fundManagement")},
                {self._column_expr("etf_info", "e", "custodian", "fundCustodian")},
                {self._column_expr("etf_info", "e", "benchmark", "fundBenchmark")},
                {self._column_expr("etf_info", "e", "trustee", "fundTrustee")},
                {self._date_expr("etf_info", "e", "issue_date", "fundIssueDate")},
                {self._date_expr("etf_info", "e", "delist_date", "fundDelistDate")},
                {self._date_expr("etf_info", "e", "due_date", "fundDueDate")},
                {self._column_expr("etf_info", "e", "issue_amount", "fundIssueAmount")},
                {self._column_expr("etf_info", "e", "m_fee", "fundManagementFee")},
                {self._column_expr("etf_info", "e", "c_fee", "fundCustodyFee")},
                {self._column_expr("etf_info", "e", "duration_year", "fundDurationYear")},
                {self._column_expr("etf_info", "e", "p_value", "fundParValue")},
                {self._column_expr("etf_info", "e", "min_amount", "fundMinAmount")},
                {self._column_expr("etf_info", "e", "exp_return", "fundExpectedReturn")},
                {self._column_expr("index_basic", "i", "publisher", "indexPublisher")},
                {self._column_expr("index_basic", "i", "index_type", "indexType")},
                {self._column_expr("index_basic", "i", "category", "indexCategory")},
                {self._date_expr("index_basic", "i", "base_date", "indexBaseDate")},
                {self._column_expr("index_basic", "i", "base_point", "indexBasePoint")},
                {self._date_expr("index_basic", "i", "exp_date", "indexExpireDate")},
                {self._column_expr("index_basic", "i", "weight_rule", "indexWeightRule")},
                {self._column_expr("index_basic", "i", "desc_text", "indexDescription")}
            FROM (SELECT %s AS ts_code) k
            {stock_join}
            {etf_join}
            {index_join}
            """,
            (symbol,),
        )
        return row or {}

    def load_board_stats(self, symbol: str) -> dict[str, Any]:
        if not symbol or not self._table_exists("ths_member"):
            return {
                "boardNames": None,
                "boardCount": 0,
            }

        cached = self._read_ttl_cache(self._board_stats_cache, symbol)
        if cached is not None:
            return cached

        board_name_expr = (
            "COALESCE(NULLIF(t.name, ''), m.ts_code)"
            if self._table_exists("ths_index")
            else "m.ts_code"
        )
        join_sql = "LEFT JOIN ths_index t ON t.ts_code = m.ts_code" if self._table_exists("ths_index") else ""
        row = fetch_one(
            f"""
            SELECT
                GROUP_CONCAT(
                    DISTINCT {board_name_expr}
                    ORDER BY {board_name_expr}
                    SEPARATOR ' / '
                ) AS boardNames,
                COUNT(DISTINCT m.ts_code) AS boardCount
            FROM ths_member m
            {join_sql}
            WHERE m.con_code = %s
            """,
            (symbol,),
        )
        board_stats = {
            "boardNames": (row or {}).get("boardNames"),
            "boardCount": int((row or {}).get("boardCount") or 0),
        }
        self._write_ttl_cache(
            self._board_stats_cache,
            symbol,
            board_stats,
            settings.stocks_cache_ttl_seconds,
        )
        return board_stats

    def _resolve_known_symbol(self, symbol: str | None, *, price_source: str | None = None) -> str | None:
        if not symbol:
            return None
        resolved_source = self.resolve_price_source(price_source or settings.display_price_source)
        source_sql, source_params = self._build_filtered_price_source(
            "ts_code_only",
            price_source=resolved_source,
            symbol=symbol,
        )
        row = fetch_one(
            f"""
            SELECT ts_code
            FROM ({source_sql}) k
            LIMIT 1
            """,
            source_params,
        )
        return str(row["ts_code"]) if row else None

    @staticmethod
    def _build_symbol_metadata_select(symbol_alias: str, *, include_board_stats: bool = True) -> str:
        board_names_expr = "board_stats.board_names" if include_board_stats else "NULL"
        board_count_expr = "COALESCE(board_stats.board_count, 0)" if include_board_stats else "0"
        return f"""
                COALESCE(
                    NULLIF(e.csname, ''),
                    NULLIF(e.extname, ''),
                    NULLIF(e.cname, ''),
                    NULLIF(s.name, ''),
                    NULLIF(i.name, ''),
                    {symbol_alias}.ts_code
                ) AS name,
                CASE
                    WHEN e.ts_code IS NOT NULL THEN 'fund'
                    WHEN s.ts_code IS NOT NULL THEN 'stock'
                    WHEN i.ts_code IS NOT NULL THEN 'index'
                    ELSE 'unknown'
                END AS securityType,
                COALESCE(NULLIF(e.exchange, ''), NULLIF(s.exchange, '')) AS exchange,
                COALESCE(NULLIF(e.market, ''), NULLIF(s.market, ''), NULLIF(i.market, '')) AS market,
                COALESCE(NULLIF(e.index_name, ''), NULLIF(i.fullname, ''), NULLIF(i.name, '')) AS indexName,
                s.industry AS industry,
                s.area AS area,
                s.list_status AS listStatus,
                DATE_FORMAT(COALESCE(e.list_date, s.list_date, i.list_date), '%%Y-%%m-%%d') AS listDate,
                {board_names_expr} AS boardNames,
                {board_count_expr} AS boardCount
        """

    @staticmethod
    def _build_symbol_metadata_joins(symbol_alias: str, *, include_board_stats: bool = True) -> str:
        board_join_sql = MarketRepository._build_board_stats_join(symbol_alias) if include_board_stats else ""
        return f"""
            LEFT JOIN etf_info e ON e.ts_code = {symbol_alias}.ts_code
            LEFT JOIN stock_basic s ON s.ts_code = {symbol_alias}.ts_code
            LEFT JOIN index_basic i ON i.ts_code = {symbol_alias}.ts_code
            {board_join_sql}
        """

    def _build_price_source(self, projection: str, *, price_source: str) -> str:
        return " UNION ALL ".join(
            self._build_price_table_query(table_name, price_source=price_source, projection=projection)
            for table_name in self._list_price_tables(price_source)
        )

    def _list_stock_reference_rows(self, *, include_board_stats: bool = True) -> list[dict[str, Any]]:
        board_names_expr = "board_stats.board_names" if include_board_stats else "NULL"
        board_count_expr = "COALESCE(board_stats.board_count, 0)" if include_board_stats else "0"
        board_join_sql = self._build_board_stats_join("s") if include_board_stats else ""
        return fetch_all(
            f"""
            SELECT
                s.ts_code AS symbol,
                COALESCE(NULLIF(s.name, ''), s.ts_code) AS name,
                'stock' AS securityType,
                s.exchange AS exchange,
                s.market AS market,
                NULL AS indexName,
                s.industry AS industry,
                s.area AS area,
                s.list_status AS listStatus,
                DATE_FORMAT(s.list_date, '%%Y-%%m-%%d') AS listDate,
                {board_names_expr} AS boardNames,
                {board_count_expr} AS boardCount
            FROM stock_basic s
            {board_join_sql}
            ORDER BY s.ts_code
            """
        )

    def _list_fund_reference_rows(self) -> list[dict[str, Any]]:
        return fetch_all(
            """
            SELECT
                e.ts_code AS symbol,
                COALESCE(NULLIF(e.csname, ''), NULLIF(e.extname, ''), NULLIF(e.cname, ''), e.ts_code) AS name,
                'fund' AS securityType,
                e.exchange AS exchange,
                e.market AS market,
                e.index_name AS indexName,
                NULL AS industry,
                NULL AS area,
                e.list_status AS listStatus,
                DATE_FORMAT(e.list_date, '%%Y-%%m-%%d') AS listDate,
                NULL AS boardNames,
                0 AS boardCount
            FROM etf_info e
            ORDER BY e.ts_code
            """
        )

    def _list_index_reference_rows(self) -> list[dict[str, Any]]:
        return fetch_all(
            """
            SELECT
                i.ts_code AS symbol,
                COALESCE(NULLIF(i.name, ''), i.ts_code) AS name,
                'index' AS securityType,
                NULL AS exchange,
                i.market AS market,
                COALESCE(NULLIF(i.fullname, ''), NULLIF(i.name, '')) AS indexName,
                NULL AS industry,
                NULL AS area,
                NULL AS listStatus,
                DATE_FORMAT(i.list_date, '%%Y-%%m-%%d') AS listDate,
                NULL AS boardNames,
                0 AS boardCount
            FROM index_basic i
            ORDER BY i.ts_code
            """
        )

    def _build_combined_price_source(self, projection: str, *, price_sources: tuple[str, ...]) -> str:
        return " UNION ALL ".join(
            self._build_price_source(projection, price_source=price_source)
            for price_source in price_sources
        )

    def _build_filtered_price_source(self, projection: str, *, price_source: str, symbol: str) -> tuple[str, tuple[Any, ...]]:
        queries: list[str] = []
        params: list[Any] = []
        for table_name in self._list_price_tables(price_source):
            query, query_params = self._build_filtered_price_table_query(
                table_name,
                price_source=price_source,
                projection=projection,
                symbol=symbol,
            )
            queries.append(query)
            params.extend(query_params)
        return " UNION ALL ".join(queries), tuple(params)

    def _build_batch_filtered_price_source(
        self,
        projection: str,
        *,
        price_source: str,
        symbols: list[str] | tuple[str, ...],
    ) -> tuple[str, tuple[Any, ...]]:
        queries: list[str] = []
        params: list[Any] = []
        for table_name in self._list_price_tables(price_source):
            query, query_params = self._build_batch_filtered_price_table_query(
                table_name,
                price_source=price_source,
                projection=projection,
                symbols=symbols,
            )
            queries.append(query)
            params.extend(query_params)
        return " UNION ALL ".join(queries), tuple(params)

    def _build_price_table_query(self, table_name: str, *, price_source: str, projection: str) -> str:
        normalized_source = self._normalize_price_source(price_source)
        if normalized_source == "kline":
            if projection == "symbol_trade_date":
                return f"SELECT ts_code, trade_date FROM `{table_name}`"
            if projection == "ts_code_only":
                return f"SELECT ts_code FROM `{table_name}`"
            if projection == "ohlcv":
                return f"""
                    SELECT
                        ts_code,
                        trade_date,
                        open,
                        high,
                        low,
                        close,
                        pre_close,
                        pct_chg,
                        vol,
                        amount,
                        NULL AS turnover_rate,
                        NULL AS volume_ratio,
                        NULL AS float_market_cap,
                        NULL AS total_market_cap,
                        NULL AS pe_ttm,
                        NULL AS pb,
                        NULL AS ps_ttm,
                        NULL AS ma5,
                        NULL AS ma10,
                        NULL AS ma20,
                        NULL AS ma30,
                        NULL AS ma60,
                        NULL AS ma120,
                        NULL AS ma250,
                        NULL AS listing_date,
                        'legacy_raw' AS adjustment_type,
                        NULL AS is_st
                    FROM `{table_name}`
                """
            raise ValueError(f"Unsupported price source projection: {projection}")

        ts_code_expr = self._normalized_ts_code_expr("p", "sb")
        if self._column_exists(table_name, "listing_date"):
            listing_date_expr = "p.listing_date"
        elif self._column_exists("stock_basic", "list_date"):
            listing_date_expr = "sb.list_date"
        else:
            listing_date_expr = "NULL"
        amount_expr = "p.turnover_value / 1000" if self._column_exists(table_name, "turnover_value") else "NULL"
        turnover_rate_expr = "p.turnover_rate" if self._column_exists(table_name, "turnover_rate") else "NULL"
        volume_ratio_expr = "p.volume_ratio" if self._column_exists(table_name, "volume_ratio") else "NULL"
        float_market_cap_expr = (
            "p.float_market_cap / 10000" if self._column_exists(table_name, "float_market_cap") else "NULL"
        )
        total_market_cap_expr = (
            "p.total_market_cap / 10000" if self._column_exists(table_name, "total_market_cap") else "NULL"
        )
        pe_ttm_expr = "p.pe_ttm" if self._column_exists(table_name, "pe_ttm") else "NULL"
        pb_expr = "p.pb" if self._column_exists(table_name, "pb") else "NULL"
        ps_ttm_expr = "p.ps_ttm" if self._column_exists(table_name, "ps_ttm") else "NULL"
        ma5_expr = "p.ma_5" if self._column_exists(table_name, "ma_5") else "NULL"
        ma10_expr = "p.ma_10" if self._column_exists(table_name, "ma_10") else "NULL"
        ma20_expr = "p.ma_20" if self._column_exists(table_name, "ma_20") else "NULL"
        ma30_expr = "p.ma_30" if self._column_exists(table_name, "ma_30") else "NULL"
        ma60_expr = "p.ma_60" if self._column_exists(table_name, "ma_60") else "NULL"
        ma120_expr = "p.ma_120" if self._column_exists(table_name, "ma_120") else "NULL"
        ma250_expr = "p.ma_250" if self._column_exists(table_name, "ma_250") else "NULL"
        if self._column_exists(table_name, "adjustment_type"):
            adjustment_type_expr = "p.adjustment_type"
        elif normalized_source == "forward":
            adjustment_type_expr = "'forward'"
        elif normalized_source == "unadjusted":
            adjustment_type_expr = "'unadjusted'"
        else:
            adjustment_type_expr = "'legacy_raw'"
        is_st_expr = "p.is_st" if self._column_exists(table_name, "is_st") else "NULL"
        if projection == "symbol_trade_date":
            select_sql = f"""
                SELECT
                    {ts_code_expr} AS ts_code,
                    p.trade_date
            """
        elif projection == "ts_code_only":
            select_sql = f"""
                SELECT
                    {ts_code_expr} AS ts_code
            """
        elif projection == "ohlcv":
            select_sql = f"""
                SELECT
                    {ts_code_expr} AS ts_code,
                    p.trade_date,
                    p.open_price AS open,
                    p.high_price AS high,
                    p.low_price AS low,
                    p.close_price AS close,
                    p.prev_close_price AS pre_close,
                    p.pct_change AS pct_chg,
                    p.volume_shares AS vol,
                    {amount_expr} AS amount,
                    {turnover_rate_expr} AS turnover_rate,
                    {volume_ratio_expr} AS volume_ratio,
                    {float_market_cap_expr} AS float_market_cap,
                    {total_market_cap_expr} AS total_market_cap,
                    {pe_ttm_expr} AS pe_ttm,
                    {pb_expr} AS pb,
                    {ps_ttm_expr} AS ps_ttm,
                    {ma5_expr} AS ma5,
                    {ma10_expr} AS ma10,
                    {ma20_expr} AS ma20,
                    {ma30_expr} AS ma30,
                    {ma60_expr} AS ma60,
                    {ma120_expr} AS ma120,
                    {ma250_expr} AS ma250,
                    {listing_date_expr} AS listing_date,
                    {adjustment_type_expr} AS adjustment_type,
                    {is_st_expr} AS is_st
            """
        else:
            raise ValueError(f"Unsupported price source projection: {projection}")

        return f"""
            {select_sql}
            FROM `{table_name}` p
            LEFT JOIN stock_basic sb ON sb.symbol = p.symbol
        """

    @staticmethod
    def _build_board_stats_join(symbol_alias: str) -> str:
        return f"""
            LEFT JOIN (
                SELECT
                    m.con_code,
                    GROUP_CONCAT(
                        DISTINCT COALESCE(NULLIF(t.name, ''), m.ts_code)
                        ORDER BY COALESCE(NULLIF(t.name, ''), m.ts_code)
                        SEPARATOR ' / '
                    ) AS board_names,
                    COUNT(DISTINCT m.ts_code) AS board_count
                FROM ths_member m
                LEFT JOIN ths_index t ON t.ts_code = m.ts_code
                GROUP BY m.con_code
            ) board_stats ON board_stats.con_code = {symbol_alias}.ts_code
        """

    def _build_filtered_price_table_query(
        self,
        table_name: str,
        *,
        price_source: str,
        projection: str,
        symbol: str,
    ) -> tuple[str, tuple[Any, ...]]:
        normalized_source = self._normalize_price_source(price_source)
        base_symbol = self._base_symbol(symbol)
        canonical_symbol = symbol.strip() if isinstance(symbol, str) else symbol

        if normalized_source == "kline":
            query = self._build_price_table_query(table_name, price_source=price_source, projection=projection)
            return (
                f"""
                {query}
                WHERE ts_code = %s
                   OR SUBSTRING_INDEX(ts_code, '.', 1) = %s
                """,
                (canonical_symbol, base_symbol),
            )

        query = self._build_price_table_query(table_name, price_source=price_source, projection=projection)
        return (
            f"""
            {query}
            WHERE p.symbol = %s
            """,
            (base_symbol,),
        )

    def _build_batch_filtered_price_table_query(
        self,
        table_name: str,
        *,
        price_source: str,
        projection: str,
        symbols: list[str] | tuple[str, ...],
    ) -> tuple[str, tuple[Any, ...]]:
        normalized_source = self._normalize_price_source(price_source)
        canonical_symbols = tuple(
            symbol.strip()
            for symbol in symbols
            if isinstance(symbol, str) and symbol.strip()
        )
        if not canonical_symbols:
            raise ValueError("At least one symbol is required")

        base_symbols = tuple(dict.fromkeys(self._base_symbol(symbol) for symbol in canonical_symbols))
        query = self._build_price_table_query(table_name, price_source=price_source, projection=projection)

        if normalized_source == "kline":
            full_placeholders = ", ".join(["%s"] * len(canonical_symbols))
            base_placeholders = ", ".join(["%s"] * len(base_symbols))
            return (
                f"""
                {query}
                WHERE ts_code IN ({full_placeholders})
                   OR SUBSTRING_INDEX(ts_code, '.', 1) IN ({base_placeholders})
                """,
                canonical_symbols + base_symbols,
            )

        base_placeholders = ", ".join(["%s"] * len(base_symbols))
        return (
            f"""
            {query}
            WHERE p.symbol IN ({base_placeholders})
            """,
            base_symbols,
        )

    @staticmethod
    def _normalized_ts_code_expr(source_alias: str, stock_alias: str) -> str:
        return f"""
            COALESCE(
                NULLIF({stock_alias}.ts_code, ''),
                CASE
                    WHEN {source_alias}.symbol LIKE '%%.%%' THEN {source_alias}.symbol
                    WHEN {source_alias}.symbol REGEXP '^(43|83|87|88|92)[0-9]{{4}}$' THEN CONCAT({source_alias}.symbol, '.BJ')
                    WHEN {source_alias}.symbol REGEXP '^(50|51|58|60|68|90)[0-9]{{4}}$' THEN CONCAT({source_alias}.symbol, '.SH')
                    WHEN {source_alias}.symbol REGEXP '^[0-9]{{6}}$' THEN CONCAT({source_alias}.symbol, '.SZ')
                    ELSE {source_alias}.symbol
                END
            )
        """

    @staticmethod
    def _base_symbol(symbol: str | None) -> str:
        if not symbol:
            return ""
        return str(symbol).strip().split(".", 1)[0]

    def _load_latest_financial_record(self, table_name: str, symbol: str) -> dict[str, Any] | None:
        if not self._table_exists(table_name):
            return None
        return fetch_one(
            f"""
            SELECT
                ts_code,
                DATE_FORMAT(ann_date, '%%Y-%%m-%%d') AS ann_date,
                DATE_FORMAT(f_ann_date, '%%Y-%%m-%%d') AS f_ann_date,
                DATE_FORMAT(end_date, '%%Y-%%m-%%d') AS end_date,
                report_type,
                comp_type,
                end_type,
                raw_json,
                DATE_FORMAT(update_time, '%%Y-%%m-%%d %%H:%%i:%%s') AS update_time
            FROM `{table_name}`
            WHERE ts_code = %s
            ORDER BY end_date DESC, ann_date DESC, update_time DESC
            LIMIT 1
            """,
            (symbol,),
        )

    def _load_latest_raw_dataset(self, symbol: str, dataset_key: str) -> dict[str, Any] | None:
        if not self._table_exists("tushare_raw_data"):
            return None
        match_columns = ["ts_code", "scope_key"]
        if self._column_exists("tushare_raw_data", "entity_key"):
            match_columns.append("entity_key")

        for column_name in match_columns:
            row = fetch_one(
                f"""
                SELECT
                    dataset_key,
                    scope_key,
                    ts_code,
                    {self._column_expr("tushare_raw_data", "r", "entity_key", "entity_key")},
                    DATE_FORMAT(trade_date, '%%Y-%%m-%%d') AS trade_date,
                    DATE_FORMAT(end_date, '%%Y-%%m-%%d') AS end_date,
                    DATE_FORMAT(ann_date, '%%Y-%%m-%%d') AS ann_date,
                    DATE_FORMAT(update_time, '%%Y-%%m-%%d %%H:%%i:%%s') AS update_time,
                    raw_json
                FROM tushare_raw_data r
                WHERE dataset_key = %s
                  AND {column_name} = %s
                ORDER BY COALESCE(trade_date, end_date, ann_date) DESC, update_time DESC
                LIMIT 1
                """,
                (dataset_key, symbol),
            )
            if row:
                return row
        return None

    def _enrich_rows_with_board_stats(self, symbol: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not rows:
            return rows

        board_stats = self.load_board_stats(symbol)
        board_names = board_stats.get("boardNames")
        board_count = int(board_stats.get("boardCount") or 0)
        return [
            {
                **row,
                "boardNames": board_names,
                "boardCount": board_count,
            }
            for row in rows
        ]

    def load_latest_raw_dataset_map(
        self,
        symbols: list[str] | tuple[str, ...],
        dataset_key: str,
    ) -> dict[str, dict[str, Any]]:
        if not self._table_exists("tushare_raw_data"):
            return {}

        cleaned_symbols = list(
            dict.fromkeys(
                str(symbol).strip()
                for symbol in symbols
                if isinstance(symbol, str) and str(symbol).strip()
            )
        )
        if not cleaned_symbols:
            return {}

        rows_by_symbol: dict[str, dict[str, Any]] = {}
        batch_size = max(1, settings.screener_batch_symbol_limit)

        for symbol_batch in self._chunk_symbols(cleaned_symbols, batch_size):
            placeholders = ", ".join(["%s"] * len(symbol_batch))
            rows = fetch_all(
                f"""
                SELECT
                    r.dataset_key,
                    r.scope_key,
                    r.ts_code,
                    {self._column_expr("tushare_raw_data", "r", "entity_key", "entity_key")},
                    DATE_FORMAT(r.trade_date, '%%Y-%%m-%%d') AS trade_date,
                    DATE_FORMAT(r.end_date, '%%Y-%%m-%%d') AS end_date,
                    DATE_FORMAT(r.ann_date, '%%Y-%%m-%%d') AS ann_date,
                    DATE_FORMAT(r.update_time, '%%Y-%%m-%%d %%H:%%i:%%s') AS update_time,
                    r.raw_json
                FROM tushare_raw_data r
                INNER JOIN (
                    SELECT
                        ts_code,
                        MAX(COALESCE(trade_date, end_date, ann_date)) AS latest_data_date
                    FROM tushare_raw_data
                    WHERE dataset_key = %s
                      AND ts_code IN ({placeholders})
                    GROUP BY ts_code
                ) latest_date
                    ON latest_date.ts_code = r.ts_code
                   AND latest_date.latest_data_date = COALESCE(r.trade_date, r.end_date, r.ann_date)
                INNER JOIN (
                    SELECT
                        ts_code,
                        COALESCE(trade_date, end_date, ann_date) AS data_date,
                        MAX(update_time) AS latest_update_time
                    FROM tushare_raw_data
                    WHERE dataset_key = %s
                      AND ts_code IN ({placeholders})
                    GROUP BY ts_code, COALESCE(trade_date, end_date, ann_date)
                ) latest_update
                    ON latest_update.ts_code = r.ts_code
                   AND latest_update.data_date = COALESCE(r.trade_date, r.end_date, r.ann_date)
                   AND (
                        latest_update.latest_update_time = r.update_time
                        OR (latest_update.latest_update_time IS NULL AND r.update_time IS NULL)
                   )
                WHERE r.dataset_key = %s
                  AND r.ts_code IN ({placeholders})
                ORDER BY r.ts_code
                """,
                (dataset_key, *symbol_batch, dataset_key, *symbol_batch, dataset_key, *symbol_batch),
            )
            for row in rows:
                symbol_key = str(row.get("ts_code") or "").strip()
                if symbol_key and symbol_key not in rows_by_symbol:
                    rows_by_symbol[symbol_key] = row

        return rows_by_symbol

    def _load_adj_factor_summary(self, symbol: str) -> dict[str, Any] | None:
        for table_name in ("stock_adj_factor", "fund_adj_factor"):
            if not self._table_exists(table_name):
                continue

            latest = fetch_one(
                f"""
                SELECT
                    DATE_FORMAT(trade_date, '%%Y-%%m-%%d') AS trade_date,
                    adj_factor
                FROM `{table_name}`
                WHERE ts_code = %s
                ORDER BY trade_date DESC
                LIMIT 1
                """,
                (symbol,),
            )
            if latest is None:
                continue

            earliest = fetch_one(
                f"""
                SELECT
                    DATE_FORMAT(trade_date, '%%Y-%%m-%%d') AS trade_date,
                    adj_factor
                FROM `{table_name}`
                WHERE ts_code = %s
                ORDER BY trade_date ASC
                LIMIT 1
                """,
                (symbol,),
            )
            count_row = fetch_one(
                f"""
                SELECT COUNT(*) AS record_count
                FROM `{table_name}`
                WHERE ts_code = %s
                """,
                (symbol,),
            )

            latest_factor = float(latest.get("adj_factor") or 0)
            earliest_factor = float((earliest or {}).get("adj_factor") or 0)
            factor_change_pct = (latest_factor / earliest_factor - 1) * 100 if earliest_factor > 0 else 0
            return {
                "table": table_name,
                "latestTradeDate": latest.get("trade_date"),
                "latestFactor": latest_factor,
                "earliestTradeDate": (earliest or {}).get("trade_date"),
                "earliestFactor": earliest_factor,
                "factorChangePct": factor_change_pct,
                "recordCount": int((count_row or {}).get("record_count") or 0),
            }

        return None

    def _table_exists(self, table_name: str) -> bool:
        cached = self._table_exists_cache.get(table_name)
        if cached is not None:
            return cached

        row = fetch_one(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_name = %s
            LIMIT 1
            """,
            (settings.db_name, table_name),
        )
        exists = row is not None
        self._table_exists_cache[table_name] = exists
        return exists

    def _column_exists(self, table_name: str, column_name: str) -> bool:
        cache_key = (table_name, column_name)
        cached = self._column_exists_cache.get(cache_key)
        if cached is not None:
            return cached
        if not self._table_exists(table_name):
            self._column_exists_cache[cache_key] = False
            return False

        row = fetch_one(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = %s
              AND table_name = %s
              AND column_name = %s
            LIMIT 1
            """,
            (settings.db_name, table_name, column_name),
        )
        exists = row is not None
        self._column_exists_cache[cache_key] = exists
        return exists

    def _column_expr(self, table_name: str, table_alias: str, column_name: str, result_alias: str) -> str:
        if self._column_exists(table_name, column_name):
            return f"{table_alias}.{column_name} AS {result_alias}"
        return f"NULL AS {result_alias}"

    def _date_expr(self, table_name: str, table_alias: str, column_name: str, result_alias: str) -> str:
        if self._column_exists(table_name, column_name):
            return f"DATE_FORMAT({table_alias}.{column_name}, '%%Y-%%m-%%d') AS {result_alias}"
        return f"NULL AS {result_alias}"

    @staticmethod
    def _chunk_symbols(symbols: list[str], batch_size: int) -> tuple[list[str], ...]:
        if batch_size <= 0:
            return (symbols,)
        return tuple(symbols[index : index + batch_size] for index in range(0, len(symbols), batch_size))

    @staticmethod
    def _read_ttl_cache(cache: dict[CacheKey, tuple[float, Any]], key: CacheKey) -> Any | None:
        cached = cache.get(key)
        if cached is None:
            return None
        expires_at, value = cached
        if expires_at <= time.monotonic():
            cache.pop(key, None)
            return None
        return value

    @staticmethod
    def _write_ttl_cache(
        cache: dict[CacheKey, tuple[float, Any]],
        key: CacheKey,
        value: Any,
        ttl_seconds: int,
    ) -> None:
        if ttl_seconds <= 0:
            cache.pop(key, None)
            return
        cache[key] = (time.monotonic() + ttl_seconds, value)
        MarketRepository._prune_ttl_cache(cache)

    @staticmethod
    def _prune_ttl_cache(cache: dict[CacheKey, tuple[float, Any]]) -> None:
        now = time.monotonic()
        expired_keys = [key for key, (expires_at, _) in cache.items() if expires_at <= now]
        for key in expired_keys:
            cache.pop(key, None)

    def _list_price_tables(self, price_source: str, *, required: bool = True) -> tuple[str, ...]:
        normalized_source = self._normalize_price_source(price_source)
        cached = self._price_tables.get(normalized_source)
        if cached is not None:
            if required and not cached:
                label = self.PRICE_SOURCE_SPECS[normalized_source]["label"]
                raise RuntimeError(f"No {settings.db_name}.{label} tables found")
            return cached

        spec = self.PRICE_SOURCE_SPECS[normalized_source]
        rows = fetch_all(
            f"""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_name REGEXP '{spec["schema_regex"]}'
            ORDER BY table_name
            """,
            (settings.db_name,),
        )
        tables = tuple(
            str(self._pick_row_value(row, "table_name"))
            for row in rows
            if self._pick_row_value(row, "table_name")
            and self._is_safe_table_name(str(self._pick_row_value(row, "table_name")), price_source=normalized_source)
        )
        self._price_tables[normalized_source] = tables

        if required and not tables:
            raise RuntimeError(f"No {settings.db_name}.{spec['label']} tables found")
        return tables

    @classmethod
    def _is_safe_table_name(cls, table_name: str, *, price_source: str) -> bool:
        spec = cls.PRICE_SOURCE_SPECS[cls._normalize_price_source(price_source)]
        return re.fullmatch(spec["safe_regex"], table_name) is not None

    @classmethod
    def _normalize_price_source(cls, price_source: str) -> str:
        normalized = (price_source or "kline").strip().lower()
        if normalized in {"raw", "legacy"}:
            normalized = "kline"
        if normalized not in cls.PRICE_SOURCE_SPECS:
            return "kline"
        return normalized

    def _metadata_price_sources(self) -> tuple[str, ...]:
        ordered = []
        for candidate in (
            settings.display_price_source,
            settings.signal_price_source,
            "unadjusted",
            "forward",
            "kline",
        ):
            normalized = self._normalize_price_source(candidate)
            if normalized not in ordered:
                ordered.append(normalized)
        return tuple(ordered)

    def _available_price_sources(self, *preferred_sources: str) -> tuple[str, ...]:
        ordered = []
        for source in preferred_sources:
            normalized = self._normalize_price_source(source)
            if normalized in ordered:
                continue
            if self._list_price_tables(normalized, required=False):
                ordered.append(normalized)
        if ordered:
            return tuple(ordered)
        return (self.resolve_price_source(settings.display_price_source),)

    @staticmethod
    def _pick_row_value(row: dict[str, Any], key: str) -> Any:
        if key in row:
            return row[key]
        upper_key = key.upper()
        if upper_key in row:
            return row[upper_key]
        return next(iter(row.values()), None)


market_repository = MarketRepository()
