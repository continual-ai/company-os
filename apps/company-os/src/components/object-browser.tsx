import type { Model } from "@company/model"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@company/ui/components/card"

type ModelObject = (typeof Model.objects)[keyof typeof Model.objects]

export function ObjectBrowser({ object }: { object: ModelObject }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 lg:px-10 lg:py-12">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Objects</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {object.pluralName}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {object.description}
        </p>
      </header>

      <Card className="mt-10 overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle>{object.pluralName}</CardTitle>
          <CardDescription>
            Record browsing will use the governed {object.name.toLowerCase()}{" "}
            capability.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <div className="flex min-w-max border-b bg-muted/30 px-4 py-2.5">
            {Object.entries(object.properties).map(([propertyId, property]) => {
              const displayRole = Object.entries(object.display).find(
                ([, displayPropertyId]) => displayPropertyId === propertyId
              )?.[0]

              return (
                <div key={propertyId} className="w-48 shrink-0 pr-4">
                  <span className="text-xs font-medium">{property.label}</span>
                  {displayRole ? (
                    <span className="ml-2 border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {displayRole}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
          <div className="px-4 py-14 text-center">
            <p className="text-sm font-medium">No records loaded</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The object schema is available; the browser list operation is not
              connected yet.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
