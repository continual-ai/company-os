import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { createEffectClient } from "#/runtime/client/create-client.ts"
import { createModelQueries } from "#/runtime/client/model-query-client.ts"
import { defineModel, defineModule, RecordId } from "#/runtime/model/index.ts"
import { PlatformModel } from "#/runtime/platform/model/index.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import { ModelUiProvider } from "#/runtime/ui/model/runtime-context.tsx"
import { useClient } from "#/runtime/ui/model/use-client.ts"

const personId = RecordId("person")("person_example")

const data = createModelQueries(
  fixtureModel,
  createEffectClient(fixtureModel, {
    baseUrl: "https://unused.test",
  })
)

it("uses the provided full client and portable kernel contract even when presentation hides modules", () => {
  const runtime = { ...testPresentation(PlatformModel), data }
  function Consumer() {
    const client = useClient(fixtureModel)
    const platform = useClient(PlatformModel)
    expect(client).toBe(data)
    expect(platform.asset).toBe(data.asset)
    expect(
      client.person.accounts.list.infiniteQueryOptions({
        id: personId,
        expand: true,
      }).meta?.objectTypes
    ).toContain("account")
    return <span>Ready</span>
  }
  const render = () =>
    renderToStaticMarkup(
      <ModelUiProvider value={runtime}>
        <Consumer />
      </ModelUiProvider>
    )
  expect(render()).toContain("Ready")
  expect(render()).toContain("Ready")
})

it("rejects a model that reuses a module ID with different definitions", () => {
  const unrelated = defineModel({
    name: "Unrelated",
    modules: [defineModule({ id: "platform", name: "Unrelated" })],
  })
  function Consumer() {
    useClient(unrelated)
    return null
  }
  expect(() =>
    renderToStaticMarkup(
      <ModelUiProvider value={{ ...testPresentation(fixtureModel), data }}>
        <Consumer />
      </ModelUiProvider>
    )
  ).toThrow(
    "The UI client was not created from this model's module definitions."
  )
})
