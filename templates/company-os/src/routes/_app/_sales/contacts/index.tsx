import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { contactViews } from "@/customization/collection-views"
import { ObjectCollection } from "@/ui/model/object-collection"
import { validateObjectCollectionSearch } from "@/ui/model/object-collection-view"

export const Route = createFileRoute("/_app/_sales/contacts/")({
  validateSearch: validateObjectCollectionSearch,
  component: ContactsPage,
})

function ContactsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ObjectCollection
      object={Model.objects.contact}
      recordHref={(recordId) => `/contacts/${recordId}`}
      search={search}
      views={contactViews}
      onSearchChange={(next) =>
        void navigate({ replace: next.state !== undefined, search: next })
      }
    />
  )
}
