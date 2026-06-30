"""Authentication for the API.

Two mechanisms, by design (ADR-0008):

- **Cognito JWT** (`verify_cognito_jwt`) — the real per-user auth for `/v1`,
  validated in-app (works on AWS *and* Render, ADR-0007). Used when AUTH_MODE=jwt.
- **HTTP Basic Auth** (`basic_auth_guard`) — interim gate for the server-rendered
  `/ui` demo only (ADR-0005), retired with the React frontend in Phase 3.

Locally (AUTH_MODE=header) neither is required: `/v1` resolves a demo user and
Basic Auth is open unless BASIC_AUTH_PASS is set.
"""
from __future__ import annotations

import base64
import os
import secrets
from typing import Optional

import jwt
from jwt import PyJWKClient
from starlette.requests import Request
from starlette.responses import Response


# ── Cognito JWT (app-level validation) ────────────────────────────────────────

_jwks_client: Optional[PyJWKClient] = None


def _issuer() -> str:
    region = os.environ["COGNITO_REGION"]
    pool_id = os.environ["COGNITO_POOL_ID"]
    return f"https://cognito-idp.{region}.amazonaws.com/{pool_id}"


def _client() -> PyJWKClient:
    """Cached JWKS client (reused across warm Lambda invocations)."""
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(f"{_issuer()}/.well-known/jwks.json")
    return _jwks_client


def verify_cognito_jwt(token: str) -> dict:
    """Validate a Cognito JWT (signature, issuer, expiry) and the app client id.

    Accepts both ID and access tokens: access tokens carry the client id in
    `client_id`, ID tokens in `aud`. Raises jwt.InvalidTokenError on any failure.
    Returns the decoded claims (including `sub`).
    """
    expected_client = os.environ["COGNITO_CLIENT_ID"]
    signing_key = _client().get_signing_key_from_jwt(token)
    claims = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        issuer=_issuer(),
        options={"verify_aud": False},   # aud only present on ID tokens; checked below
    )
    if claims.get("aud") != expected_client and claims.get("client_id") != expected_client:
        raise jwt.InvalidTokenError("token client id does not match this app client")
    return claims


def delete_cognito_user(user_sub: str) -> None:
    """Delete the user from the Cognito pool (account deletion). No-op when the
    pool isn't configured (local/header mode) so account-deletion still wipes the
    user's stored data offline. Best-effort: a missing user is treated as done."""
    pool_id = os.getenv("COGNITO_POOL_ID")
    if not pool_id:
        return
    import boto3
    client = boto3.client("cognito-idp", region_name=os.getenv("COGNITO_REGION"))
    try:
        client.admin_delete_user(UserPoolId=pool_id, Username=user_sub)
    except client.exceptions.UserNotFoundException:
        pass  # already gone — deletion is idempotent


# ── Interim Basic Auth — gates the /ui demo only ──────────────────────────────

def _unauthorized() -> Response:
    return Response(
        content="Unauthorized",
        status_code=401,
        headers={"WWW-Authenticate": 'Basic realm="stock-screener"'},
    )


def basic_auth_guard(request: Request) -> Optional[Response]:
    """Return a 401 Response if a `/ui` request should be blocked, else None.

    Only the server-rendered demo (`/ui`) is gated here; `/v1` is JWT-gated via the
    per-route dependency, and `/health` is open. No-op unless BASIC_AUTH_PASS is set.
    """
    if not request.url.path.startswith("/ui"):
        return None

    expected_pass = os.getenv("BASIC_AUTH_PASS")
    if not expected_pass:
        return None  # not configured → open (local dev only)

    expected_user = os.getenv("BASIC_AUTH_USER", "admin")
    header = request.headers.get("Authorization", "")
    if not header.startswith("Basic "):
        return _unauthorized()
    try:
        user, _, pw = base64.b64decode(header[6:]).decode("utf-8").partition(":")
    except Exception:
        return _unauthorized()

    if (secrets.compare_digest(user, expected_user)
            and secrets.compare_digest(pw, expected_pass)):
        return None
    return _unauthorized()
