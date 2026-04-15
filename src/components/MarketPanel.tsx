import React from "react";
import { Card, CardContent } from "./ui";
import StrategyPanel from "./StrategyPanel";
import KLineChart from "./KLineChart";
import EquityChart from "./EquityChart";

interface MarketPanelProps {
  snapshot: any;
  connected: boolean;
  error: string | null;
  busy: boolean;
  onBuy: () => void;
  onSell: () => void;
  onStart: () => void;
  onStop: () => void;
  message: string;
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
  message
}: MarketPanelProps) {
  // ✅ 防御解构
  const summary = snapshot?.summary;

  return (
    <div className="page-stack">
      {/* ❌ 后端错误 */}
      {error ? (
        <Card>
          <CardContent>
            <div className="error-text">{error}</div>
          </CardContent>
        </Card>
      ) : null}

      {/* ✅ 成功提示 */}
      {message ? (
        <Card>
          <CardContent>
            <div className="success-text">{message}</div>
          </CardContent>
        </Card>
      ) : null}

      {/* ❌ snapshot error（后端返回 error 时） */}
      {snapshot?.error ? (
        <Card>
          <CardContent>
            <div className="error-text">{snapshot.error}</div>
          </CardContent>
        </Card>
      ) : null}

      <div className="metrics-grid">
        <Card>
          <CardContent>
            <div className="metric-label">连接状态</div>
            <div className="metric-value">
              {connected ? "已连接" : "未连接"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="metric-label">最新净值</div>
            <div className="metric-value">
              {summary?.nav !== undefined
                ? summary.nav.toFixed(4)
                : "-"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="metric-label">K线数量</div>
            <div className="metric-value">
              {summary?.bars ?? "-"}
            </div>
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
        <CardContent>
          <div className="section-head">
            <h2 className="section-title">真实行情 K 线</h2>
            <div className="muted">数据源：TuShare</div>
          </div>

          <KLineChart candles={snapshot?.candles ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="section-head">
            <h2 className="section-title">实时收益曲线</h2>
            <div className="muted">基于真实行情回放计算</div>
          </div>

          <EquityChart equity={snapshot?.equity ?? []} />
        </CardContent>
      </Card>

    </div>
  );
}
