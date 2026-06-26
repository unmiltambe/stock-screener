"""Unit tests for the Cognito JWT validator (ADR-0008).

Uses a self-signed RS256 token + a faked JWKS client, so no network/Cognito is
needed. Exercises the verify path the deployed API relies on.
"""
from __future__ import annotations

import time

import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

REGION = "us-east-1"
POOL_ID = "us-east-1_testpool"
CLIENT_ID = "client-abc"
ISS = f"https://cognito-idp.{REGION}.amazonaws.com/{POOL_ID}"


class _FakeSigningKey:
    def __init__(self, key):
        self.key = key


class _FakeJWKS:
    def __init__(self, public_key):
        self._public_key = public_key

    def get_signing_key_from_jwt(self, token):  # mirrors PyJWKClient
        return _FakeSigningKey(self._public_key)


@pytest.fixture()
def signing(monkeypatch):
    priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setenv("COGNITO_REGION", REGION)
    monkeypatch.setenv("COGNITO_POOL_ID", POOL_ID)
    monkeypatch.setenv("COGNITO_CLIENT_ID", CLIENT_ID)
    from api import auth
    monkeypatch.setattr(auth, "_client", lambda: _FakeJWKS(priv.public_key()))
    return priv


def _token(priv, **overrides):
    claims = {"sub": "user-1", "iss": ISS, "aud": CLIENT_ID,
              "exp": int(time.time()) + 3600, **overrides}
    return pyjwt.encode(claims, priv, algorithm="RS256")


def test_valid_id_token_returns_sub(signing):
    from api import auth
    claims = auth.verify_cognito_jwt(_token(signing))
    assert claims["sub"] == "user-1"


def test_valid_access_token_uses_client_id(signing):
    # access tokens carry the app client id in `client_id`, not `aud`
    from api import auth
    tok = _token(signing, aud=None, client_id=CLIENT_ID)
    assert auth.verify_cognito_jwt(tok)["sub"] == "user-1"


def test_wrong_client_id_rejected(signing):
    from api import auth
    with pytest.raises(Exception):
        auth.verify_cognito_jwt(_token(signing, aud="someone-else"))


def test_expired_token_rejected(signing):
    from api import auth
    with pytest.raises(Exception):
        auth.verify_cognito_jwt(_token(signing, exp=int(time.time()) - 10))


def test_wrong_issuer_rejected(signing):
    from api import auth
    with pytest.raises(Exception):
        auth.verify_cognito_jwt(_token(signing, iss="https://evil.example.com"))
