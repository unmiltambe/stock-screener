# infra

**AWS CDK (TypeScript)** — the entire stack as code ([P6](../docs/constitution.md)):
Cognito user pool, API Gateway (HTTP API + JWT authorizer), the API Lambda, the
discovery batch Lambda + EventBridge schedule, DynamoDB table, Secrets Manager,
and S3 + CloudFront for the web app.

Two stacks: `dev` and `prod`, each self-contained ([docs/design.md §8](../docs/design.md)).
Deployable to a clean AWS account with one command; no console click-ops as the
source of truth.

_Provisioning begins in roadmap Phase 1 and grows per phase._
