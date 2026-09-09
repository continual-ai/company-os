import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@company/ui/alert-dialog"
import { Button } from "@company/ui/button"
import { ConfirmActionButton } from "@company/ui/confirm-action-button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@company/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@company/ui/dropdown-menu"
import { Input } from "@company/ui/input"
import { Label } from "@company/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@company/ui/popover"
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@company/ui/preview-card"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@company/ui/sheet"
import { toast } from "@company/ui/toast"
import { Tooltip, TooltipContent, TooltipTrigger } from "@company/ui/tooltip"

import {
  Example,
  type ComponentSection,
} from "#/app/ui/developer/design-system/example.tsx"

export const overlaySections: ReadonlyArray<ComponentSection> = [
  {
    id: "dialog",
    title: "Dialog",
    description:
      "A focused task with a title, description, and explicit completion or dismissal.",
    component: DialogExamples,
    usage:
      'import { Button } from "@company/ui/button"\nimport { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@company/ui/dialog"\n\n<Dialog>\n  <DialogTrigger render={<Button />}>Open</DialogTrigger>\n  <DialogContent>\n    <DialogHeader><DialogTitle>Review request</DialogTitle></DialogHeader>\n  </DialogContent>\n</Dialog>',
  },
  {
    id: "sheet",
    title: "Sheet",
    description:
      "Supporting content alongside the current task, with focus management and dismissal.",
    component: SheetExamples,
    usage:
      'import { Button } from "@company/ui/button"\nimport { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@company/ui/sheet"\n\n<Sheet>\n  <SheetTrigger render={<Button />}>Details</SheetTrigger>\n  <SheetContent>\n    <SheetHeader><SheetTitle>Record context</SheetTitle></SheetHeader>\n  </SheetContent>\n</Sheet>',
  },
  {
    id: "alert-dialog",
    title: "Alert dialog",
    description:
      "Require an explicit response to a consequential decision. Use ConfirmActionButton for asynchronous confirmation with pending and error states.",
    component: AlertExamples,
    usage:
      'import { Button } from "@company/ui/button"\nimport { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@company/ui/alert-dialog"\n\n<AlertDialog>\n  <AlertDialogTrigger render={<Button />}>Review notice</AlertDialogTrigger>\n  <AlertDialogContent>\n    <AlertDialogHeader><AlertDialogTitle>Review before continuing</AlertDialogTitle></AlertDialogHeader>\n    <AlertDialogCancel>Close</AlertDialogCancel>\n  </AlertDialogContent>\n</AlertDialog>',
  },
  {
    id: "confirm-action-button",
    title: "Confirm action button",
    description:
      "A confirmation dialog that owns pending and failure feedback while the caller owns the operation.",
    component: ConfirmExamples,
    usage:
      'import { ConfirmActionButton } from "@company/ui/confirm-action-button"\n\n<ConfirmActionButton\n  actionLabel="Reset example"\n  title="Reset this example?"\n  description="Only this preview will change."\n  onConfirm={async () => { /* Run the operation. Throw to show an error. */ }}\n/>',
  },
  {
    id: "dropdown-menu",
    title: "Dropdown menu",
    description:
      "Related actions attached to one trigger. Keep unavailable actions disabled.",
    component: MenuExamples,
    usage:
      'import { Button } from "@company/ui/button"\nimport { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@company/ui/dropdown-menu"\n\n<DropdownMenu>\n  <DropdownMenuTrigger render={<Button variant="outline" />}>Options</DropdownMenuTrigger>\n  <DropdownMenuContent>\n    <DropdownMenuItem onClick={() => {}}>Duplicate</DropdownMenuItem>\n  </DropdownMenuContent>\n</DropdownMenu>',
  },
  {
    id: "popover",
    title: "Popover",
    description:
      "Small interactive content anchored to a trigger, such as a filter or inline choice.",
    component: PopoverExamples,
    usage:
      'import { Button } from "@company/ui/button"\nimport { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@company/ui/popover"\n\n<Popover>\n  <PopoverTrigger render={<Button />}>Filter</PopoverTrigger>\n  <PopoverContent><PopoverTitle>Quick filter</PopoverTitle></PopoverContent>\n</Popover>',
  },
  {
    id: "preview-card",
    title: "Preview card",
    description:
      "Read-only context revealed from a linked identity. Keep essential actions outside hover-only content.",
    component: PreviewExamples,
    usage:
      'import { Button } from "@company/ui/button"\nimport { PreviewCard, PreviewCardContent, PreviewCardTrigger } from "@company/ui/preview-card"\n\n<PreviewCard>\n  <PreviewCardTrigger render={<Button variant="link" />}>Company</PreviewCardTrigger>\n  <PreviewCardContent>Design partner · Active customer</PreviewCardContent>\n</PreviewCard>',
  },
  {
    id: "tooltip",
    title: "Tooltip",
    description:
      "Brief supplemental context on hover or keyboard focus. The control still needs its own accessible name.",
    component: TooltipExamples,
    usage:
      'import { Button } from "@company/ui/button"\nimport { Tooltip, TooltipContent, TooltipTrigger } from "@company/ui/tooltip"\n\n<Tooltip>\n  <TooltipTrigger render={<Button variant="outline" />}>Details</TooltipTrigger>\n  <TooltipContent>Additional context</TooltipContent>\n</Tooltip>',
  },
  {
    id: "toast",
    title: "Toast",
    description:
      "Transient feedback after an action. Keep persistent errors in the relevant form or page.",
    component: ToastExamples,
    usage:
      'import { toast } from "@company/ui/toast"\n\ntoast.success("Saved")\ntoast.error("Could not save", { description: "Try again when you’re ready." })',
  },
]

function DialogExamples() {
  return (
    <Example title="Focused editor" source="@company/ui/dialog">
      <Dialog>
        <DialogTrigger render={<Button variant="outline" />}>
          Open dialog
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename workspace</DialogTitle>
            <DialogDescription>
              An example dialog. Changes stay in this preview.
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="ds-workspace">Name</Label>
          <Input id="ds-workspace" defaultValue="Example workspace" />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <DialogClose render={<Button />}>Save preview</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Example>
  )
}

function SheetExamples() {
  return (
    <Example title="Side panel" source="@company/ui/sheet">
      <Sheet>
        <SheetTrigger render={<Button variant="outline" />}>
          Open sheet
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Record context</SheetTitle>
            <SheetDescription>
              Supporting information beside your current work.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-4">
            <p className="text-sm">
              A production sheet with the same focus and dismissal behavior as
              the app.
            </p>
            <SheetClose render={<Button variant="outline" />}>
              Close preview
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </Example>
  )
}

function AlertExamples() {
  return (
    <Example title="Explicit acknowledgment" source="@company/ui/alert-dialog">
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="outline" />}>
          Review notice
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Review before continuing</AlertDialogTitle>
            <AlertDialogDescription>
              This preview requires an explicit response.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Understood</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Example>
  )
}

function ConfirmExamples() {
  return (
    <>
      <Example
        title="Successful operation"
        source="@company/ui/confirm-action-button"
      >
        <ConfirmActionButton
          actionLabel="Reset example"
          title="Reset this example?"
          description="Only this preview will change."
          onConfirm={async () => {
            toast.success("Example reset")
          }}
        />
      </Example>
      <Example
        title="Recoverable failure"
        source="@company/ui/confirm-action-button"
      >
        <ConfirmActionButton
          actionLabel="Simulate failure"
          title="Try the failing operation?"
          description="The dialog stays open and displays the operation’s error."
          onConfirm={async () => {
            throw new Error("Example save failed. Your draft is preserved.")
          }}
        />
      </Example>
    </>
  )
}

function MenuExamples() {
  return (
    <Example
      title="Actions and disabled items"
      source="@company/ui/dropdown-menu"
    >
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          Record options
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={() => toast.message("Duplicate selected in preview")}
          >
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem disabled>Export unavailable</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => toast.message("Archive selected in preview")}
          >
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Example>
  )
}

function PopoverExamples() {
  return (
    <Example title="Quick filter" source="@company/ui/popover">
      <Popover>
        <PopoverTrigger render={<Button variant="outline" />}>
          Open popover
        </PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>Quick filter</PopoverTitle>
          <Label htmlFor="ds-filter">Name contains</Label>
          <Input id="ds-filter" placeholder="Search example…" />
        </PopoverContent>
      </Popover>
    </Example>
  )
}

function PreviewExamples() {
  return (
    <Example title="Company preview" source="@company/ui/preview-card">
      <PreviewCard>
        <PreviewCardTrigger render={<Button variant="link" />}>
          Preview company
        </PreviewCardTrigger>
        <PreviewCardContent>
          <p className="font-medium">Northstar Studio</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Design partner · Active customer
          </p>
        </PreviewCardContent>
      </PreviewCard>
    </Example>
  )
}

function TooltipExamples() {
  return (
    <Example title="Hover and keyboard focus" source="@company/ui/tooltip">
      <Tooltip>
        <TooltipTrigger render={<Button variant="outline" />}>
          Hover or focus
        </TooltipTrigger>
        <TooltipContent>Additional context for this control</TooltipContent>
      </Tooltip>
    </Example>
  )
}

function ToastExamples() {
  return (
    <Example
      title="Success, information, warning, and failure"
      source="@company/ui/toast"
    >
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => toast.success("Preview saved")}
        >
          Success
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.info("Your example is ready")}
        >
          Information
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.warning("Review this example")}
        >
          Warning
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast.error("Example could not be saved", {
              description: "Try again when you’re ready.",
            })
          }
        >
          Error
        </Button>
      </div>
    </Example>
  )
}
