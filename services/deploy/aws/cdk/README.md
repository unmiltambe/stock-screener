# services/deploy/aws/cdk

**AWS CDK (Python)** — Phase 1 infrastructure: DynamoDB + Lambda (container image)
+ API Gateway HTTP API. Architecture, control flows, and the step-by-step plan are
in [../../../../docs/deploy-aws.md](../../../../docs/deploy-aws.md).

## Layout

```
app.py                          CDK app entry (reads context: region, basic_auth_*)
cdk.json                        CDK config
requirements.txt                aws-cdk-lib, constructs
stacks/stock_screener_stack.py  the stack (Dynamo + Lambda + HTTP API + IAM)
```

The Lambda image is built from [`../Dockerfile`](../Dockerfile) (build context is
`services/`, so it can copy `app/...`).

## Quick start

```bash
cd services/deploy/aws/cdk
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cdk bootstrap                               # one-time per account/region
cdk deploy -c basic_auth_pass='YOUR_PASS'   # password passed at deploy, not committed
```

Outputs `ApiUrl` and `TableName`. Then seed the demo watchlists:

```bash
DDB_TABLE='<TableName output>' AWS_REGION=us-east-1 \
    python ../seed_dynamo.py
```

Teardown: `cdk destroy` (the table uses `RemovalPolicy.DESTROY` in this dev stack —
switch to `RETAIN` before anything you care about).

_Not yet here: S3/CloudFront (Phase 3), Cognito (Phase 2), discovery batch (Phase 4)._
