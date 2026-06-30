import { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useNavigate } from "react-router-dom";

// Landing route for the Cognito redirect. react-oidc-context exchanges the code
// for tokens automatically; once authenticated we return to the app.
export default function CallbackPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.isAuthenticated) navigate("/", { replace: true });
  }, [auth.isAuthenticated, navigate]);

  if (auth.error)
    return <p className="text-neg">Sign-in failed: {auth.error.message}</p>;
  return <p className="text-dim">Signing you in…</p>;
}
