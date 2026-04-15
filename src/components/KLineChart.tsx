import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries } from "lightweight-charts";
import type { CandlePoint } from "../types/type";
function formatTime(time: string | number) {
  const str = String(time);

  // 如果是 20251125 这种格式
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }

  return str;
}
type Props = {
  candles: CandlePoint[];
};

export default function KLineChart({ candles }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 420,
    });

    const series = chart.addSeries(CandlestickSeries);

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
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
    if (!seriesRef.current || candles.length === 0) return;
    seriesRef.current.setData(
        candles
          .map((c: any) => ({
            time: formatTime(c.time),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close
          }))
          .sort((a, b) => (a.time > b.time ? 1 : -1))
      );
  }, [candles]);

  return <div ref={containerRef} className="chart-box" />;
}