// Mirrors the backend response shapes (services/app/api/schemas.py). When mobile
// arrives this lifts into packages/shared-types (ADR-0002).

export interface WatchlistSummary {
  id: string;
  name: string;
  count: number;
}

export interface WatchlistOut {
  id: string;
  name: string;
}

export interface Scores {
  fund: number | null;
  tech: number | null;
  combined: number | null;
}

export interface Metrics {
  pe: number | null;
  fwdPe: number | null;
  peg: number | null;
  fcfYield: number | null;
  roe: number | null;
  rsi: number | null;
  vsSma200: number | null;
  vsSma50: number | null;
  rangePos: number | null;
  sector: string | null;
  marketCap: number | null;
}

export interface ChartPoint {
  t: string;
  price: number;
  sma50: number | null;
  sma200: number | null;
  volume: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_hist: number | null;
  obv: number | null;
}

export interface ChartOut {
  ticker: string;
  points: ChartPoint[];
}

export interface TickerRow {
  ticker: string;
  name: string;
  price: number | null;
  dayChange: number | null;      // vs previous close, in dollars
  dayChangePct: number | null;   // same change as percent
  scores: Scores;
  signal: string | null;
  metrics: Metrics;
  lists: string[];
  stale: boolean;
}

export interface Profile {
  first_name: string;
  last_name: string;
}

// GET /v1/leaderboard — four ranked views across the user's lists.
export interface Leaderboard {
  top_opportunities: TickerRow[];
  reconsider: TickerRow[];
  best_value: TickerRow[];
  best_momentum: TickerRow[];
}
