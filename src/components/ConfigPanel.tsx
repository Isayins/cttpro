import type { MarketSnapshot, StrategyCard } from "../types/type";
import { Button, Card, CardContent } from "./ui";
import {
  formatForecastDirectionLabel,
  formatRiskLevelLabel,
  formatSignalActionLabel,
  formatSignalMarketLabel,
  formatStanceLabel,
  translateStrategyText,
} from "../utils/marketI18n";

type Props = {
  snapshot: MarketSnapshot | null;
  connected: boolean;
  busy: boolean;
  onBuy: () => Promise<void>;
  onSell: () => Promise<void>;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
};

function formatSignedPercent(value?: number) {
  if (value === undefined || value === null) {
    return "-";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
function formatPlainNumber(value?: number, digits = 2) {
  if (value === undefined || value === null) {
    return "-";
  }
  return value.toFixed(digits);
}

function buildStrategyNames(items: StrategyCard[]) {
  if (items.length === 0) {
    return "暂无";
  }
  return items.map((item) => translateStrategyText(item.name) || item.name).join("、");
}

function inferAutomationState(reason?: string) {
  if (!reason) {
    return "未知";
  }
  return reason.startsWith("Automation is paused.") ? "已暂停" : "运行中";
}

export default function ConfigPanel({
  snapshot,
  connected,
  busy,
  onBuy,
  onSell,
  onStart,
  onStop,
}: Props) {
  const analysis = snapshot?.analysis ?? null;
  const signal = snapshot?.signal;
  const forecast = analysis?.forecast;
  const backtest = analysis?.backtest;
  const factors = analysis?.factors ?? [];
  const longTermStrategies = analysis?.longTermStrategies ?? [];
  const stockPickers = analysis?.stockPickers ?? [];
  const automationState = inferAutomationState(signal?.reason);
  const forecast20 = forecast?.horizons?.find((item) => item.days === 20);
  const forecast60 = forecast?.horizons?.find((item) => item.days === 60);

  const liveRules = [
    "手动买入覆盖：直接输出 满仓 / 买入 / 90%。",
    "手动卖出覆盖：直接输出 空仓 / 卖出 / 0%。",
    "综合分数 >= 3.2：输出 满仓 / 买入 / 88%。",
    "1.4 <= 综合分数 < 3.2：输出 半仓 / 持有 / 62%。",
    "-0.8 <= 综合分数 < 1.4：输出 半仓 / 持有 / 36%。",
    "综合分数 < -0.8：输出 空仓 / 卖出 / 0%。",
  ];

  const scoringRules = [
    "价格站上 MA20：+1.1；跌破 MA20：-1.1。",
    "MA20 >= MA60 >= MA120：+1.2；仅 MA20 >= MA60：+0.4；否则 -1.0。",
    "20 日动量为正：+0.9；为负：-0.9。",
    "60 日动量为正：+1.0；为负：-1.0。",
    "20 日波动率 >= 0.42：-0.8；<= 0.22：+0.3。",
    "20 日预测收益 >= 3%：+1.0；0 到 3%：+0.45；-3% 以下：-1.0；其余：-0.45。",
    "60 日预测收益 >= 8%：+0.8；0 到 8%：+0.35；-8% 以下：-0.8；其余：-0.35。",
  ];

  return (
    <div className="page-stack">
      <Card>
        <CardContent>
          <div className="section-head">
            <div>
              <h2 className="section-title">后端策略引擎</h2>
              <div className="muted">
                这个页面已经和后端实时策略引擎对齐，不再保存只存在于浏览器本地的假参数。
              </div>
            </div>
            <div className="badge">{connected ? "后端引擎已连接" : "等待后端数据"}</div>
          </div>

          <div className="metrics-grid">
            <div className="card">
              <div className="card-content">
                <div className="metric-label">策略来源</div>
                <div className="metric-value">量化引擎</div>
                <div className="metric-footnote">当前实际决策来自后端量化策略模块。</div>
              </div>
            </div>

            <div className="card">
              <div className="card-content">
                <div className="metric-label">当前信号</div>
                <div className="metric-value">
                  {formatSignalMarketLabel(signal?.market)} / {formatSignalActionLabel(signal?.action)}
                </div>
                <div className="metric-footnote">
                  {translateStrategyText(signal?.reason) || "后端暂时还没有返回策略信号。"}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-content">
                <div className="metric-label">建议仓位</div>
                <div className="metric-value">{signal?.positionPct ?? 0}%</div>
                <div className="metric-footnote">
                  {snapshot?.name ? `${snapshot.name}${snapshot.symbol ? ` / ${snapshot.symbol}` : ""}` : "当前没有激活股票"}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-content">
                <div className="metric-label">自动化状态</div>
                <div className="metric-value">{automationState}</div>
                <div className="metric-footnote">由后端运行时的启动和暂停动作控制。</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="section-head">
            <div>
              <h2 className="section-title">决策输入</h2>
              <div className="muted">
                后端引擎会把趋势结构、历史相似形预测、回测表现，以及基本面和资金流上下文合并打分。
              </div>
            </div>
          </div>

          <div className="insight-grid">
            <div className="card insight-card">
              <div className="card-content">
                <div className="metric-label">趋势总分</div>
                <div className="metric-value">{analysis ? formatPlainNumber(analysis.score) : "-"}</div>
                <div className="metric-footnote">{formatStanceLabel(analysis?.stance) || "等待分析结果"}</div>
              </div>
            </div>

            <div className="card insight-card">
              <div className="card-content">
                <div className="metric-label">风险等级</div>
                <div className="metric-value">{formatRiskLevelLabel(analysis?.riskLevel)}</div>
                <div className="metric-footnote">
                  {translateStrategyText(analysis?.summary) || "暂时还没有策略摘要。"}
                </div>
              </div>
            </div>

            <div className="card insight-card">
              <div className="card-content">
                <div className="metric-label">相似形预测</div>
                <div className="metric-value">{formatForecastDirectionLabel(forecast?.direction)}</div>
                <div className="metric-footnote">
                  置信度 {forecast?.confidencePct ?? 0}% | 样本数 {forecast?.sampleSize ?? 0}
                </div>
              </div>
            </div>

            <div className="card insight-card">
              <div className="card-content">
                <div className="metric-label">回测年化收益</div>
                <div className="metric-value">{backtest ? `${backtest.annualReturnPct.toFixed(2)}%` : "-"}</div>
                <div className="metric-footnote">
                  最大回撤 {backtest ? `-${Math.abs(backtest.maxDrawdownPct).toFixed(2)}%` : "-"} | 夏普{" "}
                  {backtest ? backtest.sharpe.toFixed(2) : "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="metrics-grid" style={{ marginTop: "18px" }}>
            <div className="card">
              <div className="card-content">
                <div className="metric-label">20 日预测收益</div>
                <div className="metric-value">
                  {forecast20 ? formatSignedPercent(forecast20.expectedReturnPct) : "-"}
                </div>
                <div className="metric-footnote">
                  {forecast?.band
                    ? `预测区间 ${forecast.band.lowerPrice.toFixed(2)} - ${forecast.band.upperPrice.toFixed(2)}`
                    : "暂时没有预测区间。"}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-content">
                <div className="metric-label">60 日预测收益</div>
                <div className="metric-value">
                  {forecast60 ? formatSignedPercent(forecast60.expectedReturnPct) : "-"}
                </div>
                <div className="metric-footnote">历史相似形窗口由后端引擎计算。</div>
              </div>
            </div>

            <div className="card">
              <div className="card-content">
                <div className="metric-label">已载入 K 线数</div>
                <div className="metric-value">{snapshot?.summary?.bars ?? "-"}</div>
                <div className="metric-footnote">前端显示完全基于后端返回的市场快照。</div>
              </div>
            </div>

            <div className="card">
              <div className="card-content">
                <div className="metric-label">当前模型仓位</div>
                <div className="metric-value">{backtest?.latestPositionPct ?? signal?.positionPct ?? 0}%</div>
                <div className="metric-footnote">手动买入和卖出覆盖也都是通过后端发出。</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="section-head">
            <div>
              <h2 className="section-title">当前执行规则</h2>
              <div className="muted">
                下面这些规则直接对应后端当前真实在用的阈值，不是前端自己定义的假配置。
              </div>
            </div>
          </div>

          <div className="config-factor-list">
            <div className="config-factor-card">
              <div className="config-factor-head">
                <span className="config-factor-label">信号输出分档</span>
              </div>
              <div className="config-rule-list">
                {liveRules.map((item) => (
                  <div key={item} className="config-rule-item">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="config-factor-card">
              <div className="config-factor-head">
                <span className="config-factor-label">核心加减分规则</span>
              </div>
              <div className="config-rule-list">
                {scoringRules.map((item) => (
                  <div key={item} className="config-rule-item">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="section-head">
            <div>
              <h2 className="section-title">策略家族</h2>
              <div className="muted">
                这些策略家族是后端针对当前股票实时生成的策略适配结果。
              </div>
            </div>
          </div>

          <div className="metrics-grid">
            <div className="card">
              <div className="card-content">
                <div className="metric-label">长线策略数</div>
                <div className="metric-value">{longTermStrategies.length}</div>
                <div className="metric-footnote">{buildStrategyNames(longTermStrategies)}</div>
              </div>
            </div>

            <div className="card">
              <div className="card-content">
                <div className="metric-label">选股策略数</div>
                <div className="metric-value">{stockPickers.length}</div>
                <div className="metric-footnote">{buildStrategyNames(stockPickers)}</div>
              </div>
            </div>
          </div>

          <div className="config-factor-list">
            {factors.length > 0 ? (
              factors.map((factor) => (
                <div key={factor.label} className="config-factor-card">
                  <div className="config-factor-head">
                    <span className="config-factor-label">{translateStrategyText(factor.label) || factor.label}</span>
                    <strong
                      className={
                        factor.tone === "positive"
                          ? "metric-positive"
                          : factor.tone === "negative"
                            ? "metric-negative"
                            : ""
                      }
                    >
                      {translateStrategyText(factor.value) || factor.value}
                    </strong>
                  </div>
                  <div className="metric-footnote">
                    {translateStrategyText(factor.detail) || "暂时没有更多说明。"}
                  </div>
                </div>
              ))
            ) : (
              <div className="config-empty-state">
                后端分析暂时还没有返回因子明细。等市场数据返回后，后端引擎会把细项填充到这里。
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="section-head">
            <div>
              <h2 className="section-title">运行控制</h2>
              <div className="muted">
                这些按钮调用的都是真实后端动作。当前没有可编辑的前端阈值，是因为实际策略逻辑写在
                后端代码里，不在浏览器存储里。
              </div>
            </div>
          </div>

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
    </div>
  );
}
