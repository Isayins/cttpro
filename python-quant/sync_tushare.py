from __future__ import annotations

import argparse
import json

from src.services.tushare_sync import tushare_sync_service


def parse_csv(value: str | None) -> tuple[str, ...] | None:
    if value is None or value.strip() == "":
        return None
    return tuple(item.strip() for item in value.split(",") if item.strip())


def parse_json(value: str | None) -> dict[str, object] | None:
    if value is None or value.strip() == "":
        return None
    parsed = json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError("params-json must decode to an object")
    return parsed


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Fetch and sync market data from Tushare")
    subparsers = parser.add_subparsers(dest="command", required=True)

    for command in ("daily", "weekly", "monthly", "fund-daily", "adj-factor", "fund-adj", "income", "balancesheet", "cashflow", "fina-indicator"):
        child = subparsers.add_parser(command)
        child.add_argument("--ts-code", required=True)
        child.add_argument("--start-date")
        child.add_argument("--end-date")

    stock_basic = subparsers.add_parser("stock-basic")
    stock_basic.add_argument("--statuses")

    fund_basic = subparsers.add_parser("fund-basic")
    fund_basic.add_argument("--markets")
    fund_basic.add_argument("--statuses")

    trade_cal = subparsers.add_parser("trade-cal")
    trade_cal.add_argument("--exchange", default="SSE")
    trade_cal.add_argument("--start-date")
    trade_cal.add_argument("--end-date")

    index_basic = subparsers.add_parser("index-basic")
    index_basic.add_argument("--markets")

    for command in ("index-daily", "index-weekly", "index-monthly"):
        child = subparsers.add_parser(command)
        child.add_argument("--ts-code", required=True)
        child.add_argument("--start-date")
        child.add_argument("--end-date")

    index_weight = subparsers.add_parser("index-weight")
    index_weight.add_argument("--index-code", required=True)
    index_weight.add_argument("--start-date")
    index_weight.add_argument("--end-date")

    ths_index = subparsers.add_parser("ths-index")
    ths_index.add_argument("--types")
    ths_index.add_argument("--exchange", default="A")

    ths_member = subparsers.add_parser("ths-member")
    ths_member.add_argument("--limit", type=int)

    raw_api = subparsers.add_parser("raw-api")
    raw_api.add_argument("--api-name", required=True)
    raw_api.add_argument("--params-json")
    raw_api.add_argument("--dataset-key")
    raw_api.add_argument("--scope-key")

    raw_by_symbols = subparsers.add_parser("raw-by-symbols")
    raw_by_symbols.add_argument("--api-name", required=True)
    raw_by_symbols.add_argument("--security-type", default="stock")
    raw_by_symbols.add_argument("--start-date")
    raw_by_symbols.add_argument("--end-date")
    raw_by_symbols.add_argument("--statuses")
    raw_by_symbols.add_argument("--markets")
    raw_by_symbols.add_argument("--limit", type=int)
    raw_by_symbols.add_argument("--symbol-param", default="ts_code")
    raw_by_symbols.add_argument("--start-param", default="start_date")
    raw_by_symbols.add_argument("--end-param", default="end_date")
    raw_by_symbols.add_argument("--dataset-key")
    raw_by_symbols.add_argument("--extra-params-json")

    raw_by_trade_dates = subparsers.add_parser("raw-by-trade-dates")
    raw_by_trade_dates.add_argument("--api-name", required=True)
    raw_by_trade_dates.add_argument("--start-date")
    raw_by_trade_dates.add_argument("--end-date")
    raw_by_trade_dates.add_argument("--limit", type=int)
    raw_by_trade_dates.add_argument("--date-param", default="trade_date")
    raw_by_trade_dates.add_argument("--dataset-key")
    raw_by_trade_dates.add_argument("--extra-params-json")

    raw_by_calendar_dates = subparsers.add_parser("raw-by-calendar-dates")
    raw_by_calendar_dates.add_argument("--api-name", required=True)
    raw_by_calendar_dates.add_argument("--start-date")
    raw_by_calendar_dates.add_argument("--end-date")
    raw_by_calendar_dates.add_argument("--limit", type=int)
    raw_by_calendar_dates.add_argument("--date-param", default="date")
    raw_by_calendar_dates.add_argument("--dataset-key")
    raw_by_calendar_dates.add_argument("--extra-params-json")

    raw_by_sources = subparsers.add_parser("raw-by-sources")
    raw_by_sources.add_argument("--api-name", required=True)
    raw_by_sources.add_argument("--sources", required=True)
    raw_by_sources.add_argument("--start-date")
    raw_by_sources.add_argument("--end-date")
    raw_by_sources.add_argument("--limit", type=int)
    raw_by_sources.add_argument("--source-param", default="src")
    raw_by_sources.add_argument("--date-mode", default="datetime_window")
    raw_by_sources.add_argument("--date-param", default="date")
    raw_by_sources.add_argument("--start-param", default="start_date")
    raw_by_sources.add_argument("--end-param", default="end_date")
    raw_by_sources.add_argument("--dataset-key")
    raw_by_sources.add_argument("--extra-params-json")

    all_stocks = subparsers.add_parser("all-stocks")
    all_stocks.add_argument("--start-date")
    all_stocks.add_argument("--end-date")
    all_stocks.add_argument("--statuses")
    all_stocks.add_argument("--limit", type=int)

    all_funds = subparsers.add_parser("all-funds")
    all_funds.add_argument("--start-date")
    all_funds.add_argument("--end-date")
    all_funds.add_argument("--markets")
    all_funds.add_argument("--statuses")
    all_funds.add_argument("--limit", type=int)

    all_adj = subparsers.add_parser("all-adj-factors")
    all_adj.add_argument("--start-date")
    all_adj.add_argument("--end-date")
    all_adj.add_argument("--stock-limit", type=int)
    all_adj.add_argument("--fund-limit", type=int)

    all_indices = subparsers.add_parser("all-indices")
    all_indices.add_argument("--start-date")
    all_indices.add_argument("--end-date")
    all_indices.add_argument("--markets")
    all_indices.add_argument("--limit", type=int)

    all_financials = subparsers.add_parser("all-financials")
    all_financials.add_argument("--start-date")
    all_financials.add_argument("--end-date")
    all_financials.add_argument("--statuses")
    all_financials.add_argument("--limit", type=int)

    all_boards = subparsers.add_parser("all-boards")
    all_boards.add_argument("--limit", type=int)

    all_raw_stock_market = subparsers.add_parser("all-raw-stock-market")
    all_raw_stock_market.add_argument("--start-date")
    all_raw_stock_market.add_argument("--end-date")
    all_raw_stock_market.add_argument("--statuses")
    all_raw_stock_market.add_argument("--limit", type=int)

    all_raw_fund_extra = subparsers.add_parser("all-raw-fund-extra")
    all_raw_fund_extra.add_argument("--start-date")
    all_raw_fund_extra.add_argument("--end-date")
    all_raw_fund_extra.add_argument("--markets")
    all_raw_fund_extra.add_argument("--statuses")
    all_raw_fund_extra.add_argument("--limit", type=int)

    all_raw_industries = subparsers.add_parser("all-raw-industries")
    all_raw_industries.add_argument("--sources")
    all_raw_industries.add_argument("--limit", type=int)

    all_raw_shareholders = subparsers.add_parser("all-raw-shareholders")
    all_raw_shareholders.add_argument("--start-date")
    all_raw_shareholders.add_argument("--end-date")
    all_raw_shareholders.add_argument("--statuses")
    all_raw_shareholders.add_argument("--limit", type=int)

    all_raw_market_events = subparsers.add_parser("all-raw-market-events")
    all_raw_market_events.add_argument("--start-date")
    all_raw_market_events.add_argument("--end-date")
    all_raw_market_events.add_argument("--limit", type=int)

    all_raw_margin = subparsers.add_parser("all-raw-margin")
    all_raw_margin.add_argument("--start-date")
    all_raw_margin.add_argument("--end-date")
    all_raw_margin.add_argument("--limit", type=int)

    all_raw_content = subparsers.add_parser("all-raw-content")
    all_raw_content.add_argument("--start-date")
    all_raw_content.add_argument("--end-date")
    all_raw_content.add_argument("--limit", type=int)

    all_raw_supported = subparsers.add_parser("all-raw-supported")
    all_raw_supported.add_argument("--start-date")
    all_raw_supported.add_argument("--end-date")
    all_raw_supported.add_argument("--stock-statuses")
    all_raw_supported.add_argument("--fund-markets")
    all_raw_supported.add_argument("--fund-statuses")
    all_raw_supported.add_argument("--industry-sources")
    all_raw_supported.add_argument("--limit", type=int)

    all_ingestion = subparsers.add_parser("all-ingestion")
    all_ingestion.add_argument("--start-date")
    all_ingestion.add_argument("--end-date")
    all_ingestion.add_argument("--stock-statuses")
    all_ingestion.add_argument("--fund-markets")
    all_ingestion.add_argument("--fund-statuses")
    all_ingestion.add_argument("--industry-sources")
    all_ingestion.add_argument("--limit", type=int)

    all_supported = subparsers.add_parser("all-supported")
    all_supported.add_argument("--start-date")
    all_supported.add_argument("--end-date")
    all_supported.add_argument("--stock-statuses")
    all_supported.add_argument("--fund-markets")
    all_supported.add_argument("--fund-statuses")
    all_supported.add_argument("--limit", type=int)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    command = args.command
    if command == "daily":
        result = tushare_sync_service.sync_daily(args.ts_code, args.start_date, args.end_date)
    elif command == "weekly":
        result = tushare_sync_service.sync_weekly(args.ts_code, args.start_date, args.end_date)
    elif command == "monthly":
        result = tushare_sync_service.sync_monthly(args.ts_code, args.start_date, args.end_date)
    elif command == "fund-daily":
        result = tushare_sync_service.sync_fund_daily(args.ts_code, args.start_date, args.end_date)
    elif command == "adj-factor":
        result = tushare_sync_service.sync_adj_factor(args.ts_code, args.start_date, args.end_date)
    elif command == "fund-adj":
        result = tushare_sync_service.sync_fund_adj(args.ts_code, args.start_date, args.end_date)
    elif command == "income":
        result = tushare_sync_service.sync_income(args.ts_code, args.start_date, args.end_date)
    elif command == "balancesheet":
        result = tushare_sync_service.sync_balancesheet(args.ts_code, args.start_date, args.end_date)
    elif command == "cashflow":
        result = tushare_sync_service.sync_cashflow(args.ts_code, args.start_date, args.end_date)
    elif command == "fina-indicator":
        result = tushare_sync_service.sync_fina_indicator(args.ts_code, args.start_date, args.end_date)
    elif command == "stock-basic":
        result = tushare_sync_service.sync_stock_basic(parse_csv(args.statuses))
    elif command == "fund-basic":
        result = tushare_sync_service.sync_fund_basic_all(parse_csv(args.markets), parse_csv(args.statuses))
    elif command == "trade-cal":
        result = tushare_sync_service.sync_trade_calendar(args.exchange, args.start_date, args.end_date)
    elif command == "index-basic":
        result = tushare_sync_service.sync_index_basic(parse_csv(args.markets))
    elif command == "index-daily":
        result = tushare_sync_service.sync_index_daily(args.ts_code, args.start_date, args.end_date)
    elif command == "index-weekly":
        result = tushare_sync_service.sync_index_weekly(args.ts_code, args.start_date, args.end_date)
    elif command == "index-monthly":
        result = tushare_sync_service.sync_index_monthly(args.ts_code, args.start_date, args.end_date)
    elif command == "index-weight":
        result = tushare_sync_service.sync_index_weight(args.index_code, args.start_date, args.end_date)
    elif command == "ths-index":
        result = tushare_sync_service.sync_ths_index(parse_csv(args.types), args.exchange)
    elif command == "ths-member":
        result = tushare_sync_service.sync_ths_members(args.limit)
    elif command == "raw-api":
        result = tushare_sync_service.sync_raw_api(args.api_name, parse_json(args.params_json), args.dataset_key, args.scope_key)
    elif command == "raw-by-symbols":
        result = tushare_sync_service.sync_raw_by_symbols(
            args.api_name,
            args.security_type,
            args.start_date,
            args.end_date,
            parse_csv(args.statuses),
            parse_csv(args.markets),
            args.limit,
            args.symbol_param,
            args.start_param,
            args.end_param,
            parse_json(args.extra_params_json),
            args.dataset_key,
        )
    elif command == "raw-by-trade-dates":
        result = tushare_sync_service.sync_raw_by_trade_dates(
            args.api_name,
            args.start_date,
            args.end_date,
            args.limit,
            args.date_param,
            parse_json(args.extra_params_json),
            args.dataset_key,
        )
    elif command == "raw-by-calendar-dates":
        result = tushare_sync_service.sync_raw_by_calendar_dates(
            args.api_name,
            args.start_date,
            args.end_date,
            args.limit,
            args.date_param,
            parse_json(args.extra_params_json),
            args.dataset_key,
        )
    elif command == "raw-by-sources":
        result = tushare_sync_service.sync_raw_by_sources(
            args.api_name,
            parse_csv(args.sources) or tuple(),
            args.start_date,
            args.end_date,
            args.limit,
            args.source_param,
            args.date_mode,
            args.date_param,
            args.start_param,
            args.end_param,
            parse_json(args.extra_params_json),
            args.dataset_key,
        )
    elif command == "all-stocks":
        result = tushare_sync_service.sync_all_stock_quotes(args.start_date, args.end_date, parse_csv(args.statuses), args.limit)
    elif command == "all-funds":
        result = tushare_sync_service.sync_all_fund_quotes(
            args.start_date,
            args.end_date,
            parse_csv(args.markets),
            parse_csv(args.statuses),
            args.limit,
        )
    elif command == "all-adj-factors":
        result = tushare_sync_service.sync_all_adj_factors(args.start_date, args.end_date, args.stock_limit, args.fund_limit)
    elif command == "all-indices":
        result = tushare_sync_service.sync_all_indices(args.start_date, args.end_date, parse_csv(args.markets), args.limit)
    elif command == "all-financials":
        result = tushare_sync_service.sync_all_financials(args.start_date, args.end_date, parse_csv(args.statuses), args.limit)
    elif command == "all-boards":
        result = tushare_sync_service.sync_all_boards(args.limit)
    elif command == "all-raw-stock-market":
        result = tushare_sync_service.sync_all_raw_stock_market(args.start_date, args.end_date, parse_csv(args.statuses), args.limit)
    elif command == "all-raw-fund-extra":
        result = tushare_sync_service.sync_all_raw_fund_extra(
            args.start_date,
            args.end_date,
            parse_csv(args.markets),
            parse_csv(args.statuses),
            args.limit,
        )
    elif command == "all-raw-industries":
        result = tushare_sync_service.sync_all_raw_industries(parse_csv(args.sources), args.limit)
    elif command == "all-raw-shareholders":
        result = tushare_sync_service.sync_all_raw_shareholders(args.start_date, args.end_date, parse_csv(args.statuses), args.limit)
    elif command == "all-raw-market-events":
        result = tushare_sync_service.sync_all_raw_market_events(args.start_date, args.end_date, args.limit)
    elif command == "all-raw-margin":
        result = tushare_sync_service.sync_all_raw_margin(args.start_date, args.end_date, args.limit)
    elif command == "all-raw-content":
        result = tushare_sync_service.sync_all_raw_content(args.start_date, args.end_date, None, None, None, args.limit)
    elif command == "all-raw-supported":
        result = tushare_sync_service.sync_all_raw_supported(
            args.start_date,
            args.end_date,
            parse_csv(args.stock_statuses),
            parse_csv(args.fund_markets),
            parse_csv(args.fund_statuses),
            parse_csv(args.industry_sources),
            args.limit,
        )
    elif command == "all-ingestion":
        result = tushare_sync_service.sync_all_ingestion(
            args.start_date,
            args.end_date,
            parse_csv(args.stock_statuses),
            parse_csv(args.fund_markets),
            parse_csv(args.fund_statuses),
            parse_csv(args.industry_sources),
            args.limit,
        )
    else:
        result = tushare_sync_service.sync_all_supported(
            args.start_date,
            args.end_date,
            parse_csv(args.stock_statuses),
            parse_csv(args.fund_markets),
            parse_csv(args.fund_statuses),
            args.limit,
        )

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
