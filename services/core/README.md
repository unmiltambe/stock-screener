# services/core

The **pure scoring logic** — Fundamental, Technical, Combined scores and Signal,
exactly per [docs/SCORING.md](../../docs/SCORING.md).

**Rule ([P3](../../docs/constitution.md)):** no web framework, no network, no global
state. Plain numbers in, plain numbers out. This is the most stable, most-tested
part of the system, reused by both the API request path and the discovery batch.

_Ported from the prototype in roadmap Phase 0._
