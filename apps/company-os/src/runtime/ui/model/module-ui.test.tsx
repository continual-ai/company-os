import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  FixtureModule,
  fixtureModel,
  kernelModel,
  Prospect,
} from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import {
  ModelCollectionPage,
  ModelRecordPage,
} from "#/runtime/ui/model/model-pages.tsx"
import {
  composeModelUi,
  defineModuleUi,
  ObjectActions,
} from "#/runtime/ui/model/module-ui.tsx"
import { ObjectCreateContext } from "#/runtime/ui/model/object-create-context.ts"
import { ObjectRecordFeed } from "#/runtime/ui/model/object-record-feed.tsx"
import { RecordRelationshipPreviews } from "#/runtime/ui/model/record-relationship-previews.tsx"
import { ModelUiProvider } from "#/runtime/ui/model/runtime-context.tsx"

const presentation = testPresentation(fixtureModel)
const extension = defineModuleUi(FixtureModule, {
  prospect: {
    actions: {
      convert: {
        component: ({ record }) => <button>{record.name}</button>,
        placements: ["row", "record"],
      },
    },
  },
})

const component = () => <div>Memo feed</div>

describe("module UI composition", () => {
  it("places relationship contributions on accepting records without replacing their UI", () => {
    const overview = defineModuleUi(
      FixtureModule,
      {
        account: { record: { properties: ["domain"] } },
      },
      [{ link: { id: "memoTopics" }, side: "reverse", component }]
    )
    const ui = composeModelUi(fixtureModel, overview)
    expect(ui.account?.record?.overviewRelationships?.memos).toBe(component)
    expect(ui.person?.record?.overviewRelationships?.memos).toBe(component)
    expect(ui.account?.record?.properties).toEqual(["domain"])
    expect(ui.memo?.record?.overviewRelationships).toBeUndefined()
    expect(composeModelUi(kernelModel, overview)).toEqual({})
    expect(() =>
      defineModuleUi(FixtureModule, {}, [
        { link: { id: "foreignLink" }, side: "reverse", component },
      ])
    ).toThrow("cannot extend link")
  })

  it("shares typed actions across row and record surfaces and hides unavailable actions", () => {
    const render = (allowed: boolean, placement: "row" | "record") =>
      renderToStaticMarkup(
        <ObjectActions
          actions={composeModelUi(fixtureModel, extension).prospect?.actions}
          record={{ id: "prospect-1", etag: "1", name: "Convert buyer" }}
          can={() => allowed}
          placement={placement}
        />
      )
    expect(render(true, "row")).toContain("Convert buyer")
    expect(render(true, "record")).toContain("Convert buyer")
    expect(render(false, "record")).toBe("")
  })

  it("uses one object summary in feeds and relationship previews without owning data loading", () => {
    const custom = defineModuleUi(FixtureModule, {
      prospect: {
        record: {
          summaryComponent: ({ record, variant, href, actions }) => (
            <article data-variant={variant}>
              <a href={href}>{record.name}</a>
              {actions}
            </article>
          ),
        },
      },
    })
    const record = {
      id: "prospect-example",
      etag: "1",
      name: "Custom prospect summary",
    }
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <ModelUiProvider
          value={{ ...presentation, ui: composeModelUi(fixtureModel, custom) }}
        >
          <ObjectRecordFeed
            items={[{ object: Prospect, record }]}
            label="Prospects"
            loading={false}
            renderActions={() => <button>Edit prospect</button>}
          />
          <ObjectCreateContext value={() => undefined}>
            <RecordRelationshipPreviews
              previews={[
                {
                  key: "prospects",
                  label: "Prospects",
                  relationship: {
                    key: "prospects",
                    label: "Prospects",
                    targetType: Prospect.id,
                    target: Prospect,
                    featured: true,
                    cardinality: "many",
                    creates: [{ target: Prospect, options: {} }],
                    list: () => {
                      throw new Error("Previews must not load collections")
                    },
                  },
                  total: 12,
                  pending: false,
                  error: false,
                  retry: () => undefined,
                  items: [{ object: Prospect, record }],
                },
              ]}
              onSelect={() => undefined}
            />
          </ObjectCreateContext>
        </ModelUiProvider>
      </QueryClientProvider>
    )
    expect(html.match(/Custom prospect summary/g)).toHaveLength(2)
    expect(html).toContain('data-variant="feed"')
    expect(html).toContain('data-variant="preview"')
    expect(html).toContain('href="/objects/prospect/prospect-example"')
    expect(html).toContain("Edit prospect")
    expect(html).toContain('aria-label="New prospect"')
    expect(html).toContain(">12</span>")
  })

  it("replaces complete pages with route context and no default-page data loading", () => {
    const replacement = defineModuleUi(FixtureModule, {
      prospect: {
        collection: {
          pageComponent: ({ object, search }) => (
            <output>
              {object.id}:{search?.view}
            </output>
          ),
        },
        record: {
          pageComponent: ({ object, recordId, tab }) => (
            <output>
              {object.id}:{recordId}:{tab}
            </output>
          ),
        },
      },
    })
    const html = renderToStaticMarkup(
      <ModelUiProvider
        value={{
          ...presentation,
          ui: composeModelUi(fixtureModel, replacement),
        }}
      >
        <ModelCollectionPage object={Prospect} search={{ view: "qualified" }} />
        <ModelRecordPage
          object={Prospect}
          recordId="prospect-example"
          tab="conversion"
        />
      </ModelUiProvider>
    )
    expect(html).toBe(
      "<output>prospect:qualified</output><output>prospect:prospect-example:conversion</output>"
    )
  })

  it("rejects conflicting registrations and built-in tab collisions", () => {
    expect(() => composeModelUi(fixtureModel, extension, extension)).toThrow(
      "Duplicate UI"
    )
    expect(() =>
      composeModelUi(
        fixtureModel,
        defineModuleUi(FixtureModule, {
          prospect: {
            record: {
              additionalTabs: [
                { id: "overview", label: "Overview", component: () => null },
              ],
            },
          },
        })
      )
    ).toThrow("Duplicate record tab")
    expect(() =>
      composeModelUi(
        fixtureModel,
        defineModuleUi(FixtureModule, {
          account: {
            record: {
              additionalTabs: [
                { id: "people", label: "People", component: () => null },
              ],
            },
          },
        })
      )
    ).toThrow("Duplicate record tab")
  })
  it("validates overview relationships against the composed model", () => {
    expect(() =>
      composeModelUi(
        fixtureModel,
        defineModuleUi(FixtureModule, {
          account: {
            record: { properties: ["domain"], relationships: ["people"] },
          },
        })
      )
    ).not.toThrow()
    expect(() =>
      composeModelUi(
        fixtureModel,
        defineModuleUi(FixtureModule, {
          account: { record: { relationships: ["missing"] } },
        })
      )
    ).toThrow("Unknown overview relationship")
    expect(() =>
      composeModelUi(
        fixtureModel,
        defineModuleUi(FixtureModule, {
          account: {
            record: {
              additionalTabs: [
                { id: "related", label: "Related", component: () => null },
              ],
            },
          },
        })
      )
    ).toThrow("Duplicate record tab")
  })
  it("rejects misspelled action registrations at both boundaries", () => {
    expect(() =>
      defineModuleUi(FixtureModule, {
        prospect: {
          actions: {
            // @ts-expect-error Action names come from Prospect, not an arbitrary string registry.
            misspelled: { component: () => null, placements: ["row"] },
          },
        },
      })
    ).toThrow("Unknown action")
  })
})
