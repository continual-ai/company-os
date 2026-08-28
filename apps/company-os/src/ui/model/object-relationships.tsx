import { Model } from "@company/model"
import {
  modelObjectLinkTraversals,
  type ModelLinkTraversal,
} from "@company/runtime"
import { Button } from "@company/ui/components/button"
import { FieldError } from "@company/ui/components/field"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  UnlinkIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useAppForm } from "@/ui/forms/app-form"
import {
  focusFirstFormError,
  formErrorFromCause,
  formErrorFromViolations,
  formErrorMessages,
} from "@/ui/forms/form-errors"

import {
  describeReferences,
  type DynamicLinkListInput,
  linkClientFor,
  type ClientRecord,
  type ModelObject,
  type RelatedRecord,
} from "./object-client"
import { stringValue } from "./object-form"
import { ObjectReferenceSelect } from "./object-reference-select"

function errorMessage(cause: unknown, fallback: string): string {
  const errors = formErrorFromCause(cause, fallback)
  return (
    errors.form?.[0]?.message ??
    Object.values(errors.fields)[0]?.[0]?.message ??
    fallback
  )
}

function targetTypeName(typeId: string): string {
  if (typeId === Model.root.id) return Model.root.name
  const object = Object.values(Model.objects).find(({ id }) => id === typeId)
  if (object !== undefined) return object.name
  return (
    Object.values(Model.interfaces).find(({ id }) => id === typeId)?.name ??
    "record"
  )
}

function Relationship({
  canUpdate,
  object,
  record,
  traversal,
}: {
  readonly canUpdate: boolean
  readonly object: ModelObject
  readonly record: ClientRecord
  readonly traversal: ModelLinkTraversal
}) {
  const client = useMemo(
    () => linkClientFor(object, traversal),
    [object, traversal]
  )
  const [items, setItems] = useState<ReadonlyArray<RelatedRecord>>([])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string>()
  const [nextPageToken, setNextPageToken] = useState("")
  const [removing, setRemoving] = useState<string>()
  const formElement = useRef<HTMLFormElement>(null)
  const link = canUpdate ? client.link : undefined
  const unlink = canUpdate ? client.unlink : undefined

  const load = useCallback(
    async (pageToken?: string) => {
      setLoading(true)
      setLoadError(undefined)
      try {
        const request: DynamicLinkListInput =
          pageToken === undefined
            ? { id: record.id, pageSize: 50 }
            : { id: record.id, pageSize: 50, pageToken }
        const page = await client.list(request)
        const described = await describeReferences(page.items)
        setItems((current) =>
          pageToken === undefined ? described : [...current, ...described]
        )
        setNextPageToken(page.nextPageToken)
      } catch (cause) {
        setLoadError(
          errorMessage(
            cause,
            `${traversal.traversal.label} could not be loaded.`
          )
        )
      } finally {
        setLoading(false)
      }
    },
    [client, record.id, traversal.traversal.label]
  )

  useEffect(() => {
    if (!expanded) return
    void load()
  }, [expanded, load])

  const form = useAppForm({
    defaultValues: { target: "" },
    validators: {
      onSubmit: ({ value }) =>
        value.target.trim() === ""
          ? formErrorFromViolations([
              {
                message: `${targetTypeName(traversal.target.from.typeId)} is required.`,
                path: ["target"],
                reason: "REQUIRED",
              },
            ])
          : undefined,
    },
    onSubmitInvalid: () => focusFirstFormError(formElement.current),
    onSubmit: async ({ formApi, value }) => {
      try {
        if (link === undefined) {
          throw new Error("This relationship is not writable.")
        }
        await link({ id: record.id, target: value.target.trim() })
        formApi.reset()
        await load()
      } catch (cause) {
        formApi.setErrorMap({
          onSubmit: formErrorFromCause(
            cause,
            `${traversal.traversal.label} could not be linked.`
          ),
        })
        focusFirstFormError(formElement.current)
        throw cause
      }
    },
  })

  const canAdd =
    link !== undefined &&
    (traversal.traversal.cardinality === "many" || items.length === 0)

  return (
    <section className="grid gap-3 border-t pt-4">
      <Button
        type="button"
        variant="ghost"
        className="h-auto justify-start gap-2 px-0 text-left"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
        <span>
          <span className="block text-sm font-medium">
            {traversal.traversal.label}
          </span>
          {traversal.traversal.description === undefined ? null : (
            <span className="block text-xs font-normal text-muted-foreground">
              {traversal.traversal.description}
            </span>
          )}
        </span>
      </Button>

      {expanded ? (
        <>
          {loadError === undefined ? null : (
            <div className="flex items-center justify-between gap-3 text-xs text-destructive">
              <span>{loadError}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void load()}
              >
                Retry
              </Button>
            </div>
          )}

          {items.length === 0 && !loading ? (
            <p className="text-xs text-muted-foreground">No linked records.</p>
          ) : (
            <div className="grid gap-1">
              {items.map((item) => (
                <div
                  key={`${item.objectType}:${item.id}`}
                  className="flex min-h-8 items-center justify-between gap-3 border px-2 text-sm"
                >
                  <span className="min-w-0 truncate">{item.label}</span>
                  {unlink === undefined ? null : (
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      disabled={removing === item.id}
                      aria-label={`Unlink ${item.label}`}
                      onClick={() => {
                        setRemoving(item.id)
                        setLoadError(undefined)
                        void unlink({ id: record.id, target: item.id })
                          .then(() => load())
                          .catch((cause: unknown) =>
                            setLoadError(
                              errorMessage(
                                cause,
                                `${traversal.traversal.label} could not be unlinked.`
                              )
                            )
                          )
                          .finally(() => setRemoving(undefined))
                      }}
                    >
                      <UnlinkIcon />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {nextPageToken === "" ? null : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => void load(nextPageToken)}
            >
              {loading ? "Loading…" : "Load more"}
            </Button>
          )}

          {canAdd ? (
            <form.AppForm>
              <form
                ref={formElement}
                noValidate
                className="grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  void form.handleSubmit().catch(() => undefined)
                }}
              >
                <form.AppField name="target">
                  {(field) => (
                    <field.FormField
                      id={`${record.id}-${traversal.traversal.key}-target`}
                      label={`Add ${targetTypeName(traversal.target.from.typeId).toLowerCase()}`}
                    >
                      {({
                        ariaDescribedBy,
                        invalid,
                        onBlur,
                        onValueChange,
                        value,
                      }) => (
                        <ObjectReferenceSelect
                          ariaDescribedBy={ariaDescribedBy}
                          id={`${record.id}-${traversal.traversal.key}-target`}
                          invalid={invalid}
                          name="target"
                          required
                          typeId={traversal.target.from.typeId}
                          value={stringValue(value)}
                          onBlur={onBlur}
                          onValueChange={onValueChange}
                        />
                      )}
                    </field.FormField>
                  )}
                </form.AppField>
                <form.Subscribe selector={({ errors }) => errors}>
                  {(errors) => (
                    <FieldError errors={formErrorMessages(errors)} />
                  )}
                </form.Subscribe>
                <form.FormSubmitButton
                  size="sm"
                  pendingChildren={
                    <>
                      <PlusIcon />
                      Linking…
                    </>
                  }
                >
                  <PlusIcon />
                  Link
                </form.FormSubmitButton>
              </form>
            </form.AppForm>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

export function ObjectRelationships({
  canUpdate,
  object,
  record,
}: {
  readonly canUpdate: boolean
  readonly object: ModelObject
  readonly record: ClientRecord
}) {
  const traversals = modelObjectLinkTraversals(Model, object)
  if (traversals.length === 0) return null
  return (
    <div className="grid gap-4">
      {traversals.map((traversal) => (
        <Relationship
          key={traversal.traversal.key}
          canUpdate={canUpdate}
          object={object}
          record={record}
          traversal={traversal}
        />
      ))}
    </div>
  )
}
