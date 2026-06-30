import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { api } from "./client";
import type { TickerRow, WatchlistOut, WatchlistSummary } from "./types";

export function useWatchlists() {
  // Don't fire while OIDC is still resolving — prevents a guest-credentialed
  // request from racing ahead of the bearer token being set.
  const { isLoading: authLoading } = useAuth();
  return useQuery({
    queryKey: ["watchlists"],
    queryFn: () => api<WatchlistSummary[]>("/v1/watchlists"),
    enabled: !authLoading,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlist", watchlistId] });
      qc.invalidateQueries({ queryKey: ["all-symbols"] });
    },
  });
}

export function useAllSymbols() {
  const { data: watchlists } = useWatchlists();
  const listCount = watchlists?.length ?? 0;

  // Single cache-first batch on the backend — deduplicated across all
  // watchlists. Replaces the previous N-parallel-request fan-out that stormed
  // the upstream provider on a cold cache (see docs/design.md §6).
  const { data, isLoading } = useQuery({
    queryKey: ["all-symbols"],
    queryFn: () => api<TickerRow[]>("/v1/all-symbols"),
  });

  const rows = data ?? [];
  return { data: rows, isLoading, total: rows.length, listCount };
}

export function useRemoveTicker(watchlistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (symbol: string) =>
      api<void>(`/v1/watchlists/${watchlistId}/tickers/${symbol}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlist", watchlistId] });
      qc.invalidateQueries({ queryKey: ["all-symbols"] });
    },
  });
}
