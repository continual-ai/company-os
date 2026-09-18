import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import {
  defineAction,
  defineObject,
  defineModel,
  defineModule,
  schema,
} from "#/runtime/model/index.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import { useAppForm } from "#/runtime/ui/forms/app-form.ts"
import { SchemaFormField } from "#/runtime/ui/forms/schema-form-field.tsx"
import {
  schemaFormDefault,
  schemaFormInput,
} from "#/runtime/ui/forms/schema-form-values.ts"
import {
  objectFormDefaultValues,
  decodeObjectForm,
} from "#/runtime/ui/model/object-form.ts"
import type { ObjectFormValues } from "#/runtime/ui/model/object-form.ts"
import {
  decodeOperationForm,
  operationFormDefaults,
} from "#/runtime/ui/model/operation-form.ts"

const Authentication = schema.discriminatedUnion(
  "type",
  [
    schema.object(
      {
        type: schema.literal("apiKey"),
        key: schema.secret({ label: "API key", minLength: 5 }),
      },
      { label: "API key" }
    ),
    schema.object(
      {
        type: schema.literal("oauth2"),
        clientId: schema.string({ label: "Client ID", minLength: 1 }),
        settings: schema.object(
          {
            retries: schema.number({ default: 3 }),
            enabled: schema.boolean({ default: true }),
            scopes: schema.array(schema.string()),
            extra: schema.optional(
              schema.object({ audience: schema.string() })
            ),
          },
          { label: "Options" }
        ),
      },
      { label: "OAuth 2.0", description: "Authorize with your provider." }
    ),
  ],
  { label: "Authentication" }
)

const Connect = defineAction({
  id: "connectTest",
  name: "Connect",
  description: "Test structured input.",
  input: { authentication: Authentication },
})

it("edits arbitrary JSON as JSON text and preserves null, primitives, and nested values", () => {
  const field = schema.json({ label: "Payload" })
  const object = defineObject({
    id: "jsonForm",
    collection: "jsonForms",
    name: "JSON form",
    pluralName: "JSON forms",
    properties: { name: schema.string(), payload: field },
    display: { title: "name" },
  })
  const runtime = testPresentation(
    defineModel({
      name: "JSON form",
      modules: [
        defineModule({
          id: "jsonFormTest",
          name: "JSON form test",
          objects: [object],
        }),
      ],
    })
  )
  for (const value of [
    null,
    false,
    0,
    "",
    "text",
    [],
    { nested: [null, true] },
  ]) {
    const raw = schemaFormDefault(field, value)
    expect(raw).toBe(JSON.stringify(value, null, 2))
    expect(
      decodeObjectForm(
        runtime,
        object,
        { name: "Example", payload: raw },
        "create"
      )
    ).toEqual({ name: "Example", payload: value })
  }
  expect(schemaFormDefault(schema.json({ default: null }))).toBe("null")
  expect(() =>
    decodeObjectForm(
      runtime,
      object,
      { name: "Example", payload: "{" },
      "create"
    )
  ).toThrow()
  function Example() {
    const defaultValues: ObjectFormValues = {
      payload: schemaFormDefault(field, { count: 0 }),
    }
    const form = useAppForm({ defaultValues })
    return (
      <form.AppForm>
        <SchemaFormField
          id="payload"
          schema={field}
          fieldId="payload"
          required
          referenceLabels={new Map()}
        />
      </form.AppForm>
    )
  }
  const html = renderToStaticMarkup(<Example />)
  expect(html).toContain("<textarea")
  expect(html).toContain("Payload")
  expect(html).toContain("count")
})

it("initializes nested defaults, preserves absence, and submits only the selected variant", () => {
  expect(operationFormDefaults(Connect)).toEqual({
    authentication: { type: "apiKey", key: "" },
  })
  const raw = schemaFormDefault(Authentication, {
    type: "oauth2",
    clientId: "client",
  })
  expect(raw).toEqual({
    type: "oauth2",
    clientId: "client",
    settings: { retries: "3", enabled: true, scopes: "", extra: null },
  })
  expect(
    decodeOperationForm(Connect, {
      authentication: {
        ...(typeof raw === "object" && raw !== null
          ? Object.fromEntries(Object.entries(raw))
          : {}),
        key: "obsolete-secret",
        settings: {
          retries: "0",
          enabled: false,
          scopes: "read\nwrite",
          extra: null,
        },
      },
    })
  ).toEqual({
    authentication: {
      type: "oauth2",
      clientId: "client",
      settings: { retries: 0, enabled: false, scopes: ["read", "write"] },
    },
  })
  expect(schemaFormDefault(Authentication.members[0])).toEqual({
    type: "apiKey",
    key: "",
  })
  expect(
    schemaFormInput(
      schema.object({ value: schema.string() }, { nullable: true }),
      null
    )
  ).toBeNull()
})

it("never prefills secrets, including nested defaults supplied by callers", () => {
  expect(
    schemaFormDefault(Authentication, { type: "apiKey", key: "do-not-prefill" })
  ).toEqual({ type: "apiKey", key: "" })
})

it("renders nested fields, variant descriptions, and password inputs from schema metadata", () => {
  function Example({ oauth = false }: { oauth?: boolean }) {
    const defaultValues: ObjectFormValues = {
      authentication: schemaFormDefault(
        Authentication,
        oauth ? { type: "oauth2", clientId: "client" } : undefined
      ),
    }
    const form = useAppForm({ defaultValues })
    return (
      <form.AppForm>
        <SchemaFormField
          id="authentication"
          schema={Authentication}
          fieldId="authentication"
          required
          referenceLabels={new Map()}
        />
      </form.AppForm>
    )
  }
  const oauth = renderToStaticMarkup(<Example oauth />)
  expect(oauth).toContain("Client ID")
  expect(oauth).toContain("Options")
  expect(oauth).toContain("Authorize with your provider.")
  expect(oauth).not.toContain('type="password"')
  const key = renderToStaticMarkup(<Example />)
  expect(key).toContain('type="password"')
  expect(key).toContain('autoComplete="new-password"')
  expect(key).not.toContain("Client ID")
})

it("round trips structured object properties through the standard create form", () => {
  const configuration = schema.discriminatedUnion("type", [
    schema.object({ type: schema.literal("disabled") }),
    schema.object({
      type: schema.literal("oauth2"),
      settings: schema.object({
        clientId: schema.string(),
        attempts: schema.number(),
      }),
    }),
  ])
  const connector = defineObject({
    id: "formConnector",
    collection: "formConnectors",
    name: "Connector",
    pluralName: "Connectors",
    properties: { name: schema.string(), configuration },
    display: { title: "name" },
  })
  const model = defineModel({
    name: "Forms",
    modules: [
      defineModule({ id: "forms", name: "Forms", objects: [connector] }),
    ],
  })
  const runtime = testPresentation(model)
  const defaults = objectFormDefaultValues(
    runtime,
    connector,
    "create",
    undefined,
    new Date(),
    {
      name: "Example",
      configuration: {
        type: "oauth2",
        settings: { clientId: "client", attempts: 0 },
      },
    }
  )
  expect(defaults.configuration).toEqual({
    type: "oauth2",
    settings: { clientId: "client", attempts: "0" },
  })
  expect(
    decodeObjectForm(runtime, connector, defaults, "create")
  ).toMatchObject({
    configuration: {
      type: "oauth2",
      settings: { clientId: "client", attempts: 0 },
    },
  })
})

it("initializes optional defaults without converting booleans to strings", () => {
  const action = defineAction({
    id: "optionalDefault",
    name: "Optional default",
    description: "",
    input: {
      notify: schema.optional(schema.boolean({ default: true })),
      settings: schema.optional(
        schema.object(
          { attempts: schema.number() },
          { default: { attempts: 0 } }
        )
      ),
    },
  })
  const values = operationFormDefaults(action)
  expect(values).toEqual({ notify: true, settings: { attempts: "0" } })
  expect(decodeOperationForm(action, values)).toEqual({
    notify: true,
    settings: { attempts: 0 },
  })
})

function SecretArrayExample() {
  const defaultValues: ObjectFormValues = { credentials: "" }
  const form = useAppForm({ defaultValues })
  return (
    <form.AppForm>
      <SchemaFormField
        id="credentials"
        schema={schema.array(schema.secret())}
        fieldId="credentials"
        required
        json
        referenceLabels={new Map()}
      />
    </form.AppForm>
  )
}

it("does not fall back to an unmasked JSON or multiline editor for secret containers", () => {
  const html = renderToStaticMarkup(<SecretArrayExample />)
  expect(html).toContain("unsupported")
  expect(html).not.toContain("<textarea")
})

it("round trips nested JSON fallback values and preserves explicit nullable clearing", () => {
  const nested = schema.object({
    headers: schema.map(schema.string()),
    items: schema.array(schema.object({ count: schema.number() })),
  })
  const input = {
    headers: { accept: "application/json" },
    items: [{ count: 0 }],
  }
  const defaults = schemaFormDefault(nested, input)
  expect(defaults).toEqual({
    headers: '{"accept":"application/json"}',
    items: '[{"count":0}]',
  })
  expect(schemaFormInput(nested, defaults)).toEqual(input)
  expect(
    schemaFormInput(
      schema.object(
        { endpoint: schema.string() },
        { nullable: true, default: { endpoint: "default" } }
      ),
      null
    )
  ).toBeNull()
})

it("edits nested secret presence by omission and only clears on explicit remove", () => {
  const connector = defineObject({
    id: "protectedConnector",
    collection: "protectedConnectors",
    name: "Connector",
    pluralName: "Connectors",
    display: { title: "name" },
    properties: {
      name: schema.string(),
      apiKey: schema.secret({ nullable: true }),
      authentication: Authentication,
    },
  })
  const runtime = testPresentation(
    defineModel({
      name: "Protected forms",
      modules: [
        defineModule({
          id: "protectedForms",
          name: "Protected forms",
          objects: [connector],
        }),
      ],
    })
  )
  const state = {
    name: "Changed",
    apiKey: { hint: null },
    authentication: { type: "apiKey", key: { hint: null } },
  }
  expect(decodeObjectForm(runtime, connector, state, "edit")).toEqual({
    name: "Changed",
    authentication: { type: "apiKey" },
  })
  expect(
    decodeObjectForm(runtime, connector, { ...state, apiKey: null }, "edit")
  ).toMatchObject({ apiKey: null })
  expect(
    decodeObjectForm(
      runtime,
      connector,
      { ...state, apiKey: "replacement" },
      "edit"
    )
  ).toMatchObject({ apiKey: "replacement" })
  expect(() => decodeObjectForm(runtime, connector, state, "create")).toThrow()
  expect(() =>
    decodeObjectForm(runtime, connector, { ...state, apiKey: "" }, "edit")
  ).toThrow()
})
