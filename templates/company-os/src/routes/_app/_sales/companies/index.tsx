import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { companyViews } from "@/customization/collection-views"
import { ObjectCollection } from "@/ui/model/object-collection"
import { validateObjectCollectionSearch } from "@/ui/model/object-collection-view"

export const Route = createFileRoute("/_app/_sales/companies/")({
  validateSearch: validateObjectCollectionSearch,
  component: CompaniesPage,
})

function CompaniesPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ObjectCollection
      object={Model.objects.company}
      recordHref={(recordId) => `/companies/${recordId}`}
      search={search}
      views={companyViews}
      onSearchChange={(next) =>
        void navigate({ replace: next.state !== undefined, search: next })
      }
    />
  )
}
