import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Profile } from "./types";

// Profile is only meaningful for signed-in users; callers pass `enabled`.
export function useProfile(enabled: boolean) {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => api<Profile>("/v1/profile"),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Profile) =>
      api<Profile>("/v1/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(p),
      }),
    onSuccess: (data) => qc.setQueryData(["profile"], data),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => api<void>("/v1/account", { method: "DELETE" }),
  });
}
