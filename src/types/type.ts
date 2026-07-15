export interface CandlePoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  amount?: number;
}

export interface EquityPoint {
  date: string;
  value: number;
}

export interface Signal {
  market: "FULL" | "HALF" | "EMPTY";
  action: "BUY" | "SELL" | "HOLD";
  etf: string | null;
  name?: string;
  positionPct?: number;
  reason?: string;
}

export interface StrategyFactor {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
  detail?: string;
}

export interface StrategyMetric {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}

export interface StrategyCard {
  id: string;
  name: string;
  category: string;
  horizon: string;
  signal: "PASS" | "WATCH" | "AVOID";
  fitScore: number;
  summary: string;
  metrics: StrategyMetric[];
}

export interface ForecastHorizon {
  label: string;
  days: number;
  expectedReturnPct: number;
  predictedPrice: number;
  winRatePct: number;
}

export interface ForecastBand {
  lowerPrice: number;
  upperPrice: number;
}

export interface ForecastAnalysis {
  method: string;
  sampleSize: number;
  lookbackBars: number;
  latestTradeDate: string;
  confidencePct: number;
  direction: "BULLISH" | "BEARISH" | "NEUTRAL" | "INSUFFICIENT";
  summary: string;
  horizons: ForecastHorizon[];
  band: ForecastBand;
}

export interface BacktestAnalysis {
  startDate: string;
  endDate: string;
  years: number;
  trades: number;
  winRatePct: number;
  annualReturnPct: number;
  totalReturnPct: number;
  benchmarkReturnPct: number;
  excessReturnPct: number;
  maxDrawdownPct: number;
  sharpe: number;
  latestPositionPct: number;
  turnoverPct: number;
  tradingCostPct: number;
  costAssumption: string;
}

export interface PriceSourceMap {
  display: string;
  signal: string;
}

export interface StrategyAnalysis {
  executionScore: number;
  score: number;
  stance: string;
  riskLevel: string;
  avgAmount20d?: number | null;
  liquidityScore?: number;
  liquidityTier?: string;
  riskBudgetTier?: string;
  riskBudgetCapPct?: number;
  liquidityCapPct?: number;
  positionCapPct?: number;
  summary: string;
  factors: StrategyFactor[];
  longTermStrategies: StrategyCard[];
  stockPickers: StrategyCard[];
  forecast: ForecastAnalysis;
  backtest: BacktestAnalysis;
  disclaimer: string;
}

export interface ScreenerCandidate {
  rank: number;
  symbol: string;
  strategyId?: string;
  name: string;
  securityType?: string;
  exchange?: string | null;
  market?: string | null;
  industry?: string | null;
  area?: string | null;
  boardNames?: string | null;
  boardCount?: number | null;
  latestClose: number;
  dailyChangePct: number;
  fitScore: number;
  signal: "PASS" | "WATCH" | "AVOID";
  overallScore: number;
  overallScoreNormalized?: number;
  stance: string;
  summary: string;
  positionCapPct?: number;
  latestAmount?: number;
  avgAmount20d?: number;
  floatMarketCap?: number;
  totalMarketCap?: number;
  turnoverRate?: number;
  volumeRatio?: number;
  netMoneyFlow?: number;
  capitalFlowStrengthPct?: number;
  capitalFlowLabel?: string;
  marketStyle?: string;
  themeHeatScore?: number;
  themeHeatTier?: string;
  crowdingRisk?: string;
  trendBias?: string;
  priceVsMa20Pct?: number;
  priceVsMa60Pct?: number;
  priceVsMa120Pct?: number;
  maStackScore?: number;
  valuationBand?: string;
  strategyAlignmentScore?: number;
  priorityScore?: number;
  liquidityScore?: number;
  liquidityTier?: string;
  metrics: StrategyMetric[];
}

export type ScreenerPreset = "aggressive" | "balanced" | "conservative" | "custom";

export interface ScreenerQueryOptions {
  preset?: ScreenerPreset;
  minAvgAmountK?: number;
  minLatestAmountK?: number;
  minFloatMarketCapW?: number;
  minTotalMarketCapW?: number;
  minListedDays?: number;
  excludeSt?: boolean;
  excludeBse?: boolean;
  excludeSuspended?: boolean;
  excludeNonListingStatus?: boolean;
}

export interface ScreenerBucket {
  id: string;
  name: string;
  category: string;
  horizon: string;
  summary: string;
  candidateCount: number;
  topCandidates: ScreenerCandidate[];
}

export interface ScreenerSnapshot {
  updatedAt: string;
  screenedCount: number;
  eligibleCount?: number;
  filteredOutCount?: number;
  qualifiedCount: number;
  topPerStrategy: number;
  priceSources?: PriceSourceMap;
  filters?: {
    active: boolean;
    appliedPreset?: string;
    amountLookbackDays: number;
    screenedCount: number;
    cheapPassCount?: number;
    eligibleCount: number;
    filteredOutCount: number;
    strategyAnalyzedCount?: number;
    activeRules: Array<{
      key: string;
      label: string;
      threshold: number;
      displayValue: string;
    }>;
    reasonBreakdown: Array<{
      key: string;
      label: string;
      count: number;
    }>;
  };
  longTermStrategies: ScreenerBucket[];
  stockPickers: ScreenerBucket[];
}

export type ScreenerJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface ScreenerJobSnapshot {
  jobId: string | null;
  status: ScreenerJobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  error?: string | null;
  cacheHit?: boolean;
  pollAfterMs?: number;
  result?: ScreenerSnapshot;
}

export interface DatabaseItem {
  label: string;
  value: string;
}

export interface DatabaseSection {
  id: string;
  title: string;
  source: string;
  subtitle?: string;
  updatedAt?: string;
  items: DatabaseItem[];
}

export interface DatabaseSummary {
  sectionCount: number;
  dataPointCount: number;
  sections: DatabaseSection[];
}

export interface StockProfile {
  symbol?: string;
  name: string;
  securityType?: string;
  exchange?: string | null;
  market?: string | null;
  indexName?: string | null;
  industry?: string | null;
  area?: string | null;
  listStatus?: string | null;
  listDate?: string | null;
  boardCount?: number | null;
  boardNames?: string | null;
}

export interface MarketSnapshot {
  updatedAt: string;
  symbol: string;
  name: string;
  profile?: StockProfile;
  lastClose: number;
  dailyChangePct: number;
  latestVolume?: number;
  latestAmount?: number;
  signal: Signal;
  analysis?: StrategyAnalysis;
  database?: DatabaseSummary;
  priceSources?: PriceSourceMap;
  candles: CandlePoint[];
  equity?: EquityPoint[];
  summary: {
    nav: number;
    positionPct: number;
    bars: number;
  };
  error?: string;
}

export interface StockItem extends StockProfile {
  symbol: string;
  name: string;
}
