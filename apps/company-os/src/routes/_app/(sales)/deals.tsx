import { Model } from "@company/model"
import { Button } from "@company/ui/components/button"
import { Link, createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { ObjectCollection } from "@/ui/model/object-collection"

const page = {
  breadcrumb: "Deals",
  description: Model.objects.deal.description ?? "Browse deal records.",
  title: "Deals",
}

export const Route = createFileRoute("/_app/(sales)/deals")({
  ...pageOptions(page),
  component: DealsPage,
})

function DealsPage() {
  return (
    <ObjectCollection
      object={Model.objects.deal}
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
