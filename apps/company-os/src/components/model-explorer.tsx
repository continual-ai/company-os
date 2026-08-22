import type { AcmeModel } from "@acme/api"
import { Button } from "@acme/ui/components/button"
import { cn } from "@acme/ui/lib/utils"
import type { Choice, PropertyDefinition } from "@continual/runtime"
import {
  ArrowRightIcon,
  BoxesIcon,
  BracesIcon,
  DatabaseIcon,
  Link2Icon,
  WorkflowIcon,
} from "lucide-react"
import { useMemo, useState } from "react"

type CompanyModel = typeof AcmeModel
type ModelObject = CompanyModel["objects"][keyof CompanyModel["objects"]]
type ModelObjectId = ModelObject["id"]
type ModelLink = CompanyModel["links"][keyof CompanyModel["links"]]

type Point = {
  x: number
  y: number
}

const canvas = {
  height: 560,
  width: 960,
} as const

const centerPoint: Point = { x: canvas.width / 2, y: canvas.height / 2 }

const orbitPoints: ReadonlyArray<Point> = [
  { x: 170, y: 135 },
  { x: 790, y: 135 },
  { x: 790, y: 425 },
  { x: 170, y: 425 },
  { x: 480, y: 90 },
  { x: 480, y: 470 },
]

const cardinalityLabels = {
  many: "many",
  one: "1",
  zeroOrOne: "0..1",
} as const

function modelActions(model: CompanyModel) {
  return Object.values(model.actions).flatMap((group) => Object.values(group))
}

function displayRole(object: ModelObject, propertyId: string) {
  return Object.entries(object.display).find(
    ([role, value]) => role !== "icon" && value === propertyId
  )?.[0]
}

function relationshipForObject(link: ModelLink, objectType: ModelObjectId) {
  if (link.from.typeId === objectType) {
    return { current: link.from, related: link.to }
  }
  if (link.to.typeId === objectType) {
    return { current: link.to, related: link.from }
  }
  return undefined
}

function relationshipCount(
  links: ReadonlyArray<ModelLink>,
  objectType: string
) {
  return links.filter(
    (link) => link.from.typeId === objectType || link.to.typeId === objectType
  ).length
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function propertyDetails(
  property: PropertyDefinition,
  objects: ReadonlyArray<ModelObject>
) {
  const details: Array<string> = []

  if (property.kind === "recordId") {
    const referencedObject = objects.find(
      (object) => object.id === property.typeId
    )
    details.push(`references ${referencedObject?.name ?? property.typeId}`)
  }
  if (property.kind === "string") {
    if (property.minLength !== undefined) {
      details.push(`min ${property.minLength}`)
    }
    if (property.maxLength !== undefined) {
      details.push(`max ${property.maxLength}`)
    }
  }
  if (property.kind === "number") {
    if (property.minimum !== undefined) {
      details.push(`min ${property.minimum}`)
    }
    if (property.maximum !== undefined) {
      details.push(`max ${property.maximum}`)
    }
    if (property.integer) details.push("integer")
  }
  if (property.kind === "decimal") {
    if (property.precision !== undefined) {
      details.push(`precision ${property.precision}`)
    }
    if (property.scale !== undefined) {
      details.push(`scale ${property.scale}`)
    }
  }
  if (Object.hasOwn(property, "default")) {
    const defaultOption =
      property.kind === "enum"
        ? property.options?.find(
            (option: Choice) => option.value === property.default
          )
        : undefined
    if (defaultOption) {
      details.push(`default ${defaultOption.label}`)
    } else if (property.default === "") {
      details.push("default empty")
    } else if (property.default === 0) {
      details.push("default 0")
    } else {
      details.push("has default")
    }
  }

  return details
}

function pointStyle(point: Point) {
  return {
    left: `${(point.x / canvas.width) * 100}%`,
    top: `${(point.y / canvas.height) * 100}%`,
  }
}

export function ModelExplorer({ model }: { model: CompanyModel }) {
  const objects = useMemo(() => Object.values(model.objects), [model.objects])
  const interfaces = useMemo(
    () => Object.values(model.interfaces),
    [model.interfaces]
  )
  const links = useMemo(() => Object.values(model.links), [model.links])
  const actions = useMemo(() => modelActions(model), [model])
  const [selectedId, setSelectedId] = useState<ModelObjectId>(
    model.objects.company.id
  )
  const selectedObject = model.objects[selectedId]
  const selectedRelationships = links.flatMap((link) => {
    const relationship = relationshipForObject(link, selectedId)
    return relationship ? [{ link, ...relationship }] : []
  })
  const selectedActions = actions.filter(
    (action) => action.objectType === selectedObject.id
  )

  const positions = useMemo(() => {
    const result = new Map<string, Point>([[selectedId, centerPoint]])
    objects
      .filter((object) => object.id !== selectedId)
      .forEach((object, index) => {
        result.set(
          object.id,
          orbitPoints[index % orbitPoints.length] ?? centerPoint
        )
      })
    interfaces.forEach((item, index) => {
      result.set(
        item.id,
        orbitPoints[(objects.length - 1 + index) % orbitPoints.length] ??
          centerPoint
      )
    })
    return result
  }, [interfaces, objects, selectedId])

  return (
    <section className="mt-10 overflow-hidden border bg-background">
      <header className="flex flex-col gap-4 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BoxesIcon className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">Object type graph</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Select an object type to explore its properties, link types, and
            action types.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="border bg-muted/30 px-2 py-1">
            {objects.length} object types
          </span>
          <span className="border bg-muted/30 px-2 py-1">
            {interfaces.length} interfaces
          </span>
          <span className="border bg-muted/30 px-2 py-1">
            {links.length} link types
          </span>
          <span className="border bg-muted/30 px-2 py-1">
            {actions.length} action types
          </span>
        </div>
      </header>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 border-b xl:border-r xl:border-b-0">
          <div className="relative hidden h-[35rem] bg-muted/15 md:block">
            <svg
              aria-hidden="true"
              className="absolute inset-0 size-full"
              viewBox={`0 0 ${canvas.width} ${canvas.height}`}
            >
              {links.map((link) => {
                const from = positions.get(link.from.typeId) ?? centerPoint
                const to = positions.get(link.to.typeId) ?? centerPoint
                const active =
                  link.from.typeId === selectedId ||
                  link.to.typeId === selectedId
                return (
                  <g
                    key={link.id}
                    className={cn(
                      "transition-opacity",
                      active ? "opacity-100" : "opacity-30"
                    )}
                  >
                    <path
                      d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
                      className={cn(
                        "fill-none stroke-border",
                        active && "stroke-foreground/45"
                      )}
                      strokeWidth={active ? 2 : 1}
                    />
                  </g>
                )
              })}
            </svg>

            {objects.map((object) => {
              const selected = object.id === selectedId
              const objectActions = actions.filter(
                (action) => action.objectType === object.id
              )
              const objectLinks = relationshipCount(links, object.id)
              const point = positions.get(object.id) ?? centerPoint
              const connected =
                selected ||
                selectedRelationships.some(
                  ({ related }) => related.typeId === object.id
                )

              return (
                <button
                  key={object.id}
                  type="button"
                  aria-pressed={selected}
                  className={cn(
                    "absolute z-10 w-40 -translate-x-1/2 -translate-y-1/2 border bg-background p-3.5 text-left shadow-sm transition-[background-color,border-color,box-shadow,opacity] outline-none hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
                    !connected && "opacity-55 hover:opacity-100",
                    selected &&
                      "border-foreground bg-background shadow-md ring-1 ring-foreground/10"
                  )}
                  style={pointStyle(point)}
                  onClick={() => setSelectedId(object.id)}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      Object type
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {object.id}
                    </span>
                  </span>
                  <span className="mt-4 block text-sm font-medium">
                    {object.pluralName}
                  </span>
                  <span className="mt-1 line-clamp-2 block min-h-10 text-xs leading-5 text-muted-foreground">
                    {object.description}
                  </span>
                  <span className="mt-4 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>
                      {countLabel(
                        Object.keys(object.properties).length,
                        "property",
                        "properties"
                      )}
                    </span>
                    <span>{countLabel(objectLinks, "link")}</span>
                    <span>{countLabel(objectActions.length, "action")}</span>
                  </span>
                </button>
              )
            })}

            {interfaces.map((item) => (
              <div
                key={item.id}
                className="absolute z-10 w-32 -translate-x-1/2 -translate-y-1/2 border border-dashed bg-background p-3 text-left shadow-sm"
                style={pointStyle(positions.get(item.id) ?? centerPoint)}
              >
                <span className="block text-[10px] font-medium text-muted-foreground">
                  Interface
                </span>
                <span className="mt-2 block text-sm font-medium">
                  {item.name}
                </span>
                <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                  {item.id}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-px bg-border md:hidden">
            {objects.map((object) => {
              const selected = object.id === selectedId
              const objectLinks = relationshipCount(links, object.id)

              return (
                <button
                  key={object.id}
                  type="button"
                  aria-pressed={selected}
                  className={cn(
                    "min-w-0 bg-background p-4 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset",
                    selected && "bg-muted/60"
                  )}
                  onClick={() => setSelectedId(object.id)}
                >
                  <span className="block truncate font-mono text-[10px] text-muted-foreground">
                    {object.id}
                  </span>
                  <span className="mt-3 block text-sm font-medium">
                    {object.pluralName}
                  </span>
                  <span className="mt-2 block text-[10px] text-muted-foreground">
                    {countLabel(
                      Object.keys(object.properties).length,
                      "property",
                      "properties"
                    )}{" "}
                    · {countLabel(objectLinks, "link")}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <aside
          aria-label={`${selectedObject.name} object type details`}
          className="min-w-0"
        >
          <div className="border-b px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Selected object type
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">
                  {selectedObject.name}
                </h3>
              </div>
              <span className="border bg-muted/30 px-2 py-1 font-mono text-[10px]">
                {selectedObject.id}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {selectedObject.description}
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <DatabaseIcon className="size-3.5" />
              <span className="font-mono">{selectedObject.collection}</span>
            </div>
          </div>

          <InspectorSection
            icon={<BracesIcon />}
            title="Properties"
            count={Object.keys(selectedObject.properties).length}
          >
            <div className="divide-y border-y">
              {Object.entries(selectedObject.properties).map(
                ([propertyId, property]) => {
                  const role = displayRole(selectedObject, propertyId)
                  const details = propertyDetails(property, objects)
                  return (
                    <div key={propertyId} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">
                            {property.label ?? propertyId}
                          </p>
                          <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                            {propertyId}
                          </p>
                        </div>
                        <span className="shrink-0 border bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {property.kind}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                        {property.requiredOnCreate && (
                          <span>required on create</span>
                        )}
                        {property.nullable && <span>nullable</span>}
                        {property.immutable && <span>immutable</span>}
                        {property.outputOnly && <span>output only</span>}
                        {role && <span>display: {role}</span>}
                        {details.map((detail) => (
                          <span key={detail}>{detail}</span>
                        ))}
                      </div>
                      {property.options && property.options.length > 0 && (
                        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
                          Options:{" "}
                          {property.options
                            .map((option: Choice) => option.label)
                            .join(", ")}
                        </p>
                      )}
                      {property.description && (
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {property.description}
                        </p>
                      )}
                    </div>
                  )
                }
              )}
            </div>
          </InspectorSection>

          <InspectorSection
            icon={<Link2Icon />}
            title="Link types"
            count={selectedRelationships.length}
          >
            {selectedRelationships.length > 0 ? (
              <div className="space-y-2">
                {selectedRelationships.map(({ current, link, related }) => {
                  const relatedObject = objects.find(
                    (object) => object.id === related.typeId
                  )
                  const relatedInterface = interfaces.find(
                    (item) => item.id === related.typeId
                  )
                  return (
                    <Button
                      key={link.id}
                      variant="outline"
                      className="h-auto w-full justify-between px-3 py-2.5 text-left whitespace-normal"
                      disabled={relatedObject === undefined}
                      onClick={() => {
                        if (relatedObject !== undefined) {
                          setSelectedId(relatedObject.id)
                        }
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-medium">
                          {current.label}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">
                          {cardinalityLabels[current.cardinality]} · {link.name}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs">
                        {relatedObject?.name ?? relatedInterface?.name}
                        <ArrowRightIcon className="size-3" />
                      </span>
                    </Button>
                  )
                })}
              </div>
            ) : (
              <EmptyInspectorRow>No declared link types</EmptyInspectorRow>
            )}
          </InspectorSection>

          <InspectorSection
            icon={<BoxesIcon />}
            title="Interfaces"
            count={Object.keys(selectedObject.interfaces).length}
          >
            {Object.values(selectedObject.interfaces).map((implementation) => (
              <div
                key={implementation.interfaceId}
                className="border px-3 py-2.5"
              >
                <span className="text-xs font-medium">
                  {interfaces.find(
                    (item) => item.id === implementation.interfaceId
                  )?.name ?? implementation.interfaceId}
                </span>
              </div>
            ))}
          </InspectorSection>

          <InspectorSection
            icon={<WorkflowIcon />}
            title="Action types"
            count={selectedActions.length}
          >
            <div className="space-y-2">
              {selectedActions.map((action) => (
                <div key={action.id} className="border px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium">{action.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {action.id}
                    </span>
                  </div>
                  {action.description && (
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                      {action.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </InspectorSection>
        </aside>
      </div>
    </section>
  )
}

function InspectorSection({
  children,
  count,
  icon,
  title,
}: {
  children: React.ReactNode
  count: number
  icon: React.ReactNode
  title: string
}) {
  return (
    <section className="border-b px-5 py-5 last:border-b-0">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-muted-foreground [&>svg]:size-3.5">{icon}</span>
        <h4 className="text-xs font-medium">{title}</h4>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {count}
        </span>
      </div>
      {children}
    </section>
  )
}

function EmptyInspectorRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
      {children}
    </div>
  )
}
