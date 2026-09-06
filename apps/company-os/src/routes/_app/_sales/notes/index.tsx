import { createFileRoute } from "@tanstack/react-router"
import { Model } from "company-os/model"

import { ModelCollectionPage } from "@/ui/model/model-pages"
import { validateObjectCollectionSearch } from "@/ui/model/object-collection-view"
import { preloadCollection } from "@/ui/model/object-routing"

export const Route = createFileRoute("/_app/_sales/notes/")({
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => preloadCollection(Model.objects.note, deps),
  validateSearch: validateObjectCollectionSearch,
  component: NotesPage,
})

function NotesPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ModelCollectionPage
      object={Model.objects.note}
      search={search}
      onSearchChange={(next) =>
        void navigate({ replace: next.state !== undefined, search: next })
      }
    />
  )
}
