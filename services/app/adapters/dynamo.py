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


def _table(name: str):
    return boto3.resource("dynamodb").Table(name)


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
        self._t.put_item(Item={"PK": f"USER#{user_id}", "SK": f"WL#{wid}",
                              "name": name, "tickers": []})
        return Watchlist(id=wid, name=name, tickers=[])

    def rename(self, user_id: str, watchlist_id: str, new_name: str) -> None:
        self._t.update_item(
            Key={"PK": f"USER#{user_id}", "SK": f"WL#{watchlist_id}"},
            UpdateExpression="SET #n = :name",
            ExpressionAttributeNames={"#n": "name"},
            ExpressionAttributeValues={":name": new_name},
            ConditionExpression="attribute_exists(SK)",
        )

    def delete(self, user_id: str, watchlist_id: str) -> None:
        self._t.delete_item(Key={"PK": f"USER#{user_id}", "SK": f"WL#{watchlist_id}"})

    def _save_tickers(self, user_id: str, watchlist_id: str, tickers: List[str]) -> None:
        self._t.update_item(
            Key={"PK": f"USER#{user_id}", "SK": f"WL#{watchlist_id}"},
            UpdateExpression="SET tickers = :t",
            ExpressionAttributeValues={":t": tickers},
            ConditionExpression="attribute_exists(SK)",
        )

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
