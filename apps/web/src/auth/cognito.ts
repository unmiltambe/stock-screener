// Cognito OIDC config for the SPA (ADR-0008 Hosted UI, ADR-0009 guests).
//
// Authorization Code + PKCE via the Hosted UI — oidc-client-ts handles the PKCE
// dance, token storage, and silent renew. These Cognito identifiers are PUBLIC
// (the pool id appears in the JWT issuer/JWKS URLs; the SPA client is a public,
// no-secret client) — the same values live in render.yaml. Override per-env with
// VITE_COGNITO_* if the pool is ever recreated.
import { WebStorageStateStore } from "oidc-client-ts";
import type { AuthProviderProps } from "react-oidc-context";

const REGION = import.meta.env.VITE_COGNITO_REGION ?? "us-east-1";
const POOL_ID = import.meta.env.VITE_COGNITO_POOL_ID ?? "us-east-1_OYipjDV7H";
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID ?? "5i48e2uso248joouud6qi84jr9";
const HOSTED_UI =
  import.meta.env.VITE_COGNITO_HOSTED_UI ??
  "https://stock-screener-583671374484.auth.us-east-1.amazoncognito.com";

export const oidcConfig: AuthProviderProps = {
  authority: `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}`,
  client_id: CLIENT_ID,
  redirect_uri: `${window.location.origin}/callback`,
  response_type: "code",
  scope: "openid email profile",
  // Persist the session across reloads/tabs of this origin.
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  // Strip ?code/&state from the URL after a successful exchange (the /callback
  // route component then navigates home).
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, "/callback");
  },
};

// Cognito's logout is non-standard (not in the OIDC metadata), so build it by
// hand against the Hosted UI. `logout_uri` must be registered as a sign-out URL
// on the app client (the CDK adds the CloudFront origin).
export function cognitoLogoutUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    logout_uri: window.location.origin,
  });
  return `${HOSTED_UI}/logout?${params.toString()}`;
}
