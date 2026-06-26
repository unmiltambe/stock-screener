#!/usr/bin/env python3
"""CDK app entry point for the stock-screener infrastructure (Phase 1).

Deploy:
    cd infra
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    cdk bootstrap                              # one-time per account/region
    cdk deploy -c basic_auth_pass='YOUR_PASS'  # password not committed

See ../../../../docs/deploy-aws.md for the architecture and full step-by-step.
"""
import aws_cdk as cdk

from stacks.stock_screener_stack import StockScreenerStack

app = cdk.App()
region = app.node.try_get_context("region") or "us-east-1"

StockScreenerStack(
    app,
    "StockScreenerStack",
    env=cdk.Environment(region=region),
)

app.synth()
