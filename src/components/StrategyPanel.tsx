import { Button, Card, CardContent } from "./ui";
import React from "react";
import type { MarketSnapshot } from "../types/type";

type Props = {
  snapshot: MarketSnapshot | null;
  connected: boolean;
  onBuy: () => Promise<void>;
  onSell: () => Promise<void>;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  busy: boolean;
};

export default function StrategyPanel({
  snapshot,
  connected,
  onBuy,
  onSell,
  onStart,
  onStop,
  busy,
}: Props) {
  return (
    <Card>
      <CardContent>
        <div className="panel-head">
          <div>
            <h2 className="section-title">策略控制面板</h2>
            <div className="muted">
              连接状态：{connected ? "已连接" : "未连接"}
            </div>
          </div>
          <div className="badge">
            {snapshot?.signal?.market ?? "--"} / {snapshot?.signal?.action ?? "--"}
          </div>
        </div>

        <div className="stack">
          <div className="info-row">
            <span className="label">标的</span>
            <span>{snapshot?.name ?? "-"}</span>
          </div>
          <div className="info-row">
            <span className="label">最新价</span>
            <span>{snapshot?.lastClose?.toFixed(3) ?? "-"}</span>
          </div>
          <div className="info-row">
            <span className="label">涨跌</span>
            <span>{snapshot?.dailyChangePct!== undefined ? `${snapshot.dailyChangePct.toFixed(2)}%` : "-"}</span>
          </div>
          <div className="info-row">
            <span className="label">建议仓位</span>
            <span>{snapshot?.signal?.positionPct ?? "-"}%</span>
          </div>
          <div className="info-row">
            <span className="label">策略说明</span>
            <span>{snapshot?.signal?.reason ?? "-"}</span>
          </div>
        </div>

        <div className="button-row">
          <Button onClick={onBuy} disabled={busy}>
            发送买入邮件
          </Button>
          <Button variant="danger" onClick={onSell} disabled={busy}>
            发送卖出邮件
          </Button>
          <Button variant="ghost" onClick={onStart} disabled={busy}>
            开启自动策略
          </Button>
          <Button variant="ghost" onClick={onStop} disabled={busy}>
            关闭自动策略
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}