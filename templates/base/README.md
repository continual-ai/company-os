# base

The starter for an optional app: a separate interface, such as a portal or public site, over the
central app's governed capabilities. It ships the deployment contract, the app stylesheet, a health
route, and one placeholder page to replace.

```sh
pnpm app:create base <app-name>
pnpm turbo run dev --filter=<app-name>
```

Run both from the repository root. The generator copies the template into `apps/<app-name>`, sets
the package name and `continual` key, installs the workspace, and typechecks the copy. The directory
name is the permanent app key; never rename a deployed app. Each app needs its own development port.

Business definitions, rules, storage, and authorization stay in `apps/company-os`. A copy imports
`company-os/model`, `company-os/client`, `company-os/config`, `company-os/ui/*`, and
`company-os/styles.css` only. Server functions call the central app through the typed client from
`company-os/client`, pointed at `COMPANY_OS_URL` and forwarding the hosting platform's identity
headers from the incoming request rather than minting identity itself; the placeholder page shows
the pattern. Read the [architecture](../../docs/architecture.md) and
[deployment](../../docs/runbooks/deployment.md) guides before connecting or publishing it.
