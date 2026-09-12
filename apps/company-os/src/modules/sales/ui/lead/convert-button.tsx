import { ConfirmActionButton } from "@company/ui/confirm-action-button"
import { useMutation } from "@tanstack/react-query"

import { type Lead, ConvertLead } from "#/modules/sales/model/lead.ts"
import type { RecordUiProps } from "#/runtime/ui/module.ts"
import { useOperationClient } from "#/runtime/ui/module.ts"

export function ConvertLeadAction({ record }: RecordUiProps<typeof Lead>) {
  const convert = useMutation(useOperationClient(ConvertLead)())
  if (record.convertedAt !== null) return null
  return (
    <ConfirmActionButton
      actionLabel="Convert"
      destructive={false}
      title="Convert this lead?"
      description={
        record.links.company?.ids[0]
          ? "Creates a contact at the linked company."
          : "Creates a company and contact linked to this lead."
      }
      onConfirm={async () => {
        await convert.mutateAsync({ id: record.id })
      }}
    />
  )
}
