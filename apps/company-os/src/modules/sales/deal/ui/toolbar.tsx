import { Button } from "@company/ui/components/button"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from "@company/ui/components/popover"
import { Link } from "@tanstack/react-router"

import { PipelineSummary } from "./pipeline-summary"

export function DealToolbar() {
  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger render={<Button variant="outline" />}>
          Pipeline summary
        </PopoverTrigger>
        <PopoverContent align="end" className="w-96 max-w-[90vw] p-4">
          <PopoverTitle>Pipeline summary</PopoverTitle>
          <PipelineSummary />
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
