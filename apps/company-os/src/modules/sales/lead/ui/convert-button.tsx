import type { Model } from "company-os/model"
import { Effect } from "effect"

import { client } from "@/app-client"
import { ConfirmActionButton } from "@/ui/model/confirm-action-button"
import type { RecordUiProps } from "@/ui/model/module-ui"

export function ConvertLeadAction({
  record,
}: RecordUiProps<typeof Model.objects.lead>) {
  if (record.convertedAt !== null) return null
  return (
    <ConfirmActionButton
      actionLabel="Convert"
      destructive={false}
      title="Convert this lead?"
      description="Creates a company and contact linked to this lead."
      onConfirm={() =>
        Effect.runPromise(
          client.lead.convert({ id: record.id }).pipe(Effect.asVoid)
        )
      }
    />
  )
}
