#!/usr/bin/env bash
#
# Deploy stock-screener to AWS. Encodes the runbook in docs/deploy-aws.md so the
# footguns can't be forgotten: reads the /ui password from the live Lambda (never
# echoed), keeps the prod Cognito callback (frontend_url pinned in cdk.json),
# forces a diff before any backend apply, and smoke-checks after.
#
# Usage:
#   ./deploy.sh diff       backend cdk diff only — REVIEW this before backend/all
#   ./deploy.sh backend    cdk deploy the Lambda (after reviewing the diff)
#   ./deploy.sh frontend   build SPA -> S3 sync -> CloudFront invalidation
#   ./deploy.sh smoke      post-deploy checks (health, Cognito callbacks, fresh fields)
#   ./deploy.sh all        backend + frontend + smoke (only after reviewing diff)
#
set -eo pipefail
export JSII_SILENCE_WARNING_UNTESTED_NODE_VERSION=1

STACK="StockScreenerStack"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CDK_DIR="$REPO_ROOT/services/deploy/aws/cdk"
WEB_DIR="$REPO_ROOT/apps/web"

# Resolve all resource ids from the live stack — no hardcoded, drift-prone values.
load_config() {
  echo ">> reading outputs from CloudFormation stack: $STACK" >&2
  local outs
  outs="$(aws cloudformation describe-stacks --stack-name "$STACK" \
    --query 'Stacks[0].Outputs' --output json)"
  get() { echo "$outs" | python3 -c \
    "import sys,json;print(next((o['OutputValue'] for o in json.load(sys.stdin) if o['OutputKey']=='$1'),''))"; }
  FRONTEND_URL="$(get FrontendUrl)"
  FRONTEND_BUCKET="$(get FrontendBucket)"
  DISTRIBUTION_ID="$(get DistributionId)"
  USER_POOL_ID="$(get UserPoolId)"
  USER_POOL_CLIENT_ID="$(get UserPoolClientId)"
  FUNCTION_NAME="$(aws lambda list-functions \
    --query "Functions[?starts_with(FunctionName, '${STACK}-Api')].FunctionName | [0]" \
    --output text)"
  for v in FRONTEND_URL FRONTEND_BUCKET DISTRIBUTION_ID USER_POOL_ID USER_POOL_CLIENT_ID FUNCTION_NAME; do
    if [ -z "${!v}" ] || [ "${!v}" = "None" ]; then
      echo "ERROR: could not resolve $v from the stack" >&2; exit 1
    fi
  done
}

# Preserve the interim /ui basic-auth password across deploys; NEVER printed.
read_pass() {
  BASIC_AUTH_PASS="$(aws lambda get-function-configuration --function-name "$FUNCTION_NAME" \
    --query 'Environment.Variables.BASIC_AUTH_PASS' --output text 2>/dev/null)"
  if [ -z "$BASIC_AUTH_PASS" ] || [ "$BASIC_AUTH_PASS" = "None" ]; then
    echo "ERROR: could not read existing BASIC_AUTH_PASS — deploying would reset the /ui password. Aborting." >&2
    exit 1
  fi
}

backend_diff() {
  cd "$CDK_DIR"; source .venv/bin/activate; read_pass
  echo ">> cdk diff — REVIEW: the only change should be the Lambda image URI."
  echo "   (frontend_url is pinned in cdk.json; Cognito callback URLs must NOT appear here)"
  cdk diff -c basic_auth_pass="$BASIC_AUTH_PASS"
}

backend_deploy() {
  cd "$CDK_DIR"; source .venv/bin/activate; read_pass
  echo ">> cdk deploy (basic_auth_pass preserved; frontend_url from cdk.json)"
  cdk deploy -c basic_auth_pass="$BASIC_AUTH_PASS"
}

frontend_deploy() {
  cd "$WEB_DIR"
  echo ">> build SPA";           npm run build
  echo ">> sync dist -> S3";     aws s3 sync dist/ "s3://$FRONTEND_BUCKET/" --delete
  echo ">> invalidate CloudFront"
  aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" \
    --paths '/*' --query 'Invalidation.{Id:Id,Status:Status}' --output json
}

smoke() {
  echo ">> /health"; curl -s "$FRONTEND_URL/health"; echo
  echo ">> Cognito CallbackURLs (MUST include ${FRONTEND_URL}/callback):"
  aws cognito-idp describe-user-pool-client --user-pool-id "$USER_POOL_ID" \
    --client-id "$USER_POOL_CLIENT_ID" --query 'UserPoolClient.CallbackURLs' --output text
  echo ">> fresh-ticker fields (uncached WSO — popular symbols may be cache-stale ~15min):"
  curl -s -H "X-Guest-Id: $(uuidgen)" "$FRONTEND_URL/v1/scores?tickers=WSO" \
    | python3 -c "import sys,json;r=json.load(sys.stdin)[0];print({k:r.get(k) for k in ('ticker','price','dayChange','dayChangePct')})"
}

usage() {
  sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 1
}

load_config
case "${1:-}" in
  diff)     backend_diff ;;
  backend)  backend_deploy ;;
  frontend) frontend_deploy ;;
  smoke)    smoke ;;
  all)      backend_deploy; frontend_deploy; smoke ;;
  *)        usage ;;
esac
