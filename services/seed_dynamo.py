"""Seed the deployed DynamoDB table with the demo watchlists.

Run once after `cdk deploy`, from the services/ directory, with AWS credentials
configured and DDB_TABLE set to the deployed table name (a stack output):

    DDB_TABLE=StockScreenerStack-TableXXedited AWS_REGION=us-east-1 \
        python seed_dynamo.py

Idempotent: watchlists that already exist (by name) are skipped. Seeds under the
app's default user (AUTH_MODE=header → DEMO_USER), so the deployed site shows them.
"""
from __future__ import annotations

import json
import os
import pathlib

from adapters.dynamo import DynamoWatchlistRepo

DEMO_USER = "local-dev"  # must match api.deps.DEMO_USER
SEED_FILE = pathlib.Path(__file__).parent / "api" / "seed_watchlists.json"


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
