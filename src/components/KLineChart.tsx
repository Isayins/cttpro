import { useEffect, useMemo, useRef } from "react";
import { CandlestickSeries, createChart, HistogramSeries, LineSeries } from "lightweight-charts";
import type { CandlePoint } from "../types/type";

export type OverlayMode = "ma" | "boll";
export type SubChartMode = "volume" | "amount";

function formatTime(time: string | number) {
  const str = String(time);
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }
  return str;
}

function normalizeCrosshairTime(time: unknown) {
  if (!time) {
    return "";
  }
  if (typeof time === "string") {
    return time;
  }
  if (typeof time === "object" && time && "year" in (time as Record<string, unknown>)) {
    const value = time as { year: number; month: number; day: number };
    return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
  }
  return String(time);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function buildMovingAverage(candles: CandlePoint[], period: number) {
  const values: Array<{ time: string; value: number }> = [];

  for (let index = 0; index < candles.length; index += 1) {
    if (index + 1 < period) {
      continue;
    }

    const slice = candles.slice(index + 1 - period, index + 1);
    const sum = slice.reduce((total, item) => total + item.close, 0);
    values.push({
      time: formatTime(candles[index].time),
      value: Number((sum / period).toFixed(4)),
    });
  }

  return values;
}

function buildBollinger(candles: CandlePoint[], period = 20, multiplier = 2) {
  const middle: Array<{ time: string; value: number }> = [];
  const upper: Array<{ time: string; value: number }> = [];
  const lower: Array<{ time: string; value: number }> = [];

  for (let index = 0; index < candles.length; index += 1) {
    if (index + 1 < period) {
      continue;
    }

    const slice = candles.slice(index + 1 - period, index + 1);
    const closes = slice.map((item) => item.close);
    const basis = average(closes);
    const deviation = standardDeviation(closes) * multiplier;
    const time = formatTime(candles[index].time);

    middle.push({ time, value: Number(basis.toFixed(4)) });
    upper.push({ time, value: Number((basis + deviation).toFixed(4)) });
    lower.push({ time, value: Number((basis - deviation).toFixed(4)) });
  }

  return { middle, upper, lower };
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

type Props = {
  candles: CandlePoint[];
  overlayMode: OverlayMode;
  subChartMode: SubChartMode;
};

type CrosshairMoveParam = {
  point?: { x: number; y: number };
  time?: unknown;
};

type ChartRef = {
  applyOptions: (options: { width: number }) => void;
  remove: () => void;
  timeScale: () => { fitContent: () => void };
  priceScale: (id: string) => {
    applyOptions: (options: { scaleMargins: { top: number; bottom: number } }) => void;
  };
  subscribeCrosshairMove: (handler: (param: CrosshairMoveParam) => void) => void;
  unsubscribeCrosshairMove: (handler: (param: CrosshairMoveParam) => void) => void;
};

type CandleSeriesRef = {
  setData: (data: Array<{ time: string; open: number; high: number; low: number; close: number }>) => void;
};

type LineSeriesRef = {
  setData: (data: Array<{ time: string; value: number }>) => void;
};

type HistogramSeriesRef = {
  setData: (data: Array<{ time: string; value: number; color: string }>) => void;
  applyOptions: (options: { priceFormat: { type: "price" | "volume" } }) => void;
};

export default function KLineChart({ candles, overlayMode, subChartMode }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ChartRef | null>(null);
  const candleSeriesRef = useRef<CandleSeriesRef | null>(null);
  const ma5SeriesRef = useRef<LineSeriesRef | null>(null);
  const ma10SeriesRef = useRef<LineSeriesRef | null>(null);
  const ma20SeriesRef = useRef<LineSeriesRef | null>(null);
  const bollMidSeriesRef = useRef<LineSeriesRef | null>(null);
  const bollUpperSeriesRef = useRef<LineSeriesRef | null>(null);
  const bollLowerSeriesRef = useRef<LineSeriesRef | null>(null);
  const subChartSeriesRef = useRef<HistogramSeriesRef | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const lastDataSignatureRef = useRef("");

  const sortedCandles = useMemo(
    () =>
      [...candles]
        .map((candle) => ({
          ...candle,
          time: formatTime(candle.time),
        }))
        .sort((a, b) => (String(a.time) > String(b.time) ? 1 : -1)),
    [candles]
  );

  const dataSignature = useMemo(() => {
    if (sortedCandles.length === 0) {
      return "empty";
    }
    return `${sortedCandles[0].time}:${sortedCandles[sortedCandles.length - 1].time}:${sortedCandles.length}`;
  }, [sortedCandles]);

  const candleMap = useMemo(() => {
    const map = new Map<string, CandlePoint>();
    for (const candle of sortedCandles) {
      map.set(String(candle.time), candle);
    }
    return map;
  }, [sortedCandles]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 520,
      layout: {
        background: { color: "#ffffff" },
        textColor: "#334155",
      },
      grid: {
        vertLines: { color: "#eef2f7" },
        horzLines: { color: "#eef2f7" },
      },
      rightPriceScale: {
        borderColor: "#e2e8f0",
      },
      timeScale: {
        borderColor: "#e2e8f0",
      },
      crosshair: {
        vertLine: {
          color: "#94a3b8",
          width: 1,
        },
        horzLine: {
          color: "#94a3b8",
          width: 1,
        },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#dc2626",
      downColor: "#16a34a",
      borderUpColor: "#dc2626",
      borderDownColor: "#16a34a",
      wickUpColor: "#dc2626",
      wickDownColor: "#16a34a",
      priceScaleId: "right",
    });

    const ma5Series = chart.addSeries(LineSeries, {
      color: "#2563eb",
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      priceScaleId: "right",
    });
    const ma10Series = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      priceScaleId: "right",
    });
    const ma20Series = chart.addSeries(LineSeries, {
      color: "#7c3aed",
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      priceScaleId: "right",
    });

    const bollMidSeries = chart.addSeries(LineSeries, {
      color: "#0f172a",
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      priceScaleId: "right",
    });
    const bollUpperSeries = chart.addSeries(LineSeries, {
      color: "#0ea5e9",
      lineWidth: 2,
      lineStyle: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      priceScaleId: "right",
    });
    const bollLowerSeries = chart.addSeries(LineSeries, {
      color: "#ec4899",
      lineWidth: 2,
      lineStyle: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      priceScaleId: "right",
    });

    const subChartSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
    });

    chart.priceScale("").applyOptions({
      scaleMargins: {
        top: 0.75,
        bottom: 0,
      },
    });
    chart.priceScale("right").applyOptions({
      scaleMargins: {
        top: 0.08,
        bottom: 0.28,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    ma5SeriesRef.current = ma5Series;
    ma10SeriesRef.current = ma10Series;
    ma20SeriesRef.current = ma20Series;
    bollMidSeriesRef.current = bollMidSeries;
    bollUpperSeriesRef.current = bollUpperSeries;
    bollLowerSeriesRef.current = bollLowerSeries;
    subChartSeriesRef.current = subChartSeries;

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) {
        return;
      }
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      ma5SeriesRef.current = null;
      ma10SeriesRef.current = null;
      ma20SeriesRef.current = null;
      bollMidSeriesRef.current = null;
      bollUpperSeriesRef.current = null;
      bollLowerSeriesRef.current = null;
      subChartSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      !candleSeriesRef.current ||
      !ma5SeriesRef.current ||
      !ma10SeriesRef.current ||
      !ma20SeriesRef.current ||
      !bollMidSeriesRef.current ||
      !bollUpperSeriesRef.current ||
      !bollLowerSeriesRef.current ||
      !subChartSeriesRef.current
    ) {
      return;
    }

    candleSeriesRef.current.setData(
      sortedCandles.map((candle) => ({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }))
    );

    const ma5 = buildMovingAverage(sortedCandles, 5);
    const ma10 = buildMovingAverage(sortedCandles, 10);
    const ma20 = buildMovingAverage(sortedCandles, 20);
    const boll = buildBollinger(sortedCandles, 20, 2);

    ma5SeriesRef.current.setData(overlayMode === "ma" ? ma5 : []);
    ma10SeriesRef.current.setData(overlayMode === "ma" ? ma10 : []);
    ma20SeriesRef.current.setData(overlayMode === "ma" ? ma20 : []);
    bollMidSeriesRef.current.setData(overlayMode === "boll" ? boll.middle : []);
    bollUpperSeriesRef.current.setData(overlayMode === "boll" ? boll.upper : []);
    bollLowerSeriesRef.current.setData(overlayMode === "boll" ? boll.lower : []);

    subChartSeriesRef.current.applyOptions({
      priceFormat: {
        type: subChartMode === "amount" ? "price" : "volume",
      },
    });
    subChartSeriesRef.current.setData(
      sortedCandles.map((candle) => ({
        time: candle.time,
        value: subChartMode === "amount" ? candle.amount ?? 0 : candle.volume ?? 0,
        color: candle.close >= candle.open ? "rgba(220, 38, 38, 0.55)" : "rgba(22, 163, 74, 0.55)",
      }))
    );

    if (chartRef.current && sortedCandles.length > 0 && lastDataSignatureRef.current !== dataSignature) {
      chartRef.current.timeScale().fitContent();
      lastDataSignatureRef.current = dataSignature;
    }
  }, [dataSignature, overlayMode, sortedCandles, subChartMode]);

  useEffect(() => {
    if (!chartRef.current || !containerRef.current || !tooltipRef.current) {
      return;
    }

    const chart = chartRef.current;
    const container = containerRef.current;
    const tooltip = tooltipRef.current;

    const handleCrosshairMove = (param: CrosshairMoveParam) => {
      if (
        !param ||
        !param.point ||
        !param.time ||
        param.point.x < 0 ||
        param.point.y < 0 ||
        param.point.x > container.clientWidth ||
        param.point.y > container.clientHeight
      ) {
        tooltip.style.display = "none";
        return;
      }

      const key = normalizeCrosshairTime(param.time);
      const candle = candleMap.get(key);
      if (!candle) {
        tooltip.style.display = "none";
        return;
      }

      tooltip.style.display = "block";
      tooltip.innerHTML = `
        <div class="chart-tooltip-title">${key}</div>
        <div class="chart-tooltip-row"><span>开</span><strong>${candle.open.toFixed(3)}</strong></div>
        <div class="chart-tooltip-row"><span>高</span><strong>${candle.high.toFixed(3)}</strong></div>
        <div class="chart-tooltip-row"><span>低</span><strong>${candle.low.toFixed(3)}</strong></div>
        <div class="chart-tooltip-row"><span>收</span><strong>${candle.close.toFixed(3)}</strong></div>
        <div class="chart-tooltip-row"><span>量</span><strong>${formatCompactNumber(candle.volume, 1)}</strong></div>
        <div class="chart-tooltip-row"><span>额</span><strong>${formatCompactNumber(candle.amount, 1)}</strong></div>
      `;

      const tooltipWidth = 148;
      const tooltipHeight = 174;
      const left = param.point.x + 16 > container.clientWidth - tooltipWidth
        ? param.point.x - tooltipWidth - 16
        : param.point.x + 16;
      const top = param.point.y + 16 > container.clientHeight - tooltipHeight
        ? param.point.y - tooltipHeight - 16
        : param.point.y + 16;

      tooltip.style.left = `${Math.max(8, left)}px`;
      tooltip.style.top = `${Math.max(8, top)}px`;
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
    };
  }, [candleMap]);

  return (
    <div>
      <div className="chart-legend">
        {overlayMode === "ma" ? (
          <>
            <span className="legend-item"><i className="legend-dot legend-blue" />MA5</span>
            <span className="legend-item"><i className="legend-dot legend-amber" />MA10</span>
            <span className="legend-item"><i className="legend-dot legend-violet" />MA20</span>
          </>
        ) : (
          <>
            <span className="legend-item"><i className="legend-dot legend-slate" />BOLL中轨</span>
            <span className="legend-item"><i className="legend-dot legend-cyan" />BOLL上轨</span>
            <span className="legend-item"><i className="legend-dot legend-pink" />BOLL下轨</span>
          </>
        )}
        <span className="legend-item">
          <i className={`legend-bar ${subChartMode === "amount" ? "legend-amount" : "legend-volume-up"}`} />
          {subChartMode === "amount" ? "成交额" : "成交量"}
        </span>
      </div>
      <div className="chart-shell">
        <div ref={containerRef} className="chart-box chart-box-tall" />
        <div ref={tooltipRef} className="chart-tooltip" />
      </div>
    </div>
  );
}
