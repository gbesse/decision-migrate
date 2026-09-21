# Security and reporting

Purpose: Define the trust boundary for this alpha.

Do not include credentials, customer records or private workflows in public GitHub issues. Local apps use loopback-only bearer authentication and explicit timeouts. The conformance suite runs trusted host adapters locally. Dependencies and host fixtures are pinned; no untrusted plugins are downloaded or executed automatically. Unexpected errors are surfaced; no administrator email transport is configured.
