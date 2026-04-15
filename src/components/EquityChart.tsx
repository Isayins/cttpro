import { useEffect, useRef } from "react";
import { createChart, LineSeries } from "lightweight-charts";
import type { EquityPoint } from "../types/type";
function formatTime(time: string | number) {
    if (!time) return null;
  
    const str = String(time);
  
    // 处理 20260126
    if (/^\d{8}$/.test(str)) {
      return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
    }
  
    return str;
  }
type Props = {
  equity: EquityPoint[];
};

export default function EquityChart({ equity }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 320,
    });

    const series = chart.addSeries(LineSeries);

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
    if (!seriesRef.current || equity.length === 0) return;
    // seriesRef.current.setData(equity);
    seriesRef.current.setData(
        equity
          .map((e: any) => ({
            time: formatTime(e.date), // ✅ 修复
            value: e.value
          }))
          .filter((e: any) => e.time) // ✅ 防 undefined
      );
  }, [equity]);

  return <div ref={containerRef} className="chart-box" />;
}