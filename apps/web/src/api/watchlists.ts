import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { TickerRow, WatchlistOut, WatchlistSummary } from "./types";

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

export function useCreateWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<WatchlistOut>("/v1/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlists"] }),
  });
}

export function useRenameWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api<WatchlistOut>(`/v1/watchlists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlists"] }),
  });
}

export function useDeleteWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/v1/watchlists/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlists"] }),
  });
}

export function useAddTicker(watchlistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (symbol: string) =>
      api<void>(`/v1/watchlists/${watchlistId}/tickers/${symbol}`, {
        method: "PUT",
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["watchlist", watchlistId] }),
  });
}

export function useRemoveTicker(watchlistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (symbol: string) =>
      api<void>(`/v1/watchlists/${watchlistId}/tickers/${symbol}`, {
        method: "DELETE",
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["watchlist", watchlistId] }),
  });
}
