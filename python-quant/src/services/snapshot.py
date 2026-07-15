from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from src.config import settings
from src.services.market_repository import MarketRepository, market_repository
from src.services.strategy import StrategyEngine, strategy_engine
from src.utils.formatting import format_date, to_float, to_int

MAX_CANDLE_LIMIT = 5000
SCREENER_MIN_BARS = 260
SCREENER_MAX_TOP = 12
SCREENER_FILTER_REASON_LABELS = {
    "avg_amount": "20-day average turnover below threshold",
    "latest_amount": "Latest turnover below threshold",
    "float_market_cap": "Float market cap below threshold",
    "total_market_cap": "Total market cap below threshold",
    "listed_days": "Listing age below threshold",
    "st": "ST name excluded",
    "bse": "Beijing exchange excluded",
    "suspended": "Suspended symbol excluded",
    "list_status": "Non-normal listing status excluded",
}
SCREENER_FILTER_PRESETS: dict[str, dict[str, int | bool]] = {
    "aggressive": {
        "minAvgAmountK": 150000,
        "minLatestAmountK": 80000,
        "minFloatMarketCapW": 200000,
        "minTotalMarketCapW": 0,
        "minListedDays": 60,
        "excludeSt": True,
        "excludeBse": True,
        "excludeSuspended": True,
        "excludeNonListingStatus": True,
    },
    "balanced": {
        "minAvgAmountK": 300000,
        "minLatestAmountK": 150000,
        "minFloatMarketCapW": 500000,
        "minTotalMarketCapW": 0,
        "minListedDays": 120,
        "excludeSt": True,
        "excludeBse": True,
        "excludeSuspended": True,
        "excludeNonListingStatus": True,
    },
    "conservative": {
        "minAvgAmountK": 500000,
        "minLatestAmountK": 300000,
        "minFloatMarketCapW": 1000000,
        "minTotalMarketCapW": 0,
        "minListedDays": 180,
        "excludeSt": True,
        "excludeBse": True,
        "excludeSuspended": True,
        "excludeNonListingStatus": True,
    },
}


class MarketSnapshotService:
    def __init__(
        self,
        repository: MarketRepository,
        strategy: StrategyEngine,
    ) -> None:
        self.repository = repository
        self.strategy = strategy

    def build_snapshot(
        self,
        symbol: str | None = None,
        limit: int | None = None,
        *,
        automation_enabled: bool = True,
        manual_override: str | None = None,
        include_database: bool = True,
    ) -> dict[str, Any]:
        resolved_symbol = self.repository.resolve_symbol(symbol)
        if not resolved_symbol:
            return self._empty_snapshot("股票数据库中暂无行情数据", include_database=include_database)

        try:
            price_sources = self.repository.get_active_price_sources()
            display_rows = self.repository.load_rows(
                resolved_symbol,
                self._resolve_limit(limit),
                price_source=price_sources["display"],
            )
            if not display_rows:
                return self._empty_snapshot(f"No kline data found for {resolved_symbol}", include_database=include_database)

            analysis_limit = max(self._resolve_limit(limit), 1250)
            if price_sources["signal"] == price_sources["display"] and len(display_rows) >= analysis_limit:
                analysis_rows = display_rows
            else:
                analysis_rows = self.repository.load_rows(
                    resolved_symbol,
                    analysis_limit,
                    price_source=price_sources["signal"],
                )
            latest = display_rows[-1]
            previous = display_rows[-2] if len(display_rows) > 1 else display_rows[-1]
            name = str(latest["name"] or resolved_symbol)
            pct_chg = to_float(latest["pct_chg"], 4)

            if pct_chg == 0:
                previous_close = to_float(previous["close"], 4)
                if previous_close > 0:
                    pct_chg = round((to_float(latest["close"], 4) - previous_close) / previous_close * 100, 2)

            candles = [
                {
                    "time": format_date(row["trade_date"]),
                    "open": to_float(row["open"], 4),
                    "high": to_float(row["high"], 4),
                    "low": to_float(row["low"], 4),
                    "close": to_float(row["close"], 4),
                    "volume": to_int(row["vol"]),
                    "amount": to_float(row["amount"], 2),
                }
                for row in display_rows
            ]
            database_bundle = self.repository.load_database_bundle(resolved_symbol) if include_database else None
            strategy_bundle = database_bundle or self.repository.load_strategy_bundle(resolved_symbol)
            strategy_snapshot = self.strategy.analyze_market(
                analysis_rows,
                resolved_symbol,
                name,
                database_bundle=strategy_bundle,
                automation_enabled=automation_enabled,
                manual_override=manual_override,
            )
            signal = strategy_snapshot["signal"]
            analysis = strategy_snapshot["analysis"]
            nav = self._build_nav(display_rows)

            snapshot = {
                "updatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "symbol": resolved_symbol,
                "name": name,
                "profile": {
                    "symbol": resolved_symbol,
                    "name": name,
                    "securityType": str(latest.get("securityType") or "unknown"),
                    "exchange": latest.get("exchange"),
                    "market": latest.get("market"),
                    "indexName": latest.get("indexName"),
                    "industry": latest.get("industry"),
                    "area": latest.get("area"),
                    "listStatus": latest.get("listStatus"),
                    "listDate": latest.get("listDate"),
                    "boardNames": latest.get("boardNames"),
                    "boardCount": to_int(latest.get("boardCount")),
                },
                "lastClose": to_float(latest["close"], 4),
                "dailyChangePct": pct_chg,
                "latestVolume": to_int(latest["vol"]),
                "latestAmount": to_float(latest["amount"], 2),
                "signal": signal,
                "analysis": analysis,
                "priceSources": price_sources,
                "candles": candles,
                "summary": {
                    "nav": nav,
                    "positionPct": signal["positionPct"],
                    "bars": len(candles),
                },
            }
            if include_database and database_bundle is not None:
                snapshot["database"] = self._build_database_summary(database_bundle, latest, price_sources)
            return snapshot
        except Exception as exc:
            return self._empty_snapshot(f"加载行情数据失败: {exc}", include_database=include_database)

    def list_stocks(self) -> list[dict[str, Any]]:
        return self.repository.list_stocks()

    def list_weekly_data(self, symbol: str | None = None) -> dict[str, Any]:
        resolved_symbol = self.repository.resolve_symbol(symbol)
        if not resolved_symbol:
            return {"data": [], "message": "股票数据库中暂无行情数据"}

        rows = self.repository.load_rows(
            resolved_symbol,
            7,
            price_source=self.repository.get_active_price_sources()["display"],
        )
        return {
            "data": [
                {
                    "symbol": row["ts_code"],
                    "date": format_date(row["trade_date"]),
                    "open": to_float(row["open"], 4),
                    "high": to_float(row["high"], 4),
                    "low": to_float(row["low"], 4),
                    "close": to_float(row["close"], 4),
                    "volume": to_int(row["vol"]),
                    "amount": to_float(row["amount"], 2),
                    "indicator1": to_float(row["pre_close"], 4),
                    "indicator2": to_float(row["pct_chg"], 4),
                }
                for row in rows
            ]
        }

    def build_database_summary(self, symbol: str | None = None) -> dict[str, Any]:
        resolved_symbol = self.repository.resolve_symbol(symbol)
        if not resolved_symbol:
            return self._empty_database_summary()

        price_sources = self.repository.get_active_price_sources()
        latest = self.repository.load_latest_row(resolved_symbol, price_source=price_sources["display"])
        if not latest:
            return self._empty_database_summary()

        try:
            database_bundle = self.repository.load_database_bundle(resolved_symbol)
        except Exception:
            return self._empty_database_summary()
        return self._build_database_summary(database_bundle, latest, price_sources)

    def build_screener(
        self,
        *,
        top: int | None = None,
        max_symbols: int | None = None,
        preset: str | None = None,
        min_avg_amount_k: int | None = None,
        min_latest_amount_k: int | None = None,
        min_float_market_cap_w: int | None = None,
        min_total_market_cap_w: int | None = None,
        min_listed_days: int | None = None,
        exclude_st: bool | None = None,
        exclude_bse: bool | None = None,
        exclude_suspended: bool | None = None,
        exclude_non_listing_status: bool | None = None,
    ) -> dict[str, Any]:
        screenable = self.repository.list_screenable_stocks()
        price_sources = self.repository.get_active_price_sources()
        safe_top = max(1, min(int(top or 6), SCREENER_MAX_TOP))
        applied_preset = self._normalize_screener_preset(preset)
        screener_filters = self._resolve_screener_filter_settings(
            preset=applied_preset,
            overrides={
                "minAvgAmountK": min_avg_amount_k,
                "minLatestAmountK": min_latest_amount_k,
                "minFloatMarketCapW": min_float_market_cap_w,
                "minTotalMarketCapW": min_total_market_cap_w,
                "minListedDays": min_listed_days,
                "excludeSt": exclude_st,
                "excludeBse": exclude_bse,
                "excludeSuspended": exclude_suspended,
                "excludeNonListingStatus": exclude_non_listing_status,
            },
        )

        if max_symbols is not None and max_symbols > 0:
            screenable = screenable[: max_symbols]

        prefilter_limit = max(SCREENER_MIN_BARS, settings.screener_prefilter_bars)
        analysis_limit = max(prefilter_limit, settings.screener_strategy_bars)
        empty_screener_bundle = self._empty_screener_bundle()
        prefilter_snapshots = self.repository.load_prefilter_snapshots_map(
            [str(stock.get("symbol") or "").strip() for stock in screenable],
            price_source=price_sources["signal"],
            lookback_days=int(screener_filters["amountLookbackDays"]),
            required_bars=SCREENER_MIN_BARS,
        )
        cheap_filters = dict(screener_filters)
        cheap_filters["excludeSuspended"] = False
        buckets = {
            "longTermStrategies": {},
            "stockPickers": {},
        }
        screened_count = 0
        eligible_count = 0
        filtered_out_count = 0
        qualified_entries = 0
        filter_reason_counts = {key: 0 for key in SCREENER_FILTER_REASON_LABELS}
        cheap_pass_count = 0
        strategy_analyzed_count = 0
        pending_candidates: list[dict[str, Any]] = []
        pending_prefilter_pass: list[dict[str, Any]] = []

        for stock in screenable:
            symbol = str(stock.get("symbol") or "").strip()
            if not symbol:
                continue

            try:
                prefilter_snapshot = prefilter_snapshots.get(symbol)
                if not prefilter_snapshot:
                    continue
                if int(prefilter_snapshot.get("sampled_bars") or 0) < SCREENER_MIN_BARS:
                    continue

                screened_count += 1
                screener_profile = self._build_screener_profile_from_latest_row(
                    stock,
                    prefilter_snapshot,
                    empty_screener_bundle,
                    avg_amount_override=self._to_numeric(prefilter_snapshot.get("avg_amount_lookback")),
                )
                filter_result = self._apply_screener_filters(screener_profile, cheap_filters)
                if not filter_result["passed"]:
                    filtered_out_count += 1
                    for reason_code in filter_result["reasonCodes"]:
                        filter_reason_counts[reason_code] = filter_reason_counts.get(reason_code, 0) + 1
                    continue
                cheap_pass_count += 1
            except Exception:
                continue

            pending_prefilter_pass.append(
                {
                    "symbol": symbol,
                    "stock": stock,
                }
            )

        suspended_filtered: list[dict[str, Any]] = []
        suspend_bundles = {}
        if screener_filters["excludeSuspended"] and pending_prefilter_pass:
            suspend_bundles = self.repository.load_screener_bundles_map(
                [str(entry["symbol"]) for entry in pending_prefilter_pass],
                include_daily_basic=False,
                include_moneyflow=False,
                include_suspend=True,
            )

        for entry in pending_prefilter_pass:
            symbol = str(entry["symbol"])

            if screener_filters["excludeSuspended"]:
                suspend_bundle = suspend_bundles.get(symbol) or empty_screener_bundle
                if self._is_suspended_bundle(suspend_bundle):
                    filtered_out_count += 1
                    filter_reason_counts["suspended"] = filter_reason_counts.get("suspended", 0) + 1
                    continue

            suspended_filtered.append(entry)

        analysis_bundles = {}
        if suspended_filtered:
            analysis_bundles = self.repository.load_screener_bundles_map(
                [str(entry["symbol"]) for entry in suspended_filtered],
                include_daily_basic=True,
                include_moneyflow=True,
                include_suspend=False,
            )
        analysis_rows_map = {}
        if suspended_filtered:
            analysis_rows_map = self.repository.load_rows_map(
                [str(entry["symbol"]) for entry in suspended_filtered],
                analysis_limit,
                price_source=price_sources["signal"],
            )

        for entry in suspended_filtered:
            symbol = str(entry["symbol"])
            stock = entry["stock"]

            try:
                signal_rows = analysis_rows_map.get(symbol) or self.repository.load_rows(
                    symbol,
                    analysis_limit,
                    price_source=price_sources["signal"],
                )
                if len(signal_rows) < SCREENER_MIN_BARS:
                    continue
                latest = signal_rows[-1]

                database_bundle = analysis_bundles.get(symbol) or self.repository.load_screener_bundle(
                    symbol,
                    include_daily_basic=True,
                    include_moneyflow=True,
                    include_suspend=False,
                )
                screener_profile = self._build_screener_profile(stock, signal_rows, database_bundle)
                name = str(stock.get("name") or latest.get("name") or symbol)
                strategy_snapshot = self.strategy.analyze_market(
                    signal_rows,
                    symbol,
                    name,
                    database_bundle=database_bundle,
                    automation_enabled=True,
                    manual_override=None,
                )
            except Exception:
                continue

            eligible_count += 1
            strategy_analyzed_count += 1
            analysis = strategy_snapshot.get("analysis") or {}
            signal = strategy_snapshot.get("signal") or {}
            qualifying_cards = {
                bucket_key: [card for card in (analysis.get(bucket_key) or []) if int(card.get("fitScore") or 0) >= 50]
                for bucket_key in ("longTermStrategies", "stockPickers")
            }
            if not any(qualifying_cards.values()):
                continue

            pending_candidates.append(
                {
                    "symbol": symbol,
                    "stock": stock,
                    "signalLatest": latest,
                    "analysis": analysis,
                    "signal": signal,
                    "cards": qualifying_cards,
                    "screenerProfile": screener_profile,
                }
            )

        display_latest_rows = {}
        if pending_candidates:
            if price_sources["display"] == price_sources["signal"]:
                display_latest_rows = {
                    entry["symbol"]: entry["signalLatest"]
                    for entry in pending_candidates
                }
            else:
                display_latest_rows = self.repository.load_latest_rows_map(
                    [str(entry["symbol"]) for entry in pending_candidates],
                    price_source=price_sources["display"],
                )

        for entry in pending_candidates:
            display_latest = display_latest_rows.get(str(entry["symbol"])) or entry["signalLatest"]
            for bucket_key in ("longTermStrategies", "stockPickers"):
                cards = entry["cards"][bucket_key]
                for card in cards:
                    bucket = buckets[bucket_key].setdefault(
                        str(card.get("id") or f"{bucket_key}-{len(buckets[bucket_key])}"),
                        {
                            "id": str(card.get("id") or ""),
                            "name": str(card.get("name") or ""),
                            "category": str(card.get("category") or ""),
                            "horizon": str(card.get("horizon") or ""),
                            "summary": str(card.get("summary") or ""),
                            "topCandidates": [],
                        },
                    )
                    bucket["topCandidates"].append(
                        self._build_screener_candidate(
                            stock=entry["stock"],
                            latest_row=display_latest,
                            card=card,
                            analysis=entry["analysis"],
                            signal=entry["signal"],
                            screener_profile=entry["screenerProfile"],
                        )
                    )
                    qualified_entries += 1

        long_term_buckets = self._finalize_screener_buckets(list(buckets["longTermStrategies"].values()), safe_top)
        stock_picker_buckets = self._finalize_screener_buckets(list(buckets["stockPickers"].values()), safe_top)

        return {
            "updatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "screenedCount": screened_count,
            "eligibleCount": eligible_count,
            "filteredOutCount": filtered_out_count,
            "qualifiedCount": qualified_entries,
            "topPerStrategy": safe_top,
            "priceSources": self.repository.get_active_price_sources(),
            "filters": self._build_screener_filter_summary(
                screener_filters,
                applied_preset=applied_preset,
                screened_count=screened_count,
                cheap_pass_count=cheap_pass_count,
                eligible_count=eligible_count,
                filtered_out_count=filtered_out_count,
                strategy_analyzed_count=strategy_analyzed_count,
                filter_reason_counts=filter_reason_counts,
            ),
            "longTermStrategies": long_term_buckets,
            "stockPickers": stock_picker_buckets,
        }

    @staticmethod
    def _build_nav(rows: list[dict[str, Any]]) -> float:
        if not rows:
            return 0.0
        first_close = to_float(rows[0]["close"], 4)
        latest_close = to_float(rows[-1]["close"], 4)
        if first_close <= 0:
            return 0.0
        return round(latest_close / first_close, 4)

    @staticmethod
    def _build_screener_candidate(
        *,
        stock: dict[str, Any],
        latest_row: dict[str, Any],
        card: dict[str, Any],
        analysis: dict[str, Any],
        signal: dict[str, Any],
        screener_profile: dict[str, Any],
    ) -> dict[str, Any]:
        pct_chg = to_float(latest_row.get("pct_chg"), 4)
        if pct_chg == 0:
            pre_close = to_float(latest_row.get("pre_close"), 4)
            close = to_float(latest_row.get("close"), 4)
            if pre_close > 0:
                pct_chg = round((close - pre_close) / pre_close * 100, 2)

        metrics = list(card.get("metrics") or [])
        trend_bias = str(screener_profile.get("trendBias") or "")
        if trend_bias:
            metrics.append({"label": "Trend", "value": trend_bias.replace("_", " ").title(), "tone": "neutral"})
        price_vs_ma20_display = MarketSnapshotService._format_ratio_value(screener_profile.get("priceVsMa20Pct"))
        if price_vs_ma20_display:
            metrics.append({"label": "Vs MA20", "value": price_vs_ma20_display, "tone": "neutral"})
        price_vs_ma60_display = MarketSnapshotService._format_ratio_value(screener_profile.get("priceVsMa60Pct"))
        if price_vs_ma60_display:
            metrics.append({"label": "Vs MA60", "value": price_vs_ma60_display, "tone": "neutral"})
        valuation_band = str(screener_profile.get("valuationBand") or "")
        if valuation_band:
            metrics.append({"label": "Valuation", "value": valuation_band.replace("_", " ").title(), "tone": "neutral"})
        amount_display = MarketSnapshotService._format_amount_from_k(screener_profile.get("avgAmount20d"))
        if amount_display:
            metrics.append({"label": "20d avg amount", "value": amount_display, "tone": "neutral"})
        float_mv_display = MarketSnapshotService._format_market_cap_from_w(screener_profile.get("floatMarketCap"))
        if float_mv_display:
            metrics.append({"label": "Float mcap", "value": float_mv_display, "tone": "neutral"})
        turnover_display = MarketSnapshotService._format_ratio_value(screener_profile.get("turnoverRate"))
        if turnover_display:
            metrics.append({"label": "Turnover", "value": turnover_display, "tone": "neutral"})
        volume_ratio_display = MarketSnapshotService._format_number(screener_profile.get("volumeRatio"), 2)
        if volume_ratio_display:
            metrics.append({"label": "Volume ratio", "value": volume_ratio_display, "tone": "neutral"})
        net_money_flow_display = MarketSnapshotService._format_large_number(screener_profile.get("netMoneyFlow"))
        if net_money_flow_display:
            metrics.append({"label": "Net money flow", "value": net_money_flow_display, "tone": "neutral"})
        capital_flow_display = MarketSnapshotService._format_ratio_value(screener_profile.get("capitalFlowStrengthPct"))
        if capital_flow_display:
            metrics.append({"label": "Flow strength", "value": capital_flow_display, "tone": "neutral"})
        theme_heat_display = MarketSnapshotService._format_number(screener_profile.get("themeHeatScore"), 0)
        if theme_heat_display:
            metrics.append({"label": "Theme heat", "value": theme_heat_display, "tone": "neutral"})

        alignment_score = MarketSnapshotService._strategy_alignment_score(
            strategy_id=str(card.get("id") or ""),
            screener_profile=screener_profile,
            overall_score=to_float(analysis.get("score"), 2),
        )
        priority_score = MarketSnapshotService._strategy_priority_score(
            strategy_id=str(card.get("id") or ""),
            alignment_score=alignment_score,
            screener_profile=screener_profile,
        )

        return {
            "symbol": str(stock.get("symbol") or latest_row.get("ts_code") or ""),
            "strategyId": str(card.get("id") or ""),
            "name": str(stock.get("name") or latest_row.get("name") or ""),
            "securityType": str(stock.get("securityType") or latest_row.get("securityType") or "stock"),
            "exchange": stock.get("exchange") or latest_row.get("exchange"),
            "market": stock.get("market") or latest_row.get("market"),
            "industry": stock.get("industry") or latest_row.get("industry"),
            "area": stock.get("area") or latest_row.get("area"),
            "boardNames": stock.get("boardNames") or latest_row.get("boardNames"),
            "boardCount": to_int(stock.get("boardCount") or latest_row.get("boardCount")),
            "latestClose": to_float(latest_row.get("close"), 4),
            "dailyChangePct": pct_chg,
            "fitScore": int(card.get("fitScore") or 0),
            "signal": str(card.get("signal") or "WATCH"),
            "overallScore": to_float(analysis.get("score"), 2),
            "overallScoreNormalized": MarketSnapshotService._normalize_overall_score(to_float(analysis.get("score"), 2)),
            "stance": str(analysis.get("stance") or ""),
            "summary": str(signal.get("reason") or analysis.get("summary") or ""),
            "positionCapPct": to_int(analysis.get("positionCapPct")),
            "latestAmount": to_float(screener_profile.get("latestAmount"), 2),
            "avgAmount20d": to_float(screener_profile.get("avgAmount20d"), 2),
            "floatMarketCap": to_float(screener_profile.get("floatMarketCap"), 2),
            "totalMarketCap": to_float(screener_profile.get("totalMarketCap"), 2),
            "turnoverRate": to_float(screener_profile.get("turnoverRate"), 2),
            "volumeRatio": to_float(screener_profile.get("volumeRatio"), 2),
            "netMoneyFlow": to_float(screener_profile.get("netMoneyFlow"), 2),
            "capitalFlowStrengthPct": to_float(screener_profile.get("capitalFlowStrengthPct"), 2),
            "capitalFlowLabel": str(screener_profile.get("capitalFlowLabel") or ""),
            "marketStyle": str(screener_profile.get("marketStyle") or ""),
            "themeHeatScore": to_float(screener_profile.get("themeHeatScore"), 2),
            "themeHeatTier": str(screener_profile.get("themeHeatTier") or ""),
            "crowdingRisk": str(screener_profile.get("crowdingRisk") or ""),
            "trendBias": trend_bias,
            "priceVsMa20Pct": to_float(screener_profile.get("priceVsMa20Pct"), 2),
            "priceVsMa60Pct": to_float(screener_profile.get("priceVsMa60Pct"), 2),
            "priceVsMa120Pct": to_float(screener_profile.get("priceVsMa120Pct"), 2),
            "maStackScore": to_int(screener_profile.get("maStackScore")),
            "valuationBand": valuation_band,
            "strategyAlignmentScore": alignment_score,
            "priorityScore": priority_score,
            "liquidityScore": to_float(screener_profile.get("liquidityScore"), 2),
            "liquidityTier": str(screener_profile.get("liquidityTier") or ""),
            "metrics": metrics,
        }

    @staticmethod
    def _finalize_screener_buckets(buckets: list[dict[str, Any]], top: int) -> list[dict[str, Any]]:
        finalized: list[dict[str, Any]] = []
        for bucket in buckets:
            candidates = list(bucket.get("topCandidates") or [])
            candidates.sort(
                key=lambda item: (
                    -int(item.get("fitScore") or 0),
                    -float(item.get("priorityScore") or 0),
                    -float(item.get("strategyAlignmentScore") or 0),
                    -float(item.get("positionCapPct") or 0),
                    -float(item.get("overallScore") or 0),
                    -float(item.get("liquidityScore") or 0),
                    -float(item.get("dailyChangePct") or 0),
                    str(item.get("symbol") or ""),
                )
            )
            top_candidates = candidates[:top]
            for index, candidate in enumerate(top_candidates, start=1):
                candidate["rank"] = index

            finalized.append(
                {
                    **bucket,
                    "candidateCount": len(candidates),
                    "topCandidates": top_candidates,
                }
            )

        finalized.sort(
            key=lambda item: (
                -int(item.get("candidateCount") or 0),
                -int((item.get("topCandidates") or [{}])[0].get("fitScore") or 0),
                str(item.get("name") or ""),
            )
        )
        return finalized

    @staticmethod
    def _build_screener_filter_settings() -> dict[str, int | bool]:
        return {
            "amountLookbackDays": max(1, settings.screener_amount_lookback_days),
            "minAvgAmountK": max(0, settings.screener_min_avg_amount_k),
            "minLatestAmountK": max(0, settings.screener_min_latest_amount_k),
            "minFloatMarketCapW": max(0, settings.screener_min_float_market_cap_w),
            "minTotalMarketCapW": max(0, settings.screener_min_total_market_cap_w),
            "minListedDays": max(0, settings.screener_min_listed_days),
            "excludeSt": settings.screener_exclude_st,
            "excludeBse": settings.screener_exclude_bse,
            "excludeSuspended": settings.screener_exclude_suspended,
            "excludeNonListingStatus": settings.screener_exclude_non_listing_status,
        }

    @staticmethod
    def _normalize_screener_preset(preset: str | None) -> str | None:
        if not preset:
            return None
        normalized = str(preset).strip().lower()
        return normalized if normalized in SCREENER_FILTER_PRESETS else None

    @staticmethod
    def _resolve_screener_filter_settings(
        *,
        preset: str | None,
        overrides: dict[str, int | bool | None],
    ) -> dict[str, int | bool]:
        resolved = dict(MarketSnapshotService._build_screener_filter_settings())
        if preset:
            resolved.update(SCREENER_FILTER_PRESETS[preset])
        for key, value in overrides.items():
            if value is None:
                continue
            resolved[key] = value
        return resolved

    @staticmethod
    def _build_screener_profile(
        stock: dict[str, Any],
        rows: list[dict[str, Any]],
        database_bundle: dict[str, Any],
    ) -> dict[str, Any]:
        latest_row = rows[-1] if rows else {}
        lookback_days = max(1, settings.screener_amount_lookback_days)
        recent_rows = rows[-lookback_days:]
        amounts = [
            to_float(row.get("amount"), 2)
            for row in recent_rows
            if row.get("amount") not in (None, "")
        ]
        avg_amount = round(sum(amounts) / len(amounts), 2) if amounts else None
        return MarketSnapshotService._build_screener_profile_from_latest_row(
            stock,
            latest_row,
            database_bundle,
            avg_amount_override=avg_amount,
        )

    @staticmethod
    def _build_screener_profile_from_latest_row(
        stock: dict[str, Any],
        latest_row: dict[str, Any],
        database_bundle: dict[str, Any],
        *,
        avg_amount_override: float | None = None,
    ) -> dict[str, Any]:
        latest_trade_date = format_date(latest_row.get("trade_date")) if latest_row else None
        daily_basic_payload = MarketSnapshotService._parse_record_payload(
            ((database_bundle.get("rawDatasets") or {}).get("dailyBasic"))
        )
        moneyflow_payload = MarketSnapshotService._parse_record_payload(
            ((database_bundle.get("rawDatasets") or {}).get("moneyflow"))
        )
        suspend_payload = MarketSnapshotService._parse_record_payload(
            ((database_bundle.get("rawDatasets") or {}).get("suspendD"))
        )
        name = str(stock.get("name") or latest_row.get("name") or "").strip()
        exchange = str(stock.get("exchange") or latest_row.get("exchange") or "").strip().upper()
        market = str(stock.get("market") or latest_row.get("market") or "").strip().upper()
        list_status = str(stock.get("listStatus") or latest_row.get("listStatus") or "").strip().upper()
        list_date = str(stock.get("listDate") or latest_row.get("listDate") or "").strip()
        board_names = str(stock.get("boardNames") or latest_row.get("boardNames") or "").strip()
        board_count = to_int(stock.get("boardCount") or latest_row.get("boardCount"))
        listed_days = MarketSnapshotService._calculate_day_span(list_date, latest_trade_date)
        suspended = bool(MarketSnapshotService._pick_text(suspend_payload, "suspend_type", "suspend_reason", "suspend_timing"))
        float_market_cap = MarketSnapshotService._coalesce_numeric(
            MarketSnapshotService._pick(daily_basic_payload, "circ_mv"),
            latest_row.get("float_market_cap"),
        )
        total_market_cap = MarketSnapshotService._coalesce_numeric(
            MarketSnapshotService._pick(daily_basic_payload, "total_mv"),
            latest_row.get("total_market_cap"),
        )
        turnover_rate = MarketSnapshotService._coalesce_numeric(
            MarketSnapshotService._pick(daily_basic_payload, "turnover_rate", "turnover_rate_f"),
            latest_row.get("turnover_rate"),
        )
        volume_ratio = MarketSnapshotService._coalesce_numeric(
            MarketSnapshotService._pick(daily_basic_payload, "volume_ratio"),
            latest_row.get("volume_ratio"),
        )
        net_money_flow = MarketSnapshotService._to_numeric(MarketSnapshotService._pick(moneyflow_payload, "net_mf_amount"))
        latest_amount = to_float(latest_row.get("amount"), 2) if latest_row.get("amount") not in (None, "") else None
        avg_amount = avg_amount_override
        pe_ttm = MarketSnapshotService._coalesce_numeric(
            MarketSnapshotService._pick(daily_basic_payload, "pe_ttm", "pe"),
            latest_row.get("pe_ttm"),
        )
        pb = MarketSnapshotService._coalesce_numeric(MarketSnapshotService._pick(daily_basic_payload, "pb"), latest_row.get("pb"))
        trend_metrics = MarketSnapshotService._build_trend_metrics(latest_row)
        liquidity_score = MarketSnapshotService._calculate_liquidity_score(
            avg_amount=avg_amount,
            latest_amount=latest_amount,
            float_market_cap=float_market_cap,
            turnover_rate=turnover_rate,
            volume_ratio=volume_ratio,
        )
        capital_flow_strength_pct = MarketSnapshotService._calculate_capital_flow_strength_pct(
            net_money_flow=net_money_flow,
            latest_amount=latest_amount,
        )
        theme_heat_score = MarketSnapshotService._calculate_theme_heat_score(
            board_count=board_count,
            volume_ratio=volume_ratio,
            turnover_rate=turnover_rate,
            latest_amount=latest_amount,
        )

        return {
            "name": name,
            "exchange": exchange,
            "market": market,
            "listStatus": list_status,
            "listDate": list_date or None,
            "boardNames": board_names or None,
            "boardCount": board_count,
            "listedDays": listed_days,
            "isSt": 1 if MarketSnapshotService._is_st_name(name) else int(MarketSnapshotService._coalesce_numeric(latest_row.get("is_st")) or 0),
            "isBse": 1 if exchange == "BSE" else 0,
            "isSuspended": 1 if suspended else 0,
            "latestAmount": latest_amount,
            "avgAmount20d": avg_amount,
            "floatMarketCap": float_market_cap,
            "totalMarketCap": total_market_cap,
            "turnoverRate": turnover_rate,
            "volumeRatio": volume_ratio,
            "peTtm": pe_ttm,
            "pb": pb,
            "netMoneyFlow": net_money_flow,
            "capitalFlowStrengthPct": capital_flow_strength_pct,
            "capitalFlowLabel": MarketSnapshotService._capital_flow_label(capital_flow_strength_pct),
            "marketStyle": MarketSnapshotService._market_style(
                liquidity_score=liquidity_score,
                float_market_cap=float_market_cap,
                turnover_rate=turnover_rate,
                volume_ratio=volume_ratio,
                board_count=board_count,
                capital_flow_strength_pct=capital_flow_strength_pct,
            ),
            "themeHeatScore": theme_heat_score,
            "themeHeatTier": MarketSnapshotService._theme_heat_tier(theme_heat_score),
            "crowdingRisk": MarketSnapshotService._crowding_risk_label(
                theme_heat_score=theme_heat_score,
                turnover_rate=turnover_rate,
                volume_ratio=volume_ratio,
                capital_flow_strength_pct=capital_flow_strength_pct,
            ),
            "liquidityScore": liquidity_score,
            "liquidityTier": MarketSnapshotService._liquidity_tier(liquidity_score),
            "priceVsMa20Pct": trend_metrics["priceVsMa20Pct"],
            "priceVsMa60Pct": trend_metrics["priceVsMa60Pct"],
            "priceVsMa120Pct": trend_metrics["priceVsMa120Pct"],
            "maStackScore": trend_metrics["maStackScore"],
            "trendBias": trend_metrics["trendBias"],
            "valuationBand": MarketSnapshotService._valuation_band(pe_ttm=pe_ttm, pb=pb),
        }

    @staticmethod
    def _empty_screener_bundle() -> dict[str, Any]:
        return {
            "securityDetails": {},
            "financials": {},
            "rawDatasets": {
                "dailyBasic": None,
                "moneyflow": None,
                "suspendD": None,
            },
            "adjFactor": None,
        }

    @staticmethod
    def _is_suspended_bundle(database_bundle: dict[str, Any]) -> bool:
        suspend_payload = MarketSnapshotService._parse_record_payload(
            ((database_bundle.get("rawDatasets") or {}).get("suspendD"))
        )
        return bool(MarketSnapshotService._pick_text(suspend_payload, "suspend_type", "suspend_reason", "suspend_timing"))

    @staticmethod
    def _apply_screener_filters(
        screener_profile: dict[str, Any],
        screener_filters: dict[str, int | bool],
    ) -> dict[str, Any]:
        reason_codes: list[str] = []
        avg_amount = MarketSnapshotService._to_numeric(screener_profile.get("avgAmount20d"))
        latest_amount = MarketSnapshotService._to_numeric(screener_profile.get("latestAmount"))
        float_market_cap = MarketSnapshotService._to_numeric(screener_profile.get("floatMarketCap"))
        total_market_cap = MarketSnapshotService._to_numeric(screener_profile.get("totalMarketCap"))
        listed_days = MarketSnapshotService._to_numeric(screener_profile.get("listedDays"))
        is_st = bool(MarketSnapshotService._to_numeric(screener_profile.get("isSt")))
        is_bse = bool(MarketSnapshotService._to_numeric(screener_profile.get("isBse")))
        is_suspended = bool(MarketSnapshotService._to_numeric(screener_profile.get("isSuspended")))
        list_status = str(screener_profile.get("listStatus") or "").strip().upper()

        if screener_filters["minAvgAmountK"] > 0 and (avg_amount is None or avg_amount < screener_filters["minAvgAmountK"]):
            reason_codes.append("avg_amount")
        if screener_filters["minLatestAmountK"] > 0 and (
            latest_amount is None or latest_amount < screener_filters["minLatestAmountK"]
        ):
            reason_codes.append("latest_amount")
        if screener_filters["minFloatMarketCapW"] > 0 and (
            float_market_cap is None or float_market_cap < screener_filters["minFloatMarketCapW"]
        ):
            reason_codes.append("float_market_cap")
        if screener_filters["minTotalMarketCapW"] > 0 and (
            total_market_cap is None or total_market_cap < screener_filters["minTotalMarketCapW"]
        ):
            reason_codes.append("total_market_cap")
        if screener_filters["minListedDays"] > 0 and (listed_days is None or listed_days < screener_filters["minListedDays"]):
            reason_codes.append("listed_days")
        if screener_filters["excludeSt"] and is_st:
            reason_codes.append("st")
        if screener_filters["excludeBse"] and is_bse:
            reason_codes.append("bse")
        if screener_filters["excludeSuspended"] and is_suspended:
            reason_codes.append("suspended")
        if screener_filters["excludeNonListingStatus"] and list_status not in ("", "L"):
            reason_codes.append("list_status")

        return {
            "passed": not reason_codes,
            "reasonCodes": reason_codes,
        }

    @staticmethod
    def _build_screener_filter_summary(
        screener_filters: dict[str, int | bool],
        *,
        applied_preset: str | None,
        screened_count: int,
        cheap_pass_count: int,
        eligible_count: int,
        filtered_out_count: int,
        strategy_analyzed_count: int,
        filter_reason_counts: dict[str, int],
    ) -> dict[str, Any]:
        active_rules = []
        if screener_filters["minAvgAmountK"] > 0:
            active_rules.append(
                {
                    "key": "minAvgAmountK",
                    "label": "20-day average turnover",
                    "threshold": screener_filters["minAvgAmountK"],
                    "displayValue": MarketSnapshotService._format_amount_from_k(screener_filters["minAvgAmountK"]),
                }
            )
        if screener_filters["minLatestAmountK"] > 0:
            active_rules.append(
                {
                    "key": "minLatestAmountK",
                    "label": "Latest turnover",
                    "threshold": screener_filters["minLatestAmountK"],
                    "displayValue": MarketSnapshotService._format_amount_from_k(screener_filters["minLatestAmountK"]),
                }
            )
        if screener_filters["minFloatMarketCapW"] > 0:
            active_rules.append(
                {
                    "key": "minFloatMarketCapW",
                    "label": "Float market cap",
                    "threshold": screener_filters["minFloatMarketCapW"],
                    "displayValue": MarketSnapshotService._format_market_cap_from_w(screener_filters["minFloatMarketCapW"]),
                }
            )
        if screener_filters["minTotalMarketCapW"] > 0:
            active_rules.append(
                {
                    "key": "minTotalMarketCapW",
                    "label": "Total market cap",
                    "threshold": screener_filters["minTotalMarketCapW"],
                    "displayValue": MarketSnapshotService._format_market_cap_from_w(screener_filters["minTotalMarketCapW"]),
                }
            )
        if screener_filters["minListedDays"] > 0:
            active_rules.append(
                {
                    "key": "minListedDays",
                    "label": "Minimum listed days",
                    "threshold": screener_filters["minListedDays"],
                    "displayValue": f"{int(screener_filters['minListedDays'])} days",
                }
            )
        if screener_filters["excludeSt"]:
            active_rules.append({"key": "excludeSt", "label": "Exclude ST", "threshold": 1, "displayValue": "Enabled"})
        if screener_filters["excludeBse"]:
            active_rules.append({"key": "excludeBse", "label": "Exclude BSE", "threshold": 1, "displayValue": "Enabled"})
        if screener_filters["excludeSuspended"]:
            active_rules.append(
                {"key": "excludeSuspended", "label": "Exclude suspended", "threshold": 1, "displayValue": "Enabled"}
            )
        if screener_filters["excludeNonListingStatus"]:
            active_rules.append(
                {
                    "key": "excludeNonListingStatus",
                    "label": "Exclude non-L status",
                    "threshold": 1,
                    "displayValue": "Enabled",
                }
            )

        reason_breakdown = [
            {
                "key": reason_code,
                "label": SCREENER_FILTER_REASON_LABELS[reason_code],
                "count": count,
            }
            for reason_code, count in filter_reason_counts.items()
            if count > 0
        ]
        reason_breakdown.sort(key=lambda item: (-int(item["count"]), str(item["key"])))

        return {
            "active": bool(active_rules),
            "appliedPreset": applied_preset,
            "amountLookbackDays": screener_filters["amountLookbackDays"],
            "screenedCount": screened_count,
            "cheapPassCount": cheap_pass_count,
            "eligibleCount": eligible_count,
            "filteredOutCount": filtered_out_count,
            "strategyAnalyzedCount": strategy_analyzed_count,
            "activeRules": active_rules,
            "reasonBreakdown": reason_breakdown,
        }

    @staticmethod
    def _empty_snapshot(error: str, *, include_database: bool = True) -> dict[str, Any]:
        snapshot = {
            "updatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "symbol": "",
            "name": "",
            "profile": {
                "symbol": "",
                "name": "",
                "securityType": "unknown",
                "exchange": "",
                "market": "",
                "indexName": "",
                "industry": "",
                "area": "",
                "listStatus": "",
                "listDate": "",
                "boardNames": "",
                "boardCount": 0,
            },
            "lastClose": 0,
            "dailyChangePct": 0,
            "latestVolume": 0,
            "latestAmount": 0,
            "priceSources": {
                "display": settings.display_price_source,
                "signal": settings.signal_price_source,
            },
            "signal": {
                "market": "EMPTY",
                "action": "HOLD",
                "etf": None,
                "name": "",
                "positionPct": 0,
                "reason": "No strategy signal available.",
            },
            "analysis": strategy_engine._empty_analysis(),
            "candles": [],
            "summary": {"nav": 0, "positionPct": 0, "bars": 0},
            "error": error,
        }
        if include_database:
            snapshot["database"] = MarketSnapshotService._empty_database_summary()
        return snapshot

    @staticmethod
    def _empty_database_summary() -> dict[str, Any]:
        return {
            "sectionCount": 0,
            "dataPointCount": 0,
            "sections": [],
        }

    @staticmethod
    def _resolve_limit(limit: int | None) -> int:
        if limit is None or limit <= 0:
            return settings.candle_limit
        return min(limit, MAX_CANDLE_LIMIT)

    @staticmethod
    def _build_database_summary(
        database_bundle: dict[str, Any],
        latest_row: dict[str, Any],
        price_sources: dict[str, str],
    ) -> dict[str, Any]:
        sections: list[dict[str, Any]] = []
        security_type = str(latest_row.get("securityType") or "unknown")
        security_details = database_bundle.get("securityDetails") or {}
        financials = database_bundle.get("financials") or {}
        raw_datasets = database_bundle.get("rawDatasets") or {}
        adj_factor = database_bundle.get("adjFactor")

        corporate_items = MarketSnapshotService._build_corporate_items(security_type, security_details)
        if corporate_items:
            sections.append(
                {
                    "id": "corporate",
                    "title": "Database profile",
                    "source": "reference tables",
                    "subtitle": "Extended reference fields already synced into your stock database.",
                    "items": corporate_items,
                }
            )

        financial_quality_items = MarketSnapshotService._build_financial_quality_items(financials.get("finaIndicator"))
        if financial_quality_items:
            sections.append(
                {
                    "id": "quality",
                    "title": "Financial quality",
                    "source": "stock_fina_indicator",
                    "subtitle": "Latest profitability, leverage, and efficiency indicators from the financial indicator table.",
                    "updatedAt": MarketSnapshotService._record_updated_at(financials.get("finaIndicator")),
                    "items": financial_quality_items,
                }
            )

        statement_items = MarketSnapshotService._build_statement_items(
            financials.get("income"),
            financials.get("balanceSheet"),
            financials.get("cashflow"),
        )
        if statement_items:
            sections.append(
                {
                    "id": "statements",
                    "title": "Statement snapshot",
                    "source": "income / balancesheet / cashflow",
                    "subtitle": "Latest core statement values parsed from the raw financial records.",
                    "updatedAt": MarketSnapshotService._latest_update_time(
                        financials.get("income"),
                        financials.get("balanceSheet"),
                        financials.get("cashflow"),
                    ),
                    "items": statement_items,
                }
            )

        price_table_items = MarketSnapshotService._build_price_table_items(latest_row, price_sources)
        if price_table_items:
            sections.append(
                {
                    "id": "price-table",
                    "title": "Price table snapshot",
                    "source": "market price tables",
                    "subtitle": "Latest row-level metrics read directly from your configured display and signal price tables.",
                    "updatedAt": format_date(latest_row.get("trade_date")) if latest_row.get("trade_date") else None,
                    "items": price_table_items,
                }
            )

        market_dataset_items = MarketSnapshotService._build_market_dataset_items(
            raw_datasets.get("dailyBasic"),
            raw_datasets.get("moneyflow"),
            raw_datasets.get("stkLimit"),
            raw_datasets.get("suspendD"),
        )
        if market_dataset_items:
            sections.append(
                {
                    "id": "market-datasets",
                    "title": "Market datasets",
                    "source": "daily_basic / moneyflow / stk_limit / suspend_d",
                    "subtitle": "Extra market microstructure data already stored in the raw mirror tables.",
                    "updatedAt": MarketSnapshotService._latest_update_time(
                        raw_datasets.get("dailyBasic"),
                        raw_datasets.get("moneyflow"),
                        raw_datasets.get("stkLimit"),
                        raw_datasets.get("suspendD"),
                    ),
                    "items": market_dataset_items,
                }
            )

        capital_items = MarketSnapshotService._build_capital_items(
            adj_factor,
            raw_datasets.get("holderNumber"),
            raw_datasets.get("pledgeStat"),
        )
        if capital_items:
            sections.append(
                {
                    "id": "capital",
                    "title": "Capital and ownership",
                    "source": "adj_factor / holder / pledge",
                    "subtitle": "Capital structure and ownership hints from the databases you already sync.",
                    "updatedAt": MarketSnapshotService._latest_update_time(
                        raw_datasets.get("holderNumber"),
                        raw_datasets.get("pledgeStat"),
                    ),
                    "items": capital_items,
                }
            )

        fund_items = MarketSnapshotService._build_fund_items(
            raw_datasets.get("fundNav"),
            raw_datasets.get("fundShare"),
        )
        if fund_items:
            sections.append(
                {
                    "id": "fund",
                    "title": "Fund extension data",
                    "source": "fund_nav / fund_share",
                    "subtitle": "Fund net asset and share data from the raw mirror store.",
                    "updatedAt": MarketSnapshotService._latest_update_time(
                        raw_datasets.get("fundNav"),
                        raw_datasets.get("fundShare"),
                    ),
                    "items": fund_items,
                }
            )

        return {
            "sectionCount": len(sections),
            "dataPointCount": sum(len(section.get("items", [])) for section in sections),
            "sections": sections,
        }

    @staticmethod
    def _build_corporate_items(security_type: str, details: dict[str, Any]) -> list[dict[str, str]]:
        if security_type == "stock":
            return MarketSnapshotService._compact_items(
                ("Full name", details.get("stockFullName")),
                ("English name", details.get("stockEnglishName")),
                ("Currency", details.get("stockCurrency")),
                ("Actual controller", details.get("stockActualController")),
                ("Entity type", details.get("stockEntityType")),
            )

        if security_type == "fund":
            return MarketSnapshotService._compact_items(
                ("Fund type", details.get("fundType")),
                ("Invest type", details.get("fundInvestType")),
                ("Style", details.get("fundStyleType")),
                ("Benchmark", details.get("fundBenchmark")),
                ("Manager", details.get("fundManagement")),
                ("Custodian", details.get("fundCustodian")),
                ("Trustee", details.get("fundTrustee")),
                ("Issue date", details.get("fundIssueDate")),
                ("Issue amount", MarketSnapshotService._format_large_number(details.get("fundIssueAmount"))),
                ("Mgmt fee", MarketSnapshotService._format_ratio_value(details.get("fundManagementFee"))),
                ("Custody fee", MarketSnapshotService._format_ratio_value(details.get("fundCustodyFee"))),
                ("Min amount", MarketSnapshotService._format_large_number(details.get("fundMinAmount"))),
            )

        if security_type == "index":
            return MarketSnapshotService._compact_items(
                ("Publisher", details.get("indexPublisher")),
                ("Index type", details.get("indexType")),
                ("Category", details.get("indexCategory")),
                ("Base date", details.get("indexBaseDate")),
                ("Base point", MarketSnapshotService._format_number(details.get("indexBasePoint"), 2)),
                ("Weight rule", details.get("indexWeightRule")),
                ("Expiry", details.get("indexExpireDate")),
            )

        return []

    @staticmethod
    def _build_financial_quality_items(record: dict[str, Any] | None) -> list[dict[str, str]]:
        payload = MarketSnapshotService._parse_record_payload(record)
        if not payload:
            return []
        return MarketSnapshotService._compact_items(
            ("Report end", record.get("end_date")),
            ("ROE", MarketSnapshotService._format_ratio_value(MarketSnapshotService._pick(payload, "roe", "roe_yearly"))),
            ("ROA", MarketSnapshotService._format_ratio_value(MarketSnapshotService._pick(payload, "roa", "roa_yearly"))),
            ("Gross margin", MarketSnapshotService._format_ratio_value(MarketSnapshotService._pick(payload, "grossprofit_margin"))),
            ("Net profit YoY", MarketSnapshotService._format_ratio_value(MarketSnapshotService._pick(payload, "netprofit_yoy", "dt_netprofit_yoy"))),
            ("Revenue YoY", MarketSnapshotService._format_ratio_value(MarketSnapshotService._pick(payload, "or_yoy", "tr_yoy"))),
            ("Debt/assets", MarketSnapshotService._format_ratio_value(MarketSnapshotService._pick(payload, "debt_to_assets"))),
            ("Asset turnover", MarketSnapshotService._format_number(MarketSnapshotService._pick(payload, "assets_turn"), 2)),
            ("Current ratio", MarketSnapshotService._format_number(MarketSnapshotService._pick(payload, "current_ratio"), 2)),
            ("Quick ratio", MarketSnapshotService._format_number(MarketSnapshotService._pick(payload, "quick_ratio"), 2)),
            ("OCF/share", MarketSnapshotService._format_number(MarketSnapshotService._pick(payload, "ocfps"), 2)),
        )

    @staticmethod
    def _build_statement_items(
        income_record: dict[str, Any] | None,
        balance_record: dict[str, Any] | None,
        cashflow_record: dict[str, Any] | None,
    ) -> list[dict[str, str]]:
        income_payload = MarketSnapshotService._parse_record_payload(income_record)
        balance_payload = MarketSnapshotService._parse_record_payload(balance_record)
        cashflow_payload = MarketSnapshotService._parse_record_payload(cashflow_record)

        return MarketSnapshotService._compact_items(
            ("Reporting period", (income_record or {}).get("end_date") or (balance_record or {}).get("end_date")),
            ("Revenue", MarketSnapshotService._format_large_number(MarketSnapshotService._pick(income_payload, "total_revenue", "revenue"))),
            ("Operating profit", MarketSnapshotService._format_large_number(MarketSnapshotService._pick(income_payload, "operate_profit"))),
            ("Net income", MarketSnapshotService._format_large_number(MarketSnapshotService._pick(income_payload, "n_income_attr_p", "n_income"))),
            ("Total assets", MarketSnapshotService._format_large_number(MarketSnapshotService._pick(balance_payload, "total_assets"))),
            ("Total liabilities", MarketSnapshotService._format_large_number(MarketSnapshotService._pick(balance_payload, "total_liab"))),
            ("Cash on hand", MarketSnapshotService._format_large_number(MarketSnapshotService._pick(balance_payload, "money_cap"))),
            ("Operating cash flow", MarketSnapshotService._format_large_number(MarketSnapshotService._pick(cashflow_payload, "n_cashflow_act"))),
            ("Investing cash flow", MarketSnapshotService._format_large_number(MarketSnapshotService._pick(cashflow_payload, "n_cashflow_inv_act"))),
            ("Financing cash flow", MarketSnapshotService._format_large_number(MarketSnapshotService._pick(cashflow_payload, "n_cash_flows_fnc_act"))),
        )

    @staticmethod
    def _build_market_dataset_items(
        daily_basic_record: dict[str, Any] | None,
        moneyflow_record: dict[str, Any] | None,
        limit_record: dict[str, Any] | None,
        suspend_record: dict[str, Any] | None,
    ) -> list[dict[str, str]]:
        daily_payload = MarketSnapshotService._parse_record_payload(daily_basic_record)
        moneyflow_payload = MarketSnapshotService._parse_record_payload(moneyflow_record)
        limit_payload = MarketSnapshotService._parse_record_payload(limit_record)
        suspend_payload = MarketSnapshotService._parse_record_payload(suspend_record)

        return MarketSnapshotService._compact_items(
            ("Daily basic date", (daily_basic_record or {}).get("trade_date")),
            ("PE TTM", MarketSnapshotService._format_number(MarketSnapshotService._pick(daily_payload, "pe_ttm", "pe"), 2)),
            ("PB", MarketSnapshotService._format_number(MarketSnapshotService._pick(daily_payload, "pb"), 2)),
            ("PS TTM", MarketSnapshotService._format_number(MarketSnapshotService._pick(daily_payload, "ps_ttm", "ps"), 2)),
            ("Turnover", MarketSnapshotService._format_ratio_value(MarketSnapshotService._pick(daily_payload, "turnover_rate", "turnover_rate_f"))),
            ("Volume ratio", MarketSnapshotService._format_number(MarketSnapshotService._pick(daily_payload, "volume_ratio"), 2)),
            ("Total market cap", MarketSnapshotService._format_market_value(MarketSnapshotService._pick(daily_payload, "total_mv"))),
            ("Float market cap", MarketSnapshotService._format_market_value(MarketSnapshotService._pick(daily_payload, "circ_mv"))),
            ("Net money flow", MarketSnapshotService._format_large_number(MarketSnapshotService._pick(moneyflow_payload, "net_mf_amount"))),
            ("Upper limit", MarketSnapshotService._format_number(MarketSnapshotService._pick(limit_payload, "up_limit"), 3)),
            ("Lower limit", MarketSnapshotService._format_number(MarketSnapshotService._pick(limit_payload, "down_limit"), 3)),
            ("Suspension", MarketSnapshotService._pick_text(suspend_payload, "suspend_type", "suspend_reason", "suspend_timing")),
        )

    @staticmethod
    def _build_price_table_items(latest_row: dict[str, Any], price_sources: dict[str, str]) -> list[dict[str, str]]:
        trend_metrics = MarketSnapshotService._build_trend_metrics(latest_row)
        return MarketSnapshotService._compact_items(
            ("Trade date", format_date(latest_row.get("trade_date")) if latest_row.get("trade_date") else None),
            ("Display source", MarketSnapshotService._price_source_label(price_sources.get("display"))),
            ("Signal source", MarketSnapshotService._price_source_label(price_sources.get("signal"))),
            ("Adjustment", MarketSnapshotService._pick_text(latest_row, "adjustment_type")),
            ("Turnover", MarketSnapshotService._format_ratio_value(latest_row.get("turnover_rate"))),
            ("Volume ratio", MarketSnapshotService._format_number(latest_row.get("volume_ratio"), 2)),
            ("PE TTM", MarketSnapshotService._format_number(latest_row.get("pe_ttm"), 2)),
            ("PB", MarketSnapshotService._format_number(latest_row.get("pb"), 2)),
            ("PS TTM", MarketSnapshotService._format_number(latest_row.get("ps_ttm"), 2)),
            ("Float market cap", MarketSnapshotService._format_market_cap_from_w(latest_row.get("float_market_cap"))),
            ("Total market cap", MarketSnapshotService._format_market_cap_from_w(latest_row.get("total_market_cap"))),
            ("MA20 gap", MarketSnapshotService._format_ratio_value(trend_metrics["priceVsMa20Pct"])),
            ("MA60 gap", MarketSnapshotService._format_ratio_value(trend_metrics["priceVsMa60Pct"])),
            ("MA120 gap", MarketSnapshotService._format_ratio_value(trend_metrics["priceVsMa120Pct"])),
            ("Trend bias", trend_metrics["trendBias"]),
            ("MA stack score", str(trend_metrics["maStackScore"]) if trend_metrics["maStackScore"] is not None else None),
        )

    @staticmethod
    def _build_capital_items(
        adj_factor: dict[str, Any] | None,
        holder_record: dict[str, Any] | None,
        pledge_record: dict[str, Any] | None,
    ) -> list[dict[str, str]]:
        holder_payload = MarketSnapshotService._parse_record_payload(holder_record)
        pledge_payload = MarketSnapshotService._parse_record_payload(pledge_record)

        return MarketSnapshotService._compact_items(
            ("Latest adj factor", MarketSnapshotService._format_number((adj_factor or {}).get("latestFactor"), 4)),
            ("Factor date", (adj_factor or {}).get("latestTradeDate")),
            ("Factor span change", MarketSnapshotService._format_ratio_value((adj_factor or {}).get("factorChangePct"), digits=2)),
            ("Adj factor rows", str((adj_factor or {}).get("recordCount") or "")),
            ("Holder count", MarketSnapshotService._format_integer(MarketSnapshotService._pick(holder_payload, "holder_num"))),
            ("Holder date", (holder_record or {}).get("end_date") or (holder_record or {}).get("ann_date")),
            ("Pledge ratio", MarketSnapshotService._format_ratio_value(MarketSnapshotService._pick(pledge_payload, "pledge_ratio"))),
            ("Pledged shares", MarketSnapshotService._format_large_number(MarketSnapshotService._pick(pledge_payload, "pledge_count"))),
        )

    @staticmethod
    def _build_fund_items(
        nav_record: dict[str, Any] | None,
        share_record: dict[str, Any] | None,
    ) -> list[dict[str, str]]:
        nav_payload = MarketSnapshotService._parse_record_payload(nav_record)
        share_payload = MarketSnapshotService._parse_record_payload(share_record)

        return MarketSnapshotService._compact_items(
            ("NAV date", (nav_record or {}).get("end_date") or (nav_record or {}).get("ann_date")),
            ("Unit NAV", MarketSnapshotService._format_number(MarketSnapshotService._pick(nav_payload, "unit_nav"), 4)),
            ("Accum NAV", MarketSnapshotService._format_number(MarketSnapshotService._pick(nav_payload, "accum_nav"), 4)),
            ("Adjusted NAV", MarketSnapshotService._format_number(MarketSnapshotService._pick(nav_payload, "adj_nav"), 4)),
            ("Net asset", MarketSnapshotService._format_large_number(MarketSnapshotService._pick(nav_payload, "net_asset", "total_netasset"))),
            ("Fund shares", MarketSnapshotService._format_large_number(MarketSnapshotService._pick(share_payload, "fd_share"))),
            ("Share date", (share_record or {}).get("trade_date") or (share_record or {}).get("end_date")),
        )

    @staticmethod
    def _parse_record_payload(record: dict[str, Any] | None) -> dict[str, Any]:
        if not record:
            return {}
        raw_json = record.get("raw_json")
        if not raw_json:
            return {}
        try:
            parsed = json.loads(str(raw_json))
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}

    @staticmethod
    def _pick(payload: dict[str, Any], *keys: str) -> Any:
        for key in keys:
            value = payload.get(key)
            if value in (None, "", "NaN", "nan", "None", "null"):
                continue
            return value
        return None

    @staticmethod
    def _pick_text(payload: dict[str, Any], *keys: str) -> str | None:
        value = MarketSnapshotService._pick(payload, *keys)
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @staticmethod
    def _compact_items(*pairs: tuple[str, Any]) -> list[dict[str, str]]:
        items: list[dict[str, str]] = []
        for label, value in pairs:
            if value is None:
                continue
            text = str(value).strip()
            if not text:
                continue
            items.append({"label": label, "value": text})
        return items

    @staticmethod
    def _record_updated_at(record: dict[str, Any] | None) -> str | None:
        if not record:
            return None
        return record.get("update_time") or record.get("trade_date") or record.get("end_date") or record.get("ann_date")

    @staticmethod
    def _latest_update_time(*records: dict[str, Any] | None) -> str | None:
        values = [MarketSnapshotService._record_updated_at(record) for record in records]
        values = [value for value in values if value]
        return max(values) if values else None

    @staticmethod
    def _format_number(value: Any, digits: int = 2) -> str | None:
        if value in (None, ""):
            return None
        try:
            return f"{float(value):,.{digits}f}"
        except (TypeError, ValueError):
            return str(value)

    @staticmethod
    def _format_integer(value: Any) -> str | None:
        if value in (None, ""):
            return None
        try:
            return f"{int(float(value)):,}"
        except (TypeError, ValueError):
            return str(value)

    @staticmethod
    def _format_ratio_value(value: Any, digits: int = 2) -> str | None:
        if value in (None, ""):
            return None
        try:
            return f"{float(value):+.{digits}f}%"
        except (TypeError, ValueError):
            return str(value)

    @staticmethod
    def _format_large_number(value: Any) -> str | None:
        if value in (None, ""):
            return None
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return str(value)

        absolute = abs(numeric)
        if absolute >= 1_0000_0000:
            return f"{numeric / 1_0000_0000:.2f}B"
        if absolute >= 1_0000:
            return f"{numeric / 1_0000:.2f}W"
        return f"{numeric:,.2f}"

    @staticmethod
    def _format_market_value(value: Any) -> str | None:
        if value in (None, ""):
            return None
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return str(value)
        return f"{numeric / 10000:.2f}B" if abs(numeric) >= 10000 else f"{numeric:,.2f}M"

    @staticmethod
    def _format_amount_from_k(value: Any) -> str | None:
        if value in (None, ""):
            return None
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return str(value)
        amount_yuan = numeric * 1000
        if abs(amount_yuan) >= 1_0000_0000:
            return f"{amount_yuan / 1_0000_0000:.2f}B"
        if abs(amount_yuan) >= 1_0000:
            return f"{amount_yuan / 1_0000:.2f}W"
        return f"{amount_yuan:,.2f}"

    @staticmethod
    def _format_market_cap_from_w(value: Any) -> str | None:
        if value in (None, ""):
            return None
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return str(value)
        market_cap_yuan = numeric * 10000
        if abs(market_cap_yuan) >= 1_0000_0000:
            return f"{market_cap_yuan / 1_0000_0000:.2f}B"
        if abs(market_cap_yuan) >= 1_0000:
            return f"{market_cap_yuan / 1_0000:.2f}W"
        return f"{market_cap_yuan:,.2f}"

    @staticmethod
    def _calculate_liquidity_score(
        *,
        avg_amount: float | None,
        latest_amount: float | None,
        float_market_cap: float | None,
        turnover_rate: float | None,
        volume_ratio: float | None,
    ) -> float:
        avg_component = min(max((avg_amount or 0.0) / 600000, 0.0), 1.0) * 35
        latest_component = min(max((latest_amount or 0.0) / 300000, 0.0), 1.0) * 25
        market_cap_component = min(max((float_market_cap or 0.0) / 1000000, 0.0), 1.0) * 20
        turnover_component = min(max((turnover_rate or 0.0) / 3.0, 0.0), 1.0) * 10
        volume_component = min(max((volume_ratio or 0.0) / 1.5, 0.0), 1.0) * 10
        return round(avg_component + latest_component + market_cap_component + turnover_component + volume_component, 2)

    @staticmethod
    def _calculate_capital_flow_strength_pct(
        *,
        net_money_flow: float | None,
        latest_amount: float | None,
    ) -> float | None:
        if net_money_flow is None or latest_amount is None or latest_amount <= 0:
            return None
        # moneyflow uses W yuan while kline amount uses K yuan.
        strength_pct = net_money_flow * 10 / latest_amount * 100
        return round(max(-100.0, min(100.0, strength_pct)), 2)

    @staticmethod
    def _capital_flow_label(strength_pct: float | None) -> str:
        if strength_pct is None:
            return "UNKNOWN"
        if strength_pct >= 12:
            return "STRONG_INFLOW"
        if strength_pct >= 4:
            return "INFLOW"
        if strength_pct <= -12:
            return "STRONG_OUTFLOW"
        if strength_pct <= -4:
            return "OUTFLOW"
        return "NEUTRAL"

    @staticmethod
    def _calculate_theme_heat_score(
        *,
        board_count: int | None,
        volume_ratio: float | None,
        turnover_rate: float | None,
        latest_amount: float | None,
    ) -> float:
        board_component = min(max((board_count or 0) / 6.0, 0.0), 1.0) * 45
        volume_component = min(max((volume_ratio or 0.0) / 2.0, 0.0), 1.0) * 25
        turnover_component = min(max((turnover_rate or 0.0) / 6.0, 0.0), 1.0) * 20
        amount_component = min(max((latest_amount or 0.0) / 300000.0, 0.0), 1.0) * 10
        return round(board_component + volume_component + turnover_component + amount_component, 2)

    @staticmethod
    def _theme_heat_tier(score: float | None) -> str:
        if score is None:
            return "COOL"
        if score >= 75:
            return "HOT"
        if score >= 50:
            return "WARM"
        return "COOL"

    @staticmethod
    def _crowding_risk_label(
        *,
        theme_heat_score: float | None,
        turnover_rate: float | None,
        volume_ratio: float | None,
        capital_flow_strength_pct: float | None,
    ) -> str:
        if (
            (theme_heat_score or 0.0) >= 80
            and (turnover_rate or 0.0) >= 5.0
            and (volume_ratio or 0.0) >= 1.8
            and (capital_flow_strength_pct or 0.0) >= 8.0
        ):
            return "OVERCROWDED"
        if (
            (theme_heat_score or 0.0) >= 60
            and ((turnover_rate or 0.0) >= 3.0 or (volume_ratio or 0.0) >= 1.4)
        ):
            return "ACTIVE"
        return "CALM"

    @staticmethod
    def _market_style(
        *,
        liquidity_score: float | None,
        float_market_cap: float | None,
        turnover_rate: float | None,
        volume_ratio: float | None,
        board_count: int | None,
        capital_flow_strength_pct: float | None,
    ) -> str:
        if (liquidity_score or 0.0) >= 80 and (float_market_cap or 0.0) >= 1500000:
            return "CAPACITY_CORE"
        if (board_count or 0) >= 3 and (volume_ratio or 0.0) >= 1.2 and (turnover_rate or 0.0) >= 1.5:
            return "THEME_MOMENTUM"
        if (turnover_rate or 0.0) >= 4.0 or (volume_ratio or 0.0) >= 2.0:
            return "ACTIVE_TRADER"
        if (liquidity_score or 0.0) >= 60 and (capital_flow_strength_pct or 0.0) >= 4.0:
            return "STEADY_ACCUMULATION"
        return "STANDARD"

    @staticmethod
    def _strategy_alignment_score(
        *,
        strategy_id: str,
        screener_profile: dict[str, Any],
        overall_score: float,
    ) -> float:
        liquidity_score = float(screener_profile.get("liquidityScore") or 0.0)
        capital_flow_strength_pct = float(screener_profile.get("capitalFlowStrengthPct") or 0.0)
        theme_heat_score = float(screener_profile.get("themeHeatScore") or 0.0)
        turnover_rate = float(screener_profile.get("turnoverRate") or 0.0)
        volume_ratio = float(screener_profile.get("volumeRatio") or 0.0)
        board_count = int(screener_profile.get("boardCount") or 0)
        float_market_cap = float(screener_profile.get("floatMarketCap") or 0.0)
        market_style = str(screener_profile.get("marketStyle") or "")
        crowding_risk = str(screener_profile.get("crowdingRisk") or "CALM")

        liquidity_component = min(max(liquidity_score / 100.0, 0.0), 1.0) * 25
        flow_component = min(max((capital_flow_strength_pct + 20.0) / 40.0, 0.0), 1.0) * 20
        theme_component = min(max(theme_heat_score / 100.0, 0.0), 1.0) * 15
        model_component = min(max(MarketSnapshotService._normalize_overall_score(overall_score) / 100.0, 0.0), 1.0) * 10
        score = liquidity_component + flow_component + theme_component + model_component

        if strategy_id in ("secular-trend", "quality-compounder"):
            if market_style in ("CAPACITY_CORE", "STEADY_ACCUMULATION"):
                score += 18
            if float_market_cap >= 1500000:
                score += 8
            if crowding_risk == "OVERCROWDED":
                score -= 12
            if turnover_rate <= 3.5:
                score += 6
        elif strategy_id == "value-rerating":
            if capital_flow_strength_pct >= 2:
                score += 12
            if theme_heat_score <= 65:
                score += 10
            if crowding_risk == "OVERCROWDED":
                score -= 10
        elif strategy_id == "low-vol-holder":
            if market_style == "CAPACITY_CORE":
                score += 16
            if turnover_rate <= 2.5:
                score += 10
            if volume_ratio <= 1.4:
                score += 8
            if crowding_risk != "CALM":
                score -= 12
        elif strategy_id == "trend-leader":
            if market_style in ("THEME_MOMENTUM", "ACTIVE_TRADER"):
                score += 20
            if capital_flow_strength_pct >= 6:
                score += 10
            if theme_heat_score >= 60:
                score += 8
        elif strategy_id == "quality-growth":
            if market_style in ("CAPACITY_CORE", "STEADY_ACCUMULATION"):
                score += 16
            if capital_flow_strength_pct >= 3:
                score += 10
            if theme_heat_score >= 45:
                score += 6
        elif strategy_id == "value-recovery":
            if capital_flow_strength_pct >= 0:
                score += 10
            if 35 <= theme_heat_score <= 70:
                score += 12
            if board_count <= 4:
                score += 6
        elif strategy_id == "capital-flow-breakout":
            if capital_flow_strength_pct >= 8:
                score += 22
            if volume_ratio >= 1.6:
                score += 12
            if market_style in ("THEME_MOMENTUM", "ACTIVE_TRADER"):
                score += 10
            if crowding_risk == "OVERCROWDED":
                score -= 4

        return round(max(0.0, min(100.0, score)), 2)

    @staticmethod
    def _strategy_priority_score(
        *,
        strategy_id: str,
        alignment_score: float,
        screener_profile: dict[str, Any],
    ) -> float:
        crowding_risk = str(screener_profile.get("crowdingRisk") or "CALM")
        capital_flow_strength_pct = float(screener_profile.get("capitalFlowStrengthPct") or 0.0)
        theme_heat_score = float(screener_profile.get("themeHeatScore") or 0.0)
        market_style = str(screener_profile.get("marketStyle") or "")
        liquidity_score = float(screener_profile.get("liquidityScore") or 0.0)

        score = alignment_score

        if strategy_id in ("secular-trend", "quality-compounder", "low-vol-holder", "value-rerating", "value-recovery"):
            if crowding_risk == "OVERCROWDED":
                score -= 18
            elif crowding_risk == "ACTIVE":
                score -= 8
            if theme_heat_score >= 80:
                score -= 6
        elif strategy_id in ("trend-leader", "capital-flow-breakout"):
            if crowding_risk == "OVERCROWDED":
                score -= 6
            elif crowding_risk == "ACTIVE":
                score += 4
            if capital_flow_strength_pct >= 8:
                score += 6
        elif strategy_id == "quality-growth":
            if market_style in ("CAPACITY_CORE", "STEADY_ACCUMULATION"):
                score += 4
            if crowding_risk == "OVERCROWDED":
                score -= 10

        if liquidity_score >= 75:
            score += 3

        return round(max(0.0, min(100.0, score)), 2)

    @staticmethod
    def _liquidity_tier(score: float | None) -> str:
        if score is None:
            return "E"
        if score >= 85:
            return "A"
        if score >= 70:
            return "B"
        if score >= 55:
            return "C"
        if score >= 40:
            return "D"
        return "E"

    @staticmethod
    def _normalize_overall_score(score: float | None) -> float:
        if score is None:
            return 0.0
        normalized = (float(score) + 4.0) / 10.0 * 100.0
        return round(max(0.0, min(100.0, normalized)), 2)

    @staticmethod
    def _calculate_day_span(start_date: str | None, end_date: str | None) -> int | None:
        if not start_date or not end_date:
            return None
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d")
            end = datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            return None
        return max(0, (end - start).days)

    @staticmethod
    def _is_st_name(name: str | None) -> bool:
        if not name:
            return False
        normalized = str(name).strip().upper().replace("*", "")
        return normalized.startswith("ST") or " ST" in normalized

    @staticmethod
    def _to_numeric(value: Any) -> float | None:
        if value in (None, "", "NaN", "nan", "None", "null"):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _coalesce_numeric(*values: Any) -> float | None:
        for value in values:
            numeric = MarketSnapshotService._to_numeric(value)
            if numeric is not None:
                return numeric
        return None

    @staticmethod
    def _build_trend_metrics(latest_row: dict[str, Any]) -> dict[str, float | int | str | None]:
        close = MarketSnapshotService._to_numeric(latest_row.get("close"))
        ma5 = MarketSnapshotService._to_numeric(latest_row.get("ma5"))
        ma10 = MarketSnapshotService._to_numeric(latest_row.get("ma10"))
        ma20 = MarketSnapshotService._to_numeric(latest_row.get("ma20"))
        ma60 = MarketSnapshotService._to_numeric(latest_row.get("ma60"))
        ma120 = MarketSnapshotService._to_numeric(latest_row.get("ma120"))
        ma250 = MarketSnapshotService._to_numeric(latest_row.get("ma250"))

        def ratio_vs(base: float | None) -> float | None:
            if close is None or base is None or base <= 0:
                return None
            return round((close / base - 1) * 100, 2)

        comparisons = (
            (ma5, ma10),
            (ma10, ma20),
            (ma20, ma60),
            (ma60, ma120),
            (ma120, ma250),
        )
        stack_score = sum(1 for left, right in comparisons if left is not None and right is not None and left >= right)
        price_vs_ma20 = ratio_vs(ma20)
        price_vs_ma60 = ratio_vs(ma60)
        price_vs_ma120 = ratio_vs(ma120)

        trend_bias = "NEUTRAL"
        if stack_score >= 4 and (price_vs_ma20 or 0) >= 0 and (price_vs_ma60 or 0) >= 0:
            trend_bias = "BULLISH"
        elif stack_score <= 1 and ((price_vs_ma20 or 0) < 0 or (price_vs_ma60 or 0) < 0):
            trend_bias = "WEAK"
        elif stack_score >= 3 and (price_vs_ma20 or 0) >= -2:
            trend_bias = "STABLE"

        return {
            "priceVsMa20Pct": price_vs_ma20,
            "priceVsMa60Pct": price_vs_ma60,
            "priceVsMa120Pct": price_vs_ma120,
            "maStackScore": stack_score,
            "trendBias": trend_bias,
        }

    @staticmethod
    def _valuation_band(*, pe_ttm: float | None, pb: float | None) -> str | None:
        if pe_ttm is None and pb is None:
            return None
        if (pe_ttm is None or pe_ttm <= 18) and (pb is None or pb <= 2.2):
            return "VALUE"
        if (pe_ttm is None or pe_ttm <= 35) and (pb is None or pb <= 4.5):
            return "BALANCED"
        return "PREMIUM"

    @staticmethod
    def _price_source_label(price_source: str | None) -> str | None:
        if not price_source:
            return None
        mapping = {
            "forward": "Forward adjusted",
            "unadjusted": "Unadjusted",
            "kline": "Legacy raw",
        }
        return mapping.get(price_source, price_source)


snapshot_service = MarketSnapshotService(market_repository, strategy_engine)
