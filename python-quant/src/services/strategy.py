from __future__ import annotations

import hashlib
import json
import math
import time
from typing import Any

from src.config import settings
from src.utils.formatting import format_date, to_float


FORECAST_HORIZONS = (5, 20, 60)
MIN_FORECAST_BARS = 260
SIMILARITY_LOOKBACK_BARS = 1250
SIMILARITY_SAMPLE_SIZE = 16
BACKTEST_WARMUP_BARS = 120
FULL_POSITION_THRESHOLD = 2.8
HALF_POSITION_THRESHOLD = 1.3
PROBE_POSITION_THRESHOLD = 0.0
BACKTEST_COMMISSION_RATE = 0.0003
BACKTEST_SLIPPAGE_RATE = 0.001
BACKTEST_SELL_TAX_RATE = 0.0005


class StrategyEngine:
    def __init__(self) -> None:
        self.analysis_cache: dict[tuple[str, str, str, str, bool, str | None], tuple[float, dict[str, Any]]] = {}

    def analyze_market(
        self,
        rows: list[dict[str, Any]],
        symbol: str,
        name: str,
        *,
        database_bundle: dict[str, Any] | None = None,
        automation_enabled: bool = True,
        manual_override: str | None = None,
    ) -> dict[str, Any]:
        cache_key = self._analysis_cache_key(
            rows,
            symbol,
            name,
            database_bundle=database_bundle,
            automation_enabled=automation_enabled,
            manual_override=manual_override,
        )
        cached = self.analysis_cache.get(cache_key)
        if cached and cached[0] > time.monotonic():
            return cached[1]

        closes = [to_float(row.get("close"), 4) for row in rows if row.get("close") is not None]
        if not closes:
            result = {
                "signal": self._signal("EMPTY", "HOLD", symbol, name, 0, "No strategy signal available."),
                "analysis": self._empty_analysis(),
            }
            self._write_analysis_cache(cache_key, result)
            return result

        latest_row = rows[-1] if rows else {}
        trend_snapshot = self._build_trend_snapshot(closes, len(closes) - 1)
        forecast = self._build_similarity_forecast(rows, closes)
        backtest = self._backtest_trend_strategy(rows, closes)
        row_context = self._build_row_context(latest_row)
        liquidity_profile = self._build_liquidity_profile(
            row_context,
            avg_amount_20d=self._average_amount_window(rows, len(rows) - 1, 20),
        )
        risk_budget_profile = self._build_execution_risk_profile(trend_snapshot, row_context)
        position_profile = self._merge_position_profiles(liquidity_profile, risk_budget_profile)
        context = self._build_database_context(database_bundle or {}, latest_row)
        execution_score, score, factors = self._compose_live_score(
            trend_snapshot,
            forecast,
            row_context,
            context,
            liquidity_profile,
            position_profile,
        )
        long_term_strategies = self._build_long_term_strategies(
            trend_snapshot,
            forecast,
            backtest,
            context,
            position_profile,
        )
        stock_pickers = self._build_stock_picker_strategies(trend_snapshot, forecast, context, position_profile)
        stance, risk_level, summary = self._summarize_market_state(
            trend_snapshot,
            forecast,
            backtest,
            score,
            execution_score=execution_score,
            row_context=row_context,
            context=context,
            position_profile=position_profile,
        )
        signal = self._signal_from_score(
            execution_score,
            symbol,
            name,
            summary,
            position_cap=float(position_profile.get("positionCap") or 1.0),
            cap_reason=str(position_profile.get("capReason") or ""),
            automation_enabled=automation_enabled,
            manual_override=manual_override,
        )

        result = {
            "signal": signal,
            "analysis": {
                "executionScore": round(execution_score, 2),
                "score": round(score, 2),
                "stance": stance,
                "riskLevel": risk_level,
                "avgAmount20d": round(float(liquidity_profile.get("avgAmount20d") or 0.0), 2)
                if liquidity_profile.get("avgAmount20d") is not None
                else None,
                "liquidityScore": round(float(liquidity_profile.get("liquidityScore") or 0.0), 2),
                "liquidityTier": str(liquidity_profile.get("liquidityTier") or "E"),
                "riskBudgetTier": str(position_profile.get("riskBudgetTier") or "OPEN"),
                "riskBudgetCapPct": int(round(float(position_profile.get("riskBudgetCap") or 0.0) * 100)),
                "liquidityCapPct": int(round(float(position_profile.get("liquidityCap") or 0.0) * 100)),
                "positionCapPct": int(round(float(position_profile.get("positionCap") or 0.0) * 100)),
                "summary": summary,
                "factors": factors,
                "longTermStrategies": long_term_strategies,
                "stockPickers": stock_pickers,
                "forecast": forecast,
                "backtest": backtest,
                "disclaimer": "History-based statistical analysis only. It is for research reference, not investment advice.",
            },
        }
        self._write_analysis_cache(cache_key, result)
        return result

    def build_signal(
        self,
        rows: list[dict[str, Any]],
        symbol: str,
        name: str,
        *,
        database_bundle: dict[str, Any] | None = None,
        automation_enabled: bool = True,
        manual_override: str | None = None,
    ) -> dict[str, Any]:
        return self.analyze_market(
            rows,
            symbol,
            name,
            database_bundle=database_bundle,
            automation_enabled=automation_enabled,
            manual_override=manual_override,
        )["signal"]

    def _build_trend_snapshot(self, closes: list[float], index: int) -> dict[str, float | bool]:
        latest_close = closes[index]
        ma20 = self._average_window(closes, index, 20)
        ma60 = self._average_window(closes, index, 60)
        ma120 = self._average_window(closes, index, 120)
        ma250 = self._average_window(closes, index, 250)
        ret20 = self._return_between(closes, index, 20)
        ret60 = self._return_between(closes, index, 60)
        ret120 = self._return_between(closes, index, 120)
        ret250 = self._return_between(closes, index, 250)
        vol20 = self._annualized_volatility(closes, index, 20)
        vol60 = self._annualized_volatility(closes, index, 60)
        high60 = self._window_high(closes, index, 60)
        low60 = self._window_low(closes, index, 60)
        high250 = self._window_high(closes, index, 250)
        low250 = self._window_low(closes, index, 250)

        return {
            "latestClose": latest_close,
            "ma20": ma20,
            "ma60": ma60,
            "ma120": ma120,
            "ma250": ma250,
            "ret20": ret20,
            "ret60": ret60,
            "ret120": ret120,
            "ret250": ret250,
            "vol20": vol20,
            "vol60": vol60,
            "trendStrength": self._safe_ratio(latest_close, ma60) - 1,
            "aboveMa20": latest_close >= ma20,
            "aboveMa60": latest_close >= ma60,
            "aboveMa120": latest_close >= ma120,
            "aboveMa250": latest_close >= ma250,
            "maBullish": ma20 >= ma60 >= ma120,
            "maSecularBullish": ma60 >= ma120 >= ma250,
            "nearBreakout": latest_close >= high60 * 0.98 if high60 > 0 else False,
            "nearLongBreakout": latest_close >= high250 * 0.97 if high250 > 0 else False,
            "rangePosition": self._safe_ratio(latest_close - low60, max(high60 - low60, 1e-9)),
            "longRangePosition": self._safe_ratio(latest_close - low250, max(high250 - low250, 1e-9)),
            "drawdownFromHigh60": self._safe_ratio(latest_close, high60) - 1 if high60 > 0 else 0.0,
            "drawdownFromHigh250": self._safe_ratio(latest_close, high250) - 1 if high250 > 0 else 0.0,
            "trendEfficiency20": self._trend_efficiency(values=closes, index=index, length=20),
            "trendEfficiency60": self._trend_efficiency(values=closes, index=index, length=60),
        }

    def _compose_live_score(
        self,
        trend_snapshot: dict[str, float | bool],
        forecast: dict[str, Any],
        row_context: dict[str, float | None],
        context: dict[str, float | None],
        liquidity_profile: dict[str, float | str | None],
        position_profile: dict[str, float | str | None],
    ) -> tuple[float, float, list[dict[str, str]]]:
        execution_score, factors = self._compose_execution_score(
            trend_snapshot,
            row_context,
            liquidity_profile,
            position_profile,
        )
        forecast_score, forecast_factors = self._compose_forecast_score(forecast)
        context_score, context_factors = self._compose_context_score(context, row_context, forecast)
        factors.extend(forecast_factors)
        factors.extend(context_factors)
        return execution_score, execution_score + forecast_score + context_score, factors

    def _compose_execution_score(
        self,
        trend_snapshot: dict[str, float | bool],
        row_context: dict[str, float | None],
        liquidity_profile: dict[str, float | str | None],
        position_profile: dict[str, float | str | None],
    ) -> tuple[float, list[dict[str, str]]]:
        score = 0.0
        factors: list[dict[str, str]] = []

        latest_close = float(trend_snapshot["latestClose"])
        ma20 = float(trend_snapshot["ma20"])
        ma60 = float(trend_snapshot["ma60"])
        ma120 = float(trend_snapshot["ma120"])
        ret20 = float(trend_snapshot["ret20"])
        ret60 = float(trend_snapshot["ret60"])
        vol20 = float(trend_snapshot["vol20"])
        range_position = float(trend_snapshot["rangePosition"]) * 100
        drawdown_from_high60 = float(trend_snapshot["drawdownFromHigh60"])
        trend_efficiency20 = float(trend_snapshot["trendEfficiency20"])
        trend_efficiency60 = float(trend_snapshot["trendEfficiency60"])
        volume_ratio = row_context.get("volume_ratio")
        turnover_rate = row_context.get("turnover_rate")
        amount = row_context.get("amount")
        avg_amount_20d = self._to_number(liquidity_profile.get("avgAmount20d"))
        float_market_cap = row_context.get("float_market_cap")
        liquidity_tier = str(liquidity_profile.get("liquidityTier") or "E")
        position_cap = float(position_profile.get("positionCap") or 1.0)
        risk_budget_cap = float(position_profile.get("riskBudgetCap") or 1.0)
        risk_budget_tier = str(position_profile.get("riskBudgetTier") or "OPEN")
        trend_strength = float(trend_snapshot["trendStrength"])

        price_vs_ma20 = self._safe_ratio(latest_close, ma20) - 1
        price_vs_ma60 = self._safe_ratio(latest_close, ma60) - 1
        if latest_close >= ma20:
            score += 1.1
            factors.append(self._factor("Price vs MA20", price_vs_ma20, "Price is trading above the short-term trend line."))
        else:
            score -= 1.1
            factors.append(self._factor("Price vs MA20", price_vs_ma20, "Price slipped below the short-term trend line."))

        ma_alignment = self._safe_ratio(ma20, ma60) - 1
        if ma20 >= ma60 >= ma120:
            score += 1.2
            factors.append(self._factor("Trend alignment", ma_alignment, "Short, medium, and long averages are stacked bullish."))
        elif ma20 >= ma60:
            score += 0.4
            factors.append(self._factor("Trend alignment", ma_alignment, "Short trend is still above the medium trend."))
        else:
            score -= 1.0
            factors.append(self._factor("Trend alignment", ma_alignment, "Average alignment is still weak."))

        score += 0.9 if ret20 >= 0 else -0.9
        factors.append(self._factor("20-bar momentum", ret20, "Momentum across roughly one month of trading data."))

        score += 1.0 if ret60 >= 0 else -1.0
        factors.append(self._factor("60-bar momentum", ret60, "Intermediate trend across the recent quarter."))

        if vol20 >= 0.42:
            score -= 0.8
            factors.append(self._factor("20-bar volatility", -vol20, "Volatility is elevated, so the model reduces conviction."))
        elif vol20 <= 0.22:
            score += 0.3
            factors.append(self._factor("20-bar volatility", vol20, "Volatility is controlled and trend persistence tends to improve."))
        else:
            factors.append(self._factor("20-bar volatility", vol20, "Volatility is in a neutral zone.", value_as_percent=False))

        if range_position >= 75:
            score += 0.5
            factors.append(
                {
                    "label": "Range position",
                    "value": f"{range_position:.1f}%",
                    "tone": "positive",
                    "detail": "Price is trading near the top of its recent 60-bar range.",
                }
            )
        elif range_position <= 35:
            score -= 0.5
            factors.append(
                {
                    "label": "Range position",
                    "value": f"{range_position:.1f}%",
                    "tone": "negative",
                    "detail": "Price is sitting in the lower part of its recent range.",
                }
            )
        else:
            factors.append(
                {
                    "label": "Range position",
                    "value": f"{range_position:.1f}%",
                    "tone": "neutral",
                    "detail": "Price is trading around the middle of its recent range.",
                }
            )

        if trend_efficiency20 >= 0.38 and trend_efficiency60 >= 0.28 and ret20 > 0:
            score += 0.35
            factors.append(
                {
                    "label": "Trend efficiency",
                    "value": f"{trend_efficiency20:.2f} / {trend_efficiency60:.2f}",
                    "tone": "positive",
                    "detail": "Price is moving with relatively little back-and-forth noise, which usually improves trend persistence.",
                }
            )
        elif trend_efficiency20 <= 0.18 and abs(ret20) <= 0.08:
            score -= 0.35
            factors.append(
                {
                    "label": "Trend efficiency",
                    "value": f"{trend_efficiency20:.2f} / {trend_efficiency60:.2f}",
                    "tone": "negative",
                    "detail": "Price action is choppy relative to the net move, so breakout signals deserve less trust.",
                }
            )
        else:
            factors.append(
                {
                    "label": "Trend efficiency",
                    "value": f"{trend_efficiency20:.2f} / {trend_efficiency60:.2f}",
                    "tone": "neutral",
                    "detail": "Trend quality is acceptable but not clean enough to materially change conviction.",
                }
            )

        if bool(trend_snapshot["nearBreakout"]):
            score += 0.35
            factors.append(
                {
                    "label": "Breakout pressure",
                    "value": "Yes",
                    "tone": "positive",
                    "detail": "Price is close to the upper edge of its recent range and can trigger follow-through if volume expands.",
                }
            )
        else:
            factors.append(
                {
                    "label": "Breakout pressure",
                    "value": "No",
                    "tone": "neutral",
                    "detail": "Price is not yet close enough to a recent breakout area.",
                }
            )

        if bool(trend_snapshot["nearBreakout"]) and volume_ratio is not None:
            if volume_ratio >= 1.2:
                score += 0.15
                tone = "positive"
                detail = "The breakout area is being tested with decent participation, which lowers the odds of an immediate fade."
            elif volume_ratio <= 0.85:
                score -= 0.25
                tone = "negative"
                detail = "Price is pressing the breakout area on weak participation, which raises false-break risk."
            else:
                tone = "neutral"
                detail = "Breakout pressure is visible, but confirmation from participation is only average."
            factors.append(
                {
                    "label": "Breakout confirmation",
                    "value": f"{volume_ratio:.2f}",
                    "tone": tone,
                    "detail": detail,
                }
            )

        if drawdown_from_high60 >= -0.1 and drawdown_from_high60 <= -0.02 and latest_close >= ma20 and latest_close >= ma60:
            score += 0.2
            factors.append(
                {
                    "label": "Pullback quality",
                    "value": f"{drawdown_from_high60 * 100:+.1f}%",
                    "tone": "positive",
                    "detail": "The stock is holding a controlled pullback off the recent high while staying above key trend levels.",
                }
            )
        elif drawdown_from_high60 <= -0.18 and latest_close < ma20:
            score -= 0.3
            factors.append(
                {
                    "label": "Pullback quality",
                    "value": f"{drawdown_from_high60 * 100:+.1f}%",
                    "tone": "negative",
                    "detail": "The pullback from the recent high is already deep enough to question whether the prior trend is still intact.",
                }
            )
        else:
            factors.append(
                {
                    "label": "Pullback quality",
                    "value": f"{drawdown_from_high60 * 100:+.1f}%",
                    "tone": "neutral",
                    "detail": "The current pullback depth is not extreme enough to materially change execution quality.",
                }
            )

        if price_vs_ma20 >= 0.12 or (price_vs_ma60 >= 0.2 and range_position >= 92):
            score -= 0.35
            factors.append(
                {
                    "label": "Extension risk",
                    "value": f"{price_vs_ma20 * 100:+.1f}%",
                    "tone": "negative",
                    "detail": "Price is stretched well above its trend base, so the model trims conviction to avoid chasing.",
                }
            )
        elif trend_strength > 0 and price_vs_ma20 <= 0.035 and range_position >= 55:
            score += 0.15
            factors.append(
                {
                    "label": "Extension risk",
                    "value": f"{price_vs_ma20 * 100:+.1f}%",
                    "tone": "positive",
                    "detail": "Trend is positive but not overly extended, which leaves more room for cleaner follow-through.",
                }
            )
        else:
            factors.append(
                {
                    "label": "Extension risk",
                    "value": f"{price_vs_ma20 * 100:+.1f}%",
                    "tone": "neutral",
                    "detail": "Price extension is in a workable zone and does not materially change execution quality.",
                }
            )

        if volume_ratio is not None:
            if volume_ratio >= 1.6:
                score += 0.45
                tone = "positive"
                detail = "Relative volume is clearly expanding and confirms participation."
            elif volume_ratio >= 1.0:
                score += 0.2
                tone = "positive"
                detail = "Relative volume is at least keeping pace with the recent baseline."
            elif volume_ratio <= 0.7:
                score -= 0.25
                tone = "negative"
                detail = "Relative volume is weak and the move lacks broad participation."
            else:
                tone = "neutral"
                detail = "Relative volume is middling and does not add much conviction."
            factors.append(
                {
                    "label": "Volume ratio",
                    "value": f"{volume_ratio:.2f}",
                    "tone": tone,
                    "detail": detail,
                }
            )

        if turnover_rate is not None:
            if 2.0 <= turnover_rate <= 8.0:
                score += 0.35
                tone = "positive"
                detail = "Turnover is active without looking overly crowded."
            elif turnover_rate >= 12.0:
                score -= 0.2
                tone = "negative"
                detail = "Turnover is overheated and raises the risk of short-term exhaustion."
            elif turnover_rate < 0.8:
                score -= 0.15
                tone = "negative"
                detail = "Turnover is too light to support aggressive execution."
            else:
                tone = "neutral"
                detail = "Turnover is acceptable but not a major edge."
            factors.append(
                {
                    "label": "Turnover rate",
                    "value": f"{turnover_rate:.2f}%",
                    "tone": tone,
                    "detail": detail,
                }
            )

        if amount is not None:
            if amount >= 300000:
                score += 0.25
                tone = "positive"
                detail = "Turnover value is strong enough to support smoother execution."
            elif amount < 80000:
                score -= 0.3
                tone = "negative"
                detail = "Turnover value is thin and can amplify slippage risk."
            else:
                tone = "neutral"
                detail = "Turnover value is serviceable but not an edge by itself."
            factors.append(
                {
                    "label": "Turnover value",
                    "value": self._format_large_amount(amount) or "-",
                    "tone": tone,
                    "detail": detail,
                }
            )

        if avg_amount_20d is not None:
            if avg_amount_20d >= 300000:
                score += 0.3
                tone = "positive"
                detail = "Average turnover remains deep enough to scale into the trade without leaning on one hot session."
            elif avg_amount_20d >= 150000:
                score += 0.1
                tone = "positive"
                detail = "Average turnover is acceptable for measured execution."
            elif avg_amount_20d < 80000:
                score -= 0.35
                tone = "negative"
                detail = "Average turnover is persistently thin and the setup can become hard to execute cleanly."
            else:
                score -= 0.1
                tone = "neutral"
                detail = "Average turnover is middling, so position sizing should stay disciplined."
            factors.append(
                {
                    "label": "20-day average turnover",
                    "value": self._format_large_amount(avg_amount_20d) or "-",
                    "tone": tone,
                    "detail": detail,
                }
            )

        if float_market_cap is not None:
            if float_market_cap >= 1000000:
                score += 0.15
                tone = "positive"
                detail = "Float market cap is large enough to absorb institutional participation more smoothly."
            elif float_market_cap < 250000:
                score -= 0.35
                tone = "negative"
                detail = "Float market cap is small and the price can be pushed around too easily."
            elif float_market_cap < 500000:
                score -= 0.15
                tone = "negative"
                detail = "Float market cap is still on the smaller side, so execution risk stays elevated."
            else:
                tone = "neutral"
                detail = "Float market cap is workable but not yet a clear capacity advantage."
            factors.append(
                {
                    "label": "Float market cap",
                    "value": self._format_large_amount(float_market_cap) or "-",
                    "tone": tone,
                    "detail": detail,
                }
            )

        if position_cap <= 0:
            score -= 1.0
            tone = "negative"
            detail = "Liquidity is too thin for the model to carry a fresh position."
        elif position_cap <= 0.35:
            score -= 0.5
            tone = "negative"
            detail = "Liquidity is thin, so the model only allows a starter position."
        elif position_cap < 1.0:
            score -= 0.15
            tone = "neutral"
            detail = "Liquidity is acceptable, but position sizing stays capped until depth improves."
        else:
            tone = "positive"
            detail = "Liquidity gate allows full sizing without forcing a haircut."
        factors.append(
            {
                "label": "Execution capacity",
                "value": f"{liquidity_tier} / {int(round(position_cap * 100))}%",
                "tone": tone,
                "detail": detail,
            }
        )

        if risk_budget_cap <= 0.35:
            score -= 0.35
            tone = "negative"
            detail = "Risk budget is tight because volatility, extension, or crowding is too elevated for aggressive sizing."
        elif risk_budget_cap < 1.0:
            score -= 0.15
            tone = "neutral"
            detail = "Risk budget remains constructive, but the setup still needs smaller sizing because execution risk is elevated."
        else:
            tone = "positive"
            detail = "Risk budget is open and does not force additional position cuts."
        factors.append(
            {
                "label": "Risk budget",
                "value": f"{risk_budget_tier} / {int(round(risk_budget_cap * 100))}%",
                "tone": tone,
                "detail": detail,
            }
        )

        return score, factors

    def _compose_forecast_score(
        self,
        forecast: dict[str, Any],
    ) -> tuple[float, list[dict[str, str]]]:
        raw_score = 0.0
        factors: list[dict[str, str]] = []

        forecast5 = self._forecast_return_for_days(forecast, 5)
        forecast20 = self._forecast_return_for_days(forecast, 20)
        forecast60 = self._forecast_return_for_days(forecast, 60)
        forecast20_win_rate = self._forecast_win_rate_for_days(forecast, 20)
        forecast60_win_rate = self._forecast_win_rate_for_days(forecast, 60)
        if forecast5 is not None:
            if forecast5 >= 0.015:
                raw_score += 0.2
            elif forecast5 <= -0.02:
                raw_score -= 0.25
            elif forecast5 < 0:
                raw_score -= 0.1
            factors.append(self._factor("Analog forecast (5d)", forecast5, "Very short-term entry timing from the nearest historical setups."))
        if forecast20 is not None:
            if forecast20 >= 0.03:
                raw_score += 1.0
            elif forecast20 > 0:
                raw_score += 0.45
            elif forecast20 <= -0.03:
                raw_score -= 1.0
            else:
                raw_score -= 0.45
            factors.append(self._factor("Analog forecast (20d)", forecast20, "Average forward return of the closest historical setups."))

        if forecast60 is not None:
            if forecast60 >= 0.08:
                raw_score += 0.8
            elif forecast60 > 0:
                raw_score += 0.35
            elif forecast60 <= -0.08:
                raw_score -= 0.8
            else:
                raw_score -= 0.35
            factors.append(self._factor("Analog forecast (60d)", forecast60, "Longer horizon expectation from historical analog windows."))

        if forecast20_win_rate is not None or forecast60_win_rate is not None:
            breadth_score = 0.0
            if forecast20_win_rate is not None:
                if forecast20_win_rate >= 0.6:
                    breadth_score += 0.18
                elif forecast20_win_rate <= 0.45:
                    breadth_score -= 0.18
            if forecast60_win_rate is not None:
                if forecast60_win_rate >= 0.58:
                    breadth_score += 0.12
                elif forecast60_win_rate <= 0.45:
                    breadth_score -= 0.12
            raw_score += breadth_score
            factors.append(
                {
                    "label": "Analog breadth",
                    "value": f"{(forecast20_win_rate or 0.0) * 100:.1f}% / {(forecast60_win_rate or 0.0) * 100:.1f}%",
                    "tone": "positive" if breadth_score > 0 else "negative" if breadth_score < 0 else "neutral",
                    "detail": "Win rates across the nearest historical setups help distinguish broad support from a small number of outlier paths.",
                }
            )

        confidence_pct = self._to_number(forecast.get("confidencePct")) or 0.0
        sample_size = int(forecast.get("sampleSize") or 0)
        confidence_multiplier = 0.45 + min(max((confidence_pct - 34.0) / 58.0, 0.0), 1.0) * 0.55
        if sample_size < 8:
            confidence_multiplier *= 0.82
        elif sample_size < 12:
            confidence_multiplier *= 0.92
        weighted_score = raw_score * confidence_multiplier
        factors.append(
            {
                "label": "Analog confidence",
                "value": f"{confidence_pct:.1f}% x {confidence_multiplier:.2f}",
                "tone": "positive" if confidence_pct >= 62 else "negative" if confidence_pct < 48 else "neutral",
                "detail": "Historical analog signals are scaled down when confidence and sample stability are not strong enough.",
            }
        )

        return weighted_score, factors

    def _compose_context_score(
        self,
        context: dict[str, float | None],
        row_context: dict[str, float | None],
        forecast: dict[str, Any],
    ) -> tuple[float, list[dict[str, str]]]:
        score = 0.0
        factors: list[dict[str, str]] = []

        roe = context.get("roe")
        revenue_yoy = context.get("revenue_yoy")
        profit_yoy = context.get("profit_yoy")
        debt_to_assets = context.get("debt_to_assets")
        gross_margin = context.get("gross_margin")
        ocfps = context.get("ocfps")
        pe_ttm = context.get("pe_ttm")
        pb = context.get("pb")
        net_mf_amount = context.get("net_mf_amount")
        forecast20 = self._forecast_return_for_days(forecast, 20) or 0.0
        volume_ratio = row_context.get("volume_ratio") or 0.0

        quality_passes = 0
        if roe is not None and roe >= 10:
            quality_passes += 1
        if revenue_yoy is not None and revenue_yoy >= 8:
            quality_passes += 1
        if profit_yoy is not None and profit_yoy >= 8:
            quality_passes += 1
        if gross_margin is not None and gross_margin >= 20:
            quality_passes += 1
        if debt_to_assets is not None and debt_to_assets <= 65:
            quality_passes += 1
        if ocfps is not None and ocfps > 0:
            quality_passes += 1

        quality_score = (quality_passes - 3) * 0.22
        if quality_passes >= 5:
            quality_score += 0.2
        elif quality_passes <= 1:
            quality_score -= 0.25
        score += quality_score
        factors.append(
            {
                "label": "Quality checklist",
                "value": f"{quality_passes}/6",
                "tone": "positive" if quality_score > 0 else "negative" if quality_score < 0 else "neutral",
                "detail": "Combines profitability, growth, leverage, and operating cash flow into a simple quality checkpoint.",
            }
        )

        if pe_ttm is not None or pb is not None:
            if (pe_ttm is None or pe_ttm <= 20) and (pb is None or pb <= 2.8):
                valuation_score = 0.35
                valuation_detail = "Valuation is still reasonable relative to current fundamentals."
            elif (pe_ttm is not None and pe_ttm >= 45) or (pb is not None and pb >= 5.5):
                valuation_score = -0.35
                valuation_detail = "Valuation already prices in a lot of optimism and leaves less margin for error."
            else:
                valuation_score = 0.0
                valuation_detail = "Valuation is neither a strong tailwind nor a major drag."
            if valuation_score > 0 and forecast20 > 0:
                valuation_score += 0.1
            if valuation_score < 0 and forecast20 < 0:
                valuation_score -= 0.1
            score += valuation_score
            factors.append(
                {
                    "label": "Valuation posture",
                    "value": f"PE {self._format_number(pe_ttm) or '-'} / PB {self._format_number(pb) or '-'}",
                    "tone": "positive" if valuation_score > 0 else "negative" if valuation_score < 0 else "neutral",
                    "detail": valuation_detail,
                }
            )

        if net_mf_amount is not None:
            if net_mf_amount > 0 and volume_ratio >= 1.0:
                flow_score = 0.35
                flow_detail = "Positive money flow is being confirmed by above-baseline volume."
            elif net_mf_amount > 0:
                flow_score = 0.18
                flow_detail = "Money flow is positive, but volume confirmation is only moderate."
            elif net_mf_amount < 0 and volume_ratio >= 1.2:
                flow_score = -0.35
                flow_detail = "Negative money flow under active volume is a notable warning sign."
            elif net_mf_amount < 0:
                flow_score = -0.18
                flow_detail = "Money flow is negative and weakens the setup."
            else:
                flow_score = 0.0
                flow_detail = "Money flow is flat and does not affect conviction."
            score += flow_score
            factors.append(
                {
                    "label": "Money flow context",
                    "value": self._format_large_amount(net_mf_amount) or "-",
                    "tone": "positive" if flow_score > 0 else "negative" if flow_score < 0 else "neutral",
                    "detail": flow_detail,
                }
            )

        return score, factors

    def _summarize_market_state(
        self,
        trend_snapshot: dict[str, float | bool],
        forecast: dict[str, Any],
        backtest: dict[str, Any],
        score: float,
        *,
        execution_score: float,
        row_context: dict[str, float | None],
        context: dict[str, float | None],
        position_profile: dict[str, float | str | None],
    ) -> tuple[str, str, str]:
        confidence = float(forecast.get("confidencePct") or 0)
        vol20 = float(trend_snapshot["vol20"])
        backtest_drawdown = abs(float(backtest.get("maxDrawdownPct") or 0))
        forecast20 = self._forecast_return_for_days(forecast, 20) or 0.0
        forecast60 = self._forecast_return_for_days(forecast, 60) or 0.0
        volume_ratio = row_context.get("volume_ratio") or 0.0
        turnover_rate = row_context.get("turnover_rate") or 0.0
        roe = context.get("roe") or 0.0
        profit_yoy = context.get("profit_yoy") or 0.0
        debt_to_assets = context.get("debt_to_assets") or 0.0
        net_mf_amount = context.get("net_mf_amount") or 0.0
        position_cap = float(position_profile.get("positionCap") or 1.0)
        risk_budget_cap = float(position_profile.get("riskBudgetCap") or 1.0)

        if score >= 3.2 and position_cap >= 0.65:
            stance = "Trend-led accumulation"
        elif score >= 1.4 and position_cap > 0:
            stance = "Constructive but selective"
        elif score >= -0.8:
            stance = "Balanced / wait for confirmation"
        else:
            stance = "Defensive"

        risk_score = 0
        if vol20 >= 0.4:
            risk_score += 1
        if backtest_drawdown >= 22:
            risk_score += 1
        if confidence < 52:
            risk_score += 1
        if debt_to_assets >= 72:
            risk_score += 1
        if position_cap < 0.65:
            risk_score += 1
        if risk_budget_cap < 1.0:
            risk_score += 1
        risk_level = "Low" if risk_score == 0 else "Medium" if risk_score <= 2 else "High"

        if position_cap <= 0:
            summary = "Trend may look constructive, but liquidity is too thin for the model to open exposure."
        elif risk_budget_cap <= 0.35 and execution_score >= PROBE_POSITION_THRESHOLD:
            summary = "Trend is constructive, but volatility or price extension forces the model into a starter-sized posture."
        elif position_cap < 0.65 and execution_score >= PROBE_POSITION_THRESHOLD:
            summary = "Trend is constructive, but liquidity and market-cap constraints keep sizing capped."
        elif forecast20 > 0 and forecast60 > 0 and execution_score >= 1.4 and roe >= 10 and profit_yoy >= 0:
            summary = "Trend, historical analogs, and basic quality checks are all supportive, so the model keeps a pro-risk posture."
        elif forecast20 < 0 and forecast60 < 0 and score < 0:
            summary = "Trend and historical analogs are both weak, so the model stays defensive."
        elif net_mf_amount < 0 and volume_ratio >= 1.2 and turnover_rate >= 4:
            summary = "Participation is active but money flow is leaking out, so the model stays cautious despite the visible turnover."
        elif execution_score >= 1.4 and roe >= 10 and debt_to_assets <= 65:
            summary = "Trend remains supportive and the balance sheet is not stretched, so the model allows measured positioning."
        elif score >= 1.4:
            summary = "Trend remains supportive, but the forward analog signal is mixed and position sizing should stay measured."
        else:
            summary = "The market state is mixed, so the model prefers patience until trend and analog signals align."

        return stance, risk_level, summary

    def _signal_from_score(
        self,
        score: float,
        symbol: str,
        name: str,
        summary: str,
        *,
        position_cap: float,
        cap_reason: str,
        automation_enabled: bool,
        manual_override: str | None,
    ) -> dict[str, Any]:
        if manual_override == "BUY":
            return self._signal("FULL", "BUY", symbol, name, 90, "Manual buy signal was triggered.")

        if manual_override == "SELL":
            return self._signal("EMPTY", "SELL", symbol, name, 0, "Manual sell signal was triggered.")

        raw_target_position = self._position_from_score(score)
        capped_position = min(raw_target_position, max(0.0, min(position_cap, 1.0)))
        target_position = int(round(capped_position * 100))
        reason = summary
        if cap_reason and capped_position < raw_target_position:
            reason = f"{summary} {cap_reason}".strip()

        if capped_position >= 0.95:
            signal = self._signal("FULL", "BUY", symbol, name, target_position, summary)
        elif capped_position >= 0.35:
            signal = self._signal("HALF", "HOLD", symbol, name, target_position, reason)
        else:
            signal = self._signal("EMPTY", "SELL", symbol, name, target_position, reason)

        if not automation_enabled:
            signal["reason"] = f"Automation is paused. {signal['reason']}"
        return signal

    def _build_similarity_forecast(
        self,
        rows: list[dict[str, Any]],
        closes: list[float],
    ) -> dict[str, Any]:
        latest_close = closes[-1]
        latest_trade_date = format_date(rows[-1].get("trade_date"))
        lookback_bars = min(len(closes), SIMILARITY_LOOKBACK_BARS)
        max_horizon = max(FORECAST_HORIZONS)

        if len(closes) < MIN_FORECAST_BARS or len(closes) <= max_horizon + BACKTEST_WARMUP_BARS:
            return {
                "method": "Historical analog windows",
                "sampleSize": 0,
                "lookbackBars": lookback_bars,
                "latestTradeDate": latest_trade_date,
                "confidencePct": 0,
                "direction": "INSUFFICIENT",
                "summary": "Not enough multi-year data is available to build a stable forward analog forecast yet.",
                "horizons": [],
                "band": {"lowerPrice": latest_close, "upperPrice": latest_close},
            }

        current_features = self._similarity_features(closes, len(closes) - 1)
        candidates: list[tuple[float, int]] = []
        latest_index = len(closes) - 1
        start_index = max(BACKTEST_WARMUP_BARS, latest_index - lookback_bars)
        end_index = latest_index - max_horizon - 1

        for index in range(start_index, end_index + 1):
            features = self._similarity_features(closes, index)
            distance = self._feature_distance(current_features, features)
            if math.isfinite(distance):
                candidates.append((distance, index))

        if not candidates:
            return {
                "method": "Historical analog windows",
                "sampleSize": 0,
                "lookbackBars": lookback_bars,
                "latestTradeDate": latest_trade_date,
                "confidencePct": 0,
                "direction": "INSUFFICIENT",
                "summary": "Historical analog windows could not be constructed from the available data.",
                "horizons": [],
                "band": {"lowerPrice": latest_close, "upperPrice": latest_close},
            }

        best_matches = sorted(candidates, key=lambda item: item[0])[:SIMILARITY_SAMPLE_SIZE]
        weighted_horizons: list[dict[str, Any]] = []
        confidence_inputs: list[float] = []

        for horizon in FORECAST_HORIZONS:
            weighted_returns: list[tuple[float, float]] = []
            for distance, index in best_matches:
                base_close = closes[index]
                future_close = closes[index + horizon]
                future_ret = self._safe_ratio(future_close, base_close) - 1
                weight = 1 / (0.08 + distance)
                weighted_returns.append((future_ret, weight))

            mean_return = self._weighted_mean(weighted_returns)
            win_rate = self._weighted_win_rate(weighted_returns)
            dispersion = self._weighted_stddev(weighted_returns, mean_return)
            confidence_inputs.append(max(0.0, dispersion))
            weighted_horizons.append(
                {
                    "label": f"{horizon}d",
                    "days": horizon,
                    "expectedReturnPct": round(mean_return * 100, 2),
                    "predictedPrice": round(latest_close * (1 + mean_return), 4),
                    "winRatePct": round(win_rate * 100, 1),
                }
            )

        avg_dispersion = sum(confidence_inputs) / max(1, len(confidence_inputs))
        confidence_pct = max(
            34,
            min(
                92,
                round(46 + len(best_matches) * 2.1 - avg_dispersion * 115, 1),
            ),
        )

        long_view = next((item for item in weighted_horizons if item["days"] == 60), None)
        medium_view = next((item for item in weighted_horizons if item["days"] == 20), None)
        expected_medium = float(medium_view["expectedReturnPct"]) if medium_view else 0.0
        expected_long = float(long_view["expectedReturnPct"]) if long_view else 0.0

        if expected_medium >= 3 and expected_long >= 6:
            direction = "BULLISH"
            summary = "Historical windows with a similar setup were usually followed by positive medium-term performance."
        elif expected_medium <= -3 and expected_long <= -6:
            direction = "BEARISH"
            summary = "Comparable historical setups were usually followed by weaker forward performance."
        else:
            direction = "NEUTRAL"
            summary = "The nearest historical setups point to a mixed forward path rather than a clean directional edge."

        band_width = avg_dispersion * 1.1
        return {
            "method": "Historical analog windows",
            "sampleSize": len(best_matches),
            "lookbackBars": lookback_bars,
            "latestTradeDate": latest_trade_date,
            "confidencePct": confidence_pct,
            "direction": direction,
            "summary": summary,
            "horizons": weighted_horizons,
            "band": {
                "lowerPrice": round(latest_close * max(0.01, 1 + (expected_medium / 100) - band_width), 4),
                "upperPrice": round(latest_close * (1 + (expected_medium / 100) + band_width), 4),
            },
        }

    def _backtest_trend_strategy(
        self,
        rows: list[dict[str, Any]],
        closes: list[float],
    ) -> dict[str, Any]:
        if len(closes) <= BACKTEST_WARMUP_BARS + 5:
            return self._empty_backtest(rows)

        nav = 1.0
        position = 0.0
        equity_curve = [1.0]
        daily_returns: list[float] = []
        trades = 0
        closed_trades = 0
        winning_trades = 0
        entry_nav: float | None = None
        total_turnover = 0.0
        total_trading_cost = 0.0

        start_index = BACKTEST_WARMUP_BARS
        for index in range(start_index, len(closes)):
            signal_index = index - 1
            signal_row = rows[signal_index]
            row_context = self._build_row_context(signal_row)
            trend_snapshot = self._build_trend_snapshot(closes, signal_index)
            liquidity_profile = self._build_liquidity_profile(
                row_context,
                avg_amount_20d=self._average_amount_window(rows, signal_index, 20),
            )
            position_profile = self._merge_position_profiles(
                liquidity_profile,
                self._build_execution_risk_profile(trend_snapshot, row_context),
            )
            target_position = self._position_from_signal_score(
                self._execution_score_for_index(
                    closes,
                    signal_index,
                    signal_row,
                    avg_amount_20d=self._to_number(liquidity_profile.get("avgAmount20d")),
                ),
                float(position_profile.get("positionCap") or 1.0),
            )
            turnover = abs(target_position - position)
            trading_cost_rate = self._transaction_cost_rate(position, target_position)

            if turnover > 0:
                total_turnover += turnover
                total_trading_cost += trading_cost_rate
                nav *= max(0.0, 1 - trading_cost_rate)

            if position <= 0 < target_position:
                trades += 1
                entry_nav = nav
            elif position > 0 >= target_position and entry_nav is not None:
                closed_trades += 1
                if nav >= entry_nav:
                    winning_trades += 1
                entry_nav = None
            position = target_position

            previous_close = closes[index - 1]
            current_close = closes[index]
            daily_ret = position * (self._safe_ratio(current_close, previous_close) - 1)
            daily_returns.append(daily_ret)
            nav *= 1 + daily_ret
            equity_curve.append(nav)

        if position > 0 and entry_nav is not None:
            closed_trades += 1
            if nav >= entry_nav:
                winning_trades += 1

        test_days = len(daily_returns)
        benchmark_return = self._safe_ratio(closes[-1], closes[start_index - 1]) - 1
        total_return = nav - 1
        annual_return = self._annualized_return(nav, test_days)
        max_drawdown = self._max_drawdown(equity_curve)
        sharpe = self._annualized_sharpe(daily_returns)
        years = round(test_days / 252, 2)

        return {
            "startDate": format_date(rows[start_index - 1].get("trade_date")),
            "endDate": format_date(rows[-1].get("trade_date")),
            "years": years,
            "trades": trades,
            "winRatePct": round((winning_trades / max(1, closed_trades)) * 100, 1),
            "annualReturnPct": round(annual_return * 100, 2),
            "totalReturnPct": round(total_return * 100, 2),
            "benchmarkReturnPct": round(benchmark_return * 100, 2),
            "excessReturnPct": round((total_return - benchmark_return) * 100, 2),
            "maxDrawdownPct": round(max_drawdown * 100, 2),
            "sharpe": round(sharpe, 2),
            "latestPositionPct": int(round(position * 100)),
            "turnoverPct": round(total_turnover * 100, 1),
            "tradingCostPct": round(total_trading_cost * 100, 2),
            "costAssumption": self._backtest_cost_assumption(),
        }

    def _execution_score_for_index(
        self,
        closes: list[float],
        index: int,
        row: dict[str, Any] | None = None,
        *,
        avg_amount_20d: float | None = None,
    ) -> float:
        snapshot = self._build_trend_snapshot(closes, index)
        row_context = self._build_row_context(row or {})
        liquidity_profile = self._build_liquidity_profile(row_context, avg_amount_20d=avg_amount_20d)
        score, _ = self._compose_execution_score(
            snapshot,
            row_context,
            liquidity_profile,
            self._merge_position_profiles(liquidity_profile, self._build_execution_risk_profile(snapshot, row_context)),
        )
        return score

    @staticmethod
    def _position_from_score(score: float) -> float:
        if score >= FULL_POSITION_THRESHOLD:
            return 1.0
        if score >= HALF_POSITION_THRESHOLD:
            return 0.65
        if score >= PROBE_POSITION_THRESHOLD:
            return 0.35
        return 0.0

    @staticmethod
    def _position_from_signal_score(score: float, position_cap: float) -> float:
        return min(StrategyEngine._position_from_score(score), max(0.0, min(position_cap, 1.0)))

    @staticmethod
    def _transaction_cost_rate(current_position: float, target_position: float) -> float:
        turnover = abs(target_position - current_position)
        sell_turnover = max(current_position - target_position, 0.0)
        return turnover * (BACKTEST_COMMISSION_RATE + BACKTEST_SLIPPAGE_RATE) + sell_turnover * BACKTEST_SELL_TAX_RATE

    @staticmethod
    def _backtest_cost_assumption() -> str:
        commission_pct = BACKTEST_COMMISSION_RATE * 100
        slippage_pct = BACKTEST_SLIPPAGE_RATE * 100
        sell_tax_pct = BACKTEST_SELL_TAX_RATE * 100
        return f"回测按单边手续费 {commission_pct:.02f}% 、滑点 {slippage_pct:.02f}% 估算，减仓部分额外计入 {sell_tax_pct:.02f}% 卖出税费。"

    def _similarity_features(self, closes: list[float], index: int) -> dict[str, float]:
        return {
            "ret20": self._return_between(closes, index, 20),
            "ret60": self._return_between(closes, index, 60),
            "ret120": self._return_between(closes, index, 120),
            "gap20": self._safe_ratio(closes[index], self._average_window(closes, index, 20)) - 1,
            "gap60": self._safe_ratio(closes[index], self._average_window(closes, index, 60)) - 1,
            "vol20": self._annualized_volatility(closes, index, 20),
        }

    @staticmethod
    def _feature_distance(current: dict[str, float], historical: dict[str, float]) -> float:
        return (
            abs(current["ret20"] - historical["ret20"]) * 8.0
            + abs(current["ret60"] - historical["ret60"]) * 5.5
            + abs(current["ret120"] - historical["ret120"]) * 4.0
            + abs(current["gap20"] - historical["gap20"]) * 7.0
            + abs(current["gap60"] - historical["gap60"]) * 5.0
            + abs(current["vol20"] - historical["vol20"]) * 1.8
        )

    @staticmethod
    def _weighted_mean(values: list[tuple[float, float]]) -> float:
        total_weight = sum(weight for _, weight in values)
        if total_weight <= 0:
            return 0.0
        return sum(value * weight for value, weight in values) / total_weight

    @staticmethod
    def _weighted_stddev(values: list[tuple[float, float]], mean_value: float) -> float:
        total_weight = sum(weight for _, weight in values)
        if total_weight <= 0:
            return 0.0
        variance = sum(weight * (value - mean_value) ** 2 for value, weight in values) / total_weight
        return math.sqrt(max(variance, 0.0))

    @staticmethod
    def _weighted_win_rate(values: list[tuple[float, float]]) -> float:
        total_weight = sum(weight for _, weight in values)
        if total_weight <= 0:
            return 0.0
        win_weight = sum(weight for value, weight in values if value >= 0)
        return win_weight / total_weight

    def _factor(
        self,
        label: str,
        value: float,
        detail: str,
        *,
        value_as_percent: bool = True,
    ) -> dict[str, str]:
        tone = "positive" if value > 0 else "negative" if value < 0 else "neutral"
        if value_as_percent:
            formatted_value = f"{value * 100:+.2f}%"
        else:
            formatted_value = f"{value:.2f}"
        return {
            "label": label,
            "value": formatted_value,
            "tone": tone,
            "detail": detail,
        }

    def _forecast_return_for_days(self, forecast: dict[str, Any], days: int) -> float | None:
        for item in forecast.get("horizons", []):
            if int(item.get("days") or 0) == days:
                return float(item.get("expectedReturnPct") or 0) / 100
        return None

    def _forecast_win_rate_for_days(self, forecast: dict[str, Any], days: int) -> float | None:
        for item in forecast.get("horizons", []):
            if int(item.get("days") or 0) == days:
                return float(item.get("winRatePct") or 0) / 100
        return None

    def _build_long_term_strategies(
        self,
        trend_snapshot: dict[str, float | bool],
        forecast: dict[str, Any],
        backtest: dict[str, Any],
        context: dict[str, float | None],
        position_profile: dict[str, float | str | None],
    ) -> list[dict[str, Any]]:
        latest_close = float(trend_snapshot["latestClose"])
        ma250 = float(trend_snapshot["ma250"])
        ret250 = float(trend_snapshot["ret250"])
        vol60 = float(trend_snapshot["vol60"])
        forecast60 = self._forecast_return_for_days(forecast, 60)
        roe = context.get("roe")
        revenue_yoy = context.get("revenue_yoy")
        profit_yoy = context.get("profit_yoy")
        debt_to_assets = context.get("debt_to_assets")
        pe_ttm = context.get("pe_ttm")
        pb = context.get("pb")
        gross_margin = context.get("gross_margin")
        liquidity_score = self._to_number(position_profile.get("liquidityScore"))
        liquidity_tier = str(position_profile.get("liquidityTier") or "E")
        position_cap = float(position_profile.get("positionCap") or 0.0)

        cards = [
            self._strategy_card(
                "secular-trend",
                "Secular trend follower",
                "Long-term trend",
                "9-18 months",
                self._score_card(
                    bool(trend_snapshot["aboveMa250"]),
                    bool(trend_snapshot["maSecularBullish"]),
                    ret250 > 0.12,
                    (forecast60 or 0) > 0.04,
                    position_cap >= 0.65,
                ),
                "Best when the stock stays above its long-term trend and the medium-to-long moving averages keep rising.",
                [
                    self._metric("Price vs MA250", self._format_ratio(self._safe_ratio(latest_close, ma250) - 1)),
                    self._metric("250-bar return", self._format_ratio(ret250)),
                    self._metric("60-day forecast", self._format_ratio(forecast60)),
                    self._metric("Volatility", self._format_percent(vol60 * 100), "neutral"),
                    self._metric("Execution capacity", f"{liquidity_tier} / {int(round(position_cap * 100))}%", "neutral"),
                ],
            ),
            self._strategy_card(
                "quality-compounder",
                "Quality compounder",
                "Long-term quality",
                "1-3 years",
                self._score_card(
                    (roe or 0) >= 12,
                    (revenue_yoy or 0) >= 10,
                    (profit_yoy or 0) >= 10,
                    (debt_to_assets or 100) <= 60,
                    (gross_margin or 0) >= 25,
                    (liquidity_score or 0) >= 55,
                ),
                "Looks for companies that can sustain multi-quarter growth without relying on excessive leverage.",
                [
                    self._metric("ROE", self._format_percent(roe)),
                    self._metric("Revenue YoY", self._format_percent(revenue_yoy)),
                    self._metric("Profit YoY", self._format_percent(profit_yoy)),
                    self._metric("Debt/assets", self._format_percent(debt_to_assets), "neutral"),
                    self._metric("Execution capacity", f"{liquidity_tier} / {int(round(position_cap * 100))}%", "neutral"),
                ],
            ),
            self._strategy_card(
                "value-rerating",
                "Value re-rating",
                "Long-term value",
                "6-18 months",
                self._score_card(
                    pe_ttm is not None and pe_ttm <= 22,
                    pb is not None and pb <= 2.8,
                    (roe or 0) >= 8,
                    (profit_yoy or 0) > 0,
                    (forecast60 or 0) > 0,
                    position_cap >= 0.65,
                ),
                "Focuses on stocks that are not expensive on basic valuation metrics while fundamentals begin to improve.",
                [
                    self._metric("PE TTM", self._format_number(pe_ttm), "neutral"),
                    self._metric("PB", self._format_number(pb), "neutral"),
                    self._metric("ROE", self._format_percent(roe)),
                    self._metric("60-day forecast", self._format_ratio(forecast60)),
                    self._metric("Execution capacity", f"{liquidity_tier} / {int(round(position_cap * 100))}%", "neutral"),
                ],
            ),
            self._strategy_card(
                "low-vol-holder",
                "Low-vol trend holder",
                "Long-term defense",
                "9-24 months",
                self._score_card(
                    bool(trend_snapshot["aboveMa120"]),
                    bool(trend_snapshot["aboveMa250"]),
                    vol60 <= 0.32,
                    abs(float(backtest.get("maxDrawdownPct") or 0)) <= 25,
                    (forecast60 or 0) >= 0,
                    position_cap >= 0.65,
                ),
                "Designed for calmer long-term trends where drawdowns and volatility stay more manageable.",
                [
                    self._metric("Volatility", self._format_percent(vol60 * 100), "neutral"),
                    self._metric("Backtest drawdown", self._format_signed_percent(-abs(float(backtest.get("maxDrawdownPct") or 0))), "negative"),
                    self._metric("Annual return", self._format_signed_percent(float(backtest.get("annualReturnPct") or 0))),
                    self._metric("Long range pos.", self._format_percent(float(trend_snapshot["longRangePosition"]) * 100), "neutral"),
                    self._metric("Execution capacity", f"{liquidity_tier} / {int(round(position_cap * 100))}%", "neutral"),
                ],
            ),
        ]
        return cards

    def _build_stock_picker_strategies(
        self,
        trend_snapshot: dict[str, float | bool],
        forecast: dict[str, Any],
        context: dict[str, float | None],
        position_profile: dict[str, float | str | None],
    ) -> list[dict[str, Any]]:
        forecast20 = self._forecast_return_for_days(forecast, 20)
        forecast60 = self._forecast_return_for_days(forecast, 60)
        volume_ratio = context.get("volume_ratio")
        turnover_rate = context.get("turnover_rate")
        net_mf_amount = context.get("net_mf_amount")
        roe = context.get("roe")
        revenue_yoy = context.get("revenue_yoy")
        profit_yoy = context.get("profit_yoy")
        ocfps = context.get("ocfps")
        pe_ttm = context.get("pe_ttm")
        pb = context.get("pb")
        gross_margin = context.get("gross_margin")
        liquidity_score = self._to_number(position_profile.get("liquidityScore"))
        position_cap = float(position_profile.get("positionCap") or 0.0)
        liquidity_tier = str(position_profile.get("liquidityTier") or "E")

        return [
            self._strategy_card(
                "trend-leader",
                "Trend leader screener",
                "Stock picking",
                "Swing to position",
                self._score_card(
                    bool(trend_snapshot["aboveMa60"]),
                    bool(trend_snapshot["aboveMa120"]),
                    bool(trend_snapshot["nearBreakout"]),
                    (volume_ratio or 0) >= 1.0,
                    (forecast20 or 0) > 0.02,
                    (liquidity_score or 0) >= 55,
                ),
                "Chooses symbols already leading the tape instead of trying to catch weak rebounds.",
                [
                    self._metric("20-day forecast", self._format_ratio(forecast20)),
                    self._metric("Volume ratio", self._format_number(volume_ratio), "neutral"),
                    self._metric("Range position", self._format_percent(float(trend_snapshot["rangePosition"]) * 100), "neutral"),
                    self._metric("Near breakout", "Yes" if bool(trend_snapshot["nearBreakout"]) else "No", "neutral"),
                    self._metric("Execution capacity", f"{liquidity_tier} / {int(round(position_cap * 100))}%", "neutral"),
                ],
            ),
            self._strategy_card(
                "quality-growth",
                "Quality growth screener",
                "Stock picking",
                "Quarterly re-rating",
                self._score_card(
                    (roe or 0) >= 12,
                    (gross_margin or 0) >= 25,
                    (revenue_yoy or 0) >= 12,
                    (profit_yoy or 0) >= 12,
                    (ocfps or 0) > 0,
                    position_cap >= 0.65,
                ),
                "Favors growth names where profitability and operating cash generation improve together.",
                [
                    self._metric("ROE", self._format_percent(roe)),
                    self._metric("Gross margin", self._format_percent(gross_margin)),
                    self._metric("Revenue YoY", self._format_percent(revenue_yoy)),
                    self._metric("OCF/share", self._format_number(ocfps), "neutral"),
                    self._metric("Execution capacity", f"{liquidity_tier} / {int(round(position_cap * 100))}%", "neutral"),
                ],
            ),
            self._strategy_card(
                "value-recovery",
                "Value recovery screener",
                "Stock picking",
                "Mean reversion",
                self._score_card(
                    pe_ttm is not None and pe_ttm <= 18,
                    pb is not None and pb <= 2.2,
                    (profit_yoy or 0) > 0,
                    bool(trend_snapshot["aboveMa60"]),
                    (forecast60 or 0) > 0.03,
                    (liquidity_score or 0) >= 45,
                ),
                "Looks for cheaper stocks where the earnings trend has already stopped deteriorating.",
                [
                    self._metric("PE TTM", self._format_number(pe_ttm), "neutral"),
                    self._metric("PB", self._format_number(pb), "neutral"),
                    self._metric("Profit YoY", self._format_percent(profit_yoy)),
                    self._metric("60-day forecast", self._format_ratio(forecast60)),
                    self._metric("Execution capacity", f"{liquidity_tier} / {int(round(position_cap * 100))}%", "neutral"),
                ],
            ),
            self._strategy_card(
                "capital-flow-breakout",
                "Capital-flow breakout",
                "Stock picking",
                "Event driven",
                self._score_card(
                    (net_mf_amount or 0) > 0,
                    (turnover_rate or 0) >= 2.5,
                    (volume_ratio or 0) >= 1.2,
                    bool(trend_snapshot["nearBreakout"]),
                    (forecast20 or 0) > 0.015,
                    position_cap >= 0.65,
                ),
                "Combines money-flow participation with turnover expansion to find potential breakout candidates.",
                [
                    self._metric("Net money flow", self._format_large_amount(net_mf_amount)),
                    self._metric("Turnover", self._format_percent(turnover_rate)),
                    self._metric("Volume ratio", self._format_number(volume_ratio), "neutral"),
                    self._metric("20-day forecast", self._format_ratio(forecast20)),
                    self._metric("Execution capacity", f"{liquidity_tier} / {int(round(position_cap * 100))}%", "neutral"),
                ],
            ),
        ]

    def _build_database_context(self, database_bundle: dict[str, Any], latest_row: dict[str, Any] | None = None) -> dict[str, float | None]:
        financials = database_bundle.get("financials") or {}
        raw_datasets = database_bundle.get("rawDatasets") or {}
        fina_payload = self._parse_record_payload(financials.get("finaIndicator"))
        daily_payload = self._parse_record_payload(raw_datasets.get("dailyBasic"))
        moneyflow_payload = self._parse_record_payload(raw_datasets.get("moneyflow"))
        latest = latest_row or {}

        return {
            "roe": self._to_number(self._pick_value(fina_payload, "roe", "roe_yearly")),
            "revenue_yoy": self._to_number(self._pick_value(fina_payload, "or_yoy", "tr_yoy")),
            "profit_yoy": self._to_number(self._pick_value(fina_payload, "netprofit_yoy", "dt_netprofit_yoy")),
            "debt_to_assets": self._to_number(self._pick_value(fina_payload, "debt_to_assets")),
            "gross_margin": self._to_number(self._pick_value(fina_payload, "grossprofit_margin")),
            "ocfps": self._to_number(self._pick_value(fina_payload, "ocfps")),
            "pe_ttm": self._coalesce_number(self._pick_value(daily_payload, "pe_ttm", "pe"), latest.get("pe_ttm")),
            "pb": self._coalesce_number(self._pick_value(daily_payload, "pb"), latest.get("pb")),
            "turnover_rate": self._coalesce_number(
                self._pick_value(daily_payload, "turnover_rate", "turnover_rate_f"),
                latest.get("turnover_rate"),
            ),
            "volume_ratio": self._coalesce_number(self._pick_value(daily_payload, "volume_ratio"), latest.get("volume_ratio")),
            "net_mf_amount": self._to_number(self._pick_value(moneyflow_payload, "net_mf_amount")),
        }

    def _build_row_context(self, row: dict[str, Any]) -> dict[str, float | None]:
        return {
            "amount": self._to_number(row.get("amount")),
            "turnover_rate": self._to_number(row.get("turnover_rate")),
            "volume_ratio": self._to_number(row.get("volume_ratio")),
            "float_market_cap": self._to_number(row.get("float_market_cap")),
            "total_market_cap": self._to_number(row.get("total_market_cap")),
            "pe_ttm": self._to_number(row.get("pe_ttm")),
            "pb": self._to_number(row.get("pb")),
        }

    def _build_liquidity_profile(
        self,
        row_context: dict[str, float | None],
        *,
        avg_amount_20d: float | None,
    ) -> dict[str, float | str | None]:
        latest_amount = row_context.get("amount")
        float_market_cap = row_context.get("float_market_cap")
        turnover_rate = row_context.get("turnover_rate")
        volume_ratio = row_context.get("volume_ratio")

        avg_component = min(max((avg_amount_20d or 0.0) / 600000.0, 0.0), 1.0) * 35
        latest_component = min(max((latest_amount or 0.0) / 300000.0, 0.0), 1.0) * 25
        market_cap_component = min(max((float_market_cap or 0.0) / 1000000.0, 0.0), 1.0) * 20
        turnover_component = min(max((turnover_rate or 0.0) / 3.0, 0.0), 1.0) * 10
        volume_component = min(max((volume_ratio or 0.0) / 1.5, 0.0), 1.0) * 10
        liquidity_score = round(
            avg_component + latest_component + market_cap_component + turnover_component + volume_component,
            2,
        )
        position_cap = self._position_cap_from_liquidity(
            avg_amount_20d=avg_amount_20d,
            latest_amount=latest_amount,
            float_market_cap=float_market_cap,
            liquidity_score=liquidity_score,
        )
        if position_cap <= 0:
            cap_reason = "Liquidity gate blocked new exposure because turnover or float size is too small."
        elif position_cap <= 0.35:
            cap_reason = "Liquidity gate allows only a starter position until turnover and float size improve."
        elif position_cap < 1.0:
            cap_reason = "Liquidity gate trims the target position until trading depth improves."
        else:
            cap_reason = ""

        return {
            "avgAmount20d": avg_amount_20d,
            "liquidityScore": liquidity_score,
            "liquidityTier": self._liquidity_tier(liquidity_score),
            "positionCap": position_cap,
            "capReason": cap_reason,
        }

    def _build_execution_risk_profile(
        self,
        trend_snapshot: dict[str, float | bool],
        row_context: dict[str, float | None],
    ) -> dict[str, float | str | None]:
        latest_close = float(trend_snapshot["latestClose"])
        ma20 = float(trend_snapshot["ma20"])
        ma60 = float(trend_snapshot["ma60"])
        vol20 = float(trend_snapshot["vol20"])
        range_position = float(trend_snapshot["rangePosition"]) * 100
        price_vs_ma20 = self._safe_ratio(latest_close, ma20) - 1
        price_vs_ma60 = self._safe_ratio(latest_close, ma60) - 1
        drawdown_from_high60 = float(trend_snapshot["drawdownFromHigh60"])
        trend_efficiency20 = float(trend_snapshot["trendEfficiency20"])
        trend_efficiency60 = float(trend_snapshot["trendEfficiency60"])
        turnover_rate = row_context.get("turnover_rate") or 0.0
        volume_ratio = row_context.get("volume_ratio") or 0.0

        risk_budget_cap = 1.0
        risk_budget_tier = "OPEN"
        cap_reason = ""

        if (
            vol20 >= 0.5
            or price_vs_ma20 >= 0.18
            or (range_position >= 95 and turnover_rate >= 8.0)
            or (trend_efficiency20 <= 0.12 and drawdown_from_high60 <= -0.15)
        ):
            risk_budget_cap = 0.35
            risk_budget_tier = "TIGHT"
            cap_reason = "Risk budget cut the position to a starter size because volatility, price extension, or trend damage is elevated."
        elif (
            vol20 >= 0.42
            or price_vs_ma20 >= 0.12
            or turnover_rate >= 12.0
            or (range_position >= 88 and volume_ratio <= 0.85)
            or price_vs_ma60 >= 0.22
            or (trend_efficiency20 <= 0.18 and trend_efficiency60 <= 0.22)
            or (range_position >= 92 and volume_ratio <= 0.9)
        ):
            risk_budget_cap = 0.65
            risk_budget_tier = "BALANCED"
            cap_reason = "Risk budget trimmed the position because volatility, extension, breakout quality, or crowding is elevated."

        return {
            "riskBudgetCap": risk_budget_cap,
            "riskBudgetTier": risk_budget_tier,
            "capReason": cap_reason,
        }

    def _merge_position_profiles(
        self,
        liquidity_profile: dict[str, float | str | None],
        risk_budget_profile: dict[str, float | str | None],
    ) -> dict[str, float | str | None]:
        liquidity_cap = float(liquidity_profile.get("positionCap") or 1.0)
        risk_budget_cap = float(risk_budget_profile.get("riskBudgetCap") or 1.0)
        position_cap = min(liquidity_cap, risk_budget_cap)
        reasons = [
            str(item).strip()
            for item in (liquidity_profile.get("capReason"), risk_budget_profile.get("capReason"))
            if isinstance(item, str) and str(item).strip()
        ]
        return {
            **liquidity_profile,
            **risk_budget_profile,
            "liquidityCap": liquidity_cap,
            "positionCap": position_cap,
            "capReason": " ".join(reasons),
        }

    def _position_cap_from_liquidity(
        self,
        *,
        avg_amount_20d: float | None,
        latest_amount: float | None,
        float_market_cap: float | None,
        liquidity_score: float,
    ) -> float:
        if self._below_any_threshold(
            (
                (avg_amount_20d, 50000.0),
                (latest_amount, 30000.0),
                (float_market_cap, 120000.0),
            )
        ):
            return 0.0
        if self._below_any_threshold(
            (
                (avg_amount_20d, 150000.0),
                (latest_amount, 80000.0),
                (float_market_cap, 250000.0),
            )
        ):
            return 0.35
        if self._below_any_threshold(
            (
                (avg_amount_20d, 300000.0),
                (latest_amount, 150000.0),
                (float_market_cap, 500000.0),
            )
        ):
            return 0.65
        if liquidity_score < 55:
            return 0.65
        return 1.0

    @staticmethod
    def _below_any_threshold(items: tuple[tuple[float | None, float], ...]) -> bool:
        return any(value is not None and value < threshold for value, threshold in items)

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

    def _average_amount_window(self, rows: list[dict[str, Any]], index: int, window: int) -> float | None:
        if not rows or index < 0:
            return None
        start_index = max(0, index - window + 1)
        values = [
            self._to_number(rows[offset].get("amount"))
            for offset in range(start_index, index + 1)
            if self._to_number(rows[offset].get("amount")) is not None
        ]
        if not values:
            return None
        return round(sum(values) / len(values), 2)

    @staticmethod
    def _trend_efficiency(values: list[float], index: int, length: int) -> float:
        start = max(1, index - length + 1)
        window = values[start : index + 1]
        if len(window) < 2:
            return 0.0
        net_move = abs(StrategyEngine._safe_ratio(window[-1], window[0]) - 1)
        path_move = 0.0
        for position in range(1, len(window)):
            previous = window[position - 1]
            current = window[position]
            if previous > 0:
                path_move += abs(StrategyEngine._safe_ratio(current, previous) - 1)
        if path_move <= 0:
            return 0.0
        return round(min(1.0, net_move / path_move), 4)

    def _analysis_cache_key(
        self,
        rows: list[dict[str, Any]],
        symbol: str,
        name: str,
        *,
        database_bundle: dict[str, Any] | None,
        automation_enabled: bool,
        manual_override: str | None,
    ) -> tuple[str, str, str, str, bool, str | None]:
        return (
            symbol,
            name,
            self._rows_signature(rows),
            self._database_bundle_signature(database_bundle or {}),
            automation_enabled,
            manual_override,
        )

    def _write_analysis_cache(self, cache_key: tuple[str, str, str, str, bool, str | None], value: dict[str, Any]) -> None:
        ttl_seconds = settings.strategy_analysis_cache_ttl_seconds
        if ttl_seconds <= 0:
            self.analysis_cache.pop(cache_key, None)
            return
        self.analysis_cache[cache_key] = (time.monotonic() + ttl_seconds, value)
        self._prune_analysis_cache()

    def _prune_analysis_cache(self) -> None:
        now = time.monotonic()
        expired_keys = [key for key, (expires_at, _) in self.analysis_cache.items() if expires_at <= now]
        for key in expired_keys:
            self.analysis_cache.pop(key, None)

    def _rows_signature(self, rows: list[dict[str, Any]]) -> str:
        if not rows:
            return "empty"

        latest = rows[-1]
        hasher = hashlib.sha1()
        for row in rows:
            hasher.update(str(row.get("trade_date") or "").encode("utf-8", errors="ignore"))
            hasher.update(b"|")
            hasher.update(f"{to_float(row.get('close'), 4):.4f}".encode("utf-8"))
            hasher.update(b";")

        latest_context_values = (
            latest.get("turnover_rate"),
            latest.get("volume_ratio"),
            latest.get("pe_ttm"),
            latest.get("pb"),
        )
        for value in latest_context_values:
            hasher.update(f"{self._to_number(value) if value is not None else ''}|".encode("utf-8"))

        return hasher.hexdigest()

    def _database_bundle_signature(self, database_bundle: dict[str, Any]) -> str:
        financials = database_bundle.get("financials") or {}
        raw_datasets = database_bundle.get("rawDatasets") or {}
        hasher = hashlib.sha1()
        for record in (
            financials.get("finaIndicator"),
            raw_datasets.get("dailyBasic"),
            raw_datasets.get("moneyflow"),
        ):
            if not record:
                hasher.update(b"none;")
                continue
            for key in ("update_time", "trade_date", "end_date", "ann_date", "raw_json"):
                hasher.update(str(record.get(key) or "").encode("utf-8", errors="ignore"))
                hasher.update(b"|")
            hasher.update(b";")
        return hasher.hexdigest()

    def _strategy_card(
        self,
        strategy_id: str,
        name: str,
        category: str,
        horizon: str,
        fit_score: int,
        summary: str,
        metrics: list[dict[str, str]],
    ) -> dict[str, Any]:
        signal = "PASS" if fit_score >= 75 else "WATCH" if fit_score >= 50 else "AVOID"
        return {
            "id": strategy_id,
            "name": name,
            "category": category,
            "horizon": horizon,
            "signal": signal,
            "fitScore": fit_score,
            "summary": summary,
            "metrics": metrics,
        }

    @staticmethod
    def _score_card(*checks: bool) -> int:
        if not checks:
            return 0
        passed = sum(1 for item in checks if item)
        return int(round(passed / len(checks) * 100))

    @staticmethod
    def _metric(label: str, value: str | None, tone: str | None = None) -> dict[str, str]:
        return {
            "label": label,
            "value": value or "-",
            "tone": tone or ("positive" if value and value.startswith("+") else "negative" if value and value.startswith("-") else "neutral"),
        }

    @staticmethod
    def _parse_record_payload(record: dict[str, Any] | None) -> dict[str, Any]:
        if not record:
            return {}
        raw_json = record.get("raw_json")
        if not raw_json:
            return {}
        try:
            parsed = json.loads(str(raw_json))
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}

    @staticmethod
    def _pick_value(payload: dict[str, Any], *keys: str) -> Any:
        for key in keys:
            value = payload.get(key)
            if value in (None, "", "NaN", "nan", "None", "null"):
                continue
            return value
        return None

    @staticmethod
    def _to_number(value: Any) -> float | None:
        if value in (None, ""):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _coalesce_number(*values: Any) -> float | None:
        for value in values:
            numeric = StrategyEngine._to_number(value)
            if numeric is not None:
                return numeric
        return None

    @staticmethod
    def _format_number(value: float | None, digits: int = 2) -> str | None:
        if value is None:
            return None
        return f"{value:.{digits}f}"

    @staticmethod
    def _format_percent(value: float | None, digits: int = 2) -> str | None:
        if value is None:
            return None
        return f"{value:+.{digits}f}%"

    @staticmethod
    def _format_ratio(value: float | None, digits: int = 2) -> str | None:
        if value is None:
            return None
        return f"{value * 100:+.{digits}f}%"

    @staticmethod
    def _format_signed_percent(value: float | None, digits: int = 2) -> str | None:
        if value is None:
            return None
        return f"{value:+.{digits}f}%"

    @staticmethod
    def _format_large_amount(value: float | None) -> str | None:
        if value is None:
            return None
        absolute = abs(value)
        if absolute >= 1_0000_0000:
            return f"{value / 1_0000_0000:+.2f}B"
        if absolute >= 1_0000:
            return f"{value / 1_0000:+.2f}W"
        return f"{value:+.2f}"

    def _signal(
        self,
        market: str,
        action: str,
        symbol: str,
        name: str,
        position_pct: int,
        reason: str,
    ) -> dict[str, Any]:
        return {
            "market": market,
            "action": action,
            "etf": symbol,
            "name": name,
            "positionPct": position_pct,
            "reason": reason,
        }

    def _empty_analysis(self) -> dict[str, Any]:
        return {
            "executionScore": 0,
            "score": 0,
            "stance": "Unavailable",
            "riskLevel": "Unknown",
            "avgAmount20d": None,
            "liquidityScore": 0,
            "liquidityTier": "E",
            "riskBudgetTier": "OPEN",
            "riskBudgetCapPct": 0,
            "liquidityCapPct": 0,
            "positionCapPct": 0,
            "summary": "No strategy analysis is available yet.",
            "factors": [],
            "longTermStrategies": [],
            "stockPickers": [],
            "forecast": {
                "method": "Historical analog windows",
                "sampleSize": 0,
                "lookbackBars": 0,
                "latestTradeDate": "",
                "confidencePct": 0,
                "direction": "INSUFFICIENT",
                "summary": "No historical forecast is available yet.",
                "horizons": [],
                "band": {"lowerPrice": 0, "upperPrice": 0},
            },
            "backtest": {
                "startDate": "",
                "endDate": "",
                "years": 0,
                "trades": 0,
                "winRatePct": 0,
                "annualReturnPct": 0,
                "totalReturnPct": 0,
                "benchmarkReturnPct": 0,
                "excessReturnPct": 0,
                "maxDrawdownPct": 0,
                "sharpe": 0,
                "latestPositionPct": 0,
                "turnoverPct": 0,
                "tradingCostPct": 0,
                "costAssumption": self._backtest_cost_assumption(),
            },
            "disclaimer": "History-based statistical analysis only. It is for research reference, not investment advice.",
        }

    def _empty_backtest(self, rows: list[dict[str, Any]]) -> dict[str, Any]:
        latest_date = format_date(rows[-1].get("trade_date")) if rows else ""
        return {
            "startDate": latest_date,
            "endDate": latest_date,
            "years": 0,
            "trades": 0,
            "winRatePct": 0,
            "annualReturnPct": 0,
            "totalReturnPct": 0,
            "benchmarkReturnPct": 0,
            "excessReturnPct": 0,
            "maxDrawdownPct": 0,
            "sharpe": 0,
            "latestPositionPct": 0,
            "turnoverPct": 0,
            "tradingCostPct": 0,
            "costAssumption": self._backtest_cost_assumption(),
        }

    @staticmethod
    def _return_between(values: list[float], index: int, length: int) -> float:
        start = max(0, index - length)
        start_value = values[start]
        current_value = values[index]
        return StrategyEngine._safe_ratio(current_value, start_value) - 1

    @staticmethod
    def _average_window(values: list[float], index: int, length: int) -> float:
        start = max(0, index - length + 1)
        window = values[start : index + 1]
        return sum(window) / max(1, len(window))

    @staticmethod
    def _window_high(values: list[float], index: int, length: int) -> float:
        start = max(0, index - length + 1)
        return max(values[start : index + 1])

    @staticmethod
    def _window_low(values: list[float], index: int, length: int) -> float:
        start = max(0, index - length + 1)
        return min(values[start : index + 1])

    @staticmethod
    def _annualized_volatility(values: list[float], index: int, length: int) -> float:
        start = max(1, index - length + 1)
        returns = [
            StrategyEngine._safe_ratio(values[position], values[position - 1]) - 1
            for position in range(start, index + 1)
            if values[position - 1] > 0
        ]
        if len(returns) < 2:
            return 0.0
        mean_value = sum(returns) / len(returns)
        variance = sum((item - mean_value) ** 2 for item in returns) / len(returns)
        return math.sqrt(max(variance, 0.0)) * math.sqrt(252)

    @staticmethod
    def _annualized_return(nav: float, days: int) -> float:
        if nav <= 0 or days <= 0:
            return 0.0
        return nav ** (252 / days) - 1

    @staticmethod
    def _annualized_sharpe(daily_returns: list[float]) -> float:
        if len(daily_returns) < 2:
            return 0.0
        mean_value = sum(daily_returns) / len(daily_returns)
        variance = sum((item - mean_value) ** 2 for item in daily_returns) / len(daily_returns)
        stddev = math.sqrt(max(variance, 0.0))
        if stddev <= 1e-9:
            return 0.0
        return mean_value / stddev * math.sqrt(252)

    @staticmethod
    def _max_drawdown(equity_curve: list[float]) -> float:
        peak = equity_curve[0] if equity_curve else 1.0
        max_drawdown = 0.0
        for value in equity_curve:
            peak = max(peak, value)
            if peak <= 0:
                continue
            drawdown = 1 - (value / peak)
            max_drawdown = max(max_drawdown, drawdown)
        return max_drawdown

    @staticmethod
    def _safe_ratio(numerator: float, denominator: float) -> float:
        if denominator == 0:
            return 0.0
        return numerator / denominator


strategy_engine = StrategyEngine()
