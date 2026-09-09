import type { ReactNode } from "react"

import { useObjectUi } from "#/runtime/ui/model/module-ui.tsx"
import {
  tableRecord,
  type ClientRecord,
  type ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import { ObjectRecordIdentity } from "#/runtime/ui/model/object-record-identity.tsx"
import { objectHref } from "#/runtime/ui/model/object-routing.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

/** Dispatches an object-owned summary without giving it query or mutation ownership. */
export function ObjectRecordSummary({
  object,
  record,
  href: suppliedHref,
  variant,
  actions,
  author,
}: {
  readonly object: ModelObject
  readonly record: ClientRecord
  readonly href?: string | undefined
  readonly variant: "feed" | "preview"
  readonly author?: string | undefined
  readonly actions?: ReactNode
}) {
  const runtime = useModelRuntime()
  const href = suppliedHref ?? objectHref(runtime, object, record.id)

  const Component = useObjectUi(object)?.record?.summaryComponent
  return Component ? (
    <Component
      record={record}
      href={href}
      variant={variant}
      actions={actions}
      author={author}
    />
  ) : (
    <div className="flex w-full min-w-0 items-center justify-between gap-3">
      <ObjectRecordIdentity
        expanded
        className="flex-1"
        object={object}
        record={tableRecord(object, record)}
        href={href}
      />
      {actions}
    </div>
  )
}
