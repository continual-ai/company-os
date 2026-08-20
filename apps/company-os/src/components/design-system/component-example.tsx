import { CodeXmlIcon } from "lucide-react"

export function ComponentExample({
  children,
  code,
}: {
  children: React.ReactNode
  code: string
}) {
  return (
    <div className="mt-8 overflow-hidden border">
      <div className="flex min-h-56 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-2xl">{children}</div>
      </div>
      <details className="group border-t bg-muted/30">
        <summary className="flex cursor-pointer list-none items-center justify-center gap-2 px-4 py-3 text-xs font-medium hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <CodeXmlIcon className="size-3.5" />
          <span className="group-open:hidden">View code</span>
          <span className="hidden group-open:inline">Hide code</span>
        </summary>
        <pre className="overflow-x-auto border-t bg-muted/40 p-4 text-xs leading-6">
          <code>{code}</code>
        </pre>
      </details>
    </div>
  )
}
