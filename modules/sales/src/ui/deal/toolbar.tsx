import { Button } from "@company/runtime/ui/button"
import { useObjectClient } from "@company/runtime/ui/module"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from "@company/runtime/ui/popover"
import { Link } from "@tanstack/react-router"

import { Deal } from "#/model/deal.ts"
import { PipelineSummary } from "#/ui/deal/pipeline-summary.tsx"

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
