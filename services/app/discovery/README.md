# services/discovery

The **discovery engine** ([ADR-0003](../../../docs/decisions/0003-discovery-engine.md)):
the universe definition and the scheduled batch entrypoint that scores it.

Runs as an EventBridge-scheduled Lambda (target: daily), reusing `services/app/core` for
scoring and `services/app/adapters` for data. Writes a ranked `UNIVERSE#<asOf>` snapshot
to DynamoDB and flips the `LATEST` pointer; the `/screen` and `/suggestions`
endpoints read that snapshot ([docs/design.md §6](../../../docs/design.md)).

**Rules:** never score the universe on a user request path
([P5](../../../docs/constitution.md)); don't fork scoring logic — reuse `services/app/core`.

Initial universe: **S&P 500** (small enough to validate the pipeline before a paid
data source). _Lands in roadmap Phase 4._
