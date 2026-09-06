import { Model } from "company-os/model"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { SalesModule } from "@/modules/sales/model"

import { ModelCollectionPage, ModelRecordPage } from "./model-pages"
import {
  composeModelUi,
  defineModuleUi,
  ObjectActions,
  ModelUiProvider,
} from "./module-ui"

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
          actions={composeModelUi(extension).lead?.actions}
          record={{ id: "lead-1", etag: "1", name: "Convert buyer" }}
          can={() => allowed}
          placement={placement}
        />
      )
    expect(render(true, "row")).toContain("Convert buyer")
    expect(render(true, "record")).toContain("Convert buyer")
    expect(render(false, "record")).toBe("")
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
      <ModelUiProvider value={composeModelUi(replacement)}>
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
    expect(() => composeModelUi(extension, extension)).toThrow("Duplicate UI")
    expect(() =>
      defineModuleUi(SalesModule, {
        lead: {
          record: {
            additionalTabs: [
              { id: "overview", label: "Overview", component: () => null },
            ],
          },
        },
      })
    ).toThrow("Duplicate record tab")
    expect(() =>
      defineModuleUi(SalesModule, {
        company: {
          record: {
            additionalTabs: [
              { id: "contacts", label: "Contacts", component: () => null },
            ],
          },
        },
      })
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
