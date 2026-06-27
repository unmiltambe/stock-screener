// Mirrors the backend response shapes (services/app/api/schemas.py). When mobile
// arrives this lifts into packages/shared-types (ADR-0002).

export interface WatchlistSummary {
  id: string;
  name: string;
  count: number;
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

export interface TickerRow {
  ticker: string;
  name: string;
  price: number | null;
  scores: Scores;
  signal: string | null;
  metrics: Metrics;
  lists: string[];
  stale: boolean;
}
