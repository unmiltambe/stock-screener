import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { TickerRow, WatchlistSummary } from "./types";

export function useWatchlists() {
  return useQuery({
    queryKey: ["watchlists"],
    queryFn: () => api<WatchlistSummary[]>("/v1/watchlists"),
  });
}

export function useWatchlist(id: string) {
  return useQuery({
    queryKey: ["watchlist", id],
    queryFn: () => api<TickerRow[]>(`/v1/watchlists/${id}`),
    enabled: Boolean(id),
  });
}
