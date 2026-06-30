import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useAllSymbols() {
  const { data: watchlists } = useWatchlists();
  const ids = watchlists?.map((w) => w.id) ?? [];

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["watchlist", id] as const,
      queryFn: () => api<TickerRow[]>(`/v1/watchlists/${id}`),
      enabled: ids.length > 0,
    })),
  });

  const isLoading = results.some((r) => r.isLoading) || (ids.length > 0 && results.length === 0);
  const seen = new Map<string, TickerRow>();
  for (const row of results.flatMap((r) => r.data ?? [])) {
    if (seen.has(row.ticker)) {
      const existing = seen.get(row.ticker)!;
      seen.set(row.ticker, {
        ...existing,
        lists: [...new Set([...existing.lists, ...row.lists])],
      });
    } else {
      seen.set(row.ticker, row);
    }
  }
  return { data: [...seen.values()], isLoading, total: seen.size, listCount: ids.length };
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
