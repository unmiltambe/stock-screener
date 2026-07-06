import { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { Link, useNavigate } from "react-router-dom";

// Landing route for the Cognito redirect. react-oidc-context exchanges the code
// for tokens automatically; once authenticated we return to the app. If anything
// goes wrong (e.g. the page was refreshed mid-redirect and the one-time code/state
// was already consumed), we recover with a clean re-sign-in rather than dead-end.
export default function CallbackPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Members land in the app after sign-in, never on the marketing page.
    if (auth.isAuthenticated) navigate("/watchlists", { replace: true });
  }, [auth.isAuthenticated, navigate]);

  if (auth.error) {
    return (
      <div className="max-w-md mx-auto text-center mt-16">
        <p className="text-neg mb-1">That sign-in didn't go through.</p>
        <p className="text-dim text-sm mb-5">
          Usually a refresh mid-redirect. One more try should do it.
        </p>
        <button
          onClick={() => void auth.signinRedirect()}
          className="text-sm px-4 py-2 rounded bg-accent text-bg font-medium"
        >
          Try again
        </button>
        <Link to="/watchlists" className="block mt-3 text-dim text-sm hover:text-ink">
          Back to the app
        </Link>
      </div>
    );
  }

  return <p className="text-dim">Signing you in…</p>;
}
