# base

The minimal starter for any optional Company OS application.
It carries the full deployment contract and consumes the central app's model and UI, with a single placeholder page to replace.

Create an app from it with a name of your choice:

```sh
pnpm app:create base <app-name>
```

Run commands from the repository root. The generator installs the workspace and typechecks the copy;
start it with `pnpm turbo run dev --filter=<app-name>`. Replace its placeholder page with your
workflow. Authentication and backend data access are not preconfigured.

Business definitions and rules stay in the central app. This optional interface may import
`company-os/model`, `company-os/metadata`, `company-os/ui/*`, and `company-os/styles.css`; it calls the
governed API for business operations. Read [architecture](../../docs/architecture.md) and
[deployment](../../docs/runbooks/deployment.md) before connecting or publishing it.
