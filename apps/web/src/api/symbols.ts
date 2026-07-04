import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

// One autocomplete match from the symbol universe (ADR-0011).
export interface SymbolMatch {
  symbol: string;
  name: string;
  exchange: string;
  market: string;
}

/** Type-ahead search over the backend symbol universe. Pass an already-debounced
 * query; disabled (no request) until there's at least one character. */
export function useSymbolSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["symbols", q.toUpperCase()],
    queryFn: () => api<SymbolMatch[]>(`/v1/symbols/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 1,
    staleTime: 60 * 60 * 1000, // the universe changes ~daily
  });
}

/** Authoritative on-submit validation: is `symbol` a real ticker (exact match in
 * the universe)? Used to reject typed junk before adding. */
export async function isKnownSymbol(symbol: string): Promise<boolean> {
  const q = symbol.trim().toUpperCase();
  if (!q) return false;
  const matches = await api<SymbolMatch[]>(`/v1/symbols/search?q=${encodeURIComponent(q)}`);
  return matches.some((m) => m.symbol.toUpperCase() === q);
}
