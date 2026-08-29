import { Badge } from "@company/ui/components/badge"
import { Button } from "@company/ui/components/button"
import { cn } from "@company/ui/lib/utils"
import { CodeXmlIcon, ExternalLinkIcon, FileJsonIcon } from "lucide-react"
import { useDeferredValue, useEffect, useMemo, useState } from "react"

import {
  DeveloperBrowser,
  DeveloperBrowserEmpty,
  DeveloperBrowserNavGroup,
  DeveloperBrowserNavItem,
  DeveloperBrowserOutline,
  DeveloperBrowserSearch,
  DeveloperCodeBlock,
} from "./developer-browser"
import {
  curlExample,
  filterOperations,
  isOpenApiDocument,
  mediaSchema,
  operationKey,
  operationsFromDocument,
  resolveSchema,
  schemaLabel,
  schemaName,
  type HttpMethod,
  type OpenApiDocument,
  type OpenApiOperation,
  type OpenApiSchema,
} from "./openapi-reference-model"

const noPreferredTags: ReadonlyArray<string> = []

const methodClassNames = {
  delete: "border-destructive/30 bg-destructive/5 text-destructive",
  get: "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300",
  patch:
    "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
  post: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
  put: "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300",
} as const satisfies Record<HttpMethod, string>

const responseClassNames = {
  error: "border-destructive/30 bg-destructive/5 text-destructive",
  redirect:
    "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
  success:
    "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
} as const

function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "w-12 justify-center font-mono text-[10px] uppercase",
        methodClassNames[method]
      )}
    >
      {method}
    </Badge>
  )
}

function responseClassName(status: string) {
  if (status.startsWith("2")) return responseClassNames.success
  if (status.startsWith("3")) return responseClassNames.redirect
  return responseClassNames.error
}

function schemaType(
  schema: OpenApiSchema | undefined,
  schemas: Readonly<Record<string, OpenApiSchema>>
) {
  const name = schemaName(schema)
  const resolved = resolveSchema(schema, schemas)
  if (name !== undefined) return name
  return schemaLabel(resolved) ?? resolved?.format ?? "value"
}

function formatSchemaValue(value: OpenApiSchema["default"]) {
  return JSON.stringify(value) ?? "null"
}

function SchemaCard({
  emptyLabel,
  schema,
  schemas,
}: {
  emptyLabel: string
  schema: OpenApiSchema | undefined
  schemas: Readonly<Record<string, OpenApiSchema>>
}) {
  if (schema === undefined) {
    return <DeveloperBrowserEmpty>{emptyLabel}</DeveloperBrowserEmpty>
  }

  const name = schemaName(schema)
  const resolved = resolveSchema(schema, schemas) ?? schema
  const properties = Object.entries(resolved.properties ?? {})
  const required = new Set(resolved.required ?? [])
  const alternatives = resolved.oneOf ?? resolved.anyOf

  return (
    <div className="overflow-hidden border">
      <div className="flex flex-wrap items-start justify-between gap-3 bg-muted/20 px-4 py-3">
        <div>
          <p className="text-xs font-medium">
            {resolved.title ?? name ?? schemaLabel(resolved) ?? "Schema"}
          </p>
          {resolved.description === undefined ? null : (
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              {resolved.description}
            </p>
          )}
        </div>
        <code className="text-[10px] text-muted-foreground">
          {name ?? schemaLabel(resolved) ?? "value"}
        </code>
      </div>

      {properties.length > 0 ? (
        <div className="divide-y">
          {properties.map(([propertyName, property]) => {
            const definition = resolveSchema(property, schemas) ?? property
            return (
              <div
                key={propertyName}
                className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(9rem,0.6fr)_minmax(8rem,0.5fr)_minmax(0,1fr)]"
              >
                <div className="min-w-0">
                  <code className="text-xs font-medium">{propertyName}</code>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {required.has(propertyName) ? "required" : "optional"}
                    {definition.readOnly === true ? " · read only" : ""}
                  </p>
                </div>
                <code className="text-xs text-muted-foreground">
                  {schemaType(property, schemas)}
                </code>
                <div className="text-xs leading-5 text-muted-foreground">
                  {definition.description ??
                    (definition.enum === undefined
                      ? definition.format
                      : definition.enum.map(formatSchemaValue).join(" | ")) ??
                    "—"}
                </div>
              </div>
            )
          })}
        </div>
      ) : alternatives === undefined ? (
        <div className="px-4 py-3 text-xs text-muted-foreground">
          {schemaLabel(resolved) ?? resolved.format ?? "Value"}
          {resolved.enum === undefined
            ? ""
            : ` · ${resolved.enum.map(formatSchemaValue).join(" | ")}`}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {alternatives.map((alternative, index) => (
            <Badge
              key={`${schemaLabel(alternative)}-${index}`}
              variant="outline"
            >
              {schemaType(alternative, schemas)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function RequestSection({
  operation,
  schemas,
}: {
  operation: OpenApiOperation
  schemas: Readonly<Record<string, OpenApiSchema>>
}) {
  const parameters = operation.parameters ?? []
  const requestSchema = Object.values(operation.requestBody?.content ?? {})[0]
    ?.schema

  return (
    <section aria-labelledby="request-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="request-heading" className="text-sm font-medium">
          Request
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {operation.requestBody?.required === true
            ? "Body required"
            : "No required body"}
        </span>
      </div>

      {parameters.length === 0 ? null : (
        <div className="mb-4 overflow-hidden border">
          <div className="bg-muted/20 px-4 py-2 text-[11px] font-medium text-muted-foreground">
            Parameters
          </div>
          <div className="divide-y">
            {parameters.map((parameter) => (
              <div
                key={`${parameter.in}-${parameter.name}`}
                className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-[10rem_8rem_minmax(0,1fr)]"
              >
                <code className="font-medium">{parameter.name}</code>
                <span className="text-muted-foreground">
                  {parameter.in}
                  {parameter.required === true ? " · required" : ""}
                </span>
                <span className="text-muted-foreground">
                  {parameter.description ??
                    schemaType(parameter.schema, schemas)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <SchemaCard
        schema={requestSchema}
        schemas={schemas}
        emptyLabel="This operation does not accept a JSON request body."
      />
    </section>
  )
}

function ResponsesSection({
  operation,
  schemas,
}: {
  operation: OpenApiOperation
  schemas: Readonly<Record<string, OpenApiSchema>>
}) {
  const responses = Object.entries(operation.responses ?? {})

  return (
    <section aria-labelledby="responses-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="responses-heading" className="text-sm font-medium">
          Responses
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {responses.length} documented
        </span>
      </div>
      <div className="divide-y border">
        {responses.map(([status, response]) => {
          const responseSchema = Object.values(response.content ?? {})[0]
            ?.schema
          return (
            <details
              key={status}
              className="group"
              open={status.startsWith("2")}
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 marker:hidden hover:bg-muted/20">
                <Badge
                  variant="outline"
                  className={cn("font-mono", responseClassName(status))}
                >
                  {status}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-xs">
                  {response.description}
                </span>
                <code className="hidden text-[10px] text-muted-foreground sm:block">
                  {mediaSchema(response.content) ?? "No body"}
                </code>
              </summary>
              <div className="border-t bg-muted/10 p-4">
                <SchemaCard
                  schema={responseSchema}
                  schemas={schemas}
                  emptyLabel="This response has no JSON body."
                />
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}

function OperationDetail({
  document,
  operation,
}: {
  document: OpenApiDocument
  operation: OpenApiOperation
}) {
  const schemas = document.components?.schemas ?? {}

  return (
    <article className="mx-auto w-full max-w-5xl px-5 py-7 lg:px-8 lg:py-9">
      <header className="border-b pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <MethodBadge method={operation.method} />
          <code className="min-w-0 text-sm break-all">{operation.path}</code>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {operation.tag}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {operation.summary ?? operation.operationId ?? operation.path}
            </h2>
            {operation.description === undefined ? null : (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {operation.description}
              </p>
            )}
          </div>
          <div className="shrink-0 border bg-muted/20 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">Operation ID</p>
            <code className="mt-1 block text-xs">
              {operation.operationId ?? "Not specified"}
            </code>
          </div>
        </div>
      </header>

      <DeveloperBrowserOutline
        label="Operation sections"
        items={[
          { href: "#example", label: "Example" },
          {
            count:
              (operation.parameters?.length ?? 0) +
              (operation.requestBody === undefined ? 0 : 1),
            href: "#request",
            label: "Request",
          },
          {
            count: Object.keys(operation.responses ?? {}).length,
            href: "#responses",
            label: "Responses",
          },
        ]}
      />

      <div className="mt-7 space-y-9">
        <section id="example" className="scroll-mt-4">
          <DeveloperCodeBlock
            code={curlExample(operation, schemas)}
            label="cURL request"
          />
        </section>
        <div id="request" className="scroll-mt-4">
          <RequestSection operation={operation} schemas={schemas} />
        </div>
        <div id="responses" className="scroll-mt-4">
          <ResponsesSection operation={operation} schemas={schemas} />
        </div>
      </div>
    </article>
  )
}

export function OpenApiReference({
  initialTag,
  onSelectedOperationChange,
  preferredTags = noPreferredTags,
  selectedOperationId,
}: {
  initialTag?: string
  onSelectedOperationChange?: (operationId: string) => void
  preferredTags?: ReadonlyArray<string>
  selectedOperationId?: string
}) {
  const [document, setDocument] = useState<OpenApiDocument>()
  const [error, setError] = useState<string>()
  const [internalSelection, setInternalSelection] = useState<string>()
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    const controller = new AbortController()
    void fetch("/api/openapi", {
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`OpenAPI request failed with ${response.status}.`)
        }
        const value: unknown = await response.json()
        if (!isOpenApiDocument(value)) {
          throw new Error("The OpenAPI endpoint returned an invalid document.")
        }
        return value
      })
      .then(setDocument)
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The OpenAPI document could not be loaded."
          )
        }
      })
    return () => controller.abort()
  }, [])

  const operations = useMemo(
    () => (document === undefined ? [] : operationsFromDocument(document)),
    [document]
  )
  const orderedTags = useMemo(() => {
    const sourceTags = [...new Set(operations.map(({ tag }) => tag))]
    const sourceTagSet = new Set(sourceTags)
    const preferredTagSet = new Set(preferredTags)
    return [
      ...preferredTags.filter((tag) => sourceTagSet.has(tag)),
      ...sourceTags.filter((tag) => !preferredTagSet.has(tag)),
    ]
  }, [operations, preferredTags])
  const matchingOperations = useMemo(
    () => filterOperations(operations, deferredQuery),
    [deferredQuery, operations]
  )
  const matchingKeys = new Set(matchingOperations.map(operationKey))
  const groups = orderedTags.flatMap((tag) => {
    const groupOperations = operations.filter(
      (operation) =>
        operation.tag === tag && matchingKeys.has(operationKey(operation))
    )
    return groupOperations.length === 0
      ? []
      : [{ operations: groupOperations, tag }]
  })
  const selection = selectedOperationId ?? internalSelection
  const selectedOperation =
    operations.find((operation) => operationKey(operation) === selection) ??
    operations.find((operation) => operation.tag === initialTag) ??
    operations[0]
  const selectOperation = (operationId: string) => {
    setInternalSelection(operationId)
    onSelectedOperationChange?.(operationId)
  }

  if (error !== undefined) {
    return (
      <div role="alert" className="m-6 border border-destructive/30 p-5">
        <p className="text-sm font-medium">API reference unavailable</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (document === undefined || selectedOperation === undefined) {
    return (
      <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
        Loading API reference…
      </div>
    )
  }

  return (
    <DeveloperBrowser
      eyebrow={
        <>
          <CodeXmlIcon />
          OpenAPI {document.openapi}
        </>
      }
      title={document.info.title}
      description={
        document.info.description ??
        "The HTTP contract generated from the domain model."
      }
      actions={
        <Button
          variant="outline"
          nativeButton={false}
          render={
            <a
              href="/api/openapi"
              target="_blank"
              rel="noreferrer"
              aria-label="View raw OpenAPI document"
            />
          }
        >
          <FileJsonIcon />
          Raw OpenAPI
          <ExternalLinkIcon />
        </Button>
      }
      stats={[
        { label: "operations", value: operations.length },
        { label: "groups", value: orderedTags.length },
        {
          label: "schemas",
          value: Object.keys(document.components?.schemas ?? {}).length,
        },
      ]}
      sidebarLabel="API operations"
      sidebar={
        <>
          <div className="sticky top-0 z-10 border-b bg-background/95 p-3 backdrop-blur-sm">
            <DeveloperBrowserSearch
              label="Search API operations"
              placeholder="Search operations…"
              value={query}
              onChange={setQuery}
            />
            <p className="mt-2 text-[10px] text-muted-foreground">
              Search names, paths, methods, and operation IDs.
            </p>
          </div>
          <nav className="py-2">
            {groups.length === 0 ? (
              <div className="p-3">
                <DeveloperBrowserEmpty>
                  No operations match “{query}”.
                </DeveloperBrowserEmpty>
              </div>
            ) : (
              groups.map((group) => (
                <DeveloperBrowserNavGroup
                  key={group.tag}
                  title={group.tag}
                  count={group.operations.length}
                >
                  {group.operations.map((operation) => {
                    const key = operationKey(operation)
                    return (
                      <DeveloperBrowserNavItem
                        key={key}
                        active={key === operationKey(selectedOperation)}
                        code={<MethodBadge method={operation.method} />}
                        meta={operation.path}
                        onClick={() => selectOperation(key)}
                      >
                        {operation.summary ?? operation.operationId ?? key}
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
      <OperationDetail document={document} operation={selectedOperation} />
    </DeveloperBrowser>
  )
}
