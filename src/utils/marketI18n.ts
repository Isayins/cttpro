const TEXT_MAP: Record<string, string> = {
  FULL: "满仓",
  HALF: "半仓",
  EMPTY: "空仓",
  BUY: "买入",
  SELL: "卖出",
  HOLD: "持有",
  PASS: "通过",
  WATCH: "观察",
  AVOID: "回避",
  BULLISH: "看多",
  BEARISH: "看空",
  NEUTRAL: "中性",
  INSUFFICIENT: "样本不足",
  OPEN: "开放",
  BALANCED: "收敛",
  TIGHT: "紧缩",
  Low: "低",
  Medium: "中",
  High: "高",
  Unknown: "未知",
  Unavailable: "暂无结论",
  "Trend-led accumulation": "趋势主导，适合逐步吸纳",
  "Constructive but selective": "结构偏正面，但需要择强参与",
  "Balanced / wait for confirmation": "均衡观察，等待确认",
  Defensive: "偏防守",
  Yes: "是",
  No: "否",
  "No strategy signal available.": "当前还没有可用的策略信号。",
  "No strategy analysis is available yet.": "当前还没有可用的策略分析。",
  "No historical forecast is available yet.": "当前还没有可用的历史预测结果。",
  "Manual buy signal was triggered.": "已触发手动买入信号。",
  "Manual sell signal was triggered.": "已触发手动卖出信号。",
  "Trend and historical analogs both lean positive, so the model keeps a pro-risk posture.":
    "趋势与历史相似样本都偏正面，因此模型保持偏进攻的风险偏好。",
  "Trend and historical analogs are both weak, so the model stays defensive.":
    "趋势与历史相似样本都偏弱，因此模型维持防守姿态。",
  "Trend remains supportive, but the forward analog signal is mixed and position sizing should stay measured.":
    "趋势仍有支撑，但前瞻相似样本信号分化，仓位仍应保持克制。",
  "The market state is mixed, so the model prefers patience until trend and analog signals align.":
    "当前市场状态偏混合，模型倾向继续等待趋势与相似样本信号共振。",
  "Not enough multi-year data is available to build a stable forward analog forecast yet.":
    "当前多年样本仍不足，暂时无法建立稳定的前瞻相似预测。",
  "Historical analog windows could not be constructed from the available data.":
    "现有数据还不足以构建可用的历史相似窗口。",
  "Historical windows with a similar setup were usually followed by positive medium-term performance.":
    "历史上相似形态通常对应后续中期偏正收益表现。",
  "Comparable historical setups were usually followed by weaker forward performance.":
    "历史上可比形态通常对应后续偏弱的前瞻表现。",
  "The nearest historical setups point to a mixed forward path rather than a clean directional edge.":
    "最近的历史相似样本指向的是分化走势，而不是明确的方向优势。",
  "Price vs MA20": "相对 MA20",
  "Trend alignment": "均线排列",
  "20-bar momentum": "20周期动量",
  "60-bar momentum": "60周期动量",
  "20-bar volatility": "20周期波动率",
  "Range position": "区间位置",
  "Analog forecast (20d)": "相似样本预测（20日）",
  "Analog forecast (60d)": "相似样本预测（60日）",
  "Price is trading above the short-term trend line.": "价格运行在短期趋势线上方。",
  "Price slipped below the short-term trend line.": "价格已经跌回短期趋势线下方。",
  "Short, medium, and long averages are stacked bullish.": "短中长期均线呈多头排列。",
  "Short trend is still above the medium trend.": "短期趋势仍然强于中期趋势。",
  "Average alignment is still weak.": "均线排列仍然偏弱。",
  "Momentum across roughly one month of trading data.": "反映最近约一个月交易区间的动量强弱。",
  "Intermediate trend across the recent quarter.": "反映最近一个季度区间的中期趋势表现。",
  "Volatility is elevated, so the model reduces conviction.": "当前波动偏高，因此模型会下调信心。",
  "Volatility is controlled and trend persistence tends to improve.": "当前波动可控，趋势延续性通常更好。",
  "Volatility is in a neutral zone.": "当前波动处于中性区间。",
  "Price is trading near the top of its recent 60-bar range.": "价格接近最近 60 根K线区间上沿。",
  "Price is sitting in the lower part of its recent range.": "价格位于最近区间的偏下位置。",
  "Price is trading around the middle of its recent range.": "价格运行在最近区间的中部附近。",
  "Average forward return of the closest historical setups.": "来自最相近历史样本的平均前瞻收益。",
  "Longer horizon expectation from historical analog windows.": "来自历史相似窗口的更长期前瞻预期。",
  "Secular trend follower": "长期趋势跟随",
  "Long-term trend": "长线趋势",
  "9-18 months": "9-18个月",
  "Best when the stock stays above its long-term trend and the medium-to-long moving averages keep rising.":
    "更适合股价始终站在长期趋势线上方、且中长期均线持续抬升的标的。",
  "Quality compounder": "高质量复利",
  "Long-term quality": "长线质量",
  "1-3 years": "1-3年",
  "Looks for companies that can sustain multi-quarter growth without relying on excessive leverage.":
    "寻找能够在不过度依赖杠杆的前提下持续多季度增长的公司。",
  "Value re-rating": "价值重估",
  "Long-term value": "长线价值",
  "6-18 months": "6-18个月",
  "Focuses on stocks that are not expensive on basic valuation metrics while fundamentals begin to improve.":
    "聚焦估值不过分昂贵、同时基本面开始改善的股票。",
  "Low-vol trend holder": "低波趋势持有",
  "Long-term defense": "长线防守",
  "9-24 months": "9-24个月",
  "Designed for calmer long-term trends where drawdowns and volatility stay more manageable.":
    "适合长期趋势更平稳、回撤和波动更容易控制的标的。",
  "Trend leader screener": "趋势领涨筛选",
  "Stock picking": "选股策略",
  "Swing to position": "波段到趋势持有",
  "Chooses symbols already leading the tape instead of trying to catch weak rebounds.":
    "优先选择已经走强的龙头，而不是去博弈弱势反弹。",
  "Quality growth screener": "高质量成长筛选",
  "Quarterly re-rating": "季度重估",
  "Favors growth names where profitability and operating cash generation improve together.":
    "偏好盈利能力与经营现金流同步改善的成长型标的。",
  "Value recovery screener": "价值修复筛选",
  "Mean reversion": "均值回归",
  "Looks for cheaper stocks where the earnings trend has already stopped deteriorating.":
    "寻找估值更便宜、且盈利趋势已经止跌回稳的股票。",
  "Capital-flow breakout": "资金流突破",
  "Event driven": "事件驱动",
  "Combines money-flow participation with turnover expansion to find potential breakout candidates.":
    "结合资金净流入和换手放大，寻找潜在突破候选。",
  "Price vs MA250": "相对 MA250",
  "250-bar return": "250周期收益",
  "60-day forecast": "60日预测",
  Volatility: "波动率",
  ROE: "净资产收益率",
  "Revenue YoY": "营收同比",
  "Profit YoY": "利润同比",
  "Debt/assets": "资产负债率",
  "PE TTM": "市盈率 TTM",
  PB: "市净率",
  "Backtest drawdown": "回测回撤",
  "Annual return": "年化收益",
  "Long range pos.": "长周期区间位置",
  "20-day forecast": "20日预测",
  "Volume ratio": "量比",
  "Near breakout": "接近突破",
  "Gross margin": "毛利率",
  "OCF/share": "每股经营现金流",
  "Net money flow": "主力净流入",
  Turnover: "换手率",
  "20-day average turnover": "20日平均成交额",
  "Float market cap": "流通市值",
  "Execution capacity": "执行容量",
  "Risk budget": "风险预算",
  "Extension risk": "追高风险",
  "Analog confidence": "相似样本置信度",
  "Analog forecast (5d)": "相似样本预测（5日）",
  "Trend efficiency": "趋势效率",
  "Breakout confirmation": "突破确认度",
  "Pullback quality": "回撤质量",
  "Analog breadth": "相似样本广度",
  "Trend may look constructive, but liquidity is too thin for the model to open exposure.":
    "趋势看起来并不差，但流动性过薄，模型不会为这类标的开新仓。",
  "Trend is constructive, but liquidity and market-cap constraints keep sizing capped.":
    "趋势仍有支撑，但流动性和市值约束会压低可用仓位上限。",
  "Trend is constructive, but volatility or price extension forces the model into a starter-sized posture.":
    "趋势仍有支撑，但波动或价格拉伸过大，模型只能维持试探仓位。",
  "Price is stretched well above its trend base, so the model trims conviction to avoid chasing.":
    "价格已经明显偏离趋势基座，模型会主动降低信号强度，避免盲目追高。",
  "Trend is positive but not overly extended, which leaves more room for cleaner follow-through.":
    "趋势仍偏正面，但没有明显透支，后续延续空间会更健康。",
  "Price extension is in a workable zone and does not materially change execution quality.":
    "价格扩张仍在可接受区间，不会明显改变执行质量。",
  "Historical analog signals are scaled down when confidence and sample stability are not strong enough.":
    "当历史相似样本的置信度和稳定性不足时，模型会主动下调这部分信号权重。",
  "Average turnover remains deep enough to scale into the trade without leaning on one hot session.":
    "20日平均成交额足够厚，不需要依赖单日放量也能逐步完成建仓。",
  "Average turnover is acceptable for measured execution.":
    "20日平均成交额处于可接受区间，适合克制分批执行。",
  "Average turnover is persistently thin and the setup can become hard to execute cleanly.":
    "20日平均成交额持续偏薄，这类形态在真实执行时更容易出现滑点。",
  "Average turnover is middling, so position sizing should stay disciplined.":
    "20日平均成交额一般，因此仓位依然需要保持纪律。",
  "Float market cap is large enough to absorb institutional participation more smoothly.":
    "流通市值足够大，更容易承接中大资金参与。",
  "Float market cap is small and the price can be pushed around too easily.":
    "流通市值偏小，价格更容易被短线资金扰动。",
  "Float market cap is still on the smaller side, so execution risk stays elevated.":
    "流通市值仍偏小，执行风险依旧偏高。",
  "Float market cap is workable but not yet a clear capacity advantage.":
    "流通市值勉强可用，但还谈不上容量优势。",
  "Liquidity is too thin for the model to carry a fresh position.":
    "流动性太薄，模型不会给出新的持仓暴露。",
  "Liquidity is thin, so the model only allows a starter position.":
    "流动性偏薄，因此模型只允许试探仓位。",
  "Liquidity is acceptable, but position sizing stays capped until depth improves.":
    "流动性基本可用，但在深度改善之前仓位仍会被限额。",
  "Liquidity gate allows full sizing without forcing a haircut.":
    "流动性门槛已通过，不需要额外削减目标仓位。",
  "Risk budget is tight because volatility, extension, or crowding is too elevated for aggressive sizing.":
    "风险预算偏紧，因为波动、拉升幅度或交易拥挤度过高，不适合激进上仓。",
  "Risk budget remains constructive, but the setup still needs smaller sizing because execution risk is elevated.":
    "风险预算仍偏正面，但执行风险还在高位，所以仓位仍应收缩。",
  "Risk budget is open and does not force additional position cuts.":
    "风险预算处于开放状态，不会额外压缩目标仓位。",
  "Price is moving with relatively little back-and-forth noise, which usually improves trend persistence.":
    "价格推进过程中来回噪声较少，这类趋势通常更容易延续。",
  "Price action is choppy relative to the net move, so breakout signals deserve less trust.":
    "相对净涨跌而言，价格噪声偏大，说明走势更容易来回反复，突破信号可信度要打折。",
  "Trend quality is acceptable but not clean enough to materially change conviction.":
    "趋势质量尚可，但还不够顺畅，不足以明显改变模型信心。",
  "The breakout area is being tested with decent participation, which lowers the odds of an immediate fade.":
    "突破区正在接受较好的成交参与确认，短线立刻回落的概率会更低。",
  "Price is pressing the breakout area on weak participation, which raises false-break risk.":
    "价格在弱参与下冲击突破区，假突破风险会明显上升。",
  "Breakout pressure is visible, but confirmation from participation is only average.":
    "突破压力是存在的，但参与度确认还比较一般。",
  "The stock is holding a controlled pullback off the recent high while staying above key trend levels.":
    "股价从近期高点回撤幅度可控，同时仍守在关键趋势位上方。",
  "The pullback from the recent high is already deep enough to question whether the prior trend is still intact.":
    "从近期高点的回撤已经偏深，需要重新评估前一段趋势是否仍然有效。",
  "The current pullback depth is not extreme enough to materially change execution quality.":
    "当前回撤深度还不算极端，对执行质量影响有限。",
  "Liquidity gate blocked new exposure because turnover or float size is too small.":
    "流动性门槛已阻止新开仓，因为成交额或流通盘规模过小。",
  "Liquidity gate allows only a starter position until turnover and float size improve.":
    "在成交额和流通盘改善之前，流动性门槛只允许试探仓位。",
  "Liquidity gate trims the target position until trading depth improves.":
    "在交易深度改善之前，流动性门槛会主动下调目标仓位。",
  "Risk budget cut the position to a starter size because volatility, price extension, or trend damage is elevated.":
    "风险预算已把仓位压到试探级别，因为波动、价格拉伸或趋势受损风险已经偏高。",
  "Risk budget trimmed the position because volatility, extension, breakout quality, or crowding is elevated.":
    "风险预算已下调仓位，因为波动、拉伸、突破质量或交易拥挤风险已经抬升。",
  "Win rates across the nearest historical setups help distinguish broad support from a small number of outlier paths.":
    "相似样本的胜率结构有助于区分“多数样本支持”还是“少数离群样本拉高了均值”。",
  "History-based statistical analysis only. It is for research reference, not investment advice.":
    "本分析仅基于历史统计样本，用于研究参考，不构成投资建议。",
};

function translateExact(value?: string | null) {
  if (!value) {
    return value || "";
  }
  return TEXT_MAP[value] ?? value;
}

export function formatSignalMarketLabel(value?: string | null) {
  return translateExact(value) || "--";
}

export function formatSignalActionLabel(value?: string | null) {
  return translateExact(value) || "--";
}

export function formatStrategySignalLabel(value?: string | null) {
  return translateExact(value) || "--";
}

export function formatForecastDirectionLabel(value?: string | null) {
  return translateExact(value) || "样本不足";
}

export function formatRiskLevelLabel(value?: string | null) {
  return translateExact(value) || "--";
}

export function formatStanceLabel(value?: string | null) {
  return translateExact(value) || "暂无结论";
}

export function translateStrategyText(value?: string | null): string {
  if (!value) {
    return value || "";
  }
  if (value.startsWith("Automation is paused. ")) {
    const tail = value.slice("Automation is paused. ".length).trim();
    return `自动化已暂停。${translateStrategyText(tail)}`;
  }
  return translateExact(value);
}
