import type { ReactNode } from "react"

import { useObjectUi } from "./module-ui"
import {
  tableRecord,
  type ClientRecord,
  type ModelObject,
} from "./object-client"
import { ObjectRecordIdentity } from "./object-record-identity"
import { objectHref } from "./object-routing"

/** Dispatches an object-owned summary without giving it query or mutation ownership. */
export function ObjectRecordSummary({
  object,
  record,
  href = objectHref(object, record.id),
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
