# @continual/runtime

The server-only execution engine for a Company Model. Persistence,
transactions, authorization, Tool implementation binding, and the oRPC,
OpenAPI, and MCP projections belong here.

`describeModel` derives a serializable public model description for clients and
Studio directly from the registered definitions. It is not a separately
authored or deployed manifest.

This package may depend on `@continual/model`. It must never import `@acme/*`;
customer-specific models and implementations are supplied by the API
composition root.
