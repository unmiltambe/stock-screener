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
