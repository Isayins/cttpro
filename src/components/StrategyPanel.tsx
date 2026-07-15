import type { MarketSnapshot, StrategyAnalysis } from "../types/type";
import { Button, Card, CardContent } from "./ui";
import {
  formatForecastDirectionLabel,
  formatRiskLevelLabel,
  formatSignalActionLabel,
  formatSignalMarketLabel,
  formatStanceLabel,
  formatStrategySignalLabel,
  translateStrategyText,
} from "../utils/marketI18n";

function formatCompactNumber(value?: number, digits = 2) {
  if (value === undefined || value === null) {
    return "-";
  }
  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: digits,
  }).format(value);
}
function formatSignedPercent(value?: number) {
  if (value === undefined || value === null) {
    return "-";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

type Props = {
  snapshot: MarketSnapshot | null;
  analysis: StrategyAnalysis | null;
  connected: boolean;
  onBuy: () => Promise<void>;
  onSell: () => Promise<void>;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  busy: boolean;
};

export default function StrategyPanel({
  snapshot,
  analysis,
  connected,
  onBuy,
  onSell,
  onStart,
  onStop,
  busy,
}: Props) {
  const forecast = analysis?.forecast;
  const backtest = analysis?.backtest;
  const factors = analysis?.factors ?? [];
  const longTermStrategies = analysis?.longTermStrategies ?? [];
  const stockPickers = analysis?.stockPickers ?? [];

  return (
    <Card>
      <CardContent className="strategy-panel-card">
        <div className="panel-head">
          <div>
            <h2 className="section-title">策略控制台</h2>
            <div className="muted">连接状态：{connected ? "已连接" : "等待行情数据"}</div>
          </div>
          <div className="badge">
            {formatSignalMarketLabel(snapshot?.signal?.market)} / {formatSignalActionLabel(snapshot?.signal?.action)}
          </div>
        </div>

        <div className="strategy-grid strategy-grid-3col">
          <div className="strategy-summary-card">
            <span className="strategy-summary-label">当前股票名称</span>
            <strong className="strategy-summary-value">{snapshot?.name || "--"}</strong>
            <div className="strategy-summary-meta">{snapshot?.symbol || "--"}</div>
            <div className="strategy-summary-note">
              {translateStrategyText(analysis?.summary || snapshot?.signal?.reason) || "暂时还没有策略说明。"}
            </div>
            <div className="strategy-summary-chip-row">
              <span className="stock-meta-pill">执行评分 {analysis?.executionScore?.toFixed(2) ?? "--"}</span>
              <span className="stock-meta-pill">评分 {analysis?.score?.toFixed(2) ?? "--"}</span>
              <span className="stock-meta-pill">{formatStanceLabel(analysis?.stance)}</span>
              <span className="stock-meta-pill">风险 {formatRiskLevelLabel(analysis?.riskLevel)}</span>
              <span className="stock-meta-pill">流动性 {translateStrategyText(analysis?.liquidityTier) || "--"}</span>
              <span className="stock-meta-pill">风险预算 {translateStrategyText(analysis?.riskBudgetTier) || "--"}</span>
            </div>
          </div>

          <div className="strategy-summary-card strategy-summary-card-light">
            <span className="strategy-summary-label">历史预测</span>
            <strong className="strategy-summary-value">{formatForecastDirectionLabel(forecast?.direction)}</strong>
            <div className="strategy-summary-meta">置信度 {forecast?.confidencePct ?? 0}% · 相似样本 {forecast?.sampleSize ?? 0} 个</div>
            <div className="strategy-summary-note">
              {translateStrategyText(forecast?.summary) || "当前历史样本不足，模型还需要更多长期数据才能给出更稳定的预测。"}
            </div>
            <div className="forecast-chip-row">
              {(forecast?.horizons ?? []).map((item) => (
                <div key={item.days} className="forecast-chip">
                  <span>{item.label}</span>
                  <strong className={item.expectedReturnPct >= 0 ? "metric-positive" : "metric-negative"}>
                    {formatSignedPercent(item.expectedReturnPct)}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          <div className="strategy-summary-card strategy-summary-card-soft">
            <span className="strategy-summary-label">回测摘要</span>
            <strong className="strategy-summary-value">{backtest?.annualReturnPct?.toFixed(2) ?? "0.00"}%</strong>
            <div className="strategy-summary-meta">年化收益 · {backtest?.years ?? 0} 年 · {backtest?.trades ?? 0} 次交易</div>
            <div className="strategy-summary-note">
              超额收益 {formatSignedPercent(backtest?.excessReturnPct)} · 最大回撤{" "}
              {backtest ? `-${Math.abs(backtest.maxDrawdownPct).toFixed(2)}%` : "-"}
            </div>
            <div className="forecast-chip-row">
              <div className="forecast-chip">
                <span>胜率</span>
                <strong>{backtest?.winRatePct?.toFixed(1) ?? "0.0"}%</strong>
              </div>
              <div className="forecast-chip">
                <span>夏普</span>
                <strong>{backtest?.sharpe?.toFixed(2) ?? "0.00"}</strong>
              </div>
              <div className="forecast-chip">
                <span>模型仓位</span>
                <strong>{backtest?.latestPositionPct ?? 0}%</strong>
              </div>
              <div className="forecast-chip">
                <span>累计换手</span>
                <strong>{backtest?.turnoverPct?.toFixed(1) ?? "0.0"}%</strong>
              </div>
              <div className="forecast-chip">
                <span>交易成本</span>
                <strong>{backtest?.tradingCostPct?.toFixed(2) ?? "0.00"}%</strong>
              </div>
            </div>
            <div className="strategy-summary-note">
              {backtest?.costAssumption || "回测暂未配置交易成本假设。"}
            </div>
          </div>
        </div>

        <div className="strategy-stats-grid strategy-stats-grid-expanded">
          <div className="strategy-stat-card">
            <span className="strategy-stat-label">最新收盘</span>
            <strong className="strategy-stat-value">{snapshot?.lastClose?.toFixed(3) ?? "-"}</strong>
          </div>
          <div className="strategy-stat-card">
            <span className="strategy-stat-label">日涨跌幅</span>
            <strong className="strategy-stat-value">{formatSignedPercent(snapshot?.dailyChangePct)}</strong>
          </div>
          <div className="strategy-stat-card">
            <span className="strategy-stat-label">建议仓位</span>
            <strong className="strategy-stat-value">{snapshot?.signal?.positionPct ?? "-"}%</strong>
          </div>
          <div className="strategy-stat-card">
            <span className="strategy-stat-label">仓位上限</span>
            <strong className="strategy-stat-value">{analysis?.positionCapPct ?? "-"}%</strong>
          </div>
          <div className="strategy-stat-card">
            <span className="strategy-stat-label">流动性上限</span>
            <strong className="strategy-stat-value">{analysis?.liquidityCapPct ?? "-"}%</strong>
          </div>
          <div className="strategy-stat-card">
            <span className="strategy-stat-label">风险上限</span>
            <strong className="strategy-stat-value">{analysis?.riskBudgetCapPct ?? "-"}%</strong>
          </div>
          <div className="strategy-stat-card">
            <span className="strategy-stat-label">预测区间</span>
            <strong className="strategy-stat-value">
              {forecast?.band ? `${forecast.band.lowerPrice.toFixed(2)} - ${forecast.band.upperPrice.toFixed(2)}` : "-"}
            </strong>
          </div>
          <div className="strategy-stat-card">
            <span className="strategy-stat-label">最新成交量</span>
            <strong className="strategy-stat-value">{formatCompactNumber(snapshot?.latestVolume, 1)}</strong>
          </div>
          <div className="strategy-stat-card">
            <span className="strategy-stat-label">最新成交额</span>
            <strong className="strategy-stat-value">{formatCompactNumber(snapshot?.latestAmount, 1)}</strong>
          </div>
          <div className="strategy-stat-card">
            <span className="strategy-stat-label">流动性评级</span>
            <strong className="strategy-stat-value">
              {analysis?.liquidityTier
                ? `${translateStrategyText(analysis.liquidityTier) || analysis.liquidityTier} / ${Math.round(analysis?.liquidityScore ?? 0)}`
                : "-"}
            </strong>
          </div>
          <div className="strategy-stat-card">
            <span className="strategy-stat-label">回看周期</span>
            <strong className="strategy-stat-value">{forecast?.lookbackBars ?? snapshot?.summary?.bars ?? "-"}</strong>
          </div>
          <div className="strategy-stat-card">
            <span className="strategy-stat-label">已载入 K 线</span>
            <strong className="strategy-stat-value">{snapshot?.summary?.bars ?? "-"}</strong>
          </div>
        </div>

        {factors.length > 0 ? (
          <div className="strategy-factor-grid">
            {factors.map((factor) => (
              <div key={factor.label} className="strategy-factor-card">
                <div className="strategy-factor-head">
                  <span className="strategy-factor-label">{translateStrategyText(factor.label)}</span>
                  <strong
                    className={`strategy-factor-value ${
                      factor.tone === "positive" ? "metric-positive" : factor.tone === "negative" ? "metric-negative" : ""
                    }`}
                  >
                    {translateStrategyText(factor.value)}
                  </strong>
                </div>
                <div className="strategy-factor-note">{translateStrategyText(factor.detail)}</div>
              </div>
            ))}
          </div>
        ) : null}

        {longTermStrategies.length > 0 ? (
          <div className="strategy-section-block">
            <div className="strategy-section-head">
              <div>
                <div className="section-kicker">长周期</div>
                <h3 className="strategy-section-title">长期策略集合</h3>
              </div>
            </div>
            <div className="strategy-card-grid">
              {longTermStrategies.map((item) => (
                <div key={item.id} className="strategy-preset-card">
                  <div className="strategy-preset-head">
                    <div>
                      <div className="strategy-preset-name">{translateStrategyText(item.name)}</div>
                      <div className="strategy-preset-meta">
                        {translateStrategyText(item.category)} · {translateStrategyText(item.horizon)}
                      </div>
                    </div>
                    <div className={`strategy-fit-badge strategy-fit-${item.signal.toLowerCase()}`}>
                      {formatStrategySignalLabel(item.signal)} · {item.fitScore}%
                    </div>
                  </div>
                  <div className="strategy-preset-copy">{translateStrategyText(item.summary)}</div>
                  <div className="strategy-metric-row">
                    {item.metrics.map((metric) => (
                      <div key={`${item.id}-${metric.label}`} className="strategy-metric-chip">
                        <span>{translateStrategyText(metric.label)}</span>
                        <strong className={metric.tone === "positive" ? "metric-positive" : metric.tone === "negative" ? "metric-negative" : ""}>
                          {translateStrategyText(metric.value)}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {stockPickers.length > 0 ? (
          <div className="strategy-section-block">
            <div className="strategy-section-head">
              <div>
                <div className="section-kicker">选股框架</div>
                <h3 className="strategy-section-title">选股策略集合</h3>
              </div>
            </div>
            <div className="strategy-card-grid">
              {stockPickers.map((item) => (
                <div key={item.id} className="strategy-preset-card strategy-preset-card-soft">
                  <div className="strategy-preset-head">
                    <div>
                      <div className="strategy-preset-name">{translateStrategyText(item.name)}</div>
                      <div className="strategy-preset-meta">
                        {translateStrategyText(item.category)} · {translateStrategyText(item.horizon)}
                      </div>
                    </div>
                    <div className={`strategy-fit-badge strategy-fit-${item.signal.toLowerCase()}`}>
                      {formatStrategySignalLabel(item.signal)} · {item.fitScore}%
                    </div>
                  </div>
                  <div className="strategy-preset-copy">{translateStrategyText(item.summary)}</div>
                  <div className="strategy-metric-row">
                    {item.metrics.map((metric) => (
                      <div key={`${item.id}-${metric.label}`} className="strategy-metric-chip">
                        <span>{translateStrategyText(metric.label)}</span>
                        <strong className={metric.tone === "positive" ? "metric-positive" : metric.tone === "negative" ? "metric-negative" : ""}>
                          {translateStrategyText(metric.value)}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {analysis?.disclaimer ? <div className="strategy-disclaimer">{translateStrategyText(analysis.disclaimer)}</div> : null}

        <div className="button-row strategy-button-row">
          <Button onClick={onBuy} disabled={busy}>
            手动买入
          </Button>
          <Button variant="danger" onClick={onSell} disabled={busy}>
            手动卖出
          </Button>
          <Button variant="ghost" onClick={onStart} disabled={busy}>
            启动自动化
          </Button>
          <Button variant="ghost" onClick={onStop} disabled={busy}>
            暂停自动化
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
