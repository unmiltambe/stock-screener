"""HTTP Basic Auth for the interim demo deployment (ADR-0005).

Applied as middleware so it gates the **whole** app (UI + JSON API + docs),
leaving only `/health` open for the platform health check. Credentials come from
env (`BASIC_AUTH_USER` / `BASIC_AUTH_PASS`); if no password is set the gate is
**open** — fine for local runs, but the hosted deployment MUST set them (the
Render blueprint marks `BASIC_AUTH_PASS` required). This is a stopgap, not the
real auth path (Cognito, Phase 2).
"""
from __future__ import annotations

import base64
import os
import secrets
from typing import Optional

from starlette.requests import Request
from starlette.responses import Response

OPEN_PATHS = {"/health"}


def _unauthorized() -> Response:
    return Response(
        content="Unauthorized",
        status_code=401,
        headers={"WWW-Authenticate": 'Basic realm="stock-screener"'},
    )


def basic_auth_guard(request: Request) -> Optional[Response]:
    """Return a 401 Response if the request should be blocked, else None."""
    if request.url.path in OPEN_PATHS:
        return None

    expected_pass = os.getenv("BASIC_AUTH_PASS")
    if not expected_pass:
        return None  # auth not configured → open (local dev only)

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
