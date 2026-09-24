// oxlint-disable effecttsgo/process-env -- Live test credentials and opt-in flag are supplied by the test runner.
import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import { makeContinualIdentityProvider } from "#/app/server/auth/identity-provider.ts"
import { readGitHubSnapshot } from "#/app/server/github-snapshot.ts"

describe.skipIf(!process.env.RUN_E2E_TESTS)("published runtime SDK", () => {
  it("verifies real App identity and reads GitHub through a Project Connection", async () => {
    const assertion = process.env.COMPANY_OS_TEST_RUNTIME_ASSERTION
    const connectionId = process.env.COMPANY_OS_TEST_CONNECTION_ID
    const repo = process.env.COMPANY_OS_TEST_REPOSITORY
    if (!assertion || !connectionId || !repo)
      throw new Error(
        "Configure the live test's short-lived runtime assertion, Connection ID and repository."
      )
    const request = new Request("https://company-os.test", {
      headers: {
        "x-continual-app-runtime-assertion": assertion,
        "x-continual-app-runtime-origin": process.env.CONTINUAL_URL!,
      },
    })
    const provider = Effect.runSync(makeContinualIdentityProvider)
    const actor = await Effect.runPromise(provider.identify(request.headers))
    expect(actor?.issuer).toBe("continual")
    const snapshot = await readGitHubSnapshot(request, connectionId, repo)
    expect(snapshot.full_name.toLowerCase()).toBe(repo.toLowerCase())
    expect(snapshot.node_id.length).toBeGreaterThan(0)
  }, 60000)
})
