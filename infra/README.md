# infra

**AWS CDK (Python)** — Phase 1 infrastructure: DynamoDB + Lambda (container image)
+ API Gateway HTTP API. Architecture, control flows, and the step-by-step plan are
in [../docs/infra.md](../docs/infra.md).

## Layout

```
app.py                          CDK app entry (reads context: region, basic_auth_*)
cdk.json                        CDK config
requirements.txt                aws-cdk-lib, constructs
stacks/stock_screener_stack.py  the stack (Dynamo + Lambda + HTTP API + IAM)
```

The Lambda image is built from [`../services/Dockerfile.lambda`](../services/Dockerfile.lambda).

## Quick start

```bash
cd infra
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cdk bootstrap                               # one-time per account/region
cdk deploy -c basic_auth_pass='YOUR_PASS'   # password passed at deploy, not committed
```

Outputs `ApiUrl` and `TableName`. Then seed the demo watchlists:

```bash
cd ../services
DDB_TABLE='<TableName output>' AWS_REGION=us-east-1 python seed_dynamo.py
```

Teardown: `cd infra && cdk destroy` (the table uses `RemovalPolicy.DESTROY` in this
dev stack — switch to `RETAIN` before anything you care about).

_Not yet here: S3/CloudFront (Phase 3), Cognito (Phase 2), discovery batch (Phase 4)._
