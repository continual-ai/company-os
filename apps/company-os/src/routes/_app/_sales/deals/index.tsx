import { Model } from "@company/model"
import { Button } from "@company/ui/components/button"
import { Link, createFileRoute } from "@tanstack/react-router"

import { dealViews } from "@/customization/collection-views"
import { ObjectCollection } from "@/ui/model/object-collection"
import { validateObjectCollectionSearch } from "@/ui/model/object-collection-view"

export const Route = createFileRoute("/_app/_sales/deals/")({
  validateSearch: validateObjectCollectionSearch,
  component: DealsPage,
})

function DealsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ObjectCollection
      object={Model.objects.deal}
      recordHref={(recordId) => `/deals/${recordId}`}
      search={search}
      views={dealViews}
      onSearchChange={(next) =>
        void navigate({ replace: next.state !== undefined, search: next })
      }
      renderCollectionActions={() => (
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link to="/line-items" />}
        >
          Line items
        </Button>
      )}
    />
  )
}
