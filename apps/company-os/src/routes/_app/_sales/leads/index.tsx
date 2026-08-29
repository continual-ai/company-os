import { createFileRoute } from "@tanstack/react-router"

import { leadViews } from "@/customization/collection-views"
import { validateObjectCollectionSearch } from "@/ui/model/object-collection-view"
import { LeadsPage } from "@/ui/sales/leads-page"

export const Route = createFileRoute("/_app/_sales/leads/")({
  validateSearch: validateObjectCollectionSearch,
  component: LeadsRoute,
})

function LeadsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <LeadsPage
      search={search}
      views={leadViews}
      onSearchChange={(next) =>
        void navigate({ replace: next.state !== undefined, search: next })
      }
    />
  )
}
