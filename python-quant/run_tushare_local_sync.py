from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import traceback
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Callable


DEFAULT_DB_HOST = "127.0.0.1"
DEFAULT_DB_PORT = 3306
DEFAULT_DB_USER = "root"
DEFAULT_DB_PASSWORD = "root"
DEFAULT_DB_NAME = "quant"
DEFAULT_TUSHARE_HTTP_URL = "http://tsy.xiaodefa.cn"
DEFAULT_FULL_START_DATE = "20000101"
DEFAULT_RECENT_ANN_DAYS = 45
DEFAULT_RECENT_CONTENT_DAYS = 7
DEFAULT_RECENT_FINANCIAL_DAYS = 450
DEFAULT_TUSHARE_PAUSE_MS = 400


@dataclass(frozen=True)
class TradeDateSpec:
    name: str
    mode: str
    api_name: str | None = None
    dataset_key: str | None = None
    handler_name: str | None = None
    extra_params: tuple[tuple[str, str], ...] = ()


@dataclass(frozen=True)
class CalendarDateSpec:
    name: str
    api_name: str
    dataset_key: str | None = None
    date_param: str = "date"
    extra_params: tuple[tuple[str, str], ...] = ()


@dataclass(frozen=True)
class RangeSpec:
    name: str
    api_name: str
    dataset_key: str | None = None
    start_param: str = "start_date"
    end_param: str = "end_date"
    extra_params: tuple[tuple[str, str], ...] = ()


@dataclass(frozen=True)
class SymbolSpec:
    name: str
    mode: str
    api_name: str | None = None
    dataset_key: str | None = None
    handler_name: str | None = None
    start_param: str | None = "start_date"
    end_param: str | None = "end_date"
    extra_params: tuple[tuple[str, str], ...] = ()


KLINE_TRADE_DATE_SPECS: tuple[TradeDateSpec, ...] = (
    TradeDateSpec(name="daily", mode="handler", handler_name="sync_daily_by_trade_date"),
    TradeDateSpec(name="adj_factor", mode="handler", handler_name="sync_adj_factor_by_trade_date"),
)

RAW_TRADE_DATE_SPECS: tuple[TradeDateSpec, ...] = (
    TradeDateSpec(name="daily_basic", mode="raw", api_name="daily_basic", dataset_key="daily_basic"),
    TradeDateSpec(name="moneyflow", mode="raw", api_name="moneyflow", dataset_key="moneyflow"),
    TradeDateSpec(name="bak_daily", mode="raw", api_name="bak_daily", dataset_key="bak_daily"),
    TradeDateSpec(name="cyq_perf", mode="raw", api_name="cyq_perf", dataset_key="cyq_perf"),
    TradeDateSpec(name="stk_nineturn", mode="raw", api_name="stk_nineturn", dataset_key="stk_nineturn"),
    TradeDateSpec(name="stk_limit", mode="raw", api_name="stk_limit", dataset_key="stk_limit"),
    TradeDateSpec(name="suspend_d", mode="raw", api_name="suspend_d", dataset_key="suspend_d"),
    TradeDateSpec(name="stk_auction_o", mode="raw", api_name="stk_auction_o", dataset_key="stk_auction_o"),
    TradeDateSpec(name="stk_auction_c", mode="raw", api_name="stk_auction_c", dataset_key="stk_auction_c"),
    TradeDateSpec(name="top_list", mode="raw", api_name="top_list", dataset_key="top_list"),
    TradeDateSpec(name="top_inst", mode="raw", api_name="top_inst", dataset_key="top_inst"),
    TradeDateSpec(name="margin", mode="raw", api_name="margin", dataset_key="margin"),
    TradeDateSpec(name="margin_detail", mode="raw", api_name="margin_detail", dataset_key="margin_detail"),
    TradeDateSpec(name="margin_secs", mode="raw", api_name="margin_secs", dataset_key="margin_secs"),
    TradeDateSpec(name="hk_hold", mode="raw", api_name="hk_hold", dataset_key="hk_hold"),
    TradeDateSpec(
        name="hsgt_top10_sh",
        mode="raw",
        api_name="hsgt_top10",
        dataset_key="hsgt_top10_sh",
        extra_params=(("market_type", "1"),),
    ),
    TradeDateSpec(
        name="hsgt_top10_sz",
        mode="raw",
        api_name="hsgt_top10",
        dataset_key="hsgt_top10_sz",
        extra_params=(("market_type", "3"),),
    ),
)

ANN_DATE_SPECS: tuple[CalendarDateSpec, ...] = (
    CalendarDateSpec(name="forecast", api_name="forecast", dataset_key="forecast", date_param="ann_date"),
    CalendarDateSpec(name="express", api_name="express", dataset_key="express", date_param="ann_date"),
    CalendarDateSpec(name="dividend", api_name="dividend", dataset_key="dividend", date_param="ann_date"),
    CalendarDateSpec(name="stk_holdernumber", api_name="stk_holdernumber", dataset_key="stk_holdernumber", date_param="ann_date"),
    CalendarDateSpec(name="top10_holders", api_name="top10_holders", dataset_key="top10_holders", date_param="ann_date"),
    CalendarDateSpec(name="top10_floatholders", api_name="top10_floatholders", dataset_key="top10_floatholders", date_param="ann_date"),
    CalendarDateSpec(name="stk_holdertrade", api_name="stk_holdertrade", dataset_key="stk_holdertrade", date_param="ann_date"),
)

CALENDAR_DATE_SPECS: tuple[CalendarDateSpec, ...] = (
    CalendarDateSpec(name="cctv_news", api_name="cctv_news", dataset_key="cctv_news"),
    CalendarDateSpec(name="index_global", api_name="index_global", dataset_key="index_global"),
)

RANGE_SPECS: tuple[RangeSpec, ...] = (
    RangeSpec(name="report_rc", api_name="report_rc", dataset_key="report_rc"),
    RangeSpec(name="moneyflow_hsgt", api_name="moneyflow_hsgt", dataset_key="moneyflow_hsgt"),
    RangeSpec(name="block_trade", api_name="block_trade", dataset_key="block_trade"),
    RangeSpec(name="repurchase", api_name="repurchase", dataset_key="repurchase"),
)

FULL_SYMBOL_STRUCTURED_SPECS: tuple[SymbolSpec, ...] = (
    SymbolSpec(name="income", mode="handler", handler_name="sync_income"),
    SymbolSpec(name="balancesheet", mode="handler", handler_name="sync_balancesheet"),
    SymbolSpec(name="cashflow", mode="handler", handler_name="sync_cashflow"),
    SymbolSpec(name="fina_indicator", mode="handler", handler_name="sync_fina_indicator"),
)

FULL_SYMBOL_RAW_SPECS: tuple[SymbolSpec, ...] = (
    SymbolSpec(name="fina_audit", mode="raw", api_name="fina_audit", dataset_key="fina_audit"),
    SymbolSpec(
        name="fina_mainbz_product",
        mode="raw",
        api_name="fina_mainbz",
        dataset_key="fina_mainbz_product",
        extra_params=(("type", "P"),),
    ),
    SymbolSpec(
        name="fina_mainbz_region",
        mode="raw",
        api_name="fina_mainbz",
        dataset_key="fina_mainbz_region",
        extra_params=(("type", "D"),),
    ),
    SymbolSpec(
        name="pledge_stat",
        mode="raw",
        api_name="pledge_stat",
        dataset_key="pledge_stat",
        start_param=None,
        end_param=None,
    ),
    SymbolSpec(
        name="pledge_detail",
        mode="raw",
        api_name="pledge_detail",
        dataset_key="pledge_detail",
        start_param=None,
        end_param=None,
    ),
)


class TushareLocalSyncRunner:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.root_dir = Path(__file__).resolve().parent
        self.state_dir = self.root_dir / "state"
        self.report_dir = self.root_dir / "reports" / "tushare-sync"
        self.log_dir = self.root_dir / "logs" / "tushare-sync"
        self.today = datetime.now().date()
        self.job_id = datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:8]
        self.report_path = self.report_dir / self.today.strftime("%Y%m%d") / f"{args.mode}-{self.job_id}.json"
        self.log_path = self.log_dir / f"{self.today.strftime('%Y%m%d')}-{args.mode}-{self.job_id}.log"
        self.state_path = self.state_dir / f"tushare-local-sync-{args.mode}.json"
        self.logger = logging.getLogger("tushare_local_sync")
        self.state: dict[str, Any] = {"groups": {}}
        self.sync_service: Any = None
        self.fetch_one: Callable[..., Any] | None = None
        self.fetch_all: Callable[..., Any] | None = None

    def run(self) -> dict[str, Any]:
        self._ensure_dirs()
        self._configure_logging()
        self._configure_env()
        self._load_runtime()
        if self.args.reset_state and self.state_path.exists():
            self.state_path.unlink()
        self.state = self._load_state()

        payload: dict[str, Any] = {
            "jobId": self.job_id,
            "mode": self.args.mode,
            "startedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "config": {
                "dbHost": self.args.db_host,
                "dbPort": self.args.db_port,
                "dbName": self.args.db_name,
                "httpUrl": self.args.tushare_http_url,
                "pauseMs": self.args.tushare_pause_ms,
                "fullStartDate": self.args.full_start_date,
            },
            "steps": {},
        }

        try:
            payload["steps"]["reference"] = self._sync_reference()
            payload["steps"]["klineTradeDates"] = self._sync_trade_date_group(
                "klineTradeDates",
                self._trade_dates_between(self._kline_start_date(), self._end_date()),
                KLINE_TRADE_DATE_SPECS,
                use_checkpoint=self.args.mode == "full",
            )
            payload["steps"]["marketRawTradeDates"] = self._sync_trade_date_group(
                "marketRawTradeDates",
                self._trade_dates_between(self._raw_trade_start_date(), self._end_date()),
                RAW_TRADE_DATE_SPECS,
                use_checkpoint=self.args.mode == "full",
            )
            payload["steps"]["announcementDates"] = self._sync_calendar_group(
                "announcementDates",
                self._build_calendar_dates(self._ann_start_date(), self._end_date()),
                ANN_DATE_SPECS,
            )
            payload["steps"]["contentDates"] = self._sync_calendar_group(
                "contentDates",
                self._build_calendar_dates(self._content_start_date(), self._end_date()),
                CALENDAR_DATE_SPECS,
            )
            payload["steps"]["rangeDatasets"] = self._sync_range_group(self._range_start_date(), self._end_date())
            if self.args.mode == "full":
                payload["steps"]["financialStatements"] = self._sync_symbol_group(
                    "financialStatements",
                    FULL_SYMBOL_STRUCTURED_SPECS,
                    self._load_stock_symbols(),
                    self.args.full_start_date,
                    self._end_date(),
                    use_checkpoint=True,
                )
                payload["steps"]["symbolExtras"] = self._sync_symbol_group(
                    "symbolExtras",
                    FULL_SYMBOL_RAW_SPECS,
                    self._load_stock_symbols(),
                    self.args.full_start_date,
                    self._end_date(),
                    use_checkpoint=True,
                )
            elif self.args.mode == "weekend":
                payload["steps"]["weekendBoards"] = self._sync_boards()
            payload["finishedAt"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            payload["status"] = "completed"
        except Exception as exc:
            payload["finishedAt"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            payload["status"] = "failed"
            payload["error"] = str(exc)
            payload["traceback"] = traceback.format_exc()
            self.logger.exception("Tushare local sync failed")
            raise
        finally:
            self._write_report(payload)
        return payload

    def _configure_env(self) -> None:
        if self.args.tushare_token:
            os.environ["TUSHARE_TOKEN"] = self.args.tushare_token
        os.environ["TUSHARE_HTTP_URL"] = self.args.tushare_http_url
        os.environ["STOCK_DB_HOST"] = self.args.db_host
        os.environ["STOCK_DB_PORT"] = str(self.args.db_port)
        os.environ["STOCK_DB_USER"] = self.args.db_user
        os.environ["STOCK_DB_PASSWORD"] = self.args.db_password
        os.environ["STOCK_DB_NAME"] = self.args.db_name
        os.environ["TUSHARE_REQUEST_PAUSE_MS"] = str(self.args.tushare_pause_ms)

    def _load_runtime(self) -> None:
        sys.path.insert(0, str(self.root_dir))
        from src.database import fetch_all, fetch_one  # pylint: disable=import-outside-toplevel
        from src.services.tushare_sync import tushare_sync_service  # pylint: disable=import-outside-toplevel

        self.fetch_one = fetch_one
        self.fetch_all = fetch_all
        self.sync_service = tushare_sync_service

    def _sync_reference(self) -> dict[str, Any]:
        if self.args.mode == "daily" and self._table_exists("stock_basic") and self.fetch_one is not None:
            row = self.fetch_one("SELECT COUNT(*) AS c FROM stock_basic")
            stock_basic = {"ok": True, "count": int((row or {}).get("c") or 0), "affectedRows": 0}
        else:
            stock_basic = self.sync_service.sync_stock_basic()
        trade_start_date = self._end_date() if self.args.mode == "daily" else self._kline_start_date()
        trade_cal_sse = self.sync_service.sync_trade_calendar("SSE", trade_start_date, self._end_date())
        trade_cal_szse = self.sync_service.sync_trade_calendar("SZSE", trade_start_date, self._end_date())
        result: dict[str, Any] = {
            "stockBasic": self._compact(stock_basic),
            "tradeCalSSE": self._compact(trade_cal_sse),
            "tradeCalSZSE": self._compact(trade_cal_szse),
        }
        if self.args.mode in {"full", "weekend"}:
            result["boards"] = self._sync_boards()
        return result

    def _sync_boards(self) -> dict[str, Any]:
        result = self.sync_service.sync_all_boards()
        return {
            "ok": bool(result.get("ok")),
            "thsIndex": (result.get("thsIndex") or {}).get("count", 0),
            "thsMemberRows": ((result.get("thsMember") or {}).get("quoteCount") or (result.get("thsMember") or {}).get("memberCount") or 0),
        }

    def _sync_calendar_group(
        self,
        group_name: str,
        dates: list[str],
        specs: tuple[CalendarDateSpec, ...],
    ) -> dict[str, Any]:
        group_state = self._group_state(group_name)
        offset = int(group_state.get("offset", 0)) if self.args.mode == "full" else 0
        active_dates = dates[offset:]
        totals = {spec.name: 0 for spec in specs}
        affected_rows = 0
        error_count = 0

        for index, day in enumerate(active_dates, start=offset):
            for spec in specs:
                try:
                    params = {spec.date_param: day}
                    params.update(dict(spec.extra_params))
                    result = self.sync_service.sync_raw_api(spec.api_name, params, dataset_key=spec.dataset_key, scope_key=day)
                    totals[spec.name] += int(result.get("count") or 0)
                    affected_rows += int(result.get("affectedRows") or 0)
                except Exception as exc:
                    error_count += 1
                    self.logger.warning("%s failed for %s: %s", spec.name, day, exc)
            if self.args.mode == "full":
                group_state["offset"] = index + 1
                self._save_state()
            if (index + 1) % 10 == 0:
                self.logger.info("%s progress: %s/%s", group_name, index + 1, len(dates))

        if self.args.mode == "full":
            group_state["done"] = True
            self._save_state()

        return {
            "dateCount": len(dates),
            "recordCount": totals,
            "affectedRows": affected_rows,
            "errorCount": error_count,
            "startDate": dates[0] if dates else None,
            "endDate": dates[-1] if dates else None,
        }

    def _sync_trade_date_group(
        self,
        group_name: str,
        trade_dates: list[str],
        specs: tuple[TradeDateSpec, ...],
        *,
        use_checkpoint: bool,
    ) -> dict[str, Any]:
        return self._process_trade_dates(group_name, trade_dates, specs, use_checkpoint=use_checkpoint)

    def _sync_range_group(self, start_date: str, end_date: str) -> dict[str, Any]:
        totals: dict[str, int] = {}
        affected_rows = 0
        error_count = 0
        for spec in RANGE_SPECS:
            params = {spec.start_param: start_date, spec.end_param: end_date}
            params.update(dict(spec.extra_params))
            try:
                result = self.sync_service.sync_raw_api(spec.api_name, params, dataset_key=spec.dataset_key, scope_key=f"{start_date}:{end_date}")
                totals[spec.name] = int(result.get("count") or 0)
                affected_rows += int(result.get("affectedRows") or 0)
            except Exception as exc:
                totals[spec.name] = 0
                error_count += 1
                self.logger.warning("%s failed: %s", spec.name, exc)
        return {
            "startDate": start_date,
            "endDate": end_date,
            "recordCount": totals,
            "affectedRows": affected_rows,
            "errorCount": error_count,
        }

    def _sync_symbol_group(
        self,
        group_name: str,
        specs: tuple[SymbolSpec, ...],
        symbols: list[str],
        start_date: str,
        end_date: str,
        *,
        use_checkpoint: bool,
    ) -> dict[str, Any]:
        group_state = self._group_state(group_name)
        offset = int(group_state.get("offset", 0)) if use_checkpoint else 0
        active_symbols = symbols[offset:]
        totals = {spec.name: 0 for spec in specs}
        affected_rows = 0
        error_count = 0

        for index, ts_code in enumerate(active_symbols, start=offset):
            for spec in specs:
                params = dict(spec.extra_params)
                try:
                    if spec.mode == "handler" and spec.handler_name:
                        handler = getattr(self.sync_service, spec.handler_name)
                        result = handler(ts_code, start_date, end_date)
                    else:
                        params["ts_code"] = ts_code
                        if spec.start_param:
                            params[spec.start_param] = start_date
                        if spec.end_param:
                            params[spec.end_param] = end_date
                        result = self.sync_service.sync_raw_api(
                            spec.api_name,
                            params,
                            dataset_key=spec.dataset_key,
                            scope_key=ts_code,
                        )
                    totals[spec.name] += int(result.get("count") or 0)
                    affected_rows += int(result.get("affectedRows") or 0)
                except Exception as exc:
                    error_count += 1
                    self.logger.warning("%s failed for %s: %s", spec.name, ts_code, exc)
            if use_checkpoint:
                group_state["offset"] = index + 1
                self._save_state()
            if (index + 1) % 20 == 0:
                self.logger.info("%s progress: %s/%s", group_name, index + 1, len(symbols))

        if use_checkpoint:
            group_state["done"] = True
            self._save_state()

        return {
            "symbolCount": len(symbols),
            "recordCount": totals,
            "affectedRows": affected_rows,
            "errorCount": error_count,
            "startDate": start_date,
            "endDate": end_date,
        }

    def _process_trade_dates(
        self,
        group_name: str,
        trade_dates: list[str],
        specs: tuple[TradeDateSpec, ...],
        *,
        use_checkpoint: bool,
    ) -> dict[str, Any]:
        group_state = self._group_state(group_name)
        offset = int(group_state.get("offset", 0)) if use_checkpoint else 0
        active_dates = trade_dates[offset:]
        totals = {spec.name: 0 for spec in specs}
        affected_rows = 0
        error_count = 0

        for index, trade_date in enumerate(active_dates, start=offset):
            for spec in specs:
                try:
                    if spec.mode == "handler" and spec.handler_name:
                        handler = getattr(self.sync_service, spec.handler_name)
                        result = handler(trade_date)
                    else:
                        params = {"trade_date": trade_date, **dict(spec.extra_params)}
                        result = self.sync_service.sync_raw_api(
                            spec.api_name,
                            params,
                            dataset_key=spec.dataset_key,
                            scope_key=trade_date,
                        )
                    totals[spec.name] += int(result.get("count") or 0)
                    affected_rows += int(result.get("affectedRows") or 0)
                except Exception as exc:
                    error_count += 1
                    self.logger.warning("%s failed for %s: %s", spec.name, trade_date, exc)
            if use_checkpoint:
                group_state["offset"] = index + 1
                self._save_state()
            if (index + 1) % 10 == 0:
                self.logger.info("%s progress: %s/%s", group_name, index + 1, len(trade_dates))

        if use_checkpoint:
            group_state["done"] = True
            self._save_state()

        return {
            "dateCount": len(trade_dates),
            "recordCount": totals,
            "affectedRows": affected_rows,
            "errorCount": error_count,
            "startDate": trade_dates[0] if trade_dates else None,
            "endDate": trade_dates[-1] if trade_dates else None,
        }

    def _load_stock_symbols(self) -> list[str]:
        if self.fetch_all is None:
            return []
        rows = self.fetch_all("SELECT ts_code FROM stock_basic WHERE ts_code IS NOT NULL ORDER BY ts_code")
        return [str(row["ts_code"]) for row in rows if row.get("ts_code")]

    def _trade_dates_between(self, start_date: str, end_date: str) -> list[str]:
        rows = self.sync_service.client.fetch_trade_calendar("SSE", start_date, end_date)
        return [str(row["cal_date"]) for row in rows if row.get("cal_date") and int(row.get("is_open") or 0) == 1]

    def _build_calendar_dates(self, start_date: str, end_date: str) -> list[str]:
        current = datetime.strptime(start_date, "%Y%m%d").date()
        end_value = datetime.strptime(end_date, "%Y%m%d").date()
        dates: list[str] = []
        while current <= end_value:
            dates.append(current.strftime("%Y%m%d"))
            current += timedelta(days=1)
        return dates

    def _kline_start_date(self) -> str:
        if self.args.mode == "full":
            return self.args.full_start_date
        anchor = self._latest_market_anchor_date()
        if anchor is not None:
            return (anchor - timedelta(days=1)).strftime("%Y%m%d")
        return self.args.full_start_date

    def _raw_trade_start_date(self) -> str:
        if self.args.mode == "full":
            return self.args.full_start_date
        latest = self._latest_raw_trade_anchor_date()
        if latest is not None:
            return (latest - timedelta(days=1)).strftime("%Y%m%d")
        return self._kline_start_date()

    def _ann_start_date(self) -> str:
        if self.args.mode == "full":
            return self.args.full_start_date
        latest = self._latest_raw_date("dividend", "ann_date") or self._latest_raw_date("forecast", "ann_date")
        if latest is not None:
            return (latest - timedelta(days=7)).strftime("%Y%m%d")
        return (self.today - timedelta(days=self.args.recent_ann_days)).strftime("%Y%m%d")

    def _content_start_date(self) -> str:
        if self.args.mode == "full":
            return self.args.full_start_date
        latest = self._latest_raw_date("index_global", "trade_date")
        if latest is not None:
            return (latest - timedelta(days=1)).strftime("%Y%m%d")
        return (self.today - timedelta(days=self.args.recent_content_days)).strftime("%Y%m%d")

    def _range_start_date(self) -> str:
        if self.args.mode == "full":
            return self.args.full_start_date
        latest = self._latest_raw_date("moneyflow_hsgt", "trade_date")
        if latest is not None:
            return (latest - timedelta(days=1)).strftime("%Y%m%d")
        return self._raw_trade_start_date()

    def _end_date(self) -> str:
        return self.args.end_date or self.today.strftime("%Y%m%d")

    def _latest_market_anchor_date(self) -> date | None:
        candidates = [
            self._latest_table_date_by_regex(r"^stock_daily_unadjusted_[0-9]{4}$"),
            self._latest_table_date_by_regex(r"^stock_daily_forward_adjusted_[0-9]{4}$"),
            self._latest_table_date_by_regex(r"^kline[0-9]{2}_daily$"),
            self._latest_table_date("stock_adj_factor", "trade_date"),
        ]
        valid = [value for value in candidates if value is not None]
        return max(valid) if valid else None

    def _latest_raw_trade_anchor_date(self) -> date | None:
        datasets = (
            "daily_basic",
            "moneyflow",
            "bak_daily",
            "cyq_perf",
            "stk_nineturn",
            "stk_limit",
            "stk_auction_o",
            "stk_auction_c",
            "top_list",
            "top_inst",
            "margin",
            "margin_detail",
            "margin_secs",
            "hk_hold",
            "hsgt_top10_sh",
            "hsgt_top10_sz",
        )
        dates = [self._latest_raw_date(dataset_key, "trade_date") for dataset_key in datasets]
        valid = [value for value in dates if value is not None]
        return max(valid) if valid else None

    def _latest_raw_date(self, dataset_key: str, column_name: str) -> date | None:
        if self.fetch_one is None:
            return None
        row = self.fetch_one(
            f"""
            SELECT MAX({column_name}) AS latest
            FROM tushare_raw_data
            WHERE dataset_key = %s
            """,
            (dataset_key,),
        )
        return self._to_date((row or {}).get("latest"))

    def _latest_table_date(self, table_name: str, column_name: str) -> date | None:
        if self.fetch_one is None or not self._table_exists(table_name):
            return None
        row = self.fetch_one(f"SELECT MAX({column_name}) AS latest FROM `{table_name}`")
        return self._to_date((row or {}).get("latest"))

    def _latest_table_date_by_regex(self, regex: str) -> date | None:
        if self.fetch_all is None:
            return None
        rows = self.fetch_all(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_name REGEXP %s
            ORDER BY table_name
            """,
            (self.args.db_name, regex),
        )
        latest_dates = [
            self._latest_table_date(str(row.get("table_name") or next(iter(row.values()))), "trade_date")
            for row in rows
            if row
        ]
        valid = [value for value in latest_dates if value is not None]
        return max(valid) if valid else None

    def _table_exists(self, table_name: str) -> bool:
        if self.fetch_one is None:
            return False
        row = self.fetch_one(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_name = %s
            LIMIT 1
            """,
            (self.args.db_name, table_name),
        )
        return row is not None

    def _group_state(self, group_name: str) -> dict[str, Any]:
        groups = self.state.setdefault("groups", {})
        if group_name not in groups:
            groups[group_name] = {"offset": 0, "done": False}
        return groups[group_name]

    def _load_state(self) -> dict[str, Any]:
        if not self.state_path.exists():
            return {"groups": {}}
        try:
            return json.loads(self.state_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {"groups": {}}

    def _save_state(self) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        self.state_path.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")

    def _write_report(self, payload: dict[str, Any]) -> None:
        self.report_path.parent.mkdir(parents=True, exist_ok=True)
        self.report_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

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

    @staticmethod
    def _compact(result: dict[str, Any]) -> dict[str, Any]:
        return {
            "ok": bool(result.get("ok")),
            "count": int(result.get("count") or 0),
            "affectedRows": int(result.get("affectedRows") or 0),
        }

    @staticmethod
    def _to_date(value: Any) -> date | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        text = str(value).strip()
        if not text or text.lower() in {"none", "null", "nan"}:
            return None
        for fmt in ("%Y-%m-%d", "%Y%m%d"):
            try:
                return datetime.strptime(text, fmt).date()
            except ValueError:
                continue
        return None


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run local Tushare full/incremental sync for quant analysis.")
    parser.add_argument("--mode", choices=("daily", "weekend", "full"), default="daily")
    parser.add_argument("--db-host", default=DEFAULT_DB_HOST)
    parser.add_argument("--db-port", type=int, default=DEFAULT_DB_PORT)
    parser.add_argument("--db-user", default=DEFAULT_DB_USER)
    parser.add_argument("--db-password", default=DEFAULT_DB_PASSWORD)
    parser.add_argument("--db-name", default=DEFAULT_DB_NAME)
    parser.add_argument("--tushare-token", default=os.getenv("TUSHARE_TOKEN", ""))
    parser.add_argument("--tushare-http-url", default=os.getenv("TUSHARE_HTTP_URL", DEFAULT_TUSHARE_HTTP_URL))
    parser.add_argument("--tushare-pause-ms", type=int, default=DEFAULT_TUSHARE_PAUSE_MS)
    parser.add_argument("--full-start-date", default=DEFAULT_FULL_START_DATE)
    parser.add_argument("--end-date")
    parser.add_argument("--recent-ann-days", type=int, default=DEFAULT_RECENT_ANN_DAYS)
    parser.add_argument("--recent-content-days", type=int, default=DEFAULT_RECENT_CONTENT_DAYS)
    parser.add_argument("--recent-financial-days", type=int, default=DEFAULT_RECENT_FINANCIAL_DAYS)
    parser.add_argument("--reset-state", action="store_true")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    runner = TushareLocalSyncRunner(args)
    payload = runner.run()
    print(json.dumps({"jobId": payload["jobId"], "status": payload["status"], "reportPath": str(runner.report_path)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
