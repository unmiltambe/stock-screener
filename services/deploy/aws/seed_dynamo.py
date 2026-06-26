"""Seed the deployed DynamoDB table with the demo watchlists.

Run once after `cdk deploy`, with AWS credentials configured and DDB_TABLE set to
the deployed table name (a stack output):

    DDB_TABLE=StockScreenerStack-TableXXedited AWS_REGION=us-east-1 \
        python services/deploy/aws/seed_dynamo.py

Idempotent: watchlists that already exist (by name) are skipped. Seeds under the
app's default user (AUTH_MODE=header → DEMO_USER), so the deployed site shows them.
Self-bootstraps the import path to services/app so it can be run from anywhere.
"""
from __future__ import annotations

import json
import os
import pathlib
import sys

# This file: services/deploy/aws/seed_dynamo.py → app/ is three levels up + /app
_APP_DIR = pathlib.Path(__file__).resolve().parents[2] / "app"
sys.path.insert(0, str(_APP_DIR))

from adapters.dynamo import DynamoWatchlistRepo  # noqa: E402  (after sys.path setup)

DEMO_USER = "local-dev"  # must match api.deps.DEMO_USER
SEED_FILE = _APP_DIR / "api" / "seed_watchlists.json"


def main() -> None:
    table = os.environ["DDB_TABLE"]
    repo = DynamoWatchlistRepo(table)
    seed = json.loads(SEED_FILE.read_text())

    existing = {w.name for w in repo.list_all(DEMO_USER)}
    for name, tickers in seed.items():
        if name in existing:
            print(f"skip  {name} (already exists)")
            continue
        wl = repo.create(DEMO_USER, name)
        for t in tickers:
            repo.add_ticker(DEMO_USER, wl.id, t)
        print(f"seed  {name}: {len(tickers)} tickers")


if __name__ == "__main__":
    main()
