import { useEffect, useMemo, useRef } from "react";
import { AreaSeries, createChart } from "lightweight-charts";
import type { EquityPoint } from "../types/type";

function formatTime(time: string | number) {
  if (!time) {
    return null;
  }

  const str = String(time);
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }

  return str;
}

type Props = {
  equity: EquityPoint[];
};

type ChartRef = {
  applyOptions: (options: { width: number }) => void;
  remove: () => void;
  timeScale: () => { fitContent: () => void };
};

type AreaSeriesRef = {
  setData: (data: Array<{ time: string; value: number }>) => void;
};

export default function EquityChart({ equity }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ChartRef | null>(null);
  const seriesRef = useRef<AreaSeriesRef | null>(null);

  const normalizedData = useMemo(
    () =>
      equity
        .map((item) => ({
          time: formatTime(item.date),
          value: Number(item.value.toFixed(2)),
        }))
        .filter((item): item is { time: string; value: number } => Boolean(item.time)),
    [equity]
  );

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 320,
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

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#2563eb",
      topColor: "rgba(37, 99, 235, 0.28)",
      bottomColor: "rgba(37, 99, 235, 0.02)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;

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
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) {
      return;
    }

    seriesRef.current.setData(normalizedData);

    if (chartRef.current && normalizedData.length > 0) {
      chartRef.current.timeScale().fitContent();
    }
  }, [normalizedData]);

  return <div ref={containerRef} className="chart-box" />;
}
