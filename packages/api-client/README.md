# packages/api-client

The typed client for the backend API: endpoint knowledge, auth header injection
(Cognito JWT), and error mapping — in one place. Built on `shared-types`.

Consumed by `apps/web` and a future `apps/mobile`. **Rule:** no UI imports
([P4](../../docs/constitution.md)). Platform differences (e.g. token storage) are
injected, not hard-coded.
