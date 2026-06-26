# ADR-0007 — Keep two deploy targets (AWS + Render) as a portability forcing function

- **Status:** Accepted
- **Date:** 2026-06-26
- **Deciders:** Project owner
- **Relates to:** [constitution P2/P3](../constitution.md), [ADR-0001](0001-backend-and-stack.md), [ADR-0005](0005-interim-demo-deployment.md), [structure.md](../structure.md)

## Context

Render started as a throwaway stepping stone ([ADR-0005](0005-interim-demo-deployment.md))
to get *a* public URL before the real AWS stack existed. AWS (Lambda + API Gateway
+ DynamoDB) is now live and is the production target.

The question: now that AWS works, do we delete the Render path? The owner proposed
**keeping it deliberately** — as a forcing function that keeps the app decoupled
from any single hosting service.

## Decision

**Keep both deploy targets long-term.** Render is no longer "throwaway"; it is a
deliberate **portability check**. The app must keep running cleanly on both:

| | Render | AWS |
|---|--------|-----|
| Process model | long-running server (uvicorn) | serverless, per-request (Mangum) |
| Store | `memory` adapter | `dynamo` adapter |

These differ in *process model* and *storage*, so "runs on both" is a real proof of
the portability the constitution claims ([P2 stateless](../constitution.md),
[P3 pure core + adapter boundary](../constitution.md)) — not a superficial variant.

This is what motivated the `app/` (shared) vs `deploy/<platform>/` (hosting-specific)
split in [structure.md](../structure.md): the boundary is now structural, not just
conventional.

## Scope of "keep"

- **The deploy *path* in the repo is kept and maintained** — this is where the
  forcing-function value lives, at ~zero cost (a Dockerfile + requirements + the
  root `render.yaml`).
- **The live Render *URL* is optional.** The guarantee comes from the path staying
  workable, exercised by an occasional redeploy. (Later: a CI job that builds both
  images would make the check automatic rather than relying on discipline.)

## Consequences

- The "throwaway" framing in [ADR-0005](0005-interim-demo-deployment.md) is
  **superseded**: the interim *server-rendered UI* is still temporary (replaced by
  the React SPA in Phase 3), but the *Render deployment path* is now permanent.
- Any change to deploy/runtime wiring must keep **both** targets green. A future CI
  matrix (build both images, run the suite) is the intended enforcement.
- One small asymmetry is accepted and documented: `render.yaml` lives at the repo
  root (Render requires it there) while AWS's equivalent (`cdk/`) lives neatly under
  `deploy/aws/` — see the comments in [`render.yaml`](../../render.yaml).
