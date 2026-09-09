import { Link } from "@tanstack/react-router"

import { Deal } from "#/modules/sales/model/deal.ts"
import { PipelineSummary } from "#/modules/sales/ui/deal/pipeline-summary.tsx"
import { Button } from "#/runtime/ui/components/button.tsx"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from "#/runtime/ui/components/popover.tsx"
import { useObjectClient } from "#/runtime/ui/module.ts"

export function DealToolbar() {
  const options = useObjectClient(Deal).pipelineSummary({})
  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger render={<Button variant="outline" />}>
          Pipeline summary
        </PopoverTrigger>
        <PopoverContent align="end" className="w-96 max-w-[90vw] p-4">
          <PopoverTitle>Pipeline summary</PopoverTitle>
          <PipelineSummary options={options} />
        </PopoverContent>
      </Popover>
      <Button
        variant="outline"
        nativeButton={false}
        render={
          <Link to="/objects/$objectType" params={{ objectType: "lineItem" }} />
        }
      >
        Line items
      </Button>
    </div>
  )
}
