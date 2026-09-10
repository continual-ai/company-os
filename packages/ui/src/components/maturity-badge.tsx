import { Badge } from "#/components/badge.tsx"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "#/components/tooltip.tsx"

const maturities = {
  alpha: {
    label: "Alpha",
    variant: "discovery",
    description: "Early development. Expect changes as the module evolves.",
  },
  beta: {
    label: "Beta",
    variant: "info",
    description:
      "Ready for broader use, with changes and refinements still expected.",
  },
  stable: {
    label: "Stable",
    variant: "success",
    description:
      "Maintained for production use with an established behavior contract.",
  },
  deprecated: {
    label: "Deprecated",
    variant: "warning",
    description:
      "No longer recommended for new use. Contact the maintainer about a replacement.",
  },
} as const

/** Readiness has a stable color meaning, distinct from enabled/disabled state. */
export function MaturityBadge({ value }: { value: keyof typeof maturities }) {
  const maturity = maturities[value]
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Badge variant={maturity.variant} />}
        tabIndex={0}
        aria-label={`${maturity.label} maturity`}
        className="h-5 px-1.5 text-[11px]"
      >
        {maturity.label}
      </TooltipTrigger>
      <TooltipContent>{maturity.description}</TooltipContent>
    </Tooltip>
  )
}
