# @continual/cli

The `continual` executable for local developer workflows. The CLI owns argument
parsing, environment discovery, browser launch preferences, logs, and process
lifecycle; it delegates the actual application to `@continual/studio`.

```bash
continual studio
continual studio --url http://localhost:4000
continual studio --port 5555 --browser none
```

The Runtime URL resolves from `--url`, then `CONTINUAL_API_URL`, then
`http://localhost:4000`. Remote credentials are read from `CONTINUAL_TOKEN` by
Studio's local server and should not be passed as command-line arguments.

This package contains no Runtime implementation and no customer-specific code.
