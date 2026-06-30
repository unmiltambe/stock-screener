"""Guest-session identity resolution (ADR-0009).

Tests get_user_id directly — it's a plain resolver — across auth modes, so no
Cognito/network is needed. The Bearer-token path is covered by test_auth.py.
"""
from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException

from api.deps import DEMO_USER, _guest_id, get_user_id


def test_guest_id_namespaces_valid_uuid():
    gid = str(uuid.uuid4())
    assert _guest_id(gid) == f"GUEST#{gid}"


def test_guest_id_rejects_malformed_and_empty():
    assert _guest_id(None) is None
    assert _guest_id("") is None
    assert _guest_id("not-a-uuid") is None
    assert _guest_id("../../etc/passwd") is None  # no identity injection


def test_header_mode_ignores_guest_id(monkeypatch):
    # Local/offline runs must keep their seeded demo data regardless of guest hdr.
    monkeypatch.setenv("AUTH_MODE", "header")
    gid = str(uuid.uuid4())
    assert get_user_id(x_user_id=None, x_guest_id=gid, authorization=None) == DEMO_USER


def test_header_mode_explicit_user_wins(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "header")
    assert get_user_id(x_user_id="alice", x_guest_id=str(uuid.uuid4()),
                       authorization=None) == "alice"


def test_jwt_mode_guest_id_without_token(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "jwt")
    gid = str(uuid.uuid4())
    assert get_user_id(x_user_id=None, x_guest_id=gid,
                       authorization=None) == f"GUEST#{gid}"


def test_jwt_mode_no_token_no_guest_is_401(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "jwt")
    with pytest.raises(HTTPException) as exc:
        get_user_id(x_user_id=None, x_guest_id=None, authorization=None)
    assert exc.value.status_code == 401


def test_jwt_mode_malformed_guest_id_is_401(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "jwt")
    with pytest.raises(HTTPException) as exc:
        get_user_id(x_user_id=None, x_guest_id="junk", authorization=None)
    assert exc.value.status_code == 401
