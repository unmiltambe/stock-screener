# packages/shared-types

TypeScript types for the API contracts — request/response shapes mirroring the
backend ([docs/design.md §3](../../docs/design.md)). One source of truth, consumed
by `api-client`, `apps/web`, and a future `apps/mobile`.

**Rule:** types only. No UI, no runtime framework dependencies
([P4](../../docs/constitution.md)).
