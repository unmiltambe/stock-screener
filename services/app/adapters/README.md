# services/app/adapters

The **IO boundary** around the pure core: market-data fetching, the score cache,
and per-user persistence. Each is an interface with a concrete implementation, so
the core stays pure ([P3](../../../docs/constitution.md)) and sources can be swapped.

- **market-data** — fetches prices/fundamentals; the only place upstream providers
  are called. Throttled; results flow through the cache ([P5](../../../docs/constitution.md)).
- **cache** — DynamoDB TTL-backed score cache (15 min), global across users.
- **repo** — DynamoDB per-user watchlists.

_Interfaces defined in Phase 0; DynamoDB-backed in Phase 1._
