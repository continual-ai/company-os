import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { noteViews } from "@/customization/collection-views"
import { ObjectCollection } from "@/ui/model/object-collection"
import { validateObjectCollectionSearch } from "@/ui/model/object-collection-view"

export const Route = createFileRoute("/_app/_sales/notes/")({
  validateSearch: validateObjectCollectionSearch,
  component: NotesPage,
})

function NotesPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ObjectCollection
      object={Model.objects.note}
      recordHref={(recordId) => `/notes/${recordId}`}
      search={search}
      views={noteViews}
      onSearchChange={(next) =>
        void navigate({ replace: next.state !== undefined, search: next })
      }
    />
  )
}
