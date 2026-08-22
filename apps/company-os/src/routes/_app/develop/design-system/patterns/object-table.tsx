import { createFileRoute } from "@tanstack/react-router"
import { useCallback, useState } from "react"

import { ObjectTable } from "@/components/object-table/object-table"
import type {
  ObjectTableRecord,
  ObjectTableValue,
} from "@/components/object-table/object-table-config"
import {
  exampleCompanyRecords,
  resolveExampleCompanyImage,
} from "@/components/object-table/object-table-example-data"
import {
  objectTableExampleVisiblePropertyIds,
  ObjectTableExampleCompany,
} from "@/components/object-table/object-table-example-object"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Object table",
  description:
    "A metadata-informed operating grid for scanning, filtering, and editing business records.",
  title: "Object table",
}

export const Route = createFileRoute(
  "/_app/develop/design-system/patterns/object-table"
)({
  ...pageOptions(page),
  component: ObjectTablePatternPage,
})

function ObjectTablePatternPage() {
  const [companies, setCompanies] = useState<ObjectTableRecord[]>(
    exampleCompanyRecords
  )

  const updateCompany = useCallback(
    async (recordId: string, propertyId: string, value: ObjectTableValue) => {
      await new Promise((resolve) => window.setTimeout(resolve, 180))
      setCompanies((current) =>
        current.map((company) =>
          company.id === recordId
            ? { ...company, [propertyId]: value }
            : company
        )
      )
    },
    []
  )

  const createCompany = useCallback(() => {
    setCompanies((current) => [
      {
        id: crypto.randomUUID(),
        logo: null,
        name: "Untitled company",
        lifecycleStage: "prospect",
        categories: [],
        contactEmail: "",
        contactPhone: "",
        description: "",
        domain: "",
        employeeCount: null,
        foundedOn: null,
        lastReviewedAt: null,
        linkedIn: "",
        strategic: false,
        website: "",
        industry: "",
      },
      ...current,
    ])
  }, [])

  return (
    <div className="w-full px-5 py-10 lg:px-8 lg:py-12">
      <header className="max-w-3xl">
        <p className="text-xs font-medium text-muted-foreground">
          Product pattern
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Object table
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          A dense, keyboard-operable view over company-owned object metadata.
          Select a cell and use the arrow keys to move; type, press Enter, or
          double-click to edit. Active multi-value and long-text cells expand
          above the grid without changing row geometry.
        </p>
      </header>

      <div className="mt-8 h-[34rem] min-w-0 overflow-hidden border xl:h-[40rem]">
        <ObjectTable
          object={ObjectTableExampleCompany}
          records={companies}
          resolveImageSrc={resolveExampleCompanyImage}
          visiblePropertyIds={objectTableExampleVisiblePropertyIds}
          onCellCommit={updateCompany}
          onCreateRecord={createCompany}
        />
      </div>

      <section className="mt-12 grid gap-8 border-t pt-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <p className="text-xs font-medium text-muted-foreground">Boundary</p>
        <div className="grid gap-px border bg-border sm:grid-cols-2">
          <div className="bg-background p-5">
            <h2 className="text-sm font-medium">Metadata informs mechanics</h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Property definitions select cell adapters, labels, filter
              operators, editors, and read-only behavior.
            </p>
          </div>
          <div className="bg-background p-5">
            <h2 className="text-sm font-medium">Applications own behavior</h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Routes still own queries, persistence, actions, visible columns,
              and any workflow-specific composition around the grid.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12 grid gap-8 border-t pt-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <p className="text-xs font-medium text-muted-foreground">
          Cell adapter
        </p>
        <div className="grid gap-px border bg-border sm:grid-cols-3">
          <div className="bg-background p-5">
            <h2 className="text-sm font-medium">Type</h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              A semantic cell type normalizes the property schema into one
              stable adapter name.
            </p>
          </div>
          <div className="bg-background p-5">
            <h2 className="text-sm font-medium">Behavior</h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              The behavior registry declares editing, input, filtering, and
              overflow policy without React.
            </p>
          </div>
          <div className="bg-background p-5">
            <h2 className="text-sm font-medium">Renderer</h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              The renderer registry owns display, hover previews, and the
              type-specific editor.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
