import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { ChartOut, TickerRow } from "./types";

export function useTickerChart(symbol: string, years = 1) {
  return useQuery({
    queryKey: ["chart", symbol, years],
    queryFn: () => api<ChartOut>(`/v1/tickers/${symbol}/chart?years=${years}`),
    enabled: Boolean(symbol),
    staleTime: 5 * 60 * 1000, // chart data doesn't need to refresh every render
  });
}

export function useTickerScores(symbol: string) {
  return useQuery({
    queryKey: ["scores", symbol],
    queryFn: async () => {
      const rows = await api<TickerRow[]>(`/v1/scores?tickers=${symbol}`);
      return rows[0] ?? null;
    },
    enabled: Boolean(symbol),
  });
}

// Scores for a fixed set of symbols, independent of any watchlist. `/v1/scores` is
// a pure function of the tickers (scores are global per symbol), so this returns the
// same read-only rows for every visitor — used for the landing showcase.
export function useScores(symbols: string[]) {
  const key = symbols.join(",");
  return useQuery({
    queryKey: ["scores-list", key],
    queryFn: () => api<TickerRow[]>(`/v1/scores?tickers=${encodeURIComponent(key)}`),
    enabled: symbols.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
