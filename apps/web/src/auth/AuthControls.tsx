import { useEffect, useMemo, useRef } from "react";
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
  const migrated = useRef(false);
  const { data: profile } = useProfile(auth.isAuthenticated);

  // Bearer token follows the session (null falls back to the X-Guest-Id path).
  useEffect(() => {
    setAuthToken(auth.isAuthenticated ? auth.user?.access_token ?? null : null);
  }, [auth.isAuthenticated, auth.user?.access_token]);

  // On first authentication, absorb any guest watchlists, then refresh queries.
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
      .catch(() => { /* non-fatal */ })
      .finally(refresh);
  }, [auth.isAuthenticated, qc]);

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
