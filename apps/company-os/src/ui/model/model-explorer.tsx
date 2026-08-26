import type { Model } from "@company/model"
import type {
  Action,
  AnySchema,
  Choice,
  InterfaceType,
  LinkType,
  ObjectType,
  PropertyDefinition,
} from "@company/runtime"
import { Badge } from "@company/ui/components/badge"
import { Button } from "@company/ui/components/button"
import {
  BoxesIcon,
  BracesIcon,
  DatabaseIcon,
  Link2Icon,
  WaypointsIcon,
  WorkflowIcon,
} from "lucide-react"
import { useDeferredValue, useMemo, useState, type ReactNode } from "react"

import {
  DeveloperBrowser,
  DeveloperBrowserEmpty,
  DeveloperBrowserNavGroup,
  DeveloperBrowserNavItem,
  DeveloperBrowserOutline,
  DeveloperBrowserSearch,
} from "@/ui/develop/developer-browser"

type ModelDefinition = typeof Model
type ModelObject = ObjectType
type ModelInterface = InterfaceType
type ModelLink = LinkType
type ModelAction = Action
type ModelItem = ModelObject | ModelInterface

const allModules = "all"

const cardinalityLabels = {
  many: "many",
  one: "one",
  zeroOrOne: "zero or one",
} as const

function modelActions(model: ModelDefinition) {
  return Object.values(model.actions).flatMap((group) => Object.values(group))
}

function itemKey(item: ModelItem) {
  return `${item.kind}:${item.id}`
}

function displayRole(
  definition: Pick<ModelObject | ModelInterface, "display">,
  propertyId: string
) {
  return Object.entries(definition.display ?? {}).find(
    ([role, value]) => role !== "icon" && value === propertyId
  )?.[0]
}

function relationshipsForItem(
  links: ReadonlyArray<ModelLink>,
  item: ModelItem
) {
  const relationships: Array<{
    current: ModelLink["forward"]
    link: ModelLink
    related: ModelLink["forward"]["to"]
  }> = []
  for (const link of links) {
    if (
      link.forward.from.kind === item.kind &&
      link.forward.from.typeId === item.id
    ) {
      relationships.push({
        current: link.forward,
        link,
        related: link.forward.to,
      })
    }
    if (
      link.reverse.from.kind === item.kind &&
      link.reverse.from.typeId === item.id
    ) {
      relationships.push({
        current: link.reverse,
        link,
        related: link.reverse.to,
      })
    }
  }
  return relationships
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function propertyDetails(
  property: AnySchema,
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
    if (property.format !== undefined) details.push(property.format)
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
  if ("default" in property) {
    const defaultOption =
      property.kind === "enum"
        ? property.options?.find(
            (option: Choice) => option.value === property.default
          )
        : undefined
    if (defaultOption !== undefined) {
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

function isPropertyDefinition(
  property: AnySchema
): property is PropertyDefinition {
  return "requiredOnCreate" in property
}

function PropertyTable({
  definition,
  objects,
}: {
  definition: ModelObject | ModelInterface
  objects: ReadonlyArray<ModelObject>
}) {
  const properties = Object.entries(definition.properties)

  if (properties.length === 0) {
    return (
      <DeveloperBrowserEmpty>
        This {definition.kind} is a marker and declares no shared properties.
      </DeveloperBrowserEmpty>
    )
  }

  return (
    <div className="divide-y border">
      {properties.map(([propertyId, property]) => {
        const role = displayRole(definition, propertyId)
        const details = propertyDetails(property, objects)
        const metadata = isPropertyDefinition(property) ? property : undefined
        return (
          <div
            key={propertyId}
            className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(10rem,0.7fr)_7rem_minmax(0,1.3fr)]"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">
                {property.label ?? propertyId}
              </p>
              <code className="mt-1 block truncate text-[10px] text-muted-foreground">
                {propertyId}
              </code>
            </div>
            <div>
              <Badge variant="outline" className="font-mono text-[10px]">
                {property.kind}
              </Badge>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                {metadata?.requiredOnCreate ? (
                  <span>required on create</span>
                ) : null}
                {metadata?.nullable ? <span>nullable</span> : null}
                {metadata?.immutable ? <span>immutable</span> : null}
                {metadata?.outputOnly ? <span>output only</span> : null}
                {role === undefined ? null : <span>display: {role}</span>}
                {details.map((detail) => (
                  <span key={detail}>{detail}</span>
                ))}
              </div>
              {property.kind !== "enum" ||
              property.options === undefined ||
              property.options.length === 0 ? null : (
                <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">
                  {property.options
                    .map((option: Choice) => option.label)
                    .join(" · ")}
                </p>
              )}
              {property.description === undefined ? null : (
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  {property.description}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DetailSection({
  children,
  count,
  icon,
  id,
  title,
}: {
  children: ReactNode
  count: number
  icon: ReactNode
  id?: string
  title: string
}) {
  return (
    <section id={id} className="scroll-mt-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {count}
        </span>
      </div>
      {children}
    </section>
  )
}

function RelationshipList({
  items,
  model,
  onSelect,
}: {
  items: ReturnType<typeof relationshipsForItem>
  model: ModelDefinition
  onSelect: (key: string) => void
}) {
  if (items.length === 0) {
    return (
      <DeveloperBrowserEmpty>No declared link types.</DeveloperBrowserEmpty>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map(({ current, link, related }) => {
        const target =
          related.kind === "object"
            ? Object.values(model.objects).find(
                ({ id }) => id === related.typeId
              )
            : Object.values(model.interfaces).find(
                ({ id }) => id === related.typeId
              )
        return (
          <button
            key={link.id}
            type="button"
            disabled={target === undefined}
            className="border p-4 text-left transition-colors outline-none hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
            onClick={() => {
              if (target !== undefined) onSelect(itemKey(target))
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium">{current.label}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {cardinalityLabels[current.cardinality]} · {link.name}
                </p>
              </div>
              <Badge variant="outline">{related.kind}</Badge>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm font-medium">
              <Link2Icon className="size-3.5 text-muted-foreground" />
              {target?.name ?? related.typeId}
            </div>
            {current.description === undefined ? null : (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {current.description}
              </p>
            )}
          </button>
        )
      })}
    </div>
  )
}

function ActionList({ actions }: { actions: ReadonlyArray<ModelAction> }) {
  if (actions.length === 0) {
    return <DeveloperBrowserEmpty>No governed actions.</DeveloperBrowserEmpty>
  }

  return (
    <div className="divide-y border">
      {actions.map((action) => (
        <div
          key={action.id}
          className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(10rem,0.7fr)_8rem_minmax(0,1.3fr)]"
        >
          <div>
            <p className="text-xs font-medium">{action.name}</p>
            <code className="mt-1 block text-[10px] text-muted-foreground">
              {action.id}
            </code>
          </div>
          <div className="flex flex-wrap items-start gap-1">
            <Badge variant="outline">{action.scope}</Badge>
            {action.idempotent ? (
              <Badge variant="outline">idempotent</Badge>
            ) : null}
            {action.destructive ? (
              <Badge variant="destructive">destructive</Badge>
            ) : null}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {action.description}
          </p>
        </div>
      ))}
    </div>
  )
}

function ObjectDetail({
  actions,
  links,
  model,
  object,
  onSelect,
}: {
  actions: ReadonlyArray<ModelAction>
  links: ReadonlyArray<ModelLink>
  model: ModelDefinition
  object: ModelObject
  onSelect: (key: string) => void
}) {
  const modules = Object.values(model.modules)
  const module = modules.find((candidate) =>
    candidate.objects.some(({ id }) => id === object.id)
  )
  const relationships = relationshipsForItem(links, object)
  const implementations = Object.values(object.interfaces)

  return (
    <article className="mx-auto w-full max-w-6xl px-5 py-7 lg:px-8 lg:py-9">
      <header className="border-b pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <DatabaseIcon className="size-3.5" />
              {module?.name ?? "Model"} object
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {object.name}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {object.description}
            </p>
          </div>
          <code className="w-fit border bg-muted/20 px-2.5 py-1.5 text-xs">
            {object.id}
          </code>
        </div>
        <dl className="mt-5 grid gap-px border bg-border sm:grid-cols-4">
          <DefinitionFact label="Collection" value={object.collection} code />
          <DefinitionFact
            label="Parent"
            value={`${object.parent.kind}:${object.parent.typeId}`}
            code
          />
          <DefinitionFact
            label="Properties"
            value={Object.keys(object.properties).length}
          />
          <DefinitionFact label="Actions" value={actions.length} />
        </dl>
      </header>

      <DeveloperBrowserOutline
        label={`${object.name} definition sections`}
        items={[
          {
            count: Object.keys(object.properties).length,
            href: "#properties",
            label: "Properties",
          },
          {
            count: relationships.length,
            href: "#relationships",
            label: "Relationships",
          },
          {
            count: implementations.length,
            href: "#interfaces",
            label: "Interfaces",
          },
          { count: actions.length, href: "#actions", label: "Actions" },
        ]}
      />

      <div className="mt-8 space-y-10">
        <DetailSection
          id="properties"
          icon={<BracesIcon />}
          title="Properties"
          count={Object.keys(object.properties).length}
        >
          <PropertyTable
            definition={object}
            objects={Object.values(model.objects)}
          />
        </DetailSection>

        <DetailSection
          id="relationships"
          icon={<Link2Icon />}
          title="Relationships"
          count={relationships.length}
        >
          <RelationshipList
            items={relationships}
            model={model}
            onSelect={onSelect}
          />
        </DetailSection>

        <DetailSection
          id="interfaces"
          icon={<WaypointsIcon />}
          title="Interfaces"
          count={implementations.length}
        >
          {implementations.length === 0 ? (
            <DeveloperBrowserEmpty>
              This object implements no interfaces.
            </DeveloperBrowserEmpty>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {implementations.map((implementation) => {
                const modelInterface = Object.values(model.interfaces).find(
                  ({ id }) => id === implementation.interfaceId
                )
                return (
                  <button
                    key={implementation.interfaceId}
                    type="button"
                    className="border p-4 text-left transition-colors outline-none hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-ring/50"
                    onClick={() => {
                      if (modelInterface !== undefined) {
                        onSelect(itemKey(modelInterface))
                      }
                    }}
                  >
                    <p className="text-sm font-medium">
                      {modelInterface?.name ?? implementation.interfaceId}
                    </p>
                    <code className="mt-1 block text-[10px] text-muted-foreground">
                      {implementation.interfaceId}
                    </code>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {Object.keys(implementation.propertyMapping).length === 0
                        ? "Marker interface"
                        : `${Object.keys(implementation.propertyMapping).length} mapped properties`}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </DetailSection>

        <DetailSection
          id="actions"
          icon={<WorkflowIcon />}
          title="Actions"
          count={actions.length}
        >
          <ActionList actions={actions} />
        </DetailSection>
      </div>
    </article>
  )
}

function InterfaceDetail({
  links,
  model,
  modelInterface,
  onSelect,
}: {
  links: ReadonlyArray<ModelLink>
  model: ModelDefinition
  modelInterface: ModelInterface
  onSelect: (key: string) => void
}) {
  const modules = Object.values(model.modules)
  const module = modules.find((candidate) =>
    candidate.interfaces.some(({ id }) => id === modelInterface.id)
  )
  const relationships = relationshipsForItem(links, modelInterface)
  const implementers = Object.values(model.objects).filter((object) =>
    Object.values(object.interfaces).some(
      ({ interfaceId }) => interfaceId === modelInterface.id
    )
  )

  return (
    <article className="mx-auto w-full max-w-6xl px-5 py-7 lg:px-8 lg:py-9">
      <header className="border-b pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <WaypointsIcon className="size-3.5" />
              {module?.name ?? "Model"} interface
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {modelInterface.name}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {modelInterface.description ??
                "A shared role implemented by compatible object types."}
            </p>
          </div>
          <code className="w-fit border border-dashed bg-muted/20 px-2.5 py-1.5 text-xs">
            {modelInterface.id}
          </code>
        </div>
        <dl className="mt-5 grid gap-px border bg-border sm:grid-cols-3">
          <DefinitionFact label="Kind" value="interface" />
          <DefinitionFact
            label="Shared properties"
            value={Object.keys(modelInterface.properties).length}
          />
          <DefinitionFact label="Implementers" value={implementers.length} />
        </dl>
      </header>

      <DeveloperBrowserOutline
        label={`${modelInterface.name} definition sections`}
        items={[
          {
            count: Object.keys(modelInterface.properties).length,
            href: "#properties",
            label: "Shared properties",
          },
          {
            count: implementers.length,
            href: "#implementers",
            label: "Implementers",
          },
          {
            count: relationships.length,
            href: "#relationships",
            label: "Relationships",
          },
        ]}
      />

      <div className="mt-8 space-y-10">
        <DetailSection
          id="properties"
          icon={<BracesIcon />}
          title="Shared properties"
          count={Object.keys(modelInterface.properties).length}
        >
          <PropertyTable
            definition={modelInterface}
            objects={Object.values(model.objects)}
          />
        </DetailSection>

        <DetailSection
          id="implementers"
          icon={<DatabaseIcon />}
          title="Implemented by"
          count={implementers.length}
        >
          {implementers.length === 0 ? (
            <DeveloperBrowserEmpty>
              No object types implement this interface.
            </DeveloperBrowserEmpty>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {implementers.map((object) => (
                <button
                  key={object.id}
                  type="button"
                  className="border p-4 text-left transition-colors outline-none hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-ring/50"
                  onClick={() => onSelect(itemKey(object))}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{object.name}</span>
                    <code className="text-[10px] text-muted-foreground">
                      {object.id}
                    </code>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {object.description}
                  </p>
                </button>
              ))}
            </div>
          )}
        </DetailSection>

        <DetailSection
          id="relationships"
          icon={<Link2Icon />}
          title="Relationships"
          count={relationships.length}
        >
          <RelationshipList
            items={relationships}
            model={model}
            onSelect={onSelect}
          />
        </DetailSection>
      </div>
    </article>
  )
}

function DefinitionFact({
  code = false,
  label,
  value,
}: {
  code?: boolean
  label: string
  value: number | string
}) {
  return (
    <div className="bg-background px-4 py-3">
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd
        className={code ? "mt-1 font-mono text-xs" : "mt-1 text-sm font-medium"}
      >
        {value}
      </dd>
    </div>
  )
}

function itemMatches(
  item: ModelItem,
  query: string,
  actions: ReadonlyArray<ModelAction>
) {
  const normalized = query.trim().toLowerCase()
  if (normalized.length === 0) return true
  const actionText =
    item.kind === "object"
      ? actions
          .filter((action) => action.objectType === item.id)
          .flatMap((action) => [action.id, action.name, action.description])
      : []
  return [
    item.id,
    item.name,
    item.pluralName,
    item.description,
    ...Object.entries(item.properties).flatMap(([propertyId, property]) => [
      propertyId,
      property.label,
      property.description,
    ]),
    ...actionText,
  ].some((value) => value?.toLowerCase().includes(normalized) === true)
}

export function ModelExplorer({
  model,
  onSelectedItemChange,
  selectedItem,
}: {
  model: ModelDefinition
  onSelectedItemChange?: (item: string) => void
  selectedItem?: string
}) {
  const modules = useMemo(() => Object.values(model.modules), [model.modules])
  const objects = useMemo(() => Object.values(model.objects), [model.objects])
  const interfaces = useMemo(
    () => Object.values(model.interfaces),
    [model.interfaces]
  )
  const links = useMemo(() => Object.values(model.links), [model.links])
  const actions = useMemo(() => modelActions(model), [model])
  const defaultItem = itemKey(model.objects.company)
  const [internalSelection, setInternalSelection] = useState(defaultItem)
  const [selectedModule, setSelectedModule] = useState(allModules)
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const selection = selectedItem ?? internalSelection
  const selectedObject = objects.find((object) => itemKey(object) === selection)
  const selectedInterface = interfaces.find(
    (modelInterface) => itemKey(modelInterface) === selection
  )
  const resolvedObject =
    selectedObject ??
    (selectedInterface === undefined ? model.objects.company : undefined)
  const resolvedInterface = selectedInterface ?? interfaces[0]
  const resolvedItem = resolvedObject ?? resolvedInterface
  const selectedActions =
    resolvedObject === undefined
      ? []
      : actions.filter((action) => action.objectType === resolvedObject.id)
  const selectItem = (key: string) => {
    setInternalSelection(key)
    onSelectedItemChange?.(key)
  }

  const activeModuleId = modules.find((module) =>
    resolvedItem?.kind === "object"
      ? module.objects.some(({ id }) => id === resolvedItem.id)
      : module.interfaces.some(({ id }) => id === resolvedItem?.id)
  )?.id
  const orderedModules = [
    ...modules.filter(({ id }) => id === activeModuleId),
    ...modules.filter(({ id }) => id !== activeModuleId),
  ]
  const visibleGroups = orderedModules.flatMap((module) => {
    if (selectedModule !== allModules && selectedModule !== module.id) return []
    const items: ReadonlyArray<ModelItem> = [
      ...module.objects,
      ...module.interfaces,
    ]
    const matchingItems = items.filter((item) =>
      itemMatches(item, deferredQuery, actions)
    )
    return matchingItems.length === 0 ? [] : [{ items: matchingItems, module }]
  })

  return (
    <DeveloperBrowser
      eyebrow={
        <>
          <BoxesIcon />
          Browser-safe model contract
        </>
      }
      title={`${model.name} domain model`}
      description="Browse the shared definitions that drive application behavior and generated interfaces."
      stats={[
        { label: "modules", value: modules.length },
        { label: "objects", value: objects.length },
        { label: "interfaces", value: interfaces.length },
        { label: "links", value: links.length },
        { label: "actions", value: actions.length },
      ]}
      sidebarLabel="Domain model definitions"
      sidebar={
        <>
          <div className="sticky top-0 z-10 space-y-3 border-b bg-background/95 p-3 backdrop-blur-sm">
            <DeveloperBrowserSearch
              label="Search domain model"
              placeholder="Search the model…"
              value={query}
              onChange={setQuery}
            />
            <div className="flex gap-1 overflow-x-auto">
              <Button
                type="button"
                size="xs"
                variant={selectedModule === allModules ? "secondary" : "ghost"}
                onClick={() => setSelectedModule(allModules)}
              >
                All
              </Button>
              {modules.map((module) => (
                <Button
                  key={module.id}
                  type="button"
                  size="xs"
                  variant={selectedModule === module.id ? "secondary" : "ghost"}
                  onClick={() => setSelectedModule(module.id)}
                >
                  {module.name}
                </Button>
              ))}
            </div>
          </div>
          <nav className="py-2">
            {visibleGroups.length === 0 ? (
              <div className="p-3">
                <DeveloperBrowserEmpty>
                  No model definitions match “{query}”.
                </DeveloperBrowserEmpty>
              </div>
            ) : (
              visibleGroups.map(({ items, module }) => (
                <DeveloperBrowserNavGroup
                  key={module.id}
                  title={module.name}
                  count={items.length}
                >
                  {items.map((item) => {
                    const key = itemKey(item)
                    const relationshipCount = relationshipsForItem(
                      links,
                      item
                    ).length
                    const actionCount =
                      item.kind === "object"
                        ? actions.filter(
                            (action) => action.objectType === item.id
                          ).length
                        : 0
                    return (
                      <DeveloperBrowserNavItem
                        key={key}
                        active={
                          resolvedItem !== undefined &&
                          key === itemKey(resolvedItem)
                        }
                        code={
                          item.kind === "object" ? (
                            <DatabaseIcon className="size-3.5 text-muted-foreground" />
                          ) : (
                            <WaypointsIcon className="size-3.5 text-muted-foreground" />
                          )
                        }
                        meta={
                          item.kind === "object"
                            ? `${countLabel(Object.keys(item.properties).length, "property", "properties")} · ${countLabel(relationshipCount, "link")} · ${countLabel(actionCount, "action")}`
                            : `interface · ${countLabel(Object.keys(item.properties).length, "property", "properties")}`
                        }
                        onClick={() => selectItem(key)}
                      >
                        {item.name}
                      </DeveloperBrowserNavItem>
                    )
                  })}
                </DeveloperBrowserNavGroup>
              ))
            )}
          </nav>
        </>
      }
    >
      {resolvedObject === undefined && resolvedInterface !== undefined ? (
        <InterfaceDetail
          links={links}
          model={model}
          modelInterface={resolvedInterface}
          onSelect={selectItem}
        />
      ) : resolvedObject !== undefined ? (
        <ObjectDetail
          actions={selectedActions}
          links={links}
          model={model}
          object={resolvedObject}
          onSelect={selectItem}
        />
      ) : (
        <div className="p-6">
          <DeveloperBrowserEmpty>
            This model has no browsable definitions.
          </DeveloperBrowserEmpty>
        </div>
      )}
    </DeveloperBrowser>
  )
}
