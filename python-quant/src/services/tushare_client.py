from __future__ import annotations

from typing import Any

import tushare as ts

from src.config import settings
from src.utils.dates import normalize_tushare_date


class TushareClient:
    def __init__(self) -> None:
        self._pro = None

    @property
    def pro(self):
        if self._pro is None:
            if not settings.tushare_token:
                raise RuntimeError("TUSHARE_TOKEN is not configured")

            pro = ts.pro_api(settings.tushare_token)
            pro._DataApi__token = settings.tushare_token
            pro._DataApi__http_url = settings.tushare_http_url
            self._pro = pro

        return self._pro

    def fetch_api(self, api_name: str, **kwargs: Any) -> list[dict[str, Any]]:
        api = getattr(self.pro, api_name, None)
        if api is None:
            raise ValueError(f"Unsupported Tushare API: {api_name}")
        return self._frame_to_records(api(**kwargs))

    def fetch_daily(
        self,
        ts_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._frame_to_records(
            self.pro.daily(
                ts_code=ts_code,
                start_date=normalize_tushare_date(start_date),
                end_date=normalize_tushare_date(end_date),
            )
        )

    def fetch_weekly(
        self,
        ts_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._frame_to_records(
            self.pro.weekly(
                ts_code=ts_code,
                start_date=normalize_tushare_date(start_date),
                end_date=normalize_tushare_date(end_date),
            )
        )

    def fetch_monthly(
        self,
        ts_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._frame_to_records(
            self.pro.monthly(
                ts_code=ts_code,
                start_date=normalize_tushare_date(start_date),
                end_date=normalize_tushare_date(end_date),
            )
        )

    def fetch_fund_daily(
        self,
        ts_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._frame_to_records(
            self.pro.fund_daily(
                ts_code=ts_code,
                start_date=normalize_tushare_date(start_date),
                end_date=normalize_tushare_date(end_date),
            )
        )

    def fetch_fund_basic(
        self,
        market: str | None = None,
        status: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._frame_to_records(
            self.pro.fund_basic(
                market=market or settings.tushare_default_market,
                status=status or settings.tushare_default_status,
            )
        )

    def fetch_stock_basic(self, exchange: str = "", list_status: str = "L") -> list[dict[str, Any]]:
        return self._frame_to_records(self.pro.stock_basic(exchange=exchange, list_status=list_status))

    def fetch_trade_calendar(
        self,
        exchange: str = "SSE",
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._frame_to_records(
            self.pro.trade_cal(
                exchange=exchange,
                start_date=normalize_tushare_date(start_date),
                end_date=normalize_tushare_date(end_date),
            )
        )

    def fetch_adj_factor(
        self,
        ts_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._frame_to_records(
            self.pro.adj_factor(
                ts_code=ts_code,
                start_date=normalize_tushare_date(start_date),
                end_date=normalize_tushare_date(end_date),
            )
        )

    def fetch_fund_adj(
        self,
        ts_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._frame_to_records(
            self.pro.fund_adj(
                ts_code=ts_code,
                start_date=normalize_tushare_date(start_date),
                end_date=normalize_tushare_date(end_date),
            )
        )

    def fetch_index_basic(
        self,
        market: str,
        publisher: str | None = None,
        category: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._frame_to_records(
            self.pro.index_basic(
                market=market,
                publisher=publisher,
                category=category,
            )
        )

    def fetch_index_daily(
        self,
        ts_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._frame_to_records(
            self.pro.index_daily(
                ts_code=ts_code,
                start_date=normalize_tushare_date(start_date),
                end_date=normalize_tushare_date(end_date),
            )
        )

    def fetch_index_weekly(
        self,
        ts_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._frame_to_records(
            self.pro.index_weekly(
                ts_code=ts_code,
                start_date=normalize_tushare_date(start_date),
                end_date=normalize_tushare_date(end_date),
            )
        )

    def fetch_index_monthly(
        self,
        ts_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._frame_to_records(
            self.pro.index_monthly(
                ts_code=ts_code,
                start_date=normalize_tushare_date(start_date),
                end_date=normalize_tushare_date(end_date),
            )
        )

    def fetch_index_weight(
        self,
        index_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._frame_to_records(
            self.pro.index_weight(
                index_code=index_code,
                start_date=normalize_tushare_date(start_date),
                end_date=normalize_tushare_date(end_date),
            )
        )

    def fetch_income(
        self,
        ts_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._frame_to_records(
            self.pro.income(
                ts_code=ts_code,
                start_date=normalize_tushare_date(start_date),
                end_date=normalize_tushare_date(end_date),
            )
        )

    def fetch_balancesheet(
        self,
        ts_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._frame_to_records(
            self.pro.balancesheet(
                ts_code=ts_code,
                start_date=normalize_tushare_date(start_date),
                end_date=normalize_tushare_date(end_date),
            )
        )

    def fetch_cashflow(
        self,
        ts_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._frame_to_records(
            self.pro.cashflow(
                ts_code=ts_code,
                start_date=normalize_tushare_date(start_date),
                end_date=normalize_tushare_date(end_date),
            )
        )

    def fetch_fina_indicator(
        self,
        ts_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._frame_to_records(
            self.pro.fina_indicator(
                ts_code=ts_code,
                start_date=normalize_tushare_date(start_date),
                end_date=normalize_tushare_date(end_date),
            )
        )

    def fetch_ths_index(self, exchange: str = "A", type_: str | None = None) -> list[dict[str, Any]]:
        kwargs: dict[str, Any] = {"exchange": exchange}
        if type_:
            kwargs["type"] = type_
        return self._frame_to_records(self.pro.ths_index(**kwargs))

    def fetch_ths_member(
        self,
        ts_code: str | None = None,
        con_code: str | None = None,
    ) -> list[dict[str, Any]]:
        return self._frame_to_records(
            self.pro.ths_member(
                ts_code=ts_code,
                con_code=con_code,
            )
        )

    def fetch_daily_basic(
        self,
        ts_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self.fetch_api(
            "daily_basic",
            ts_code=ts_code,
            start_date=normalize_tushare_date(start_date),
            end_date=normalize_tushare_date(end_date),
        )

    def fetch_stk_limit(
        self,
        ts_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self.fetch_api(
            "stk_limit",
            ts_code=ts_code,
            start_date=normalize_tushare_date(start_date),
            end_date=normalize_tushare_date(end_date),
        )

    def fetch_suspend_d(
        self,
        ts_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self.fetch_api(
            "suspend_d",
            ts_code=ts_code,
            start_date=normalize_tushare_date(start_date),
            end_date=normalize_tushare_date(end_date),
        )

    def fetch_moneyflow(
        self,
        ts_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self.fetch_api(
            "moneyflow",
            ts_code=ts_code,
            start_date=normalize_tushare_date(start_date),
            end_date=normalize_tushare_date(end_date),
        )

    def fetch_index_classify(self, src: str = "SW2021", level: str | None = None) -> list[dict[str, Any]]:
        kwargs: dict[str, Any] = {"src": src}
        if level:
            kwargs["level"] = level
        return self.fetch_api("index_classify", **kwargs)

    def fetch_index_member(
        self,
        index_code: str | None = None,
        ts_code: str | None = None,
        src: str | None = None,
        is_new: str | None = None,
    ) -> list[dict[str, Any]]:
        kwargs: dict[str, Any] = {}
        if index_code:
            kwargs["index_code"] = index_code
        if ts_code:
            kwargs["ts_code"] = ts_code
        if src:
            kwargs["src"] = src
        if is_new:
            kwargs["is_new"] = is_new
        return self.fetch_api("index_member", **kwargs)

    def fetch_fund_nav(
        self,
        ts_code: str,
        end_date: str | None = None,
        market: str | None = None,
    ) -> list[dict[str, Any]]:
        kwargs: dict[str, Any] = {"ts_code": ts_code}
        if end_date:
            kwargs["end_date"] = normalize_tushare_date(end_date)
        if market:
            kwargs["market"] = market
        return self.fetch_api("fund_nav", **kwargs)

    def fetch_fund_share(
        self,
        ts_code: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        return self.fetch_api(
            "fund_share",
            ts_code=ts_code,
            start_date=normalize_tushare_date(start_date),
            end_date=normalize_tushare_date(end_date),
        )

    @staticmethod
    def _frame_to_records(frame) -> list[dict[str, Any]]:
        if frame is None or frame.empty:
            return []

        normalized = frame.where(frame.notna(), None)
        return [dict(record) for record in normalized.to_dict(orient="records")]


tushare_client = TushareClient()
