import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"
import { useCallback, useState } from "react"

import { ObjectTable } from "@/components/object-table/object-table"
import type {
  ObjectTableRecord,
  ObjectTableValue,
} from "@/components/object-table/object-table-config"
import { exampleCompanyRecords } from "@/components/object-table/object-table-example-data"
import {
  objectTableExampleVisiblePropertyIds,
  ObjectTableExampleCompany,
} from "@/components/object-table/object-table-example-object"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Companies",
  description: Model.objects.company.description ?? "Browse company records.",
  title: "Companies",
}

export const Route = createFileRoute("/_app/companies")({
  ...pageOptions(page),
  component: CompaniesPage,
})

function CompaniesPage() {
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
    <ObjectTable
      object={ObjectTableExampleCompany}
      records={companies}
      visiblePropertyIds={objectTableExampleVisiblePropertyIds}
      onCellCommit={updateCompany}
      onCreateRecord={createCompany}
    />
  )
}
