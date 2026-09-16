import { Button } from "@company/ui/button"
import { Input } from "@company/ui/input"
import { useState } from "react"

import type { AnySchema } from "#/runtime/model/index.ts"
import { unionMember } from "#/runtime/ui/forms/schema-form-values.ts"

function RevealedSecret({
  value,
  label,
}: {
  readonly value: string
  readonly label: string
}) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <Input
        aria-label={label}
        readOnly
        type={revealed ? "text" : "password"}
        value={value}
        autoComplete="off"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setRevealed(!revealed)}
      >
        {revealed ? "Hide" : "Reveal"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          void navigator.clipboard.writeText(value)
        }}
      >
        Copy
      </Button>
    </div>
  )
}

/** Explicit action results live only in the open dialog; secret values require an intentional reveal or copy. */
export function OperationResult({
  schema,
  value,
  label = "Result",
}: {
  readonly schema: AnySchema
  readonly value: unknown
  readonly label?: string
}) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">Empty</span>
  if (schema.kind === "optional")
    return <OperationResult schema={schema.value} value={value} label={label} />
  if (schema.kind === "string" && schema.secret && typeof value === "string")
    return <RevealedSecret value={value} label={label} />
  if (schema.kind === "union") {
    const member = unionMember(schema, value)
    if (member)
      return <OperationResult schema={member} value={value} label={label} />
    return <span>Completed</span>
  }
  if (schema.kind === "struct" && typeof value === "object")
    return (
      <dl className="space-y-3">
        {Object.entries(schema.properties).map(([key, child]) => (
          <div key={key}>
            <dt className="mb-1 text-sm font-medium">{child.label ?? key}</dt>
            <dd>
              <OperationResult
                schema={child}
                value={Reflect.get(value, key)}
                label={child.label ?? key}
              />
            </dd>
          </div>
        ))}
      </dl>
    )
  if (schema.kind === "array" && Array.isArray(value))
    return (
      <div className="space-y-3">
        {value.map((item, index) => (
          <OperationResult
            key={index}
            schema={schema.items}
            value={item}
            label={label}
          />
        ))}
      </div>
    )
  if (schema.kind === "map" && typeof value === "object")
    return (
      <dl className="space-y-3">
        {Object.entries(value).map(([key, item]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>
              <OperationResult
                schema={schema.values}
                value={item}
                label={key}
              />
            </dd>
          </div>
        ))}
      </dl>
    )
  return (
    <span className="break-words text-sm">
      {typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value)}
    </span>
  )
}
