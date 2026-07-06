# CLAUDE.md — How to work in this repo

Behavioral guidance for an AI agent writing code here. This is about *how to
work*, not *what to build* — for the latter see [docs/constitution.md](docs/constitution.md)
(architecture) and [AGENTS.md](AGENTS.md) (repo orientation and guardrails).

Adapted from Karpathy's coding guidelines; the constitution's principles (P1–P10)
take precedence where they overlap.

> For the **end-to-end checklist** that sequences everything below through commit,
> deploy, and post-deploy verification, see [docs/workflow.md](docs/workflow.md) —
> the single go-to change → ship runbook. The sections here are the *how/why* it
> links into.

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

**"Done" includes the paper trail.** If the change maps to a backlog item, close
the loop on it *as part of finishing*: update its status (✅ done / ◑ partial),
link the spec/ADR, and record what was deliberately deferred. A shipped feature
whose backlog entry still says "planned" is not done — and a doc that claims to
list "every column" / "every ADR" is stale the moment your change adds one. Update
the reference docs your change touches ([ui-columns.md](docs/ui-columns.md),
[screens.md](docs/screens.md) for any screen/route/nav change, the
[docs index](docs/README.md), etc.) in the same breath, not when someone notices.

## 5. Record decisions, not just code

Surfacing a tradeoff in chat (§1) is not the same as capturing it. A recommendation
spoken in conversation is gone the next session; a future contributor sees the
resulting code with no idea what else was considered or why. **Persist the decision
to a doc as part of the work, not as an afterthought someone has to ask for.**

Write an ADR (`docs/decisions/NNNN-title.md`) — or a short spec for a larger feature
— when a change does any of:
- introduces an external/third-party dependency (a SaaS, a new library, a hosted service);
- sends user data off-platform, or changes where data lives;
- is a user-facing feature with more than one reasonable approach;
- picks among alternatives that carry real, lasting tradeoffs.

This trigger is **independent of the P1–P10 check** in [AGENTS.md](AGENTS.md): a
change can violate no principle and still deserve a recorded decision (the principles
don't watch for external dependencies or data residency). Don't wait to be asked.

And reassess mid-flight: a change that *started* as a one-liner but has accumulated
several decisions across a few turns has outgrown "trivial" — stop and write it up
before finishing. ADR = the decision + rationale + alternatives rejected; spec = the
plan for a bigger feature. When unsure which, an ADR is the cheaper default.
