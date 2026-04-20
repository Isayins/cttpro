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

export interface MarketSnapshot {
  updatedAt: string;
  symbol: string;
  name: string;
  lastClose: number;
  dailyChangePct: number;
  latestVolume?: number;
  latestAmount?: number;
  signal: Signal;
  candles: CandlePoint[];
  equity: EquityPoint[];
  summary: {
    nav: number;
    positionPct: number;
    bars: number;
  };
  error?: string;
}

export interface StockItem {
  symbol: string;
  name: string;
  exchange?: string | null;
  indexName?: string | null;
}
