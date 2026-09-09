import { Button } from "@company/ui/button"

export function CollectionPagination({
  loaded,
  totalSize,
  hasNextPage,
  loading,
  error,
  onNextPage,
}: {
  readonly loaded: number
  readonly totalSize: number
  readonly hasNextPage: boolean
  readonly loading: boolean
  readonly error?: string | undefined
  readonly onNextPage: () => void
}) {
  return (
    <footer className="flex min-h-9 shrink-0 items-center justify-between gap-3 border-t bg-background px-4 text-xs text-muted-foreground">
      <span className="tabular-nums" aria-live="polite">
        {loaded.toLocaleString()} of {totalSize.toLocaleString()}
      </span>
      {hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={onNextPage}
        >
          {loading ? "Loading…" : error ? "Retry loading" : "Load more"}
        </Button>
      )}
    </footer>
  )
}
