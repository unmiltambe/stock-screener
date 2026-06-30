"""DynamoDB-backed adapters (single-table design — docs/design.md §5).

  Watchlist        PK=USER#<id>   SK=WL#<wlid>     attr name, tickers:[..]
  Score cache      PK=CACHE#<sym> SK=SCORE         attr value(json), ttl(epoch)

Not exercised by the offline test suite (requires DynamoDB Local or AWS). Used
when STORE_BACKEND=dynamo. See docs/local-dev.md for running against DynamoDB
Local.
"""
from __future__ import annotations

import json
import time
import uuid
from typing import Any, List, Optional

import boto3
from boto3.dynamodb.conditions import Key

from core.models import Watchlist

from .ports import is_guest

# Abandoned guest sessions self-expire so storage doesn't accumulate (ADR-0009).
# Authenticated users' items carry no TTL. The window refreshes on every write,
# so an actively-used guest session won't vanish mid-use.
_GUEST_TTL_SECONDS = 7 * 24 * 3600  # 7 days


def _table(name: str):
    return boto3.resource("dynamodb").Table(name)


def _guest_ttl(user_id: str) -> Optional[int]:
    """Epoch expiry for a guest's items, or None for authenticated users."""
    if is_guest(user_id):
        return int(time.time()) + _GUEST_TTL_SECONDS
    return None


class DynamoCache:
    def __init__(self, table_name: str) -> None:
        self._t = _table(table_name)

    def get(self, key: str) -> Optional[Any]:
        resp = self._t.get_item(Key={"PK": f"CACHE#{key}", "SK": "SCORE"})
        item = resp.get("Item")
        if not item:
            return None
        if "ttl" in item and int(item["ttl"]) <= int(time.time()):
            return None  # expired but not yet swept by DynamoDB TTL
        return json.loads(item["value"])

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        self._t.put_item(Item={
            "PK": f"CACHE#{key}", "SK": "SCORE",
            "value": json.dumps(value),
            "ttl": int(time.time()) + ttl_seconds,
        })


class DynamoWatchlistRepo:
    """Watchlists keyed by a minted id: SK = WL#<id>, with `name` as an attribute
    (ADR-0004). Rename mutates the attribute; the id (and URL) is stable."""

    def __init__(self, table_name: str) -> None:
        self._t = _table(table_name)

    @staticmethod
    def _to_watchlist(item: dict) -> Watchlist:
        return Watchlist(id=item["SK"][3:], name=item.get("name", ""),
                         tickers=list(item.get("tickers", [])))

    def list_all(self, user_id: str) -> List[Watchlist]:
        resp = self._t.query(
            KeyConditionExpression=Key("PK").eq(f"USER#{user_id}")
            & Key("SK").begins_with("WL#")
        )
        return [self._to_watchlist(it) for it in resp.get("Items", [])]

    def get(self, user_id: str, watchlist_id: str) -> Optional[Watchlist]:
        resp = self._t.get_item(Key={"PK": f"USER#{user_id}", "SK": f"WL#{watchlist_id}"})
        item = resp.get("Item")
        return self._to_watchlist(item) if item else None

    def create(self, user_id: str, name: str) -> Watchlist:
        wid = uuid.uuid4().hex
        item = {"PK": f"USER#{user_id}", "SK": f"WL#{wid}",
                "name": name, "tickers": []}
        ttl = _guest_ttl(user_id)
        if ttl is not None:
            item["ttl"] = ttl
        self._t.put_item(Item=item)
        return Watchlist(id=wid, name=name, tickers=[])

    def rename(self, user_id: str, watchlist_id: str, new_name: str) -> None:
        names = {"#n": "name"}
        values = {":name": new_name}
        expr = "SET #n = :name"
        ttl = _guest_ttl(user_id)
        if ttl is not None:
            expr += ", #ttl = :ttl"
            names["#ttl"] = "ttl"
            values[":ttl"] = ttl
        self._t.update_item(
            Key={"PK": f"USER#{user_id}", "SK": f"WL#{watchlist_id}"},
            UpdateExpression=expr,
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ConditionExpression="attribute_exists(SK)",
        )

    def delete(self, user_id: str, watchlist_id: str) -> None:
        self._t.delete_item(Key={"PK": f"USER#{user_id}", "SK": f"WL#{watchlist_id}"})

    def _save_tickers(self, user_id: str, watchlist_id: str, tickers: List[str]) -> None:
        names = None
        values = {":t": tickers}
        expr = "SET tickers = :t"
        ttl = _guest_ttl(user_id)
        if ttl is not None:
            expr += ", #ttl = :ttl"
            names = {"#ttl": "ttl"}
            values[":ttl"] = ttl
        kwargs = dict(
            Key={"PK": f"USER#{user_id}", "SK": f"WL#{watchlist_id}"},
            UpdateExpression=expr,
            ExpressionAttributeValues=values,
            ConditionExpression="attribute_exists(SK)",
        )
        if names:
            kwargs["ExpressionAttributeNames"] = names
        self._t.update_item(**kwargs)

    def add_ticker(self, user_id: str, watchlist_id: str, symbol: str) -> None:
        wl = self.get(user_id, watchlist_id)
        if wl is None:
            return
        symbol = symbol.upper()
        if symbol not in wl.tickers:
            self._save_tickers(user_id, watchlist_id, wl.tickers + [symbol])

    def remove_ticker(self, user_id: str, watchlist_id: str, symbol: str) -> None:
        wl = self.get(user_id, watchlist_id)
        if wl is None:
            return
        symbol = symbol.upper()
        if symbol in wl.tickers:
            self._save_tickers(user_id, watchlist_id,
                            [t for t in wl.tickers if t != symbol])

    # ── profile (SK=PROFILE) + account deletion ───────────────────────────────

    def get_profile(self, user_id: str) -> Optional[dict]:
        resp = self._t.get_item(Key={"PK": f"USER#{user_id}", "SK": "PROFILE"})
        item = resp.get("Item")
        if not item:
            return None
        return {k: item[k] for k in ("first_name", "last_name") if k in item}

    def set_profile(self, user_id: str, profile: dict) -> None:
        item = {"PK": f"USER#{user_id}", "SK": "PROFILE",
                "first_name": profile.get("first_name", ""),
                "last_name": profile.get("last_name", "")}
        ttl = _guest_ttl(user_id)
        if ttl is not None:
            item["ttl"] = ttl
        self._t.put_item(Item=item)

    def delete_all(self, user_id: str) -> None:
        resp = self._t.query(KeyConditionExpression=Key("PK").eq(f"USER#{user_id}"))
        items = resp.get("Items", [])
        with self._t.batch_writer() as batch:
            for it in items:
                batch.delete_item(Key={"PK": it["PK"], "SK": it["SK"]})

    def try_mark_seeded(self, user_id: str) -> bool:
        """Conditional put of a SEEDED marker — the write itself is the lock. Only
        the first caller succeeds; everyone else gets ConditionalCheckFailed and
        returns False. Immune to Query's eventual consistency."""
        item = {"PK": f"USER#{user_id}", "SK": "META#SEEDED"}
        ttl = _guest_ttl(user_id)
        if ttl is not None:
            item["ttl"] = ttl
        try:
            self._t.put_item(Item=item, ConditionExpression="attribute_not_exists(SK)")
            return True
        except self._t.meta.client.exceptions.ConditionalCheckFailedException:
            return False
