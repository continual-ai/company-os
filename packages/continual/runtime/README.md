# @continual/runtime

The reusable kernel for defining and running a Company OS.

The runtime supplies company-neutral primitives and mechanical projections. Company packages use
it to describe their operating model; the private backend supplies the implementation. It never
imports `@acme/*`.

```ts
import { defineCompany, defineModule, defineObject } from "@continual/runtime"
```

## Owns

- Semantic definition primitives and type inference
- Serializable contract descriptions
- Execution and transport machinery that is universal across companies
- Fetch-compatible HTTP, typed clients, OpenAPI, and MCP projections as real consumers require them

## Does not own

- Company nouns, policy, handlers, repositories, or UI
- Provider-specific configuration or a hosted-platform dependency
- A second business contract for each transport

## Current state

The package implements objects, fields, modules, companies, and a versioned description projection.
Execution, actions, HTTP, clients, OpenAPI, MCP, and Effect v4 integration remain to be built.

Keep this as one package while the kernel is small. Add browser, server, or platform subpath exports
when concrete code needs those boundaries; do not reserve empty packages.
