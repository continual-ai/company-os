import { FactoryIcon, ShoppingBagIcon, TruckIcon } from "lucide-react"

import type { Choice, ChoiceColor } from "#/runtime/model/index.ts"
import { cn } from "#/runtime/ui/lib/utils.ts"

const tagColorClasses = {
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  gray: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
  green:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
  indigo:
    "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  lime: "border-lime-200 bg-lime-50 text-lime-800 dark:border-lime-800 dark:bg-lime-950 dark:text-lime-300",
  orange:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
  pink: "border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-800 dark:bg-pink-950 dark:text-pink-300",
  purple:
    "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300",
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  teal: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300",
  violet:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
  yellow:
    "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
} satisfies Record<ChoiceColor, string>

const tagIconComponents = new Map([
  ["factory", FactoryIcon],
  ["shoppingBag", ShoppingBagIcon],
  ["truck", TruckIcon],
])

export function ObjectChoiceBadge({
  choice,
  className,
}: {
  choice: Choice
  className?: string | undefined
}) {
  const Icon =
    choice.icon === undefined ? undefined : tagIconComponents.get(choice.icon)

  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center rounded-sm border px-1.5 font-normal",
        choice.color === undefined
          ? "border-transparent bg-secondary text-secondary-foreground"
          : tagColorClasses[choice.color],
        className
      )}
    >
      {Icon === undefined ? null : (
        <Icon aria-hidden="true" className="mr-1 size-3" />
      )}
      <span className="truncate">{choice.label}</span>
    </span>
  )
}
