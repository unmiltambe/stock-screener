# CLAUDE.md — How to work in this repo

Behavioral guidance for an AI agent writing code here. This is about *how to
work*, not *what to build* — for the latter see [docs/constitution.md](docs/constitution.md)
(architecture) and [AGENTS.md](AGENTS.md) (repo orientation and guardrails).

Adapted from Karpathy's coding guidelines; the constitution's principles (P1–P10)
take precedence where they overlap.

## 1. Think before coding

Don't assume, don't hide confusion, surface tradeoffs. If a request has more than
one reasonable reading, say so and pick — don't choose silently. When a design has
real alternatives (as most UI work here does), lay them out with a recommendation
rather than implementing the first thing that compiles.

## 2. Simplicity first

Minimum code that solves the problem, nothing speculative. No unrequested
features, no abstraction for a second caller that doesn't exist yet, no defensive
handling for impossible states. Extract shared code when there *is* duplication
([P9](docs/constitution.md)), not in anticipation of it.

## 3. Surgical changes

Touch only what the task requires. Don't refactor working code you happened to
read, don't restyle unrelated sections, match the surrounding conventions. Clean
up only the mess your own change created.

## 4. Loop until verified — typecheck is not verification

Define what "done" looks like before starting, then prove it. In this repo,
`tsc --noEmit` passing is **not** proof: it has silently passed while the app was
broken (a type-only export that broke the bundle; a page that rendered blank).

Before declaring a frontend change done:
- Run the real bundle: `vite build` (catches what `tsc` misses, e.g. type-only
  import resolution).
- Load the affected page — the loading, empty, and populated states.

Report outcomes honestly. If something is untested, say so; don't imply
verification that didn't happen.
