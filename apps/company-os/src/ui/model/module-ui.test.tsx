import {
  ModelCollectionPage,
  ModelRecordPage,
} from "@company/runtime/ui/model/model-pages"
import {
  composeModelUi,
  defineModuleUi,
  ObjectActions,
} from "@company/runtime/ui/model/module-ui"
import { ObjectRecordFeed } from "@company/runtime/ui/model/object-record-feed"
import { RecordRelationshipPreviews } from "@company/runtime/ui/model/record-relationship-previews"
import { ModelUiProvider } from "@company/runtime/ui/model/runtime-context"
import { SalesModule } from "@company/sales/model"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { Model } from "#/examples/model.ts"
import { presentation } from "#/examples/presentation.ts"

const extension = defineModuleUi(SalesModule, {
  lead: {
    actions: {
      convert: {
        component: ({ record }) => <button>{record.name}</button>,
        placements: ["row", "record"],
      },
    },
  },
})

describe("module UI composition", () => {
  it("shares typed actions across row and record surfaces and hides unauthorized actions", () => {
    const render = (allowed: boolean, placement: "row" | "record") =>
      renderToStaticMarkup(
        <ObjectActions
          actions={composeModelUi(Model, extension).lead?.actions}
          record={{ id: "lead-1", etag: "1", name: "Convert buyer" }}
          can={() => allowed}
          placement={placement}
        />
      )
    expect(render(true, "row")).toContain("Convert buyer")
    expect(render(true, "record")).toContain("Convert buyer")
    expect(render(false, "record")).toBe("")
  })

  it("uses one object summary in feeds and relationship previews without owning data loading", () => {
    const custom = defineModuleUi(SalesModule, {
      lead: {
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
      id: "lead-example",
      etag: "1",
      name: "Custom lead summary",
    }
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <ModelUiProvider
          value={{ ...presentation, ui: composeModelUi(Model, custom) }}
        >
          <ObjectRecordFeed
            items={[{ object: Model.objects.lead, record }]}
            label="Leads"
            loading={false}
            renderActions={() => <button>Edit lead</button>}
          />
          <RecordRelationshipPreviews
            previews={[
              {
                key: "leads",
                label: "Leads",
                total: 12,
                pending: false,
                error: false,
                retry: () => undefined,
                items: [{ object: Model.objects.lead, record }],
              },
            ]}
            onSelect={() => undefined}
          />
        </ModelUiProvider>
      </QueryClientProvider>
    )
    expect(html.match(/Custom lead summary/g)).toHaveLength(2)
    expect(html).toContain('data-variant="feed"')
    expect(html).toContain('data-variant="preview"')
    expect(html).toContain('href="/objects/lead/lead-example"')
    expect(html).toContain("Edit lead")
    expect(html).toContain(">12</span>")
  })

  it("replaces complete pages with route context and no default-page data loading", () => {
    const replacement = defineModuleUi(SalesModule, {
      lead: {
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
        value={{ ...presentation, ui: composeModelUi(Model, replacement) }}
      >
        <ModelCollectionPage
          object={Model.objects.lead}
          search={{ view: "qualified" }}
        />
        <ModelRecordPage
          object={Model.objects.lead}
          recordId="lead-example"
          tab="conversion"
        />
      </ModelUiProvider>
    )
    expect(html).toBe(
      "<output>lead:qualified</output><output>lead:lead-example:conversion</output>"
    )
  })

  it("rejects conflicting registrations and built-in tab collisions", () => {
    expect(() => composeModelUi(Model, extension, extension)).toThrow(
      "Duplicate UI"
    )
    expect(() =>
      composeModelUi(
        Model,
        defineModuleUi(SalesModule, {
          lead: {
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
        Model,
        defineModuleUi(SalesModule, {
          company: {
            record: {
              additionalTabs: [
                { id: "contacts", label: "Contacts", component: () => null },
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
        Model,
        defineModuleUi(SalesModule, {
          company: {
            record: { properties: ["domain"], relationships: ["contacts"] },
          },
        })
      )
    ).not.toThrow()
    expect(() =>
      composeModelUi(
        Model,
        defineModuleUi(SalesModule, {
          company: { record: { relationships: ["missing"] } },
        })
      )
    ).toThrow("Unknown overview relationship")
    expect(() =>
      composeModelUi(
        Model,
        defineModuleUi(SalesModule, {
          company: {
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
      defineModuleUi(SalesModule, {
        lead: {
          actions: {
            // @ts-expect-error Action names come from Lead, not an arbitrary string registry.
            misspelled: { component: () => null, placements: ["row"] },
          },
        },
      })
    ).toThrow("Unknown action")
  })
})
