import { memo, useEffect, useMemo, useRef } from "react";
import { HistogramSeries, LineSeries, createChart } from "lightweight-charts";
import type { CandlePoint } from "../types/type";

type MacdPoint = {
  time: string;
  dif: number;
  dea: number;
  macd: number;
};

function formatTime(time: string | number) {
  const str = String(time);
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }
  return str;
}

function calculateMacd(candles: CandlePoint[]) {
  const data: MacdPoint[] = [];
  const emaShortFactor = 2 / (12 + 1);
  const emaLongFactor = 2 / (26 + 1);
  const signalFactor = 2 / (9 + 1);

  let ema12: number | null = null;
  let ema26: number | null = null;
  let dea: number | null = null;

  for (const candle of candles) {
    const close = candle.close;
    ema12 = ema12 === null ? close : close * emaShortFactor + ema12 * (1 - emaShortFactor);
    ema26 = ema26 === null ? close : close * emaLongFactor + ema26 * (1 - emaLongFactor);
    const dif = ema12 - ema26;
    dea = dea === null ? dif : dif * signalFactor + dea * (1 - signalFactor);
    const macd = (dif - dea) * 2;

    data.push({
      time: formatTime(candle.time),
      dif: Number(dif.toFixed(4)),
      dea: Number(dea.toFixed(4)),
      macd: Number(macd.toFixed(4)),
    });
  }

  return data;
}

type Props = {
  candles: CandlePoint[];
};

type ChartRef = {
  applyOptions: (options: { width: number }) => void;
  remove: () => void;
  timeScale: () => { fitContent: () => void };
};

type LineSeriesRef = {
  setData: (data: Array<{ time: string; value: number }>) => void;
};

type HistogramSeriesRef = {
  setData: (data: Array<{ time: string; value: number; color: string }>) => void;
};

function MacdChartComponent({ candles }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ChartRef | null>(null);
  const difSeriesRef = useRef<LineSeriesRef | null>(null);
  const deaSeriesRef = useRef<LineSeriesRef | null>(null);
  const histSeriesRef = useRef<HistogramSeriesRef | null>(null);
  const lastDataSignatureRef = useRef("");

  const macdData = useMemo(() => calculateMacd(candles), [candles]);
  const dataSignature = useMemo(() => {
    if (macdData.length === 0) {
      return "empty";
    }
    return `${macdData[0].time}:${macdData[macdData.length - 1].time}:${macdData.length}`;
  }, [macdData]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 260,
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
    });

    const histSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: "right",
    });
    const difSeries = chart.addSeries(LineSeries, {
      color: "#2563eb",
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    const deaSeries = chart.addSeries(LineSeries, {
      color: "#f97316",
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    chartRef.current = chart;
    histSeriesRef.current = histSeries;
    difSeriesRef.current = difSeries;
    deaSeriesRef.current = deaSeries;

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
      histSeriesRef.current = null;
      difSeriesRef.current = null;
      deaSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!histSeriesRef.current || !difSeriesRef.current || !deaSeriesRef.current) {
      return;
    }

    histSeriesRef.current.setData(
      macdData.map((item) => ({
        time: item.time,
        value: item.macd,
        color: item.macd >= 0 ? "rgba(220, 38, 38, 0.6)" : "rgba(22, 163, 74, 0.6)",
      }))
    );
    difSeriesRef.current.setData(
      macdData.map((item) => ({
        time: item.time,
        value: item.dif,
      }))
    );
    deaSeriesRef.current.setData(
      macdData.map((item) => ({
        time: item.time,
        value: item.dea,
      }))
    );

    if (chartRef.current && macdData.length > 0 && lastDataSignatureRef.current !== dataSignature) {
      chartRef.current.timeScale().fitContent();
      lastDataSignatureRef.current = dataSignature;
    }
  }, [dataSignature, macdData]);

  return (
    <div>
      <div className="chart-legend">
        <span className="legend-item"><i className="legend-bar legend-volume-up" />MACD柱</span>
        <span className="legend-item"><i className="legend-dot legend-blue" />DIF</span>
        <span className="legend-item"><i className="legend-dot legend-orange" />DEA</span>
      </div>
      <div ref={containerRef} className="chart-box" />
    </div>
  );
}

const MacdChart = memo(MacdChartComponent);

export default MacdChart;
