import { ConfirmActionButton } from "@company/ui/confirm-action-button"
import { useMutation } from "@tanstack/react-query"

import { Model } from "#/app.model.ts"
import { type Lead } from "#/modules/sales/model/lead.ts"
import { linkPreview } from "#/runtime/model/record-links.ts"
import { type RecordUiProps, useClient } from "#/runtime/ui/module.ts"

export function ConvertLeadAction({ record }: RecordUiProps<typeof Lead>) {
  const client = useClient(Model)
  const convert = useMutation(client.lead.convert.mutationOptions())
  if (
    record.status === "disqualified" ||
    linkPreview(record.links.opportunity).totalSize > 0
  )
    return null
  return (
    <ConfirmActionButton
      actionLabel="Convert"
      destructive={false}
      title="Convert this lead?"
      description="Creates an opportunity with the linked account and contact."
      onConfirm={async () => {
        await convert.mutateAsync({ id: record.id })
      }}
    />
  )
}
