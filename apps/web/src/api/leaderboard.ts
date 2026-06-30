import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { Leaderboard } from "./types";

export function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api<Leaderboard>("/v1/leaderboard"),
    staleTime: 60 * 1000,
  });
}
