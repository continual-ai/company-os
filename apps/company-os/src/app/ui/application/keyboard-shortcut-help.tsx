import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@company/ui/dialog"
import {
  useAvailableShortcuts,
  useKeyboardShortcuts,
} from "@company/ui/keyboard-shortcuts"
import { useState } from "react"

export function KeyboardShortcutHelp() {
  const [open, setOpen] = useState(false)
  const shortcuts = useAvailableShortcuts()
  useKeyboardShortcuts([
    {
      id: "shortcut-help",
      key: "?",
      description: "Show keyboard shortcuts",
      group: "General",
      run: () => setOpen(true),
    },
  ])
  const groups = [...new Set(shortcuts.map((shortcut) => shortcut.group))]
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts for this page. Page navigation pauses while you type or
            use a dialog.
          </DialogDescription>
        </DialogHeader>
        {groups.map((group) => (
          <section key={group} className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">
              {group}
            </h3>
            <dl className="divide-y">
              {shortcuts
                .filter((shortcut) => shortcut.group === group)
                .map((shortcut) => (
                  <div
                    key={shortcut.id}
                    className="flex items-center justify-between gap-4 py-2"
                    aria-disabled={shortcut.enabled === false}
                  >
                    <dt
                      className={
                        shortcut.enabled === false
                          ? "text-muted-foreground"
                          : undefined
                      }
                    >
                      {shortcut.description}
                    </dt>
                    <dd>
                      <kbd className="rounded-md border bg-muted/40 px-2 py-1 font-sans text-xs text-muted-foreground">
                        {shortcut.label ??
                          (shortcut.mod ? "⌘ / Ctrl + " : "") + shortcut.key}
                      </kbd>
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  )
}
