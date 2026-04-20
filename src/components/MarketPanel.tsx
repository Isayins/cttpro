import React, { useMemo, useState } from "react";
import type { CandlePoint, EquityPoint, MarketSnapshot, StockItem } from "../types/type";
import { Card, CardContent } from "./ui";
import EquityChart from "./EquityChart";
import KLineChart, { type OverlayMode, type SubChartMode } from "./KLineChart";
import MacdChart from "./MacdChart";
import StockSelectorPanel from "./StockSelectorPanel";
import StrategyPanel from "./StrategyPanel";

interface MarketPanelProps {
  snapshot: MarketSnapshot | null;
  connected: boolean;
  error: string | null;
  busy: boolean;
  onBuy: () => Promise<void>;
  onSell: () => Promise<void>;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  message: string;
  stocks: StockItem[];
  stocksLoading: boolean;
  stocksError: string;
  selectedSymbol: string;
  selectedRange: string;
  rangeOptions: ReadonlyArray<{ key: string; label: string }>;
  onSelectSymbol: (symbol: string) => void;
  onSelectRange: (range: string) => void;
}

function formatCompactNumber(value?: number, digits = 2) {
  if (value === undefined || value === null) {
    return "-";
  }
  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: digits,
  }).format(value);
}

function sortCandlesByTime(candles: CandlePoint[]) {
  return [...candles].sort((left, right) => String(left.time).localeCompare(String(right.time)));
}

function computeCandleStats(candles: CandlePoint[]) {
  if (candles.length === 0) {
    return null;
  }

  const latest = candles[candles.length - 1];
  let periodHigh = candles[0].high;
  let periodLow = candles[0].low;

  for (const candle of candles) {
    periodHigh = Math.max(periodHigh, candle.high);
    periodLow = Math.min(periodLow, candle.low);
  }

  return {
    latest,
    periodHigh,
    periodLow,
    amplitude: latest.close > 0 ? ((latest.high - latest.low) / latest.close) * 100 : 0,
  };
}

function computeReturnStats(candles: CandlePoint[]) {
  if (candles.length === 0) {
    return {
      curve: [] as EquityPoint[],
      totalReturnPct: 0,
      maxDrawdownPct: 0,
      startClose: 0,
      latestClose: 0,
    };
  }

  const firstClose = candles[0].close || 0;
  let peakNav = 1;
  let maxDrawdownPct = 0;

  const curve = candles.map((candle) => {
    const nav = firstClose > 0 ? candle.close / firstClose : 0;
    peakNav = Math.max(peakNav, nav || 0);
    const drawdownPct = peakNav > 0 ? ((nav - peakNav) / peakNav) * 100 : 0;
    maxDrawdownPct = Math.min(maxDrawdownPct, drawdownPct);

    return {
      date: candle.time,
      value: Number((((nav || 0) - 1) * 100).toFixed(2)),
    };
  });

  return {
    curve,
    totalReturnPct: curve[curve.length - 1]?.value ?? 0,
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    startClose: firstClose,
    latestClose: candles[candles.length - 1]?.close ?? 0,
  };
}

function formatSignedPercent(value?: number) {
  if (value === undefined || value === null) {
    return "-";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export default function MarketPanel({
  snapshot,
  connected,
  error,
  busy,
  onBuy,
  onSell,
  onStart,
  onStop,
  message,
  stocks,
  stocksLoading,
  stocksError,
  selectedSymbol,
  selectedRange,
  rangeOptions,
  onSelectSymbol,
  onSelectRange,
}: MarketPanelProps) {
  const summary = snapshot?.summary;
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("ma");
  const [subChartMode, setSubChartMode] = useState<SubChartMode>("volume");
  const activeSymbol = snapshot?.symbol || selectedSymbol || "";

  const activeStock = useMemo(() => {
    if (!activeSymbol) {
      return null;
    }
    return stocks.find((item) => item.symbol === activeSymbol) ?? null;
  }, [activeSymbol, stocks]);
  const orderedCandles = useMemo(() => sortCandlesByTime(snapshot?.candles ?? []), [snapshot?.candles]);
  const candleStats = useMemo(() => computeCandleStats(orderedCandles), [orderedCandles]);
  const returnStats = useMemo(() => computeReturnStats(orderedCandles), [orderedCandles]);
  const latestSignal = snapshot?.signal;
  const latestChange = snapshot?.dailyChangePct ?? 0;

  return (
    <div className="page-stack stock-page-stack">
      {error ? (
        <Card>
          <CardContent>
            <div className="error-text">{error}</div>
          </CardContent>
        </Card>
      ) : null}

      {message ? (
        <Card>
          <CardContent>
            <div className="success-text">{message}</div>
          </CardContent>
        </Card>
      ) : null}

      {snapshot?.error ? (
        <Card>
          <CardContent>
            <div className="error-text">{snapshot.error}</div>
          </CardContent>
        </Card>
      ) : null}

      <section className="market-hero">
        <div className="market-hero-main">
          <div className="market-hero-kicker">Market Overview</div>
          <div className="market-hero-title-row">
            <h1 className="market-hero-title">{activeStock?.name || snapshot?.name || "未选择股票名称"}</h1>
            <span className={`market-status-pill ${connected ? "online" : "offline"}`}>
              {connected ? "实时在线" : "等待连接"}
            </span>
          </div>
          <div className="market-hero-meta">
            {activeStock?.symbol || snapshot?.symbol || "--"}
            {activeStock?.indexName ? ` · ${activeStock.indexName}` : ""}
            {activeStock?.exchange ? ` · ${activeStock.exchange}` : ""}
            {snapshot?.updatedAt ? ` · 更新于 ${snapshot.updatedAt}` : ""}
          </div>
          <div className="market-hero-price-row">
            <div className="market-price-block">
              <span className="market-price-label">最新价</span>
              <span className="market-price-value">{snapshot?.lastClose?.toFixed(3) ?? "-"}</span>
            </div>
            <div className={`market-change-block ${latestChange >= 0 ? "metric-positive" : "metric-negative"}`}>
              <span className="market-price-label">今日涨跌</span>
              <span className="market-price-value">{formatSignedPercent(latestChange)}</span>
            </div>
          </div>
        </div>

        <div className="market-hero-side">
          <div className="hero-signal-card">
            <span className="hero-signal-label">策略动作</span>
            <strong className="hero-signal-value">
              {latestSignal?.market ?? "--"} / {latestSignal?.action ?? "--"}
            </strong>
            <p className="hero-signal-copy">{latestSignal?.reason ?? "等待策略信号..."}</p>
          </div>
          <div className="hero-mini-stats">
            <div className="hero-mini-stat">
              <span>成交量</span>
              <strong>{formatCompactNumber(snapshot?.latestVolume, 1)}</strong>
            </div>
            <div className="hero-mini-stat">
              <span>成交额</span>
              <strong>{formatCompactNumber(snapshot?.latestAmount, 1)}</strong>
            </div>
            <div className="hero-mini-stat">
              <span>K线数量</span>
              <strong>{summary?.bars ?? "-"}</strong>
            </div>
            <div className="hero-mini-stat">
              <span>当前仓位</span>
              <strong>{latestSignal?.positionPct ?? "-"}%</strong>
            </div>
          </div>
        </div>
      </section>

      <StockSelectorPanel
        stocks={stocks}
        stocksLoading={stocksLoading}
        stocksError={stocksError}
        activeSymbol={activeSymbol}
        activeStock={activeStock}
        onSelectSymbol={onSelectSymbol}
      />

      <div className="metrics-grid stock-metrics-grid">
        <Card>
          <CardContent className="metric-card premium">
            <div className="metric-label">连接状态</div>
            <div className="metric-value">{connected ? "已连接" : "未连接"}</div>
            <div className="metric-footnote">行情代理与轮询刷新状态</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="metric-card premium">
            <div className="metric-label">区间涨跌</div>
            <div className={`metric-value ${returnStats.totalReturnPct >= 0 ? "metric-positive" : "metric-negative"}`}>
              {formatSignedPercent(returnStats.totalReturnPct)}
            </div>
            <div className="metric-footnote">按区间首日收盘价归一化</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="metric-card premium">
            <div className="metric-label">最大回撤</div>
            <div className="metric-value metric-negative">{formatSignedPercent(returnStats.maxDrawdownPct)}</div>
            <div className="metric-footnote">区间内相对峰值回撤</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="metric-card premium">
            <div className="metric-label">最新净值参考</div>
            <div className="metric-value">{summary?.nav !== undefined ? summary.nav.toFixed(4) : "-"}</div>
            <div className="metric-footnote">用于策略结果观察</div>
          </CardContent>
        </Card>
      </div>

      <StrategyPanel
        snapshot={snapshot}
        connected={connected}
        busy={busy}
        onBuy={onBuy}
        onSell={onSell}
        onStart={onStart}
        onStop={onStop}
      />

      <Card>
        <CardContent className="chart-card-content">
          <div className="section-head chart-section-head">
            <div>
              <div className="section-kicker">Price Action</div>
              <h2 className="section-title">行情 K 线</h2>
              <div className="muted">主图支持 MA / BOLL 切换，副图支持成交量 / 成交额切换，并带悬浮信息卡。</div>
            </div>
            <div className="chart-toolbar">
              <div className="range-switcher">
                {rangeOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`range-pill ${selectedRange === option.key ? "active" : ""}`}
                    onClick={() => onSelectRange(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="range-switcher">
                <button
                  type="button"
                  className={`range-pill ${overlayMode === "ma" ? "active" : ""}`}
                  onClick={() => setOverlayMode("ma")}
                >
                  MA
                </button>
                <button
                  type="button"
                  className={`range-pill ${overlayMode === "boll" ? "active" : ""}`}
                  onClick={() => setOverlayMode("boll")}
                >
                  BOLL
                </button>
                <button
                  type="button"
                  className={`range-pill ${subChartMode === "volume" ? "active" : ""}`}
                  onClick={() => setSubChartMode("volume")}
                >
                  成交量
                </button>
                <button
                  type="button"
                  className={`range-pill ${subChartMode === "amount" ? "active" : ""}`}
                  onClick={() => setSubChartMode("amount")}
                >
                  成交额
                </button>
              </div>
            </div>
          </div>

          {candleStats ? (
            <div className="kline-stats-grid kline-stats-grid-wide">
              <div className="kline-stat-card">
                <span className="kline-stat-label">开盘</span>
                <span className="kline-stat-value">{candleStats.latest.open.toFixed(3)}</span>
              </div>
              <div className="kline-stat-card">
                <span className="kline-stat-label">最高</span>
                <span className="kline-stat-value">{candleStats.latest.high.toFixed(3)}</span>
              </div>
              <div className="kline-stat-card">
                <span className="kline-stat-label">最低</span>
                <span className="kline-stat-value">{candleStats.latest.low.toFixed(3)}</span>
              </div>
              <div className="kline-stat-card">
                <span className="kline-stat-label">收盘</span>
                <span className="kline-stat-value">{candleStats.latest.close.toFixed(3)}</span>
              </div>
              <div className="kline-stat-card">
                <span className="kline-stat-label">成交量</span>
                <span className="kline-stat-value">{formatCompactNumber(candleStats.latest.volume, 1)}</span>
              </div>
              <div className="kline-stat-card">
                <span className="kline-stat-label">成交额</span>
                <span className="kline-stat-value">{formatCompactNumber(candleStats.latest.amount, 1)}</span>
              </div>
              <div className="kline-stat-card">
                <span className="kline-stat-label">振幅</span>
                <span className="kline-stat-value">{candleStats.amplitude.toFixed(2)}%</span>
              </div>
              <div className="kline-stat-card">
                <span className="kline-stat-label">区间最高</span>
                <span className="kline-stat-value">{candleStats.periodHigh.toFixed(3)}</span>
              </div>
              <div className="kline-stat-card">
                <span className="kline-stat-label">区间最低</span>
                <span className="kline-stat-value">{candleStats.periodLow.toFixed(3)}</span>
              </div>
            </div>
          ) : null}

          <KLineChart
            candles={orderedCandles}
            overlayMode={overlayMode}
            subChartMode={subChartMode}
          />
        </CardContent>
      </Card>

      <div className="analytics-grid">
        <Card>
          <CardContent className="chart-card-content">
            <div className="section-head chart-section-head">
              <div>
                <div className="section-kicker">Momentum</div>
                <h2 className="section-title">MACD 指标</h2>
                <div className="muted">显示 DIF、DEA 和 MACD 柱，便于观察趋势强弱与拐点。</div>
              </div>
            </div>

            <MacdChart candles={orderedCandles} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="chart-card-content">
            <div className="section-head chart-section-head">
              <div>
                <div className="section-kicker">Return Curve</div>
                <h2 className="section-title">区间收益走势</h2>
                <div className="muted">基于当前股票真实收盘价按区间首日归一化计算，展示累计涨跌，不再伪装成策略净值。</div>
              </div>
              <div className="badge">{summary?.bars ?? snapshot?.candles?.length ?? 0} 根 K 线</div>
            </div>

            <div className="return-stats-grid">
              <div className="return-stat-card">
                <span className="return-stat-label">起始收盘</span>
                <span className="return-stat-value">{returnStats.startClose ? returnStats.startClose.toFixed(3) : "-"}</span>
              </div>
              <div className="return-stat-card">
                <span className="return-stat-label">最新收盘</span>
                <span className="return-stat-value">{returnStats.latestClose ? returnStats.latestClose.toFixed(3) : "-"}</span>
              </div>
              <div className="return-stat-card">
                <span className={`return-stat-value ${returnStats.totalReturnPct >= 0 ? "metric-positive" : "metric-negative"}`}>
                  {formatSignedPercent(returnStats.totalReturnPct)}
                </span>
                <span className="return-stat-label">区间累计收益</span>
              </div>
              <div className="return-stat-card">
                <span className="return-stat-value metric-negative">{formatSignedPercent(returnStats.maxDrawdownPct)}</span>
                <span className="return-stat-label">区间最大回撤</span>
              </div>
            </div>

            <EquityChart equity={returnStats.curve} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
