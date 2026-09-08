import { SearchIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { Input } from "#/ui/components/input.tsx"

export function CollectionSearch({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (draft === value) return undefined
    const timer = setTimeout(() => onChange(draft), 200)
    return () => clearTimeout(timer)
  }, [draft, value, onChange])
  return (
    <div className="relative w-full sm:ml-auto sm:w-56 sm:shrink-0">
      <SearchIcon className="pointer-events-none absolute top-1.5 left-2 size-3.5 text-muted-foreground" />
      <Input
        type="search"
        aria-label={`Search ${label}`}
        placeholder={`Search ${label.toLowerCase()}…`}
        value={draft}
        className="h-7 pl-7"
        onChange={(event) => setDraft(event.target.value)}
      />
    </div>
  )
}
