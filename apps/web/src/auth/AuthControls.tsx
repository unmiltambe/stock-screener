import { useEffect, useRef } from "react";
import { useAuth } from "react-oidc-context";
import { useQueryClient } from "@tanstack/react-query";
import { api, setAuthToken } from "../api/client";
import { cognitoLogoutUrl } from "./cognito";

// Header auth controls + the side effects that bridge OIDC into the rest of the
// app: keep the API client's bearer token in sync, and migrate guest data on the
// first sign-in (ADR-0009).
export default function AuthControls() {
  const auth = useAuth();
  const qc = useQueryClient();
  const migrated = useRef(false);

  // Bearer token follows the session (access token is the API's authz token;
  // null falls the client back to the X-Guest-Id path).
  useEffect(() => {
    setAuthToken(auth.isAuthenticated ? auth.user?.access_token ?? null : null);
  }, [auth.isAuthenticated, auth.user?.access_token]);

  // On first authentication, absorb any guest watchlists, then refresh queries.
  // Runs before nothing else fetches authenticated data because invalidate() is
  // what triggers refetch with the new token.
  useEffect(() => {
    if (!auth.isAuthenticated || migrated.current) return;
    migrated.current = true;
    const guestId = sessionStorage.getItem("guestId");
    const refresh = () => void qc.invalidateQueries();
    if (!guestId) return refresh();
    api("/v1/auth/migrate-guest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guest_id: guestId }),
    })
      .then(() => sessionStorage.removeItem("guestId"))
      .catch(() => { /* non-fatal: user still has their account */ })
      .finally(refresh);
  }, [auth.isAuthenticated, qc]);

  if (auth.isLoading) return <span className="text-dim text-sm">…</span>;

  if (auth.isAuthenticated) {
    const email = (auth.user?.profile.email as string | undefined) ?? "Account";
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-dim">{email}</span>
        <button
          onClick={() => {
            setAuthToken(null);
            void auth.removeUser();
            window.location.href = cognitoLogoutUrl();
          }}
          className="text-dim hover:text-ink transition-colors"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => void auth.signinRedirect()}
      className="text-sm px-3 py-1.5 rounded border border-line hover:border-accent text-accent transition-colors"
    >
      Sign in
    </button>
  );
}
