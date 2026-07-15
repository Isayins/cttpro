from __future__ import annotations

import hashlib
import json
import re
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Iterable

from src.config import settings
from src.database import execute, execute_many, fetch_one
from src.services.tushare_client import TushareClient, tushare_client
from src.utils.dates import normalize_tushare_date, trade_year_suffix, tushare_date_to_db


class TushareSyncService:
    def __init__(self, client: TushareClient) -> None:
        self.client = client

    def ensure_reference_tables(self) -> None:
        self._ensure_etf_info_table()
        self._ensure_stock_basic_table()
        self._ensure_index_basic_table()
        self._ensure_ths_index_table()
        self._ensure_ths_member_table()

    def fetch_daily(self, ts_code: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        records = self.client.fetch_daily(ts_code, start_date, end_date)
        return self._quote_response("daily", ts_code, start_date, end_date, records)

    def fetch_weekly(self, ts_code: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        records = self.client.fetch_weekly(ts_code, start_date, end_date)
        return self._quote_response("weekly", ts_code, start_date, end_date, records)

    def fetch_monthly(self, ts_code: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        records = self.client.fetch_monthly(ts_code, start_date, end_date)
        return self._quote_response("monthly", ts_code, start_date, end_date, records)

    def fetch_fund_daily(self, ts_code: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        records = self.client.fetch_fund_daily(ts_code, start_date, end_date)
        return self._quote_response("fund_daily", ts_code, start_date, end_date, records)

    def fetch_fund_basic(self, market: str | None = None, status: str | None = None) -> dict[str, Any]:
        records = self.client.fetch_fund_basic(market, status)
        return {
            "source": "fund_basic",
            "market": market or settings.tushare_default_market,
            "status": status or settings.tushare_default_status,
            "count": len(records),
            "items": records,
        }

    def fetch_stock_basic(self, exchange: str = "", list_status: str = "L") -> dict[str, Any]:
        records = self.client.fetch_stock_basic(exchange, list_status)
        return {
            "source": "stock_basic",
            "exchange": exchange,
            "listStatus": list_status,
            "count": len(records),
            "items": records,
        }

    def fetch_trade_calendar(
        self,
        exchange: str = "SSE",
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> dict[str, Any]:
        records = self.client.fetch_trade_calendar(exchange, start_date, end_date)
        return {
            "source": "trade_cal",
            "exchange": exchange,
            "startDate": normalize_tushare_date(start_date),
            "endDate": normalize_tushare_date(end_date),
            "count": len(records),
            "items": records,
        }

    def sync_raw_api(
        self,
        api_name: str,
        params: dict[str, Any] | None = None,
        dataset_key: str | None = None,
        scope_key: str | None = None,
    ) -> dict[str, Any]:
        request_params = {key: value for key, value in (params or {}).items() if value not in (None, "")}
        rows = self.client.fetch_api(api_name, **request_params)
        return self._sync_raw_records(api_name, rows, dataset_key or api_name, scope_key, request_params)

    def sync_daily_by_trade_date(self, trade_date: str) -> dict[str, Any]:
        normalized_trade_date = normalize_tushare_date(trade_date)
        if normalized_trade_date is None:
            raise ValueError("trade_date is required")
        rows = self.client.fetch_api("daily", trade_date=normalized_trade_date)
        return self._sync_quotes("daily", normalized_trade_date, rows)

    def sync_adj_factor_by_trade_date(self, trade_date: str) -> dict[str, Any]:
        normalized_trade_date = normalize_tushare_date(trade_date)
        if normalized_trade_date is None:
            raise ValueError("trade_date is required")
        rows = self.client.fetch_api("adj_factor", trade_date=normalized_trade_date)
        self._ensure_adj_factor_table("stock_adj_factor")
        affected = execute_many(
            """
            INSERT INTO stock_adj_factor (ts_code, trade_date, adj_factor)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE
                adj_factor = VALUES(adj_factor),
                update_time = CURRENT_TIMESTAMP
            """,
            [
                (
                    row.get("ts_code"),
                    tushare_date_to_db(str(row["trade_date"])),
                    row.get("adj_factor"),
                )
                for row in rows
                if row.get("ts_code") and row.get("trade_date")
            ],
        )
        return {
            "ok": True,
            "source": "adj_factor",
            "tradeDate": normalized_trade_date,
            "count": len(rows),
            "affectedRows": affected,
            "tables": ["stock_adj_factor"],
            "message": f"Synced {len(rows)} adj_factor rows for {normalized_trade_date}",
        }

    def sync_daily(self, ts_code: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        records = self.client.fetch_daily(ts_code, start_date, end_date)
        return self._sync_quotes("daily", ts_code, records)

    def sync_weekly(self, ts_code: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        records = self.client.fetch_weekly(ts_code, start_date, end_date)
        return self._sync_quotes("weekly", ts_code, records)

    def sync_monthly(self, ts_code: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        records = self.client.fetch_monthly(ts_code, start_date, end_date)
        return self._sync_quotes("monthly", ts_code, records)

    def sync_fund_daily(self, ts_code: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        records = self.client.fetch_fund_daily(ts_code, start_date, end_date)
        return self._sync_quotes("fund_daily", ts_code, records)

    def sync_stock_basic(self, statuses: tuple[str, ...] | None = None) -> dict[str, Any]:
        active_statuses = statuses or settings.tushare_stock_statuses
        rows = self._merge_rows_by_key(
            self.client.fetch_stock_basic(exchange="", list_status=status)
            for status in active_statuses
        )
        self._ensure_stock_basic_table()
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
                self._to_db_date_or_none(row.get("list_date")),
                self._to_db_date_or_none(row.get("delist_date")),
                row.get("is_hs"),
                row.get("act_name"),
                row.get("act_ent_type"),
            )
            for row in rows
            if row.get("ts_code")
        ]
        affected = execute_many(
            """
            INSERT INTO stock_basic (
                ts_code, symbol, name, area, industry, fullname, enname, market,
                exchange, curr_type, list_status, list_date, delist_date, is_hs,
                act_name, act_ent_type
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s, %s
            )
            ON DUPLICATE KEY UPDATE
                symbol = VALUES(symbol),
                name = VALUES(name),
                area = VALUES(area),
                industry = VALUES(industry),
                fullname = VALUES(fullname),
                enname = VALUES(enname),
                market = VALUES(market),
                exchange = VALUES(exchange),
                curr_type = VALUES(curr_type),
                list_status = VALUES(list_status),
                list_date = VALUES(list_date),
                delist_date = VALUES(delist_date),
                is_hs = VALUES(is_hs),
                act_name = VALUES(act_name),
                act_ent_type = VALUES(act_ent_type),
                update_time = CURRENT_TIMESTAMP
            """,
            payloads,
        )
        return self._basic_result("stock_basic", len(rows), affected, active_statuses, None, rows)

    def sync_fund_basic_all(
        self,
        markets: tuple[str, ...] | None = None,
        statuses: tuple[str, ...] | None = None,
    ) -> dict[str, Any]:
        active_markets = markets or settings.tushare_fund_markets
        active_statuses = statuses or settings.tushare_fund_statuses
        rows = self._merge_rows_by_key(
            self.client.fetch_fund_basic(market=market, status=status)
            for market in active_markets
            for status in active_statuses
        )
        self._ensure_etf_info_table()
        payloads = [
            (
                row.get("ts_code"),
                row.get("name"),
                row.get("name"),
                row.get("name"),
                row.get("name"),
                self._resolve_exchange(row.get("ts_code")),
                row.get("benchmark"),
                row.get("market"),
                row.get("status"),
                row.get("fund_type"),
                row.get("invest_type"),
                row.get("type"),
                row.get("management"),
                row.get("custodian"),
                row.get("benchmark"),
                self._to_db_date_or_none(row.get("list_date")),
                self._to_db_date_or_none(row.get("issue_date")),
                self._to_db_date_or_none(row.get("delist_date")),
                self._to_db_date_or_none(row.get("due_date")),
                row.get("issue_amount"),
                row.get("m_fee"),
                row.get("c_fee"),
                row.get("duration_year"),
                row.get("p_value"),
                row.get("min_amount"),
                row.get("exp_return"),
                row.get("trustee"),
                self._to_db_date_or_none(row.get("purc_startdate")),
                self._to_db_date_or_none(row.get("redm_startdate")),
            )
            for row in rows
            if row.get("ts_code")
        ]
        affected = execute_many(
            """
            INSERT INTO etf_info (
                ts_code, name, cname, csname, extname, exchange, index_name, market, status,
                fund_type, invest_type, type, management, custodian, benchmark,
                list_date, issue_date, delist_date, due_date,
                issue_amount, m_fee, c_fee, duration_year, p_value, min_amount, exp_return,
                trustee, purc_startdate, redm_startdate
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s
            )
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                cname = VALUES(cname),
                csname = VALUES(csname),
                extname = VALUES(extname),
                exchange = VALUES(exchange),
                index_name = VALUES(index_name),
                market = VALUES(market),
                status = VALUES(status),
                fund_type = VALUES(fund_type),
                invest_type = VALUES(invest_type),
                type = VALUES(type),
                management = VALUES(management),
                custodian = VALUES(custodian),
                benchmark = VALUES(benchmark),
                list_date = VALUES(list_date),
                issue_date = VALUES(issue_date),
                delist_date = VALUES(delist_date),
                due_date = VALUES(due_date),
                issue_amount = VALUES(issue_amount),
                m_fee = VALUES(m_fee),
                c_fee = VALUES(c_fee),
                duration_year = VALUES(duration_year),
                p_value = VALUES(p_value),
                min_amount = VALUES(min_amount),
                exp_return = VALUES(exp_return),
                trustee = VALUES(trustee),
                purc_startdate = VALUES(purc_startdate),
                redm_startdate = VALUES(redm_startdate),
                update_time = CURRENT_TIMESTAMP
            """,
            payloads,
        )
        return self._basic_result("fund_basic", len(rows), affected, active_statuses, active_markets, rows)

    def sync_fund_basic(self, market: str | None = None, status: str | None = None) -> dict[str, Any]:
        markets = (market,) if market else settings.tushare_fund_markets
        statuses = (status,) if status else (settings.tushare_default_status,)
        return self.sync_fund_basic_all(markets, statuses)

    def sync_trade_calendar(
        self,
        exchange: str = "SSE",
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> dict[str, Any]:
        rows = self.client.fetch_trade_calendar(exchange, start_date, end_date)
        self._ensure_trade_cal_table()
        payloads = [
            (
                row.get("exchange"),
                tushare_date_to_db(str(row["cal_date"])),
                row.get("is_open"),
                self._to_db_date_or_none(row.get("pretrade_date")),
            )
            for row in rows
            if row.get("cal_date")
        ]
        affected = execute_many(
            """
            INSERT INTO trade_cal (exchange, cal_date, is_open, pretrade_date)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                is_open = VALUES(is_open),
                pretrade_date = VALUES(pretrade_date),
                update_time = CURRENT_TIMESTAMP
            """,
            payloads,
        )
        return {
            "ok": True,
            "source": "trade_cal",
            "exchange": exchange,
            "startDate": normalize_tushare_date(start_date),
            "endDate": normalize_tushare_date(end_date),
            "count": len(rows),
            "affectedRows": affected,
            "message": f"Synced {len(rows)} trade calendar rows for {exchange}",
        }

    def sync_adj_factor(self, ts_code: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        rows = self.client.fetch_adj_factor(ts_code, start_date, end_date)
        self._ensure_adj_factor_table("stock_adj_factor")
        affected = execute_many(
            """
            INSERT INTO stock_adj_factor (ts_code, trade_date, adj_factor)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE
                adj_factor = VALUES(adj_factor),
                update_time = CURRENT_TIMESTAMP
            """,
            [
                (row.get("ts_code") or ts_code, tushare_date_to_db(str(row["trade_date"])), row.get("adj_factor"))
                for row in rows
                if row.get("trade_date")
            ],
        )
        return self._simple_sync_result("adj_factor", ts_code, len(rows), affected, ["stock_adj_factor"])

    def sync_fund_adj(self, ts_code: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        rows = self.client.fetch_fund_adj(ts_code, start_date, end_date)
        self._ensure_adj_factor_table("fund_adj_factor")
        affected = execute_many(
            """
            INSERT INTO fund_adj_factor (ts_code, trade_date, adj_factor)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE
                adj_factor = VALUES(adj_factor),
                update_time = CURRENT_TIMESTAMP
            """,
            [
                (row.get("ts_code") or ts_code, tushare_date_to_db(str(row["trade_date"])), row.get("adj_factor"))
                for row in rows
                if row.get("trade_date")
            ],
        )
        return self._simple_sync_result("fund_adj", ts_code, len(rows), affected, ["fund_adj_factor"])

    def sync_index_basic(self, markets: tuple[str, ...] | None = None) -> dict[str, Any]:
        active_markets = markets or settings.tushare_index_markets
        rows = self._merge_rows_by_key(
            self.client.fetch_index_basic(market=market)
            for market in active_markets
        )
        self._ensure_index_basic_table()
        affected = execute_many(
            """
            INSERT INTO index_basic (
                ts_code, name, fullname, market, publisher, index_type, category,
                base_date, base_point, list_date, weight_rule, desc_text, exp_date
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s
            )
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                fullname = VALUES(fullname),
                market = VALUES(market),
                publisher = VALUES(publisher),
                index_type = VALUES(index_type),
                category = VALUES(category),
                base_date = VALUES(base_date),
                base_point = VALUES(base_point),
                list_date = VALUES(list_date),
                weight_rule = VALUES(weight_rule),
                desc_text = VALUES(desc_text),
                exp_date = VALUES(exp_date),
                update_time = CURRENT_TIMESTAMP
            """,
            [
                (
                    row.get("ts_code"),
                    row.get("name"),
                    row.get("fullname"),
                    row.get("market"),
                    row.get("publisher"),
                    row.get("index_type"),
                    row.get("category"),
                    self._to_db_date_or_none(row.get("base_date")),
                    row.get("base_point"),
                    self._to_db_date_or_none(row.get("list_date")),
                    row.get("weight_rule"),
                    row.get("desc"),
                    self._to_db_date_or_none(row.get("exp_date")),
                )
                for row in rows
                if row.get("ts_code")
            ],
        )
        return {
            "ok": True,
            "source": "index_basic",
            "markets": list(active_markets),
            "count": len(rows),
            "affectedRows": affected,
            "symbols": [row["ts_code"] for row in rows if row.get("ts_code")],
            "sampleSymbols": [row["ts_code"] for row in rows[:20] if row.get("ts_code")],
            "message": f"Synced {len(rows)} index basic rows",
        }

    def sync_index_daily(self, ts_code: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        return self._sync_index_quote("index_daily", ts_code, self.client.fetch_index_daily(ts_code, start_date, end_date))

    def sync_index_weekly(self, ts_code: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        return self._sync_index_quote("index_weekly", ts_code, self.client.fetch_index_weekly(ts_code, start_date, end_date))

    def sync_index_monthly(self, ts_code: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        return self._sync_index_quote("index_monthly", ts_code, self.client.fetch_index_monthly(ts_code, start_date, end_date))

    def sync_index_weight(self, index_code: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        rows = self.client.fetch_index_weight(index_code, start_date, end_date)
        self._ensure_index_weight_table()
        affected = execute_many(
            """
            INSERT INTO index_weight (
                index_code, con_code, trade_date, weight
            ) VALUES (
                %s, %s, %s, %s
            )
            ON DUPLICATE KEY UPDATE
                weight = VALUES(weight),
                update_time = CURRENT_TIMESTAMP
            """,
            [
                (
                    row.get("index_code") or index_code,
                    row.get("con_code"),
                    tushare_date_to_db(str(row["trade_date"])),
                    row.get("weight"),
                )
                for row in rows
                if row.get("trade_date") and row.get("con_code")
            ],
        )
        return self._simple_sync_result("index_weight", index_code, len(rows), affected, ["index_weight"])

    def sync_ths_index(self, types: tuple[str, ...] | None = None, exchange: str = "A") -> dict[str, Any]:
        active_types = types or settings.tushare_ths_index_types
        rows = self._merge_rows_by_key(
            self.client.fetch_ths_index(exchange=exchange, type_=type_value)
            for type_value in active_types
        )
        self._ensure_ths_index_table()
        affected = execute_many(
            """
            INSERT INTO ths_index (
                ts_code, name, count, exchange, list_date, type_name
            ) VALUES (
                %s, %s, %s, %s, %s, %s
            )
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                count = VALUES(count),
                exchange = VALUES(exchange),
                list_date = VALUES(list_date),
                type_name = VALUES(type_name),
                update_time = CURRENT_TIMESTAMP
            """,
            [
                (
                    row.get("ts_code"),
                    row.get("name"),
                    row.get("count"),
                    row.get("exchange"),
                    self._to_db_date_or_none(row.get("list_date")),
                    row.get("type"),
                )
                for row in rows
                if row.get("ts_code")
            ],
        )
        return {
            "ok": True,
            "source": "ths_index",
            "exchange": exchange,
            "types": list(active_types),
            "count": len(rows),
            "affectedRows": affected,
            "symbols": [row["ts_code"] for row in rows if row.get("ts_code")],
            "sampleSymbols": [row["ts_code"] for row in rows[:20] if row.get("ts_code")],
            "message": f"Synced {len(rows)} THS board index rows",
        }

    def sync_ths_members(self, limit: int | None = None) -> dict[str, Any]:
        board_basics = self.sync_ths_index()
        symbols = self._apply_limit(board_basics["symbols"], limit)
        self._ensure_ths_member_table()
        items: list[dict[str, Any]] = []
        errors: list[dict[str, str]] = []
        total_rows = 0
        total_affected_rows = 0
        for ts_code in symbols:
            try:
                rows = self.client.fetch_ths_member(ts_code=ts_code)
                affected = execute_many(
                    """
                    INSERT INTO ths_member (
                        ts_code, con_code, con_name, in_date, out_date, is_new
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s
                    )
                    ON DUPLICATE KEY UPDATE
                        con_name = VALUES(con_name),
                        in_date = VALUES(in_date),
                        out_date = VALUES(out_date),
                        is_new = VALUES(is_new),
                        update_time = CURRENT_TIMESTAMP
                    """,
                    [
                        (
                            row.get("ts_code") or ts_code,
                            row.get("con_code") or row.get("code"),
                            row.get("con_name") or row.get("name"),
                            self._to_db_date_or_none(row.get("in_date")),
                            self._to_db_date_or_none(row.get("out_date")),
                            row.get("is_new"),
                        )
                        for row in rows
                        if row.get("con_code") or row.get("code")
                    ],
                )
                total_rows += len(rows)
                total_affected_rows += affected
                items.append({"tsCode": ts_code, "count": len(rows), "affectedRows": affected})
                self._pause()
            except Exception as exc:
                errors.append({"tsCode": ts_code, "error": str(exc)})
        return {
            "ok": len(errors) == 0,
            "source": "ths_member",
            "boardCount": len(symbols),
            "successCount": len(items),
            "errorCount": len(errors),
            "memberCount": total_rows,
            "affectedRows": total_affected_rows,
            "sampleItems": items[:20],
            "errors": errors[:20],
        }

    def sync_income(self, ts_code: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        rows = self.client.fetch_income(ts_code, start_date, end_date)
        return self._sync_financial_table("stock_income", "income", ts_code, rows)

    def sync_balancesheet(self, ts_code: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        rows = self.client.fetch_balancesheet(ts_code, start_date, end_date)
        return self._sync_financial_table("stock_balancesheet", "balancesheet", ts_code, rows)

    def sync_cashflow(self, ts_code: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        rows = self.client.fetch_cashflow(ts_code, start_date, end_date)
        return self._sync_financial_table("stock_cashflow", "cashflow", ts_code, rows)

    def sync_fina_indicator(self, ts_code: str, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        rows = self.client.fetch_fina_indicator(ts_code, start_date, end_date)
        return self._sync_financial_table("stock_fina_indicator", "fina_indicator", ts_code, rows)

    def sync_all_stock_quotes(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        statuses: tuple[str, ...] | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        basics = self.sync_stock_basic(statuses)
        symbols = self._apply_limit(basics["symbols"], limit)
        return self._sync_stock_quote_set(symbols, start_date, end_date)

    def sync_all_fund_quotes(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        markets: tuple[str, ...] | None = None,
        statuses: tuple[str, ...] | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        basics = self.sync_fund_basic_all(markets, statuses)
        symbols = self._apply_limit(basics["symbols"], limit)
        return self._sync_fund_quote_set(symbols, start_date, end_date)

    def sync_all_adj_factors(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        stock_limit: int | None = None,
        fund_limit: int | None = None,
    ) -> dict[str, Any]:
        stock_basics = self.sync_stock_basic()
        fund_basics = self.sync_fund_basic_all()
        stock_symbols = self._apply_limit(stock_basics["symbols"], stock_limit)
        fund_symbols = self._apply_limit(fund_basics["symbols"], fund_limit)
        stock_result = self._sync_single_job_set(stock_symbols, lambda symbol: self.sync_adj_factor(symbol, start_date, end_date), "stock_adj_factor")
        fund_result = self._sync_single_job_set(fund_symbols, lambda symbol: self.sync_fund_adj(symbol, start_date, end_date), "fund_adj_factor")
        return {
            "ok": stock_result["ok"] and fund_result["ok"],
            "source": "all_adj_factors",
            "stockAdjFactor": stock_result,
            "fundAdjFactor": fund_result,
        }

    def sync_all_indices(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        markets: tuple[str, ...] | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        basics = self.sync_index_basic(markets)
        index_codes = self._apply_limit(basics["symbols"], limit)
        quote_result = self._sync_index_quote_set(index_codes, start_date, end_date)
        weight_result = self._sync_single_job_set(index_codes, lambda code: self.sync_index_weight(code, start_date, end_date), "index_weight")
        return {
            "ok": quote_result["ok"] and weight_result["ok"],
            "source": "all_indices",
            "indexBasic": self._summarize_basic_result(basics),
            "indexQuotes": quote_result,
            "indexWeights": weight_result,
        }

    def sync_all_financials(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        statuses: tuple[str, ...] | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        basics = self.sync_stock_basic(statuses)
        symbols = self._apply_limit(basics["symbols"], limit)
        items: list[dict[str, Any]] = []
        errors: list[dict[str, str]] = []
        totals = {
            "income": 0,
            "balancesheet": 0,
            "cashflow": 0,
            "fina_indicator": 0,
        }
        affected_rows = 0
        for symbol in symbols:
            try:
                income_result = self.sync_income(symbol, start_date, end_date)
                self._pause()
                balance_result = self.sync_balancesheet(symbol, start_date, end_date)
                self._pause()
                cashflow_result = self.sync_cashflow(symbol, start_date, end_date)
                self._pause()
                indicator_result = self.sync_fina_indicator(symbol, start_date, end_date)
                self._pause()
                totals["income"] += income_result["count"]
                totals["balancesheet"] += balance_result["count"]
                totals["cashflow"] += cashflow_result["count"]
                totals["fina_indicator"] += indicator_result["count"]
                affected_rows += (
                    income_result["affectedRows"]
                    + balance_result["affectedRows"]
                    + cashflow_result["affectedRows"]
                    + indicator_result["affectedRows"]
                )
                items.append(
                    {
                        "tsCode": symbol,
                        "income": self._compact_job_result(income_result),
                        "balancesheet": self._compact_job_result(balance_result),
                        "cashflow": self._compact_job_result(cashflow_result),
                        "finaIndicator": self._compact_job_result(indicator_result),
                    }
                )
            except Exception as exc:
                errors.append({"tsCode": symbol, "error": str(exc)})
        return {
            "ok": len(errors) == 0,
            "source": "all_financials",
            "symbolCount": len(symbols),
            "successCount": len(items),
            "errorCount": len(errors),
            "recordCount": totals,
            "affectedRows": affected_rows,
            "sampleItems": items[:20],
            "errors": errors[:20],
        }

    def sync_all_boards(self, limit: int | None = None) -> dict[str, Any]:
        ths_index_result = self.sync_ths_index()
        board_codes = self._apply_limit(ths_index_result["symbols"], limit)
        member_result = self._sync_ths_member_subset(board_codes)
        return {
            "ok": member_result["ok"],
            "source": "all_boards",
            "thsIndex": self._summarize_basic_result(ths_index_result),
            "thsMember": member_result,
        }

    def sync_all_raw_stock_market(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        statuses: tuple[str, ...] | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        effective_start = start_date or settings.tushare_default_start_date
        basics = self.sync_stock_basic(statuses)
        symbols = self._apply_limit(basics["symbols"], limit)
        items: list[dict[str, Any]] = []
        errors: list[dict[str, str]] = []
        totals = {
            "daily_basic": 0,
            "stk_limit": 0,
            "suspend_d": 0,
            "moneyflow": 0,
        }
        affected_rows = 0
        for symbol in symbols:
            try:
                daily_basic_result = self.sync_raw_api(
                    "daily_basic",
                    {"ts_code": symbol, "start_date": effective_start, "end_date": end_date},
                    dataset_key="daily_basic",
                    scope_key=symbol,
                )
                self._pause()
                stk_limit_result = self.sync_raw_api(
                    "stk_limit",
                    {"ts_code": symbol, "start_date": effective_start, "end_date": end_date},
                    dataset_key="stk_limit",
                    scope_key=symbol,
                )
                self._pause()
                suspend_result = self.sync_raw_api(
                    "suspend_d",
                    {"ts_code": symbol, "start_date": effective_start, "end_date": end_date},
                    dataset_key="suspend_d",
                    scope_key=symbol,
                )
                self._pause()
                moneyflow_result = self.sync_raw_api(
                    "moneyflow",
                    {"ts_code": symbol, "start_date": effective_start, "end_date": end_date},
                    dataset_key="moneyflow",
                    scope_key=symbol,
                )
                self._pause()
                totals["daily_basic"] += daily_basic_result["count"]
                totals["stk_limit"] += stk_limit_result["count"]
                totals["suspend_d"] += suspend_result["count"]
                totals["moneyflow"] += moneyflow_result["count"]
                affected_rows += (
                    daily_basic_result["affectedRows"]
                    + stk_limit_result["affectedRows"]
                    + suspend_result["affectedRows"]
                    + moneyflow_result["affectedRows"]
                )
                items.append(
                    {
                        "tsCode": symbol,
                        "dailyBasic": self._compact_job_result(daily_basic_result),
                        "stkLimit": self._compact_job_result(stk_limit_result),
                        "suspendD": self._compact_job_result(suspend_result),
                        "moneyflow": self._compact_job_result(moneyflow_result),
                    }
                )
            except Exception as exc:
                errors.append({"tsCode": symbol, "error": str(exc)})
        return {
            "ok": len(errors) == 0,
            "source": "all_raw_stock_market",
            "symbolCount": len(symbols),
            "successCount": len(items),
            "errorCount": len(errors),
            "recordCount": totals,
            "affectedRows": affected_rows,
            "sampleItems": items[:20],
            "errors": errors[:20],
        }

    def sync_all_raw_fund_extra(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        markets: tuple[str, ...] | None = None,
        statuses: tuple[str, ...] | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        basics = self.sync_fund_basic_all(markets, statuses)
        symbols = self._apply_limit(basics["symbols"], limit)
        items: list[dict[str, Any]] = []
        errors: list[dict[str, str]] = []
        totals = {
            "fund_nav": 0,
            "fund_share": 0,
        }
        affected_rows = 0
        for symbol in symbols:
            try:
                fund_nav_result = self.sync_raw_api(
                    "fund_nav",
                    {"ts_code": symbol, "end_date": end_date},
                    dataset_key="fund_nav",
                    scope_key=symbol,
                )
                self._pause()
                fund_share_result = self.sync_raw_api(
                    "fund_share",
                    {"ts_code": symbol, "start_date": start_date, "end_date": end_date},
                    dataset_key="fund_share",
                    scope_key=symbol,
                )
                self._pause()
                totals["fund_nav"] += fund_nav_result["count"]
                totals["fund_share"] += fund_share_result["count"]
                affected_rows += fund_nav_result["affectedRows"] + fund_share_result["affectedRows"]
                items.append(
                    {
                        "tsCode": symbol,
                        "fundNav": self._compact_job_result(fund_nav_result),
                        "fundShare": self._compact_job_result(fund_share_result),
                    }
                )
            except Exception as exc:
                errors.append({"tsCode": symbol, "error": str(exc)})
        return {
            "ok": len(errors) == 0,
            "source": "all_raw_fund_extra",
            "symbolCount": len(symbols),
            "successCount": len(items),
            "errorCount": len(errors),
            "recordCount": totals,
            "affectedRows": affected_rows,
            "sampleItems": items[:20],
            "errors": errors[:20],
        }

    def sync_all_raw_industries(
        self,
        sources: tuple[str, ...] | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        active_sources = sources or settings.tushare_industry_sources
        items: list[dict[str, Any]] = []
        errors: list[dict[str, str]] = []
        classify_count = 0
        member_count = 0
        affected_rows = 0
        for source in active_sources:
            try:
                classify_rows = self.client.fetch_index_classify(src=source)
                classify_result = self._sync_raw_records(
                    "index_classify",
                    classify_rows,
                    "index_classify",
                    source,
                    {"src": source},
                )
                classify_count += classify_result["count"]
                affected_rows += classify_result["affectedRows"]
                index_codes = self._apply_limit(
                    [row["index_code"] for row in classify_rows if row.get("index_code")],
                    limit,
                )
                member_result = self._sync_single_job_set(
                    index_codes,
                    lambda code: self.sync_raw_api(
                        "index_member",
                        {"index_code": code, "src": source},
                        dataset_key="index_member",
                        scope_key=code,
                    ),
                    "index_member",
                )
                member_count += member_result["quoteCount"]
                affected_rows += member_result["affectedRows"]
                items.append(
                    {
                        "sourceCode": source,
                        "indexClassify": self._compact_job_result(classify_result),
                        "indexMember": self._summarize_bulk_quote_result(member_result),
                    }
                )
            except Exception as exc:
                errors.append({"source": source, "error": str(exc)})
        return {
            "ok": len(errors) == 0,
            "source": "all_raw_industries",
            "industrySourceCount": len(active_sources),
            "successCount": len(items),
            "errorCount": len(errors),
            "recordCount": {
                "index_classify": classify_count,
                "index_member": member_count,
            },
            "affectedRows": affected_rows,
            "sampleItems": items[:20],
            "errors": errors[:20],
        }

    def sync_all_raw_shareholders(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        statuses: tuple[str, ...] | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        effective_start = start_date or settings.tushare_default_start_date
        basics = self.sync_stock_basic(statuses)
        symbols = self._apply_limit(basics["symbols"], limit)
        items: list[dict[str, Any]] = []
        errors: list[dict[str, str]] = []
        totals = {
            "stk_holdernumber": 0,
            "top10_holders": 0,
            "top10_floatholders": 0,
            "stk_holdertrade": 0,
            "pledge_stat": 0,
            "pledge_detail": 0,
        }
        affected_rows = 0
        for symbol in symbols:
            try:
                holder_number_result = self.sync_raw_api(
                    "stk_holdernumber",
                    {"ts_code": symbol, "start_date": effective_start, "end_date": end_date},
                    dataset_key="stk_holdernumber",
                    scope_key=symbol,
                )
                self._pause()
                top10_holder_result = self.sync_raw_api(
                    "top10_holders",
                    {"ts_code": symbol, "start_date": effective_start, "end_date": end_date},
                    dataset_key="top10_holders",
                    scope_key=symbol,
                )
                self._pause()
                top10_float_result = self.sync_raw_api(
                    "top10_floatholders",
                    {"ts_code": symbol, "start_date": effective_start, "end_date": end_date},
                    dataset_key="top10_floatholders",
                    scope_key=symbol,
                )
                self._pause()
                holder_trade_result = self.sync_raw_api(
                    "stk_holdertrade",
                    {"ts_code": symbol, "start_date": effective_start, "end_date": end_date},
                    dataset_key="stk_holdertrade",
                    scope_key=symbol,
                )
                self._pause()
                pledge_stat_result = self.sync_raw_api(
                    "pledge_stat",
                    {"ts_code": symbol},
                    dataset_key="pledge_stat",
                    scope_key=symbol,
                )
                self._pause()
                pledge_detail_result = self.sync_raw_api(
                    "pledge_detail",
                    {"ts_code": symbol},
                    dataset_key="pledge_detail",
                    scope_key=symbol,
                )
                self._pause()
                totals["stk_holdernumber"] += holder_number_result["count"]
                totals["top10_holders"] += top10_holder_result["count"]
                totals["top10_floatholders"] += top10_float_result["count"]
                totals["stk_holdertrade"] += holder_trade_result["count"]
                totals["pledge_stat"] += pledge_stat_result["count"]
                totals["pledge_detail"] += pledge_detail_result["count"]
                affected_rows += (
                    holder_number_result["affectedRows"]
                    + top10_holder_result["affectedRows"]
                    + top10_float_result["affectedRows"]
                    + holder_trade_result["affectedRows"]
                    + pledge_stat_result["affectedRows"]
                    + pledge_detail_result["affectedRows"]
                )
                items.append(
                    {
                        "tsCode": symbol,
                        "holderNumber": self._compact_job_result(holder_number_result),
                        "top10Holders": self._compact_job_result(top10_holder_result),
                        "top10FloatHolders": self._compact_job_result(top10_float_result),
                        "holderTrade": self._compact_job_result(holder_trade_result),
                        "pledgeStat": self._compact_job_result(pledge_stat_result),
                        "pledgeDetail": self._compact_job_result(pledge_detail_result),
                    }
                )
            except Exception as exc:
                errors.append({"tsCode": symbol, "error": str(exc)})
        return {
            "ok": len(errors) == 0,
            "source": "all_raw_shareholders",
            "symbolCount": len(symbols),
            "successCount": len(items),
            "errorCount": len(errors),
            "recordCount": totals,
            "affectedRows": affected_rows,
            "sampleItems": items[:20],
            "errors": errors[:20],
        }

    def sync_all_raw_market_events(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        effective_start = start_date or settings.tushare_default_start_date
        open_dates = self._trade_dates_in_range(effective_start, end_date)
        active_dates = self._apply_limit(open_dates, limit)
        block_trade_result = self.sync_raw_api(
            "block_trade",
            {"start_date": effective_start, "end_date": end_date},
            dataset_key="block_trade",
            scope_key=f"{normalize_tushare_date(effective_start)}:{normalize_tushare_date(end_date)}",
        )
        self._pause()
        repurchase_result = self.sync_raw_api(
            "repurchase",
            {"start_date": effective_start, "end_date": end_date},
            dataset_key="repurchase",
            scope_key=f"{normalize_tushare_date(effective_start)}:{normalize_tushare_date(end_date)}",
        )
        self._pause()
        top_list_result = self._sync_single_job_set(
            active_dates,
            lambda trade_date: self.sync_raw_api(
                "top_list",
                {"trade_date": trade_date},
                dataset_key="top_list",
                scope_key=trade_date,
            ),
            "top_list",
        )
        top_inst_result = self._sync_single_job_set(
            active_dates,
            lambda trade_date: self.sync_raw_api(
                "top_inst",
                {"trade_date": trade_date},
                dataset_key="top_inst",
                scope_key=trade_date,
            ),
            "top_inst",
        )
        return {
            "ok": all(
                [
                    block_trade_result["ok"],
                    repurchase_result["ok"],
                    top_list_result["ok"],
                    top_inst_result["ok"],
                ]
            ),
            "source": "all_raw_market_events",
            "tradeDateCount": len(active_dates),
            "recordCount": {
                "block_trade": block_trade_result["count"],
                "repurchase": repurchase_result["count"],
                "top_list": top_list_result["quoteCount"],
                "top_inst": top_inst_result["quoteCount"],
            },
            "affectedRows": (
                block_trade_result["affectedRows"]
                + repurchase_result["affectedRows"]
                + top_list_result["affectedRows"]
                + top_inst_result["affectedRows"]
            ),
            "blockTrade": self._compact_job_result(block_trade_result),
            "repurchase": self._compact_job_result(repurchase_result),
            "topList": self._summarize_bulk_quote_result(top_list_result),
            "topInst": self._summarize_bulk_quote_result(top_inst_result),
        }

    def sync_all_raw_margin(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        effective_start = start_date or settings.tushare_default_start_date
        trade_dates = self._apply_limit(self._trade_dates_in_range(effective_start, end_date), limit)
        margin_result = self._sync_single_job_set(
            trade_dates,
            lambda trade_date: self.sync_raw_api(
                "margin",
                {"trade_date": trade_date},
                dataset_key="margin",
                scope_key=trade_date,
            ),
            "margin",
        )
        margin_detail_result = self._sync_single_job_set(
            trade_dates,
            lambda trade_date: self.sync_raw_api(
                "margin_detail",
                {"trade_date": trade_date},
                dataset_key="margin_detail",
                scope_key=trade_date,
            ),
            "margin_detail",
        )
        margin_secs_result = self._sync_single_job_set(
            trade_dates,
            lambda trade_date: self.sync_raw_api(
                "margin_secs",
                {"trade_date": trade_date},
                dataset_key="margin_secs",
                scope_key=trade_date,
            ),
            "margin_secs",
        )
        return {
            "ok": margin_result["ok"] and margin_detail_result["ok"] and margin_secs_result["ok"],
            "source": "all_raw_margin",
            "tradeDateCount": len(trade_dates),
            "recordCount": {
                "margin": margin_result["quoteCount"],
                "margin_detail": margin_detail_result["quoteCount"],
                "margin_secs": margin_secs_result["quoteCount"],
            },
            "affectedRows": margin_result["affectedRows"] + margin_detail_result["affectedRows"] + margin_secs_result["affectedRows"],
            "margin": self._summarize_bulk_quote_result(margin_result),
            "marginDetail": self._summarize_bulk_quote_result(margin_detail_result),
            "marginSecs": self._summarize_bulk_quote_result(margin_secs_result),
        }

    def sync_all_raw_content(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        news_sources: tuple[str, ...] | None = None,
        major_news_sources: tuple[str, ...] | None = None,
        index_ann_sources: tuple[str, ...] | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        effective_start = start_date or settings.tushare_default_start_date
        calendar_dates = self._apply_limit(self._calendar_dates_in_range(effective_start, end_date), limit)
        active_news_sources = news_sources or settings.tushare_news_sources
        active_major_news_sources = major_news_sources or settings.tushare_major_news_sources
        active_index_ann_sources = index_ann_sources or settings.tushare_index_ann_sources

        anns_result = self._sync_single_job_set(
            calendar_dates,
            lambda day: self.sync_raw_api(
                "anns_d",
                {"ann_date": day},
                dataset_key="anns_d",
                scope_key=day,
            ),
            "anns_d",
        )
        report_result = self._sync_single_job_set(
            calendar_dates,
            lambda day: self.sync_raw_api(
                "report_rc",
                {"report_date": day},
                dataset_key="report_rc",
                scope_key=day,
            ),
            "report_rc",
        )
        cctv_result = self._sync_single_job_set(
            calendar_dates,
            lambda day: self.sync_raw_api(
                "cctv_news",
                {"date": day},
                dataset_key="cctv_news",
                scope_key=day,
            ),
            "cctv_news",
        )

        news_items: list[dict[str, Any]] = []
        news_errors: list[dict[str, str]] = []
        news_rows = 0
        news_affected_rows = 0
        for source in active_news_sources:
            for day in calendar_dates:
                try:
                    start_time, end_time = self._day_datetime_window(day)
                    result = self.sync_raw_api(
                        "news",
                        {"src": source, "start_date": start_time, "end_date": end_time},
                        dataset_key="news",
                        scope_key=f"{source}:{day}",
                    )
                    news_rows += result["count"]
                    news_affected_rows += result["affectedRows"]
                    news_items.append({"source": source, "day": day, **self._compact_job_result(result)})
                    self._pause()
                except Exception as exc:
                    news_errors.append({"source": source, "day": day, "error": str(exc)})
        news_result = {
            "ok": len(news_errors) == 0,
            "source": "news",
            "jobCount": len(active_news_sources) * len(calendar_dates),
            "successCount": len(news_items),
            "errorCount": len(news_errors),
            "quoteCount": news_rows,
            "affectedRows": news_affected_rows,
            "sampleItems": news_items[:20],
            "errors": news_errors[:20],
        }

        major_news_items: list[dict[str, Any]] = []
        major_news_errors: list[dict[str, str]] = []
        major_news_rows = 0
        major_news_affected_rows = 0
        for source in active_major_news_sources:
            for day in calendar_dates:
                try:
                    start_time, end_time = self._day_datetime_window(day)
                    result = self.sync_raw_api(
                        "major_news",
                        {"src": source, "start_date": start_time, "end_date": end_time},
                        dataset_key="major_news",
                        scope_key=f"{source}:{day}",
                    )
                    major_news_rows += result["count"]
                    major_news_affected_rows += result["affectedRows"]
                    major_news_items.append({"source": source, "day": day, **self._compact_job_result(result)})
                    self._pause()
                except Exception as exc:
                    major_news_errors.append({"source": source, "day": day, "error": str(exc)})
        major_news_result = {
            "ok": len(major_news_errors) == 0,
            "source": "major_news",
            "jobCount": len(active_major_news_sources) * len(calendar_dates),
            "successCount": len(major_news_items),
            "errorCount": len(major_news_errors),
            "quoteCount": major_news_rows,
            "affectedRows": major_news_affected_rows,
            "sampleItems": major_news_items[:20],
            "errors": major_news_errors[:20],
        }

        index_ann_items: list[dict[str, Any]] = []
        index_ann_errors: list[dict[str, str]] = []
        index_ann_rows = 0
        index_ann_affected_rows = 0
        for source in active_index_ann_sources:
            for day in calendar_dates:
                try:
                    result = self.sync_raw_api(
                        "index_announcement",
                        {"src": source, "ann_date": day},
                        dataset_key="index_announcement",
                        scope_key=f"{source}:{day}",
                    )
                    index_ann_rows += result["count"]
                    index_ann_affected_rows += result["affectedRows"]
                    index_ann_items.append({"source": source, "day": day, **self._compact_job_result(result)})
                    self._pause()
                except Exception as exc:
                    index_ann_errors.append({"source": source, "day": day, "error": str(exc)})
        index_ann_result = {
            "ok": len(index_ann_errors) == 0,
            "source": "index_announcement",
            "jobCount": len(active_index_ann_sources) * len(calendar_dates),
            "successCount": len(index_ann_items),
            "errorCount": len(index_ann_errors),
            "quoteCount": index_ann_rows,
            "affectedRows": index_ann_affected_rows,
            "sampleItems": index_ann_items[:20],
            "errors": index_ann_errors[:20],
        }

        return {
            "ok": all(
                [
                    anns_result["ok"],
                    report_result["ok"],
                    cctv_result["ok"],
                    news_result["ok"],
                    major_news_result["ok"],
                    index_ann_result["ok"],
                ]
            ),
            "source": "all_raw_content",
            "calendarDateCount": len(calendar_dates),
            "recordCount": {
                "anns_d": anns_result["quoteCount"],
                "report_rc": report_result["quoteCount"],
                "cctv_news": cctv_result["quoteCount"],
                "news": news_result["quoteCount"],
                "major_news": major_news_result["quoteCount"],
                "index_announcement": index_ann_result["quoteCount"],
            },
            "affectedRows": (
                anns_result["affectedRows"]
                + report_result["affectedRows"]
                + cctv_result["affectedRows"]
                + news_result["affectedRows"]
                + major_news_result["affectedRows"]
                + index_ann_result["affectedRows"]
            ),
            "anns": self._summarize_bulk_quote_result(anns_result),
            "reportRc": self._summarize_bulk_quote_result(report_result),
            "cctvNews": self._summarize_bulk_quote_result(cctv_result),
            "news": self._summarize_bulk_quote_result(news_result),
            "majorNews": self._summarize_bulk_quote_result(major_news_result),
            "indexAnnouncement": self._summarize_bulk_quote_result(index_ann_result),
        }

    def sync_raw_by_symbols(
        self,
        api_name: str,
        security_type: str = "stock",
        start_date: str | None = None,
        end_date: str | None = None,
        statuses: tuple[str, ...] | None = None,
        markets: tuple[str, ...] | None = None,
        limit: int | None = None,
        symbol_param: str = "ts_code",
        start_param: str | None = "start_date",
        end_param: str | None = "end_date",
        extra_params: dict[str, Any] | None = None,
        dataset_key: str | None = None,
    ) -> dict[str, Any]:
        symbols = self._load_symbols_by_security_type(security_type, statuses, markets, limit)
        base_params = {key: value for key, value in (extra_params or {}).items() if value not in (None, "")}
        return self._sync_single_job_set(
            symbols,
            lambda symbol: self.sync_raw_api(
                api_name,
                self._merge_raw_params(
                    base_params,
                    {
                        symbol_param: symbol,
                        start_param: start_date if start_param else None,
                        end_param: end_date if end_param else None,
                    },
                ),
                dataset_key=dataset_key or api_name,
                scope_key=symbol,
            ),
            api_name,
        )

    def sync_raw_by_trade_dates(
        self,
        api_name: str,
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int | None = None,
        date_param: str = "trade_date",
        extra_params: dict[str, Any] | None = None,
        dataset_key: str | None = None,
    ) -> dict[str, Any]:
        trade_dates = self._apply_limit(self._trade_dates_in_range(start_date, end_date), limit)
        base_params = {key: value for key, value in (extra_params or {}).items() if value not in (None, "")}
        return self._sync_single_job_set(
            trade_dates,
            lambda trade_date: self.sync_raw_api(
                api_name,
                self._merge_raw_params(base_params, {date_param: trade_date}),
                dataset_key=dataset_key or api_name,
                scope_key=trade_date,
            ),
            api_name,
        )

    def sync_raw_by_calendar_dates(
        self,
        api_name: str,
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int | None = None,
        date_param: str = "date",
        extra_params: dict[str, Any] | None = None,
        dataset_key: str | None = None,
    ) -> dict[str, Any]:
        calendar_dates = self._apply_limit(self._calendar_dates_in_range(start_date, end_date), limit)
        base_params = {key: value for key, value in (extra_params or {}).items() if value not in (None, "")}
        return self._sync_single_job_set(
            calendar_dates,
            lambda day: self.sync_raw_api(
                api_name,
                self._merge_raw_params(base_params, {date_param: day}),
                dataset_key=dataset_key or api_name,
                scope_key=day,
            ),
            api_name,
        )

    def sync_raw_by_sources(
        self,
        api_name: str,
        sources: tuple[str, ...],
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int | None = None,
        source_param: str = "src",
        date_mode: str = "datetime_window",
        date_param: str = "date",
        start_param: str = "start_date",
        end_param: str = "end_date",
        extra_params: dict[str, Any] | None = None,
        dataset_key: str | None = None,
    ) -> dict[str, Any]:
        active_dates = self._apply_limit(self._calendar_dates_in_range(start_date, end_date), limit)
        base_params = {key: value for key, value in (extra_params or {}).items() if value not in (None, "")}
        items: list[dict[str, Any]] = []
        errors: list[dict[str, str]] = []
        total_rows = 0
        total_affected_rows = 0
        for source in sources:
            for day in active_dates:
                try:
                    params = dict(base_params)
                    params[source_param] = source
                    if date_mode == "datetime_window":
                        start_value, end_value = self._day_datetime_window(day)
                        params[start_param] = start_value
                        params[end_param] = end_value
                    elif date_mode == "date":
                        params[date_param] = day
                    elif date_mode == "range":
                        params[start_param] = normalize_tushare_date(start_date) or settings.tushare_default_start_date
                        params[end_param] = normalize_tushare_date(end_date) or datetime.now().strftime("%Y%m%d")
                    else:
                        raise ValueError(f"Unsupported date_mode: {date_mode}")
                    result = self.sync_raw_api(
                        api_name,
                        params,
                        dataset_key=dataset_key or api_name,
                        scope_key=f"{source}:{day}",
                    )
                    total_rows += result["count"]
                    total_affected_rows += result["affectedRows"]
                    items.append({"source": source, "day": day, **self._compact_job_result(result)})
                    self._pause()
                except Exception as exc:
                    errors.append({"source": source, "day": day, "error": str(exc)})
        return {
            "ok": len(errors) == 0,
            "source": api_name,
            "jobCount": len(sources) * len(active_dates),
            "successCount": len(items),
            "errorCount": len(errors),
            "quoteCount": total_rows,
            "affectedRows": total_affected_rows,
            "sampleItems": items[:20],
            "errors": errors[:20],
        }

    def sync_all_raw_supported(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        stock_statuses: tuple[str, ...] | None = None,
        fund_markets: tuple[str, ...] | None = None,
        fund_statuses: tuple[str, ...] | None = None,
        industry_sources: tuple[str, ...] | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        stock_market = self.sync_all_raw_stock_market(start_date, end_date, stock_statuses, limit)
        fund_extra = self.sync_all_raw_fund_extra(start_date, end_date, fund_markets, fund_statuses, limit)
        industries = self.sync_all_raw_industries(industry_sources, limit)
        shareholders = self.sync_all_raw_shareholders(start_date, end_date, stock_statuses, limit)
        market_events = self.sync_all_raw_market_events(start_date, end_date, limit)
        margin = self.sync_all_raw_margin(start_date, end_date, limit)
        content = self.sync_all_raw_content(start_date, end_date, None, None, None, limit)
        return {
            "ok": stock_market["ok"] and fund_extra["ok"] and industries["ok"] and shareholders["ok"] and market_events["ok"] and margin["ok"] and content["ok"],
            "source": "all_raw_supported",
            "startDate": normalize_tushare_date(start_date or settings.tushare_default_start_date),
            "endDate": normalize_tushare_date(end_date),
            "stockMarket": stock_market,
            "fundExtra": fund_extra,
            "industries": industries,
            "shareholders": shareholders,
            "marketEvents": market_events,
            "margin": margin,
            "content": content,
            "message": "Completed raw mirror sync for the extended Tushare dataset batches",
        }

    def sync_all_ingestion(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        stock_statuses: tuple[str, ...] | None = None,
        fund_markets: tuple[str, ...] | None = None,
        fund_statuses: tuple[str, ...] | None = None,
        industry_sources: tuple[str, ...] | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        structured = self.sync_all_supported(start_date, end_date, stock_statuses, fund_markets, fund_statuses, limit)
        raw_supported = self.sync_all_raw_supported(
            start_date,
            end_date,
            stock_statuses,
            fund_markets,
            fund_statuses,
            industry_sources,
            limit,
        )
        return {
            "ok": structured["ok"] and raw_supported["ok"],
            "source": "all_ingestion",
            "structured": structured,
            "rawSupported": raw_supported,
            "message": "Completed structured sync plus raw mirror sync for the quant ingestion module",
        }

    def sync_all_supported(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        stock_statuses: tuple[str, ...] | None = None,
        fund_markets: tuple[str, ...] | None = None,
        fund_statuses: tuple[str, ...] | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        effective_start = start_date or settings.tushare_default_start_date
        stock_basics = self.sync_stock_basic(stock_statuses)
        fund_basics = self.sync_fund_basic_all(fund_markets, fund_statuses)
        trade_cal_sse = self.sync_trade_calendar("SSE", effective_start, end_date)
        trade_cal_szse = self.sync_trade_calendar("SZSE", effective_start, end_date)
        stock_quotes = self._sync_stock_quote_set(self._apply_limit(stock_basics["symbols"], limit), effective_start, end_date)
        fund_quotes = self._sync_fund_quote_set(self._apply_limit(fund_basics["symbols"], limit), effective_start, end_date)
        adj_factors = self.sync_all_adj_factors(effective_start, end_date, limit, limit)
        indices = self.sync_all_indices(effective_start, end_date, None, limit)
        financials = self.sync_all_financials(effective_start, end_date, stock_statuses, limit)
        boards = self.sync_all_boards(limit)
        return {
            "ok": all(
                [
                    stock_quotes["ok"],
                    fund_quotes["ok"],
                    adj_factors["ok"],
                    indices["ok"],
                    financials["ok"],
                    boards["ok"],
                ]
            ),
            "source": "all_supported",
            "startDate": normalize_tushare_date(effective_start),
            "endDate": normalize_tushare_date(end_date),
            "stockBasic": self._summarize_basic_result(stock_basics),
            "fundBasic": self._summarize_basic_result(fund_basics),
            "tradeCalendars": [trade_cal_sse, trade_cal_szse],
            "stockQuotes": self._summarize_bulk_quote_result(stock_quotes),
            "fundQuotes": self._summarize_bulk_quote_result(fund_quotes),
            "adjFactors": adj_factors,
            "indices": indices,
            "financials": financials,
            "boards": boards,
            "message": "Completed full sync for all supported Tushare datasets in the quant module",
        }

    def _sync_stock_quote_set(self, symbols: list[str], start_date: str | None, end_date: str | None) -> dict[str, Any]:
        items: list[dict[str, Any]] = []
        errors: list[dict[str, str]] = []
        total_rows = 0
        total_affected_rows = 0
        for symbol in symbols:
            try:
                daily_result = self.sync_daily(symbol, start_date, end_date)
                self._pause()
                weekly_result = self.sync_weekly(symbol, start_date, end_date)
                self._pause()
                monthly_result = self.sync_monthly(symbol, start_date, end_date)
                self._pause()
                total_rows += daily_result["count"] + weekly_result["count"] + monthly_result["count"]
                total_affected_rows += daily_result["affectedRows"] + weekly_result["affectedRows"] + monthly_result["affectedRows"]
                items.append(
                    {
                        "tsCode": symbol,
                        "daily": self._compact_job_result(daily_result),
                        "weekly": self._compact_job_result(weekly_result),
                        "monthly": self._compact_job_result(monthly_result),
                    }
                )
            except Exception as exc:
                errors.append({"tsCode": symbol, "error": str(exc)})
        return self._bulk_job_result("stock_quotes", len(symbols), items, errors, total_rows, total_affected_rows)

    def _sync_fund_quote_set(self, symbols: list[str], start_date: str | None, end_date: str | None) -> dict[str, Any]:
        items: list[dict[str, Any]] = []
        errors: list[dict[str, str]] = []
        total_rows = 0
        total_affected_rows = 0
        for symbol in symbols:
            try:
                result = self.sync_fund_daily(symbol, start_date, end_date)
                self._pause()
                total_rows += result["count"]
                total_affected_rows += result["affectedRows"]
                items.append({"tsCode": symbol, **self._compact_job_result(result)})
            except Exception as exc:
                errors.append({"tsCode": symbol, "error": str(exc)})
        return self._bulk_job_result("fund_quotes", len(symbols), items, errors, total_rows, total_affected_rows)

    def _sync_index_quote_set(self, codes: list[str], start_date: str | None, end_date: str | None) -> dict[str, Any]:
        items: list[dict[str, Any]] = []
        errors: list[dict[str, str]] = []
        total_rows = 0
        total_affected_rows = 0
        for code in codes:
            try:
                daily_result = self.sync_index_daily(code, start_date, end_date)
                self._pause()
                weekly_result = self.sync_index_weekly(code, start_date, end_date)
                self._pause()
                monthly_result = self.sync_index_monthly(code, start_date, end_date)
                self._pause()
                total_rows += daily_result["count"] + weekly_result["count"] + monthly_result["count"]
                total_affected_rows += daily_result["affectedRows"] + weekly_result["affectedRows"] + monthly_result["affectedRows"]
                items.append(
                    {
                        "tsCode": code,
                        "daily": self._compact_job_result(daily_result),
                        "weekly": self._compact_job_result(weekly_result),
                        "monthly": self._compact_job_result(monthly_result),
                    }
                )
            except Exception as exc:
                errors.append({"tsCode": code, "error": str(exc)})
        return self._bulk_job_result("index_quotes", len(codes), items, errors, total_rows, total_affected_rows)

    def _sync_single_job_set(self, symbols: list[str], job: Any, source: str) -> dict[str, Any]:
        items: list[dict[str, Any]] = []
        errors: list[dict[str, str]] = []
        total_rows = 0
        total_affected_rows = 0
        for symbol in symbols:
            try:
                result = job(symbol)
                self._pause()
                total_rows += result["count"]
                total_affected_rows += result["affectedRows"]
                items.append({"tsCode": symbol, **self._compact_job_result(result)})
            except Exception as exc:
                errors.append({"tsCode": symbol, "error": str(exc)})
        return self._bulk_job_result(source, len(symbols), items, errors, total_rows, total_affected_rows)

    def _sync_ths_member_subset(self, board_codes: list[str]) -> dict[str, Any]:
        self._ensure_ths_member_table()
        items: list[dict[str, Any]] = []
        errors: list[dict[str, str]] = []
        total_rows = 0
        total_affected_rows = 0
        for ts_code in board_codes:
            try:
                rows = self.client.fetch_ths_member(ts_code=ts_code)
                affected = execute_many(
                    """
                    INSERT INTO ths_member (
                        ts_code, con_code, con_name, in_date, out_date, is_new
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s
                    )
                    ON DUPLICATE KEY UPDATE
                        con_name = VALUES(con_name),
                        in_date = VALUES(in_date),
                        out_date = VALUES(out_date),
                        is_new = VALUES(is_new),
                        update_time = CURRENT_TIMESTAMP
                    """,
                    [
                        (
                            row.get("ts_code") or ts_code,
                            row.get("con_code") or row.get("code"),
                            row.get("con_name") or row.get("name"),
                            self._to_db_date_or_none(row.get("in_date")),
                            self._to_db_date_or_none(row.get("out_date")),
                            row.get("is_new"),
                        )
                        for row in rows
                        if row.get("con_code") or row.get("code")
                    ],
                )
                total_rows += len(rows)
                total_affected_rows += affected
                items.append({"tsCode": ts_code, "count": len(rows), "affectedRows": affected})
                self._pause()
            except Exception as exc:
                errors.append({"tsCode": ts_code, "error": str(exc)})
        return self._bulk_job_result("ths_member", len(board_codes), items, errors, total_rows, total_affected_rows)

    def _sync_quotes(self, source: str, ts_code: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
        grouped_rows: dict[str, list[tuple[Any, ...]]] = defaultdict(list)
        cycle = self._resolve_cycle(source)
        for row in rows:
            trade_date = row.get("trade_date")
            if not trade_date:
                continue
            year_suffix = trade_year_suffix(str(trade_date))
            grouped_rows[year_suffix].append(
                (
                    row.get("ts_code") or ts_code,
                    tushare_date_to_db(str(trade_date)),
                    row.get("open"),
                    row.get("high"),
                    row.get("low"),
                    row.get("close"),
                    row.get("pre_close"),
                    row.get("change"),
                    row.get("pct_chg"),
                    row.get("vol"),
                    row.get("amount"),
                )
            )
        affected = 0
        tables: list[str] = []
        for year_suffix, payloads in grouped_rows.items():
            table_name = f"kline{year_suffix}_{cycle}"
            self._ensure_kline_table(table_name)
            affected += execute_many(
                f"""
                INSERT INTO `{table_name}` (
                    ts_code, trade_date, open, high, low, close,
                    pre_close, `change`, pct_chg, vol, amount
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s
                )
                ON DUPLICATE KEY UPDATE
                    open = VALUES(open),
                    high = VALUES(high),
                    low = VALUES(low),
                    close = VALUES(close),
                    pre_close = VALUES(pre_close),
                    `change` = VALUES(`change`),
                    pct_chg = VALUES(pct_chg),
                    vol = VALUES(vol),
                    amount = VALUES(amount),
                    update_time = CURRENT_TIMESTAMP
                """,
                payloads,
            )
            tables.append(table_name)
        return self._simple_sync_result(source, ts_code, len(rows), affected, tables)

    def _sync_index_quote(self, source: str, ts_code: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
        table_name = source
        self._ensure_index_quote_table(table_name)
        affected = execute_many(
            f"""
            INSERT INTO `{table_name}` (
                ts_code, trade_date, close, open, high, low, pre_close,
                change_value, pct_chg, vol, amount
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s
            )
            ON DUPLICATE KEY UPDATE
                close = VALUES(close),
                open = VALUES(open),
                high = VALUES(high),
                low = VALUES(low),
                pre_close = VALUES(pre_close),
                change_value = VALUES(change_value),
                pct_chg = VALUES(pct_chg),
                vol = VALUES(vol),
                amount = VALUES(amount),
                update_time = CURRENT_TIMESTAMP
            """,
            [
                (
                    row.get("ts_code") or ts_code,
                    tushare_date_to_db(str(row["trade_date"])),
                    row.get("close"),
                    row.get("open"),
                    row.get("high"),
                    row.get("low"),
                    row.get("pre_close"),
                    row.get("change"),
                    row.get("pct_chg"),
                    row.get("vol"),
                    row.get("amount"),
                )
                for row in rows
                if row.get("trade_date")
            ],
        )
        return self._simple_sync_result(source, ts_code, len(rows), affected, [table_name])

    def _sync_financial_table(
        self,
        table_name: str,
        source: str,
        ts_code: str,
        rows: list[dict[str, Any]],
    ) -> dict[str, Any]:
        self._ensure_financial_table(table_name)
        affected = execute_many(
            f"""
            INSERT INTO `{table_name}` (
                ts_code, ann_date, f_ann_date, end_date, report_type,
                comp_type, end_type, raw_json
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s
            )
            ON DUPLICATE KEY UPDATE
                ann_date = VALUES(ann_date),
                f_ann_date = VALUES(f_ann_date),
                comp_type = VALUES(comp_type),
                end_type = VALUES(end_type),
                raw_json = VALUES(raw_json),
                update_time = CURRENT_TIMESTAMP
            """,
            [
                (
                    row.get("ts_code") or ts_code,
                    self._to_db_date_or_none(row.get("ann_date")),
                    self._to_db_date_or_none(row.get("f_ann_date")),
                    self._to_db_date_or_none(row.get("end_date")),
                    row.get("report_type") or "",
                    row.get("comp_type"),
                    row.get("end_type"),
                    json.dumps(row, ensure_ascii=False, default=str),
                )
                for row in rows
                if row.get("end_date")
            ],
        )
        return self._simple_sync_result(source, ts_code, len(rows), affected, [table_name])

    def _quote_response(
        self,
        source: str,
        ts_code: str,
        start_date: str | None,
        end_date: str | None,
        records: list[dict[str, Any]],
    ) -> dict[str, Any]:
        return {
            "source": source,
            "tsCode": ts_code,
            "startDate": normalize_tushare_date(start_date),
            "endDate": normalize_tushare_date(end_date),
            "count": len(records),
            "items": records,
        }

    def _sync_raw_records(
        self,
        api_name: str,
        rows: list[dict[str, Any]],
        dataset_key: str,
        scope_key: str | None,
        request_params: dict[str, Any] | None,
    ) -> dict[str, Any]:
        self._ensure_raw_mirror_table()
        request_json = json.dumps(request_params or {}, ensure_ascii=False, sort_keys=True)
        if self._raw_mirror_uses_extended_schema():
            affected = execute_many(
                """
                INSERT INTO tushare_raw_data (
                    api_name, dataset_key, scope_key, biz_key_hash, biz_key_text,
                    ts_code, entity_type, entity_key, record_scope, trade_date,
                    end_date, ann_date, request_params_json, raw_json, raw_hash
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s
                )
                ON DUPLICATE KEY UPDATE
                    dataset_key = VALUES(dataset_key),
                    scope_key = VALUES(scope_key),
                    ts_code = VALUES(ts_code),
                    entity_type = VALUES(entity_type),
                    entity_key = VALUES(entity_key),
                    record_scope = VALUES(record_scope),
                    trade_date = VALUES(trade_date),
                    end_date = VALUES(end_date),
                    ann_date = VALUES(ann_date),
                    request_params_json = VALUES(request_params_json),
                    raw_json = VALUES(raw_json),
                    raw_hash = VALUES(raw_hash),
                    update_time = CURRENT_TIMESTAMP
                """,
                [
                    self._build_raw_payload(api_name, dataset_key, scope_key, row, request_json, request_params)
                    for row in rows
                ],
            )
        else:
            affected = execute_many(
                """
                INSERT INTO tushare_raw_data (
                    dataset_key, scope_key, ts_code, entity_key, trade_date,
                    end_date, ann_date, raw_json, update_time, source, dedupe_key
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, CURRENT_TIMESTAMP, %s, %s
                )
                ON DUPLICATE KEY UPDATE
                    scope_key = VALUES(scope_key),
                    ts_code = VALUES(ts_code),
                    entity_key = VALUES(entity_key),
                    trade_date = VALUES(trade_date),
                    end_date = VALUES(end_date),
                    ann_date = VALUES(ann_date),
                    raw_json = VALUES(raw_json),
                    update_time = CURRENT_TIMESTAMP,
                    source = VALUES(source)
                """,
                [
                    self._build_raw_payload_legacy(api_name, dataset_key, scope_key, row, request_params)
                    for row in rows
                ],
            )
        return {
            "ok": True,
            "source": api_name,
            "datasetKey": dataset_key,
            "scopeKey": scope_key,
            "count": len(rows),
            "affectedRows": affected,
            "tables": ["tushare_raw_data"],
            "sampleKeys": [self._build_raw_identity_text(row, scope_key) for row in rows[:10]],
            "message": f"Synced {len(rows)} raw {api_name} rows",
        }

    def _ensure_kline_table(self, table_name: str) -> None:
        execute(
            f"""
            CREATE TABLE IF NOT EXISTS `{table_name}` (
                ts_code VARCHAR(16) NOT NULL,
                trade_date DATE NOT NULL,
                open DECIMAL(18,4) NULL,
                high DECIMAL(18,4) NULL,
                low DECIMAL(18,4) NULL,
                close DECIMAL(18,4) NULL,
                pre_close DECIMAL(18,4) NULL,
                `change` DECIMAL(18,4) NULL,
                pct_chg DECIMAL(18,4) NULL,
                vol DECIMAL(20,4) NULL,
                amount DECIMAL(20,4) NULL,
                create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code, trade_date),
                KEY `idx_{table_name}_trade_date` (trade_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )

    def _ensure_adj_factor_table(self, table_name: str) -> None:
        execute(
            f"""
            CREATE TABLE IF NOT EXISTS `{table_name}` (
                ts_code VARCHAR(16) NOT NULL,
                trade_date DATE NOT NULL,
                adj_factor DECIMAL(20,8) NULL,
                create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code, trade_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )

    def _ensure_etf_info_table(self) -> None:
        execute(
            """
            CREATE TABLE IF NOT EXISTS etf_info (
                ts_code VARCHAR(16) NOT NULL,
                name VARCHAR(120) NULL,
                cname VARCHAR(120) NULL,
                csname VARCHAR(120) NULL,
                extname VARCHAR(120) NULL,
                exchange VARCHAR(20) NULL,
                index_name VARCHAR(255) NULL,
                market VARCHAR(20) NULL,
                status VARCHAR(20) NULL,
                fund_type VARCHAR(60) NULL,
                invest_type VARCHAR(60) NULL,
                type VARCHAR(60) NULL,
                management VARCHAR(120) NULL,
                custodian VARCHAR(120) NULL,
                benchmark VARCHAR(255) NULL,
                list_date DATE NULL,
                issue_date DATE NULL,
                delist_date DATE NULL,
                due_date DATE NULL,
                issue_amount DECIMAL(20,4) NULL,
                m_fee DECIMAL(12,6) NULL,
                c_fee DECIMAL(12,6) NULL,
                duration_year DECIMAL(12,4) NULL,
                p_value DECIMAL(12,4) NULL,
                min_amount DECIMAL(20,4) NULL,
                exp_return DECIMAL(12,4) NULL,
                trustee VARCHAR(120) NULL,
                purc_startdate DATE NULL,
                redm_startdate DATE NULL,
                create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )
        for column_name, ddl_sql in (
            ("name", "ALTER TABLE etf_info ADD COLUMN name VARCHAR(120) NULL AFTER ts_code"),
            ("cname", "ALTER TABLE etf_info ADD COLUMN cname VARCHAR(120) NULL AFTER name"),
            ("csname", "ALTER TABLE etf_info ADD COLUMN csname VARCHAR(120) NULL AFTER cname"),
            ("extname", "ALTER TABLE etf_info ADD COLUMN extname VARCHAR(120) NULL AFTER csname"),
            ("exchange", "ALTER TABLE etf_info ADD COLUMN exchange VARCHAR(20) NULL AFTER extname"),
            ("index_name", "ALTER TABLE etf_info ADD COLUMN index_name VARCHAR(255) NULL AFTER exchange"),
            ("market", "ALTER TABLE etf_info ADD COLUMN market VARCHAR(20) NULL AFTER index_name"),
            ("status", "ALTER TABLE etf_info ADD COLUMN status VARCHAR(20) NULL AFTER market"),
            ("fund_type", "ALTER TABLE etf_info ADD COLUMN fund_type VARCHAR(60) NULL AFTER status"),
            ("invest_type", "ALTER TABLE etf_info ADD COLUMN invest_type VARCHAR(60) NULL AFTER fund_type"),
            ("type", "ALTER TABLE etf_info ADD COLUMN type VARCHAR(60) NULL AFTER invest_type"),
            ("management", "ALTER TABLE etf_info ADD COLUMN management VARCHAR(120) NULL AFTER type"),
            ("custodian", "ALTER TABLE etf_info ADD COLUMN custodian VARCHAR(120) NULL AFTER management"),
            ("benchmark", "ALTER TABLE etf_info ADD COLUMN benchmark VARCHAR(255) NULL AFTER custodian"),
            ("list_date", "ALTER TABLE etf_info ADD COLUMN list_date DATE NULL AFTER benchmark"),
            ("issue_date", "ALTER TABLE etf_info ADD COLUMN issue_date DATE NULL AFTER list_date"),
            ("delist_date", "ALTER TABLE etf_info ADD COLUMN delist_date DATE NULL AFTER issue_date"),
            ("due_date", "ALTER TABLE etf_info ADD COLUMN due_date DATE NULL AFTER delist_date"),
            ("issue_amount", "ALTER TABLE etf_info ADD COLUMN issue_amount DECIMAL(20,4) NULL AFTER due_date"),
            ("m_fee", "ALTER TABLE etf_info ADD COLUMN m_fee DECIMAL(12,6) NULL AFTER issue_amount"),
            ("c_fee", "ALTER TABLE etf_info ADD COLUMN c_fee DECIMAL(12,6) NULL AFTER m_fee"),
            ("duration_year", "ALTER TABLE etf_info ADD COLUMN duration_year DECIMAL(12,4) NULL AFTER c_fee"),
            ("p_value", "ALTER TABLE etf_info ADD COLUMN p_value DECIMAL(12,4) NULL AFTER duration_year"),
            ("min_amount", "ALTER TABLE etf_info ADD COLUMN min_amount DECIMAL(20,4) NULL AFTER p_value"),
            ("exp_return", "ALTER TABLE etf_info ADD COLUMN exp_return DECIMAL(12,4) NULL AFTER min_amount"),
            ("trustee", "ALTER TABLE etf_info ADD COLUMN trustee VARCHAR(120) NULL AFTER exp_return"),
            ("purc_startdate", "ALTER TABLE etf_info ADD COLUMN purc_startdate DATE NULL AFTER trustee"),
            ("redm_startdate", "ALTER TABLE etf_info ADD COLUMN redm_startdate DATE NULL AFTER purc_startdate"),
            ("create_time", "ALTER TABLE etf_info ADD COLUMN create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER redm_startdate"),
            ("update_time", "ALTER TABLE etf_info ADD COLUMN update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER create_time"),
        ):
            self._ensure_table_column("etf_info", column_name, ddl_sql)

    def _ensure_stock_basic_table(self) -> None:
        execute(
            """
            CREATE TABLE IF NOT EXISTS stock_basic (
                ts_code VARCHAR(16) NOT NULL,
                symbol VARCHAR(16) NULL,
                name VARCHAR(120) NULL,
                area VARCHAR(60) NULL,
                industry VARCHAR(120) NULL,
                fullname VARCHAR(255) NULL,
                enname VARCHAR(255) NULL,
                market VARCHAR(40) NULL,
                exchange VARCHAR(20) NULL,
                curr_type VARCHAR(20) NULL,
                list_status VARCHAR(20) NULL,
                list_date DATE NULL,
                delist_date DATE NULL,
                is_hs VARCHAR(10) NULL,
                act_name VARCHAR(120) NULL,
                act_ent_type VARCHAR(60) NULL,
                create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code),
                KEY idx_stock_basic_symbol (symbol),
                KEY idx_stock_basic_list_status (list_status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )
        for column_name, ddl_sql in (
            ("symbol", "ALTER TABLE stock_basic ADD COLUMN symbol VARCHAR(16) NULL AFTER ts_code"),
            ("name", "ALTER TABLE stock_basic ADD COLUMN name VARCHAR(120) NULL AFTER symbol"),
            ("area", "ALTER TABLE stock_basic ADD COLUMN area VARCHAR(60) NULL AFTER name"),
            ("industry", "ALTER TABLE stock_basic ADD COLUMN industry VARCHAR(120) NULL AFTER area"),
            ("fullname", "ALTER TABLE stock_basic ADD COLUMN fullname VARCHAR(255) NULL AFTER industry"),
            ("enname", "ALTER TABLE stock_basic ADD COLUMN enname VARCHAR(255) NULL AFTER fullname"),
            ("market", "ALTER TABLE stock_basic ADD COLUMN market VARCHAR(40) NULL AFTER enname"),
            ("exchange", "ALTER TABLE stock_basic ADD COLUMN exchange VARCHAR(20) NULL AFTER market"),
            ("curr_type", "ALTER TABLE stock_basic ADD COLUMN curr_type VARCHAR(20) NULL AFTER exchange"),
            ("list_status", "ALTER TABLE stock_basic ADD COLUMN list_status VARCHAR(20) NULL AFTER curr_type"),
            ("list_date", "ALTER TABLE stock_basic ADD COLUMN list_date DATE NULL AFTER list_status"),
            ("delist_date", "ALTER TABLE stock_basic ADD COLUMN delist_date DATE NULL AFTER list_date"),
            ("is_hs", "ALTER TABLE stock_basic ADD COLUMN is_hs VARCHAR(10) NULL AFTER delist_date"),
            ("act_name", "ALTER TABLE stock_basic ADD COLUMN act_name VARCHAR(120) NULL AFTER is_hs"),
            ("act_ent_type", "ALTER TABLE stock_basic ADD COLUMN act_ent_type VARCHAR(60) NULL AFTER act_name"),
            ("create_time", "ALTER TABLE stock_basic ADD COLUMN create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER act_ent_type"),
            ("update_time", "ALTER TABLE stock_basic ADD COLUMN update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER create_time"),
        ):
            self._ensure_table_column("stock_basic", column_name, ddl_sql)
        self._ensure_table_index("stock_basic", "idx_stock_basic_symbol", "ALTER TABLE stock_basic ADD KEY idx_stock_basic_symbol (symbol)")
        self._ensure_table_index("stock_basic", "idx_stock_basic_list_status", "ALTER TABLE stock_basic ADD KEY idx_stock_basic_list_status (list_status)")

    def _ensure_trade_cal_table(self) -> None:
        execute(
            """
            CREATE TABLE IF NOT EXISTS trade_cal (
                exchange VARCHAR(20) NOT NULL,
                cal_date DATE NOT NULL,
                is_open TINYINT(1) NULL,
                pretrade_date DATE NULL,
                create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (exchange, cal_date),
                KEY idx_trade_cal_open (is_open)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )

    def _ensure_index_basic_table(self) -> None:
        execute(
            """
            CREATE TABLE IF NOT EXISTS index_basic (
                ts_code VARCHAR(16) NOT NULL,
                name VARCHAR(120) NULL,
                fullname VARCHAR(255) NULL,
                market VARCHAR(30) NULL,
                publisher VARCHAR(60) NULL,
                index_type VARCHAR(60) NULL,
                category VARCHAR(60) NULL,
                base_date DATE NULL,
                base_point DECIMAL(18,4) NULL,
                list_date DATE NULL,
                weight_rule VARCHAR(255) NULL,
                desc_text TEXT NULL,
                exp_date DATE NULL,
                create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code),
                KEY idx_index_basic_market (market)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )
        for column_name, ddl_sql in (
            ("name", "ALTER TABLE index_basic ADD COLUMN name VARCHAR(120) NULL AFTER ts_code"),
            ("fullname", "ALTER TABLE index_basic ADD COLUMN fullname VARCHAR(255) NULL AFTER name"),
            ("market", "ALTER TABLE index_basic ADD COLUMN market VARCHAR(30) NULL AFTER fullname"),
            ("publisher", "ALTER TABLE index_basic ADD COLUMN publisher VARCHAR(60) NULL AFTER market"),
            ("index_type", "ALTER TABLE index_basic ADD COLUMN index_type VARCHAR(60) NULL AFTER publisher"),
            ("category", "ALTER TABLE index_basic ADD COLUMN category VARCHAR(60) NULL AFTER index_type"),
            ("base_date", "ALTER TABLE index_basic ADD COLUMN base_date DATE NULL AFTER category"),
            ("base_point", "ALTER TABLE index_basic ADD COLUMN base_point DECIMAL(18,4) NULL AFTER base_date"),
            ("list_date", "ALTER TABLE index_basic ADD COLUMN list_date DATE NULL AFTER base_point"),
            ("weight_rule", "ALTER TABLE index_basic ADD COLUMN weight_rule VARCHAR(255) NULL AFTER list_date"),
            ("desc_text", "ALTER TABLE index_basic ADD COLUMN desc_text TEXT NULL AFTER weight_rule"),
            ("exp_date", "ALTER TABLE index_basic ADD COLUMN exp_date DATE NULL AFTER desc_text"),
            ("create_time", "ALTER TABLE index_basic ADD COLUMN create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER exp_date"),
            ("update_time", "ALTER TABLE index_basic ADD COLUMN update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER create_time"),
        ):
            self._ensure_table_column("index_basic", column_name, ddl_sql)
        self._ensure_table_index("index_basic", "idx_index_basic_market", "ALTER TABLE index_basic ADD KEY idx_index_basic_market (market)")

    def _ensure_index_quote_table(self, table_name: str) -> None:
        execute(
            f"""
            CREATE TABLE IF NOT EXISTS `{table_name}` (
                ts_code VARCHAR(16) NOT NULL,
                trade_date DATE NOT NULL,
                close DECIMAL(18,4) NULL,
                open DECIMAL(18,4) NULL,
                high DECIMAL(18,4) NULL,
                low DECIMAL(18,4) NULL,
                pre_close DECIMAL(18,4) NULL,
                change_value DECIMAL(18,4) NULL,
                pct_chg DECIMAL(18,4) NULL,
                vol DECIMAL(20,4) NULL,
                amount DECIMAL(20,4) NULL,
                create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code, trade_date),
                KEY `idx_{table_name}_trade_date` (trade_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )

    def _ensure_index_weight_table(self) -> None:
        execute(
            """
            CREATE TABLE IF NOT EXISTS index_weight (
                index_code VARCHAR(16) NOT NULL,
                con_code VARCHAR(16) NOT NULL,
                trade_date DATE NOT NULL,
                weight DECIMAL(18,6) NULL,
                create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (index_code, con_code, trade_date),
                KEY idx_index_weight_con_code (con_code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )

    def _ensure_ths_index_table(self) -> None:
        execute(
            """
            CREATE TABLE IF NOT EXISTS ths_index (
                ts_code VARCHAR(16) NOT NULL,
                name VARCHAR(120) NULL,
                count INT NULL,
                exchange VARCHAR(20) NULL,
                list_date DATE NULL,
                type_name VARCHAR(30) NULL,
                create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )
        for column_name, ddl_sql in (
            ("name", "ALTER TABLE ths_index ADD COLUMN name VARCHAR(120) NULL AFTER ts_code"),
            ("count", "ALTER TABLE ths_index ADD COLUMN count INT NULL AFTER name"),
            ("exchange", "ALTER TABLE ths_index ADD COLUMN exchange VARCHAR(20) NULL AFTER count"),
            ("list_date", "ALTER TABLE ths_index ADD COLUMN list_date DATE NULL AFTER exchange"),
            ("type_name", "ALTER TABLE ths_index ADD COLUMN type_name VARCHAR(30) NULL AFTER list_date"),
            ("create_time", "ALTER TABLE ths_index ADD COLUMN create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER type_name"),
            ("update_time", "ALTER TABLE ths_index ADD COLUMN update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER create_time"),
        ):
            self._ensure_table_column("ths_index", column_name, ddl_sql)

    def _ensure_ths_member_table(self) -> None:
        execute(
            """
            CREATE TABLE IF NOT EXISTS ths_member (
                ts_code VARCHAR(16) NOT NULL,
                con_code VARCHAR(16) NOT NULL,
                con_name VARCHAR(120) NULL,
                in_date DATE NULL,
                out_date DATE NULL,
                is_new VARCHAR(10) NULL,
                create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code, con_code),
                KEY idx_ths_member_con_code (con_code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )
        for column_name, ddl_sql in (
            ("con_code", "ALTER TABLE ths_member ADD COLUMN con_code VARCHAR(16) NULL AFTER ts_code"),
            ("con_name", "ALTER TABLE ths_member ADD COLUMN con_name VARCHAR(120) NULL AFTER con_code"),
            ("in_date", "ALTER TABLE ths_member ADD COLUMN in_date DATE NULL AFTER con_name"),
            ("out_date", "ALTER TABLE ths_member ADD COLUMN out_date DATE NULL AFTER in_date"),
            ("is_new", "ALTER TABLE ths_member ADD COLUMN is_new VARCHAR(10) NULL AFTER out_date"),
            ("create_time", "ALTER TABLE ths_member ADD COLUMN create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER is_new"),
            ("update_time", "ALTER TABLE ths_member ADD COLUMN update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER create_time"),
        ):
            self._ensure_table_column("ths_member", column_name, ddl_sql)
        self._ensure_table_index("ths_member", "idx_ths_member_con_code", "ALTER TABLE ths_member ADD KEY idx_ths_member_con_code (con_code)")

    def _ensure_financial_table(self, table_name: str) -> None:
        execute(
            f"""
            CREATE TABLE IF NOT EXISTS `{table_name}` (
                ts_code VARCHAR(16) NOT NULL,
                ann_date DATE NULL,
                f_ann_date DATE NULL,
                end_date DATE NOT NULL,
                report_type VARCHAR(20) NULL,
                comp_type VARCHAR(20) NULL,
                end_type VARCHAR(20) NULL,
                raw_json LONGTEXT NOT NULL,
                create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code, end_date, report_type),
                KEY `idx_{table_name}_ann_date` (ann_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )

    def _ensure_raw_mirror_table(self) -> None:
        if not self._raw_mirror_table_exists():
            execute(
                """
                CREATE TABLE tushare_raw_data (
                    api_name VARCHAR(64) NOT NULL,
                    dataset_key VARCHAR(64) NOT NULL,
                    scope_key VARCHAR(255) NULL,
                    biz_key_hash CHAR(64) NOT NULL,
                    biz_key_text TEXT NOT NULL,
                    ts_code VARCHAR(32) NULL,
                    entity_type VARCHAR(32) NULL,
                    entity_key VARCHAR(255) NULL,
                    record_scope VARCHAR(255) NULL,
                    trade_date DATE NULL,
                    end_date DATE NULL,
                    ann_date DATE NULL,
                    request_params_json LONGTEXT NULL,
                    raw_json LONGTEXT NOT NULL,
                    raw_hash CHAR(64) NOT NULL,
                    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (api_name, biz_key_hash),
                    KEY idx_tushare_raw_dataset_scope (dataset_key, scope_key(100)),
                    KEY idx_tushare_raw_ts_code (ts_code),
                    KEY idx_tushare_raw_entity_key (entity_key(100)),
                    KEY idx_tushare_raw_record_scope (record_scope(100)),
                    KEY idx_tushare_raw_trade_date (trade_date),
                    KEY idx_tushare_raw_end_date (end_date)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
        self._ensure_raw_mirror_column("entity_type", "ALTER TABLE tushare_raw_data ADD COLUMN entity_type VARCHAR(32) NULL AFTER ts_code")
        self._ensure_raw_mirror_column("entity_key", "ALTER TABLE tushare_raw_data ADD COLUMN entity_key VARCHAR(255) NULL AFTER entity_type")
        self._ensure_raw_mirror_column("record_scope", "ALTER TABLE tushare_raw_data ADD COLUMN record_scope VARCHAR(255) NULL AFTER entity_key")
        self._ensure_raw_mirror_index("idx_tushare_raw_entity_key", "ALTER TABLE tushare_raw_data ADD KEY idx_tushare_raw_entity_key (entity_key)")
        self._ensure_raw_mirror_index("idx_tushare_raw_record_scope", "ALTER TABLE tushare_raw_data ADD KEY idx_tushare_raw_record_scope (record_scope)")

    def _trade_dates_in_range(self, start_date: str | None, end_date: str | None) -> list[str]:
        normalized_start = normalize_tushare_date(start_date) or settings.tushare_default_start_date
        normalized_end = normalize_tushare_date(end_date) or datetime.now().strftime("%Y%m%d")
        rows = self.client.fetch_trade_calendar("SSE", normalized_start, normalized_end)
        open_dates = [str(row["cal_date"]) for row in rows if row.get("cal_date") and int(row.get("is_open") or 0) == 1]
        if open_dates:
            return open_dates
        current = datetime.strptime(normalized_start, "%Y%m%d")
        end_value = datetime.strptime(normalized_end, "%Y%m%d")
        dates: list[str] = []
        while current <= end_value:
            dates.append(current.strftime("%Y%m%d"))
            current += timedelta(days=1)
        return dates

    def _calendar_dates_in_range(self, start_date: str | None, end_date: str | None) -> list[str]:
        normalized_start = normalize_tushare_date(start_date) or settings.tushare_default_start_date
        normalized_end = normalize_tushare_date(end_date) or datetime.now().strftime("%Y%m%d")
        current = datetime.strptime(normalized_start, "%Y%m%d")
        end_value = datetime.strptime(normalized_end, "%Y%m%d")
        dates: list[str] = []
        while current <= end_value:
            dates.append(current.strftime("%Y%m%d"))
            current += timedelta(days=1)
        return dates

    @staticmethod
    def _day_datetime_window(day: str) -> tuple[str, str]:
        normalized_day = normalize_tushare_date(day)
        if normalized_day is None:
            raise ValueError("day is required")
        return (
            f"{normalized_day[:4]}-{normalized_day[4:6]}-{normalized_day[6:8]} 00:00:00",
            f"{normalized_day[:4]}-{normalized_day[4:6]}-{normalized_day[6:8]} 23:59:59",
        )

    def _load_symbols_by_security_type(
        self,
        security_type: str,
        statuses: tuple[str, ...] | None,
        markets: tuple[str, ...] | None,
        limit: int | None,
    ) -> list[str]:
        normalized = security_type.strip().lower()
        if normalized == "stock":
            basics = self.sync_stock_basic(statuses)
            return self._apply_limit(basics["symbols"], limit)
        if normalized == "fund":
            basics = self.sync_fund_basic_all(markets, statuses)
            return self._apply_limit(basics["symbols"], limit)
        if normalized == "index":
            basics = self.sync_index_basic(markets)
            return self._apply_limit(basics["symbols"], limit)
        if normalized == "board":
            basics = self.sync_ths_index()
            return self._apply_limit(basics["symbols"], limit)
        raise ValueError(f"Unsupported security_type: {security_type}")

    @staticmethod
    def _merge_raw_params(*groups: dict[str, Any] | None) -> dict[str, Any]:
        merged: dict[str, Any] = {}
        for group in groups:
            if not group:
                continue
            for key, value in group.items():
                if key is not None and value not in (None, ""):
                    merged[str(key)] = value
        return merged

    @staticmethod
    def _resolve_exchange(ts_code: str | None) -> str | None:
        if not ts_code or "." not in ts_code:
            return None
        return ts_code.split(".")[-1]

    @staticmethod
    def _to_db_date_or_none(value: Any) -> str | None:
        if value in (None, ""):
            return None
        text = str(value).strip()
        if text.lower() in {"nan", "nat", "none", "null"}:
            return None
        return tushare_date_to_db(text)

    @classmethod
    def _build_raw_payload(
        cls,
        api_name: str,
        dataset_key: str,
        scope_key: str | None,
        row: dict[str, Any],
        request_json: str,
        request_params: dict[str, Any] | None,
    ) -> tuple[Any, ...]:
        identity_text = cls._build_raw_identity_text(row, scope_key)
        raw_json = json.dumps(row, ensure_ascii=False, sort_keys=True, default=str)
        return (
            api_name,
            dataset_key,
            cls._resolve_raw_scope_key(row, scope_key),
            hashlib.sha256(identity_text.encode("utf-8")).hexdigest(),
            identity_text,
            cls._resolve_raw_ts_code(row, scope_key, request_params),
            cls._resolve_raw_entity_type(row, scope_key, request_params),
            cls._resolve_raw_entity_key(row, scope_key, request_params),
            cls._resolve_raw_record_scope(row, scope_key, request_params),
            cls._to_db_date_or_none(row.get("trade_date")),
            cls._to_db_date_or_none(row.get("end_date")),
            cls._to_db_date_or_none(row.get("ann_date")),
            request_json,
            raw_json,
            hashlib.sha256(raw_json.encode("utf-8")).hexdigest(),
        )

    @classmethod
    def _build_raw_payload_legacy(
        cls,
        api_name: str,
        dataset_key: str,
        scope_key: str | None,
        row: dict[str, Any],
        request_params: dict[str, Any] | None,
    ) -> tuple[Any, ...]:
        dedupe_text = cls._build_raw_identity_text(row, scope_key)
        return (
            dataset_key,
            cls._resolve_raw_scope_key(row, scope_key),
            cls._resolve_raw_ts_code(row, scope_key, request_params),
            cls._resolve_raw_entity_key(row, scope_key, request_params),
            cls._to_db_date_or_none(row.get("trade_date")),
            cls._to_db_date_or_none(row.get("end_date")),
            cls._to_db_date_or_none(row.get("ann_date")),
            json.dumps(row, ensure_ascii=False, sort_keys=True, default=str),
            api_name,
            hashlib.sha1(f"{api_name}|{dataset_key}|{dedupe_text}".encode("utf-8")).hexdigest(),
        )

    @staticmethod
    def _resolve_raw_ts_code(
        row: dict[str, Any],
        scope_key: str | None = None,
        request_params: dict[str, Any] | None = None,
    ) -> str | None:
        for field in ("ts_code", "con_code", "index_code", "code", "stock_code", "symbol"):
            value = row.get(field)
            if value not in (None, ""):
                return str(value)
        if request_params:
            for field in ("ts_code", "con_code", "index_code", "code", "stock_code", "symbol"):
                value = request_params.get(field)
                if value not in (None, "") and TushareSyncService._looks_like_security_code(str(value)):
                    return str(value)
        if scope_key and TushareSyncService._looks_like_security_code(str(scope_key)):
            return str(scope_key)
        return None

    @staticmethod
    def _resolve_raw_entity_type(
        row: dict[str, Any],
        scope_key: str | None = None,
        request_params: dict[str, Any] | None = None,
    ) -> str:
        if TushareSyncService._resolve_raw_ts_code(row, scope_key, request_params):
            return "security"
        if TushareSyncService._resolve_raw_first_value(row, request_params, "src", "source"):
            return "source"
        if TushareSyncService._resolve_raw_first_value(row, request_params, "exchange"):
            return "exchange"
        if TushareSyncService._resolve_raw_first_value(row, request_params, "market"):
            return "market"
        if TushareSyncService._resolve_raw_first_value(row, request_params, "trade_date", "cal_date", "ann_date", "date", "report_date", "end_date"):
            return "date"
        if TushareSyncService._resolve_raw_first_value(row, request_params, "name"):
            return "name"
        if scope_key not in (None, ""):
            return "scope"
        return "generic"

    @staticmethod
    def _resolve_raw_entity_key(
        row: dict[str, Any],
        scope_key: str | None = None,
        request_params: dict[str, Any] | None = None,
    ) -> str | None:
        ts_code = TushareSyncService._resolve_raw_ts_code(row, scope_key, request_params)
        if ts_code:
            return ts_code
        for value in (
            TushareSyncService._resolve_raw_first_value(row, request_params, "src", "source"),
            TushareSyncService._resolve_raw_first_value(row, request_params, "exchange"),
            TushareSyncService._resolve_raw_first_value(row, request_params, "market"),
            TushareSyncService._resolve_raw_first_value(row, request_params, "trade_date", "cal_date", "ann_date", "date", "report_date", "end_date"),
            TushareSyncService._resolve_raw_first_value(row, request_params, "name"),
            scope_key,
        ):
            if value not in (None, ""):
                return str(value)
        return None

    @staticmethod
    def _resolve_raw_record_scope(
        row: dict[str, Any],
        scope_key: str | None = None,
        request_params: dict[str, Any] | None = None,
    ) -> str | None:
        for value in (
            scope_key,
            TushareSyncService._resolve_raw_first_value(request_params or {}, None, "ts_code", "index_code", "con_code", "code"),
            TushareSyncService._resolve_raw_first_value(request_params or {}, None, "src", "source", "exchange", "market"),
            TushareSyncService._resolve_raw_first_value(row, request_params, "trade_date", "cal_date", "ann_date", "date", "report_date", "end_date"),
        ):
            if value not in (None, ""):
                return str(value)
        return None

    @staticmethod
    def _resolve_raw_first_value(
        row: dict[str, Any],
        request_params: dict[str, Any] | None,
        *fields: str,
    ) -> Any:
        for field in fields:
            value = row.get(field)
            if value not in (None, ""):
                return value
        if request_params:
            for field in fields:
                value = request_params.get(field)
                if value not in (None, ""):
                    return value
        return None

    @staticmethod
    def _resolve_raw_scope_key(row: dict[str, Any], explicit_scope: str | None) -> str | None:
        if explicit_scope:
            return explicit_scope
        for field in ("ts_code", "index_code", "con_code", "exchange", "market", "src"):
            value = row.get(field)
            if value not in (None, ""):
                return str(value)
        return None

    @staticmethod
    def _build_raw_identity_text(row: dict[str, Any], scope_key: str | None) -> str:
        key_groups = (
            ("ts_code", "trade_date"),
            ("ts_code", "end_date", "report_type"),
            ("ts_code", "ann_date", "end_date"),
            ("index_code", "con_code", "trade_date"),
            ("index_code", "con_code"),
            ("index_code", "trade_date"),
            ("index_code",),
            ("con_code", "trade_date"),
            ("con_code",),
            ("cal_date", "exchange"),
            ("trade_date", "exchange"),
            ("ts_code",),
            ("code",),
            ("symbol",),
            ("name", "market"),
        )
        for group in key_groups:
            if all(row.get(field) not in (None, "") for field in group):
                identity_parts = [f"{field}={row.get(field)}" for field in group]
                if scope_key:
                    identity_parts.insert(0, f"scope={scope_key}")
                return "|".join(identity_parts)
        normalized = {key: row[key] for key in sorted(row) if row.get(key) not in (None, "")}
        if scope_key:
            normalized = {"scope": scope_key, **normalized}
        return json.dumps(normalized, ensure_ascii=False, sort_keys=True, default=str)

    @staticmethod
    def _looks_like_security_code(value: str) -> bool:
        candidate = value.strip()
        if not candidate:
            return False
        return bool(
            re.match(r"^[0-9A-Z]{6}\.[A-Z]{2,}$", candidate)
            or re.match(r"^[A-Z0-9]{3,12}\.[A-Z]{2,}$", candidate)
        )

    def _ensure_raw_mirror_column(self, column_name: str, ddl_sql: str) -> None:
        self._ensure_table_column("tushare_raw_data", column_name, ddl_sql)

    def _ensure_raw_mirror_index(self, index_name: str, ddl_sql: str) -> None:
        self._ensure_table_index("tushare_raw_data", index_name, ddl_sql)

    def _ensure_table_column(self, table_name: str, column_name: str, ddl_sql: str) -> None:
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
        if row is None:
            execute(ddl_sql)

    def _ensure_table_index(self, table_name: str, index_name: str, ddl_sql: str) -> None:
        row = fetch_one(
            """
            SELECT 1
            FROM information_schema.statistics
            WHERE table_schema = %s
              AND table_name = %s
              AND index_name = %s
            LIMIT 1
            """,
            (settings.db_name, table_name, index_name),
        )
        if row is None:
            execute(ddl_sql)

    def _raw_mirror_table_exists(self) -> bool:
        row = fetch_one(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_name = 'tushare_raw_data'
            LIMIT 1
            """,
            (settings.db_name,),
        )
        return row is not None

    def _raw_mirror_uses_extended_schema(self) -> bool:
        required_columns = (
            "api_name",
            "biz_key_hash",
            "biz_key_text",
            "entity_type",
            "entity_key",
            "record_scope",
            "request_params_json",
            "raw_hash",
        )
        return all(self._table_column_exists("tushare_raw_data", column_name) for column_name in required_columns)

    def _table_column_exists(self, table_name: str, column_name: str) -> bool:
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
        return row is not None

    @staticmethod
    def _compact_job_result(result: dict[str, Any]) -> dict[str, Any]:
        return {
            "count": result.get("count", 0),
            "affectedRows": result.get("affectedRows", 0),
            "tables": result.get("tables", []),
        }

    @staticmethod
    def _summarize_basic_result(result: dict[str, Any]) -> dict[str, Any]:
        return {
            "ok": result.get("ok"),
            "source": result.get("source"),
            "count": result.get("count", 0),
            "affectedRows": result.get("affectedRows", 0),
            "sampleSymbols": result.get("sampleSymbols", []),
            "message": result.get("message"),
        }

    @staticmethod
    def _summarize_bulk_quote_result(result: dict[str, Any]) -> dict[str, Any]:
        return {
            "ok": result.get("ok"),
            "source": result.get("source"),
            "symbolCount": result.get("symbolCount", 0),
            "successCount": result.get("successCount", 0),
            "errorCount": result.get("errorCount", 0),
            "quoteCount": result.get("quoteCount", 0),
            "affectedRows": result.get("affectedRows", 0),
            "sampleItems": result.get("sampleItems", []),
            "errors": result.get("errors", []),
        }

    @staticmethod
    def _merge_rows_by_key(groups: Iterable[list[dict[str, Any]]]) -> list[dict[str, Any]]:
        merged: dict[str, dict[str, Any]] = {}
        for rows in groups:
            for row in rows:
                key = row.get("ts_code")
                if key:
                    merged[str(key)] = row
        return list(merged.values())

    @staticmethod
    def _resolve_cycle(source: str) -> str:
        if source in {"daily", "fund_daily"}:
            return "daily"
        if source == "weekly":
            return "weekly"
        if source == "monthly":
            return "monthly"
        raise ValueError(f"Unsupported quote source: {source}")

    @staticmethod
    def _apply_limit(symbols: list[str], limit: int | None) -> list[str]:
        effective_limit = limit if limit is not None else settings.tushare_bulk_symbol_limit
        if effective_limit is None or effective_limit <= 0:
            return symbols
        return symbols[:effective_limit]

    def _pause(self) -> None:
        pause_ms = settings.tushare_request_pause_ms
        if pause_ms > 0:
            time.sleep(pause_ms / 1000)

    @staticmethod
    def _simple_sync_result(source: str, ts_code: str, count: int, affected_rows: int, tables: list[str]) -> dict[str, Any]:
        return {
            "ok": True,
            "source": source,
            "tsCode": ts_code,
            "count": count,
            "affectedRows": affected_rows,
            "tables": tables,
            "message": f"Synced {count} {source} rows for {ts_code}",
        }

    @staticmethod
    def _bulk_job_result(
        source: str,
        symbol_count: int,
        items: list[dict[str, Any]],
        errors: list[dict[str, str]],
        total_rows: int,
        affected_rows: int,
    ) -> dict[str, Any]:
        return {
            "ok": len(errors) == 0,
            "source": source,
            "symbolCount": symbol_count,
            "successCount": len(items),
            "errorCount": len(errors),
            "quoteCount": total_rows,
            "affectedRows": affected_rows,
            "sampleItems": items[:20],
            "errors": errors[:20],
        }

    @staticmethod
    def _basic_result(
        source: str,
        count: int,
        affected_rows: int,
        statuses: tuple[str, ...] | None,
        markets: tuple[str, ...] | None,
        rows: list[dict[str, Any]],
    ) -> dict[str, Any]:
        result: dict[str, Any] = {
            "ok": True,
            "source": source,
            "count": count,
            "affectedRows": affected_rows,
            "symbols": [row["ts_code"] for row in rows if row.get("ts_code")],
            "sampleSymbols": [row["ts_code"] for row in rows[:20] if row.get("ts_code")],
            "message": f"Synced {count} {source} rows",
        }
        if statuses is not None:
            result["statuses"] = list(statuses)
        if markets is not None:
            result["markets"] = list(markets)
        return result


tushare_sync_service = TushareSyncService(tushare_client)
