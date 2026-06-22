# services/api

The HTTP backend — **FastAPI** app exposed on AWS Lambda via Mangum, behind API
Gateway ([docs/design.md §3](../../docs/design.md)).

Responsibilities: request validation, auth context (read verified `userId` from the
Cognito JWT claim — never from path/body), and orchestration. It depends on
`services/core` (scoring) and `services/adapters` (data/cache/persistence) — and
contains **no** scoring or IO logic itself.

_Lands in roadmap Phase 1._
