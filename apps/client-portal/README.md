# client-portal

A satellite app over the central application: the place where customers see and act on their own
records. It ships the deployment contract, the app stylesheet, a health route, and a first page that
lists people from the central app through the typed client.

```sh
pnpm turbo run dev --filter=@company/client-portal
```

Business definitions, rules, storage, and authorization stay in `apps/company-os`. This app imports
`company-os/model`, `company-os/client`, and `company-os/config` only, and takes its primitives
and stylesheet from `@company/ui`. Server functions call the central app through `createClient` from
`company-os/client`, pointed at `COMPANY_OS_URL` and forwarding the hosting platform's identity
headers from the incoming request rather than minting identity. Read the
[architecture](../../docs/architecture.md) and [deployment](../../docs/runbooks/deployment.md) guides
before connecting or publishing it. Delete this directory if the company has no portal; copy it to
start another satellite.
