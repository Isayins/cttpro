from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, HTTPException

from src.services.tushare_sync import tushare_sync_service

router = APIRouter(prefix="/api/quant")


def _parse_csv(value: str | None) -> tuple[str, ...] | None:
    if value is None or value.strip() == "":
        return None
    return tuple(item.strip() for item in value.split(",") if item.strip())


def _parse_json(value: str | None) -> dict[str, object] | None:
    if value is None or value.strip() == "":
        return None
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"JSON 格式不正确：{exc}") from exc
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=400, detail="params_json 必须解析为对象")
    return parsed


@router.get("/source/daily")
async def fetch_daily_source(ts_code: str, start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.fetch_daily, ts_code, start_date, end_date)


@router.get("/source/weekly")
async def fetch_weekly_source(ts_code: str, start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.fetch_weekly, ts_code, start_date, end_date)


@router.get("/source/monthly")
async def fetch_monthly_source(ts_code: str, start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.fetch_monthly, ts_code, start_date, end_date)


@router.get("/source/fund-daily")
async def fetch_fund_daily_source(ts_code: str, start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.fetch_fund_daily, ts_code, start_date, end_date)


@router.get("/source/fund-basic")
async def fetch_fund_basic_source(market: str | None = None, status: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.fetch_fund_basic, market, status)


@router.get("/source/stock-basic")
async def fetch_stock_basic_source(exchange: str = "", list_status: str = "L"):
    return await asyncio.to_thread(tushare_sync_service.fetch_stock_basic, exchange, list_status)


@router.get("/source/trade-cal")
async def fetch_trade_cal_source(exchange: str = "SSE", start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.fetch_trade_calendar, exchange, start_date, end_date)


@router.post("/import/daily")
async def sync_daily(ts_code: str, start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_daily, ts_code, start_date, end_date)


@router.post("/import/weekly")
async def sync_weekly(ts_code: str, start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_weekly, ts_code, start_date, end_date)


@router.post("/import/monthly")
async def sync_monthly(ts_code: str, start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_monthly, ts_code, start_date, end_date)


@router.post("/import/fund-daily")
async def sync_fund_daily(ts_code: str, start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_fund_daily, ts_code, start_date, end_date)


@router.post("/import/stock-basic")
async def sync_stock_basic(statuses: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_stock_basic, _parse_csv(statuses))


@router.post("/import/fund-basic")
async def sync_fund_basic(markets: str | None = None, statuses: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_fund_basic_all, _parse_csv(markets), _parse_csv(statuses))


@router.post("/import/trade-cal")
async def sync_trade_cal(exchange: str = "SSE", start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_trade_calendar, exchange, start_date, end_date)


@router.post("/import/adj-factor")
async def sync_adj_factor(ts_code: str, start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_adj_factor, ts_code, start_date, end_date)


@router.post("/import/fund-adj")
async def sync_fund_adj(ts_code: str, start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_fund_adj, ts_code, start_date, end_date)


@router.post("/import/index-basic")
async def sync_index_basic(markets: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_index_basic, _parse_csv(markets))


@router.post("/import/index-daily")
async def sync_index_daily(ts_code: str, start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_index_daily, ts_code, start_date, end_date)


@router.post("/import/index-weekly")
async def sync_index_weekly(ts_code: str, start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_index_weekly, ts_code, start_date, end_date)


@router.post("/import/index-monthly")
async def sync_index_monthly(ts_code: str, start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_index_monthly, ts_code, start_date, end_date)


@router.post("/import/index-weight")
async def sync_index_weight(index_code: str, start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_index_weight, index_code, start_date, end_date)


@router.post("/import/ths-index")
async def sync_ths_index(types: str | None = None, exchange: str = "A"):
    return await asyncio.to_thread(tushare_sync_service.sync_ths_index, _parse_csv(types), exchange)


@router.post("/import/ths-member")
async def sync_ths_members(limit: int | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_ths_members, limit)


@router.post("/import/income")
async def sync_income(ts_code: str, start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_income, ts_code, start_date, end_date)


@router.post("/import/balancesheet")
async def sync_balancesheet(ts_code: str, start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_balancesheet, ts_code, start_date, end_date)


@router.post("/import/cashflow")
async def sync_cashflow(ts_code: str, start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_cashflow, ts_code, start_date, end_date)


@router.post("/import/fina-indicator")
async def sync_fina_indicator(ts_code: str, start_date: str | None = None, end_date: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_fina_indicator, ts_code, start_date, end_date)


@router.post("/import/raw-api")
async def sync_raw_api(api_name: str, params_json: str | None = None, dataset_key: str | None = None, scope_key: str | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_raw_api, api_name, _parse_json(params_json), dataset_key, scope_key)


@router.post("/import/raw-by-symbols")
async def sync_raw_by_symbols(
    api_name: str,
    security_type: str = "stock",
    start_date: str | None = None,
    end_date: str | None = None,
    statuses: str | None = None,
    markets: str | None = None,
    limit: int | None = None,
    symbol_param: str = "ts_code",
    start_param: str | None = "start_date",
    end_param: str | None = "end_date",
    dataset_key: str | None = None,
    extra_params_json: str | None = None,
):
    return await asyncio.to_thread(
        tushare_sync_service.sync_raw_by_symbols,
        api_name,
        security_type,
        start_date,
        end_date,
        _parse_csv(statuses),
        _parse_csv(markets),
        limit,
        symbol_param,
        start_param,
        end_param,
        _parse_json(extra_params_json),
        dataset_key,
    )


@router.post("/import/raw-by-trade-dates")
async def sync_raw_by_trade_dates(
    api_name: str,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int | None = None,
    date_param: str = "trade_date",
    dataset_key: str | None = None,
    extra_params_json: str | None = None,
):
    return await asyncio.to_thread(
        tushare_sync_service.sync_raw_by_trade_dates,
        api_name,
        start_date,
        end_date,
        limit,
        date_param,
        _parse_json(extra_params_json),
        dataset_key,
    )


@router.post("/import/raw-by-calendar-dates")
async def sync_raw_by_calendar_dates(
    api_name: str,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int | None = None,
    date_param: str = "date",
    dataset_key: str | None = None,
    extra_params_json: str | None = None,
):
    return await asyncio.to_thread(
        tushare_sync_service.sync_raw_by_calendar_dates,
        api_name,
        start_date,
        end_date,
        limit,
        date_param,
        _parse_json(extra_params_json),
        dataset_key,
    )


@router.post("/import/raw-by-sources")
async def sync_raw_by_sources(
    api_name: str,
    sources: str,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int | None = None,
    source_param: str = "src",
    date_mode: str = "datetime_window",
    date_param: str = "date",
    start_param: str = "start_date",
    end_param: str = "end_date",
    dataset_key: str | None = None,
    extra_params_json: str | None = None,
):
    parsed_sources = _parse_csv(sources)
    if not parsed_sources:
        raise HTTPException(status_code=400, detail="sources 参数不能为空")
    return await asyncio.to_thread(
        tushare_sync_service.sync_raw_by_sources,
        api_name,
        parsed_sources,
        start_date,
        end_date,
        limit,
        source_param,
        date_mode,
        date_param,
        start_param,
        end_param,
        _parse_json(extra_params_json),
        dataset_key,
    )


@router.post("/import/all-stocks")
async def sync_all_stocks(start_date: str | None = None, end_date: str | None = None, statuses: str | None = None, limit: int | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_all_stock_quotes, start_date, end_date, _parse_csv(statuses), limit)


@router.post("/import/all-funds")
async def sync_all_funds(
    start_date: str | None = None,
    end_date: str | None = None,
    markets: str | None = None,
    statuses: str | None = None,
    limit: int | None = None,
):
    return await asyncio.to_thread(
        tushare_sync_service.sync_all_fund_quotes,
        start_date,
        end_date,
        _parse_csv(markets),
        _parse_csv(statuses),
        limit,
    )


@router.post("/import/all-adj-factors")
async def sync_all_adj_factors(
    start_date: str | None = None,
    end_date: str | None = None,
    stock_limit: int | None = None,
    fund_limit: int | None = None,
):
    return await asyncio.to_thread(tushare_sync_service.sync_all_adj_factors, start_date, end_date, stock_limit, fund_limit)


@router.post("/import/all-indices")
async def sync_all_indices(start_date: str | None = None, end_date: str | None = None, markets: str | None = None, limit: int | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_all_indices, start_date, end_date, _parse_csv(markets), limit)


@router.post("/import/all-financials")
async def sync_all_financials(start_date: str | None = None, end_date: str | None = None, statuses: str | None = None, limit: int | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_all_financials, start_date, end_date, _parse_csv(statuses), limit)


@router.post("/import/all-boards")
async def sync_all_boards(limit: int | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_all_boards, limit)


@router.post("/import/all-raw-stock-market")
async def sync_all_raw_stock_market(start_date: str | None = None, end_date: str | None = None, statuses: str | None = None, limit: int | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_all_raw_stock_market, start_date, end_date, _parse_csv(statuses), limit)


@router.post("/import/all-raw-fund-extra")
async def sync_all_raw_fund_extra(
    start_date: str | None = None,
    end_date: str | None = None,
    markets: str | None = None,
    statuses: str | None = None,
    limit: int | None = None,
):
    return await asyncio.to_thread(
        tushare_sync_service.sync_all_raw_fund_extra,
        start_date,
        end_date,
        _parse_csv(markets),
        _parse_csv(statuses),
        limit,
    )


@router.post("/import/all-raw-industries")
async def sync_all_raw_industries(sources: str | None = None, limit: int | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_all_raw_industries, _parse_csv(sources), limit)


@router.post("/import/all-raw-shareholders")
async def sync_all_raw_shareholders(start_date: str | None = None, end_date: str | None = None, statuses: str | None = None, limit: int | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_all_raw_shareholders, start_date, end_date, _parse_csv(statuses), limit)


@router.post("/import/all-raw-market-events")
async def sync_all_raw_market_events(start_date: str | None = None, end_date: str | None = None, limit: int | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_all_raw_market_events, start_date, end_date, limit)


@router.post("/import/all-raw-margin")
async def sync_all_raw_margin(start_date: str | None = None, end_date: str | None = None, limit: int | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_all_raw_margin, start_date, end_date, limit)


@router.post("/import/all-raw-content")
async def sync_all_raw_content(start_date: str | None = None, end_date: str | None = None, limit: int | None = None):
    return await asyncio.to_thread(tushare_sync_service.sync_all_raw_content, start_date, end_date, None, None, None, limit)


@router.post("/import/all-raw-supported")
async def sync_all_raw_supported(
    start_date: str | None = None,
    end_date: str | None = None,
    stock_statuses: str | None = None,
    fund_markets: str | None = None,
    fund_statuses: str | None = None,
    industry_sources: str | None = None,
    limit: int | None = None,
):
    return await asyncio.to_thread(
        tushare_sync_service.sync_all_raw_supported,
        start_date,
        end_date,
        _parse_csv(stock_statuses),
        _parse_csv(fund_markets),
        _parse_csv(fund_statuses),
        _parse_csv(industry_sources),
        limit,
    )


@router.post("/import/all-ingestion")
async def sync_all_ingestion(
    start_date: str | None = None,
    end_date: str | None = None,
    stock_statuses: str | None = None,
    fund_markets: str | None = None,
    fund_statuses: str | None = None,
    industry_sources: str | None = None,
    limit: int | None = None,
):
    return await asyncio.to_thread(
        tushare_sync_service.sync_all_ingestion,
        start_date,
        end_date,
        _parse_csv(stock_statuses),
        _parse_csv(fund_markets),
        _parse_csv(fund_statuses),
        _parse_csv(industry_sources),
        limit,
    )


@router.post("/import/all-supported")
async def sync_all_supported(
    start_date: str | None = None,
    end_date: str | None = None,
    stock_statuses: str | None = None,
    fund_markets: str | None = None,
    fund_statuses: str | None = None,
    limit: int | None = None,
):
    return await asyncio.to_thread(
        tushare_sync_service.sync_all_supported,
        start_date,
        end_date,
        _parse_csv(stock_statuses),
        _parse_csv(fund_markets),
        _parse_csv(fund_statuses),
        limit,
    )
