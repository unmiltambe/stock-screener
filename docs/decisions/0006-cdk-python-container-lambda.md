# ADR-0006 — Infra in Python CDK; Lambda as a container image

- **Status:** Accepted
- **Date:** 2026-06-25
- **Deciders:** Project owner
- **Relates to:** [ADR-0001](0001-backend-and-stack.md), [infra.md](../infra.md), [design.md](../design.md)

## Context

Phase 1 provisions the backend on AWS via CDK. Two foundational choices shape the
infra code: the **CDK language**, and how the **Python Lambda is packaged** (its
deps include pandas/numpy via yfinance).

[design.md](../design.md) tentatively noted "CDK (TypeScript)". This ADR revisits
that with the owner's context in mind.

## Decision

1. **CDK in Python.** The owner is Python-fluent and there is no TypeScript in the
   repo yet (the React frontend is Phase 3). Python CDK keeps infra in the same
   language as the backend, lowering friction now. CDK-Python is feature-equivalent
   to CDK-TypeScript. This supersedes the design.md note.

2. **Lambda as a container image** (not a zip). yfinance pulls pandas/numpy, whose
   native wheels are awkward to bundle reliably in a zip and bump the 250 MB
   unzipped limit. A container image (AWS Lambda Python base, 10 GB limit) handles
   heavy deps cleanly and reuses the Docker approach from the interim Render step.
   CDK builds and pushes the image automatically (`DockerImageFunction`).

## Alternatives considered

- **CDK in TypeScript** — matches the eventual frontend toolchain and most CDK
  docs/examples, but adds a new language on top of new infra concepts for the owner
  right now. Revisit only if infra and frontend teams converge on TS later.
- **Zip + bundling** — lighter, marginally faster cold starts, but fragile for
  pandas/numpy and size-constrained. Rejected for reliability.

## Consequences

- `infra/` is a Python CDK app; contributors need Python (already required) rather
  than TS for infra.
- The Lambda image is built from `services/Dockerfile.lambda` (distinct from the
  Render `Dockerfile`, which runs uvicorn).
- Cold starts are slightly higher than a minimal zip; acceptable for a cached
  personal tool (see [infra.md](../infra.md) § Known limitations).
- If the team later standardizes infra on TypeScript, this is a contained rewrite
  of `infra/` only — no backend impact.
