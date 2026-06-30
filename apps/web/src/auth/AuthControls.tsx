import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { useQueryClient } from "@tanstack/react-query";
import { api, setAuthToken } from "../api/client";
import { useProfile } from "../api/profile";
import { greeting } from "../lib/greeting";
import { cognitoLogoutUrl } from "./cognito";

// Header auth controls + the side effects that bridge OIDC into the rest of the
// app: keep the API bearer token in sync, and migrate guest data on first sign-in
// (ADR-0009). Signed in, the corner greets the user warmly by first name.
export default function AuthControls() {
  const auth = useAuth();
  const qc = useQueryClient();
  const bootstrapped = useRef(false);
  const { data: profile } = useProfile(auth.isAuthenticated);

  // useLayoutEffect fires after the committed render but before any useEffect —
  // including TanStack Query's fetch trigger — so the bearer token module variable
  // is always set before the first query fires for this auth state.
  useLayoutEffect(() => {
    setAuthToken(auth.isAuthenticated ? (auth.user?.access_token ?? null) : null);
  }, [auth.isAuthenticated, auth.user?.access_token]);

  // Bootstrap the account exactly once per load (guest or signed-in): the backend
  // seeds-or-migrates only on the first call for an identity and is a no-op after,
  // so this is the single write path for new-account state. Reads stay pure.
  useEffect(() => {
    if (auth.isLoading || bootstrapped.current) return;
    bootstrapped.current = true;
    const guestId = auth.isAuthenticated ? sessionStorage.getItem("guestId") : null;
    api("/v1/session/init", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(guestId ? { guest_id: guestId } : {}),
    })
      .then(() => { if (guestId) sessionStorage.removeItem("guestId"); })
      .catch(() => { /* non-fatal — reads still work */ })
      .finally(() => void qc.invalidateQueries());
  }, [auth.isLoading, auth.isAuthenticated, qc]);

  const firstName = profile?.first_name;
  // Pick one greeting per name value, so it varies across visits but is stable
  // within a render (no reshuffle on every paint).
  const hello = useMemo(() => greeting(firstName), [firstName]);

  if (auth.isLoading) return <span className="text-dim text-sm">…</span>;

  if (auth.isAuthenticated) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link to="/profile" className="text-ink hover:text-accent transition-colors" title="Your profile">
          {hello}
        </Link>
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
