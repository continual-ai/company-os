import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@acme/ui/components/accordion"
import { Alert, AlertDescription, AlertTitle } from "@acme/ui/components/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@acme/ui/components/alert-dialog"
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@acme/ui/components/avatar"
import { Badge } from "@acme/ui/components/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@acme/ui/components/breadcrumb"
import { Button } from "@acme/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@acme/ui/components/card"
import { Checkbox } from "@acme/ui/components/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@acme/ui/components/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@acme/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@acme/ui/components/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@acme/ui/components/empty"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@acme/ui/components/field"
import { Input } from "@acme/ui/components/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@acme/ui/components/input-group"
import { Label } from "@acme/ui/components/label"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@acme/ui/components/popover"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@acme/ui/components/progress"
import { RadioGroup, RadioGroupItem } from "@acme/ui/components/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/components/select"
import { Separator } from "@acme/ui/components/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@acme/ui/components/sheet"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@acme/ui/components/sidebar"
import { Skeleton } from "@acme/ui/components/skeleton"
import { Switch } from "@acme/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@acme/ui/components/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@acme/ui/components/tabs"
import { Textarea } from "@acme/ui/components/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@acme/ui/components/tooltip"
import {
  ArchiveIcon,
  Building2Icon,
  CheckCircle2Icon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"

import type { ComponentSlug } from "@/components/design-system/component-metadata"

type ComponentExample = {
  code: string
  preview: React.ReactNode
  usage: string
}

const snippet = (...lines: string[]) => lines.join("\n")

const exampleDetails = {
  accordion: {
    code: snippet(
      'import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@acme/ui/components/accordion"',
      "",
      '<Accordion defaultValue={["governance"]}>',
      '  <AccordionItem value="governance">',
      "    <AccordionTrigger>How are actions governed?</AccordionTrigger>",
      "    <AccordionContent>Every mutation checks actor authority.</AccordionContent>",
      "  </AccordionItem>",
      "</Accordion>"
    ),
    usage:
      "Use an accordion for optional supporting material, not for information required to complete the current task.",
  },
  alert: {
    code: snippet(
      'import { Alert, AlertDescription, AlertTitle } from "@acme/ui/components/alert"',
      "",
      "<Alert>",
      "  <CheckCircle2Icon />",
      "  <AlertTitle>Model synchronized</AlertTitle>",
      "  <AlertDescription>All projections match the current source.</AlertDescription>",
      "</Alert>"
    ),
    usage:
      "Use alerts for contextual status that should remain visible in the flow. Reserve destructive styling for errors that need attention.",
  },
  "alert-dialog": {
    code: snippet(
      'import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@acme/ui/components/alert-dialog"',
      "",
      "<AlertDialog>",
      '  <AlertDialogTrigger render={<Button variant="destructive" />}>Archive company</AlertDialogTrigger>',
      "  <AlertDialogContent>",
      "    <AlertDialogHeader>",
      "      <AlertDialogTitle>Archive this company?</AlertDialogTitle>",
      "      <AlertDialogDescription>This removes it from active work.</AlertDialogDescription>",
      "    </AlertDialogHeader>",
      "    <AlertDialogFooter>",
      "      <AlertDialogCancel>Cancel</AlertDialogCancel>",
      "      <AlertDialogAction>Archive</AlertDialogAction>",
      "    </AlertDialogFooter>",
      "  </AlertDialogContent>",
      "</AlertDialog>"
    ),
    usage:
      "Use an alert dialog when a consequential action requires explicit acknowledgement. Ordinary editing belongs in a dialog or sheet.",
  },
  avatar: {
    code: snippet(
      'import { Avatar, AvatarBadge, AvatarFallback } from "@acme/ui/components/avatar"',
      "",
      '<Avatar size="lg">',
      "  <AvatarFallback>TZ</AvatarFallback>",
      "  <AvatarBadge />",
      "</Avatar>"
    ),
    usage:
      "Use a stable fallback so identity remains legible when an image is absent or fails to load.",
  },
  badge: {
    code: snippet(
      'import { Badge } from "@acme/ui/components/badge"',
      "",
      '<Badge variant="secondary">Qualified</Badge>'
    ),
    usage:
      "Use badges for compact metadata. Do not make color the only signal for a business status.",
  },
  breadcrumb: {
    code: snippet(
      'import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@acme/ui/components/breadcrumb"',
      "",
      "<Breadcrumb>",
      "  <BreadcrumbList>",
      '    <BreadcrumbItem><BreadcrumbLink href="/develop">Develop</BreadcrumbLink></BreadcrumbItem>',
      "    <BreadcrumbSeparator />",
      "    <BreadcrumbItem><BreadcrumbPage>Design system</BreadcrumbPage></BreadcrumbItem>",
      "  </BreadcrumbList>",
      "</Breadcrumb>"
    ),
    usage:
      "Use breadcrumbs for a real hierarchy. Keep labels short and make the final item the current page.",
  },
  button: {
    code: snippet(
      'import { Button } from "@acme/ui/components/button"',
      "",
      "<Button>Save company</Button>",
      '<Button variant="outline">Cancel</Button>',
      '<Button variant="destructive">Archive</Button>'
    ),
    usage:
      "Use one primary action per local decision point. Secondary and destructive variants should communicate hierarchy, not decoration.",
  },
  card: {
    code: snippet(
      'import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@acme/ui/components/card"',
      "",
      "<Card>",
      "  <CardHeader>",
      "    <CardTitle>Pipeline</CardTitle>",
      "    <CardDescription>Qualified opportunities</CardDescription>",
      "    <CardAction><Badge>12</Badge></CardAction>",
      "  </CardHeader>",
      "  <CardContent>$420,000 weighted value</CardContent>",
      "  <CardFooter>Updated moments ago</CardFooter>",
      "</Card>"
    ),
    usage:
      "Use cards for bounded supporting surfaces. Prefer ordinary page structure when the content already has sufficient hierarchy.",
  },
  checkbox: {
    code: snippet(
      'import { Checkbox } from "@acme/ui/components/checkbox"',
      'import { Label } from "@acme/ui/components/label"',
      "",
      '<div className="flex items-center gap-2">',
      '  <Checkbox id="approval" defaultChecked />',
      '  <Label htmlFor="approval">Require approval before execution</Label>',
      "</div>"
    ),
    usage:
      "Use checkboxes for independent choices. Pair every checkbox with a visible label and a unique id.",
  },
  command: {
    code: snippet(
      'import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@acme/ui/components/command"',
      "",
      "<Command>",
      '  <CommandInput placeholder="Search company objects..." />',
      "  <CommandList>",
      '    <CommandGroup heading="Objects">',
      "      <CommandItem>Companies</CommandItem>",
      "      <CommandItem>Contacts</CommandItem>",
      "    </CommandGroup>",
      "  </CommandList>",
      "</Command>"
    ),
    usage:
      "Use command surfaces for keyboard-first discovery and action selection, especially when users already know what they want.",
  },
  dialog: {
    code: snippet(
      'import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@acme/ui/components/dialog"',
      "",
      "<Dialog>",
      "  <DialogTrigger render={<Button />}>Add contact</DialogTrigger>",
      "  <DialogContent>",
      "    <DialogHeader>",
      "      <DialogTitle>Add contact</DialogTitle>",
      "      <DialogDescription>Create a person associated with this company.</DialogDescription>",
      "    </DialogHeader>",
      '    <Input aria-label="Email" placeholder="person@example.com" />',
      "    <DialogFooter><Button>Create contact</Button></DialogFooter>",
      "  </DialogContent>",
      "</Dialog>"
    ),
    usage:
      "Use a dialog for a short focused task. Move longer or navigable workflows onto a page or into a sheet.",
  },
  "dropdown-menu": {
    code: snippet(
      'import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@acme/ui/components/dropdown-menu"',
      "",
      "<DropdownMenu>",
      '  <DropdownMenuTrigger render={<Button variant="outline" size="icon" />}><MoreHorizontalIcon /></DropdownMenuTrigger>',
      "  <DropdownMenuContent>",
      "    <DropdownMenuItem>Edit company</DropdownMenuItem>",
      "    <DropdownMenuItem>View activity</DropdownMenuItem>",
      "  </DropdownMenuContent>",
      "</DropdownMenu>"
    ),
    usage:
      "Use a dropdown menu for secondary contextual actions. Keep the primary action visible.",
  },
  empty: {
    code: snippet(
      'import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@acme/ui/components/empty"',
      "",
      "<Empty>",
      '  <EmptyMedia variant="icon"><Building2Icon /></EmptyMedia>',
      "  <EmptyHeader>",
      "    <EmptyTitle>No companies yet</EmptyTitle>",
      "    <EmptyDescription>Add the first company to begin operating the pipeline.</EmptyDescription>",
      "  </EmptyHeader>",
      "  <EmptyContent><Button>Add company</Button></EmptyContent>",
      "</Empty>"
    ),
    usage:
      "Use an empty state to explain why the surface is empty and offer the next useful action. Avoid celebratory copy when work is blocked.",
  },
  field: {
    code: snippet(
      'import { Field, FieldDescription, FieldLabel } from "@acme/ui/components/field"',
      'import { Input } from "@acme/ui/components/input"',
      "",
      "<Field>",
      '  <FieldLabel htmlFor="domain">Company domain</FieldLabel>',
      '  <Input id="domain" placeholder="acme.example" />',
      "  <FieldDescription>Used to match contacts and activity.</FieldDescription>",
      "</Field>"
    ),
    usage:
      "Reach for Field instead of assembling form spacing and validation ad hoc. It is the standard semantic form composition.",
  },
  input: {
    code: snippet(
      'import { Input } from "@acme/ui/components/input"',
      "",
      '<Input aria-label="Company name" placeholder="Acme" />'
    ),
    usage:
      "Use Input inside Field for most forms so labels, descriptions, and errors retain a consistent relationship.",
  },
  "input-group": {
    code: snippet(
      'import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@acme/ui/components/input-group"',
      "",
      "<InputGroup>",
      "  <InputGroupAddon><InputGroupText>https://</InputGroupText></InputGroupAddon>",
      '  <InputGroupInput aria-label="Company domain" placeholder="acme.example" />',
      "</InputGroup>"
    ),
    usage:
      "Use an input group when the addon changes how the value is interpreted. Avoid decorative addons that make scanning harder.",
  },
  label: {
    code: snippet(
      'import { Label } from "@acme/ui/components/label"',
      "",
      '<Label htmlFor="company-name">Company name</Label>'
    ),
    usage:
      "Prefer FieldLabel inside Field. Use Label directly for compact controls that do not need descriptions or validation.",
  },
  popover: {
    code: snippet(
      'import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@acme/ui/components/popover"',
      "",
      "<Popover>",
      '  <PopoverTrigger render={<Button variant="outline" />}>Assignment</PopoverTrigger>',
      "  <PopoverContent>",
      "    <PopoverHeader>",
      "      <PopoverTitle>Assign owner</PopoverTitle>",
      "      <PopoverDescription>Choose who is accountable for the next action.</PopoverDescription>",
      "    </PopoverHeader>",
      "  </PopoverContent>",
      "</Popover>"
    ),
    usage:
      "Use a popover for lightweight contextual interaction that remains anchored to its trigger.",
  },
  progress: {
    code: snippet(
      'import { Progress, ProgressLabel, ProgressValue } from "@acme/ui/components/progress"',
      "",
      "<Progress value={68}>",
      "  <ProgressLabel>Importing records</ProgressLabel>",
      "  <ProgressValue />",
      "</Progress>"
    ),
    usage:
      "Use progress when completion is measurable. Use a skeleton or indeterminate status for operations without a meaningful bound.",
  },
  "radio-group": {
    code: snippet(
      'import { RadioGroup, RadioGroupItem } from "@acme/ui/components/radio-group"',
      'import { Label } from "@acme/ui/components/label"',
      "",
      '<RadioGroup defaultValue="review">',
      '  <div className="flex items-center gap-2">',
      '    <RadioGroupItem id="review" value="review" />',
      '    <Label htmlFor="review">Review first</Label>',
      "  </div>",
      '  <div className="flex items-center gap-2">',
      '    <RadioGroupItem id="automatic" value="automatic" />',
      '    <Label htmlFor="automatic">Run automatically</Label>',
      "  </div>",
      "</RadioGroup>"
    ),
    usage:
      "Use a radio group for a small visible set of mutually exclusive choices. Use Select when the list is longer.",
  },
  select: {
    code: snippet(
      'import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@acme/ui/components/select"',
      "",
      '<Select defaultValue="qualified">',
      "  <SelectTrigger><SelectValue /></SelectTrigger>",
      "  <SelectContent>",
      '    <SelectItem value="new">New</SelectItem>',
      '    <SelectItem value="qualified">Qualified</SelectItem>',
      '    <SelectItem value="closed">Closed</SelectItem>',
      "  </SelectContent>",
      "</Select>"
    ),
    usage:
      "Use Select for a constrained list that would otherwise consume too much space. Keep frequently compared choices visible with radios.",
  },
  separator: {
    code: snippet(
      'import { Separator } from "@acme/ui/components/separator"',
      "",
      '<div className="flex items-center gap-4">',
      "  <span>Pipeline</span>",
      '  <Separator orientation="vertical" />',
      "  <span>12 qualified</span>",
      "</div>"
    ),
    usage:
      "Use a separator when a semantic grouping needs reinforcement. Spacing alone is usually enough for ordinary sections.",
  },
  sheet: {
    code: snippet(
      'import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@acme/ui/components/sheet"',
      "",
      "<Sheet>",
      '  <SheetTrigger render={<Button variant="outline" />}>Edit details</SheetTrigger>',
      "  <SheetContent>",
      "    <SheetHeader>",
      "      <SheetTitle>Company details</SheetTitle>",
      "      <SheetDescription>Update supporting company information.</SheetDescription>",
      "    </SheetHeader>",
      "    <SheetFooter><Button>Save changes</Button></SheetFooter>",
      "  </SheetContent>",
      "</Sheet>"
    ),
    usage:
      "Use a sheet for supporting work that benefits from retaining the parent context, especially on responsive surfaces.",
  },
  sidebar: {
    code: snippet(
      'import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from "@acme/ui/components/sidebar"',
      "",
      "<SidebarProvider>",
      '  <Sidebar collapsible="none">',
      "    <SidebarContent>",
      "      <SidebarGroup><SidebarGroupContent><SidebarMenu>",
      "        <SidebarMenuItem><SidebarMenuButton>Home</SidebarMenuButton></SidebarMenuItem>",
      "      </SidebarMenu></SidebarGroupContent></SidebarGroup>",
      "    </SidebarContent>",
      "  </Sidebar>",
      "</SidebarProvider>"
    ),
    usage:
      "Use Sidebar as an application shell primitive. Navigation ownership and information architecture stay with each app.",
  },
  skeleton: {
    code: snippet(
      'import { Skeleton } from "@acme/ui/components/skeleton"',
      "",
      '<div className="space-y-2">',
      '  <Skeleton className="h-4 w-40" />',
      '  <Skeleton className="h-3 w-full" />',
      '  <Skeleton className="h-3 w-3/4" />',
      "</div>"
    ),
    usage:
      "Use skeletons to preserve the eventual layout during short loads. Do not replace meaningful progress or error feedback with indefinite shimmer.",
  },
  switch: {
    code: snippet(
      'import { Switch } from "@acme/ui/components/switch"',
      'import { Label } from "@acme/ui/components/label"',
      "",
      '<div className="flex items-center justify-between gap-4">',
      '  <Label htmlFor="notifications">Operating notifications</Label>',
      '  <Switch id="notifications" defaultChecked />',
      "</div>"
    ),
    usage:
      "Use a switch only when changing the value takes effect immediately. Use a checkbox inside a submitted form.",
  },
  table: {
    code: snippet(
      'import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@acme/ui/components/table"',
      "",
      "<Table>",
      "  <TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>",
      "  <TableBody><TableRow><TableCell>Acme</TableCell><TableCell>Qualified</TableCell></TableRow></TableBody>",
      "</Table>"
    ),
    usage:
      "Use tables for comparison across records. Put sorting, filtering, pagination, selection, and row actions in an app-owned table pattern.",
  },
  tabs: {
    code: snippet(
      'import { Tabs, TabsContent, TabsList, TabsTrigger } from "@acme/ui/components/tabs"',
      "",
      '<Tabs defaultValue="overview">',
      "  <TabsList>",
      '    <TabsTrigger value="overview">Overview</TabsTrigger>',
      '    <TabsTrigger value="activity">Activity</TabsTrigger>',
      "  </TabsList>",
      '  <TabsContent value="overview">Current company state.</TabsContent>',
      '  <TabsContent value="activity">Recent governed actions.</TabsContent>',
      "</Tabs>"
    ),
    usage:
      "Use tabs for peer views of the same subject. Use navigation when each destination has its own place in the application hierarchy.",
  },
  textarea: {
    code: snippet(
      'import { Textarea } from "@acme/ui/components/textarea"',
      "",
      '<Textarea aria-label="Operating note" placeholder="Add context for the next review..." />'
    ),
    usage:
      "Use Textarea inside Field for multiline content. Keep operational notes concise and distinguish them from structured company data.",
  },
  tooltip: {
    code: snippet(
      'import { Tooltip, TooltipContent, TooltipTrigger } from "@acme/ui/components/tooltip"',
      "",
      "<Tooltip>",
      '  <TooltipTrigger render={<Button variant="outline" size="icon" />}><SettingsIcon /></TooltipTrigger>',
      "  <TooltipContent>Settings</TooltipContent>",
      "</Tooltip>"
    ),
    usage:
      "Use tooltips to label unfamiliar icon-only controls or add a brief hint. Required instructions must remain visible.",
  },
} satisfies Record<ComponentSlug, Pick<ComponentExample, "code" | "usage">>

export function getComponentExample(slug: ComponentSlug): ComponentExample {
  return {
    ...exampleDetails[slug],
    preview: <ComponentPreview slug={slug} />,
  }
}

function ComponentPreview({ slug }: { slug: ComponentSlug }) {
  switch (slug) {
    case "accordion":
      return (
        <Accordion defaultValue={["governance"]}>
          <AccordionItem value="governance">
            <AccordionTrigger>How are actions governed?</AccordionTrigger>
            <AccordionContent>
              Every mutation establishes an actor and checks authority before it
              changes company state.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="ownership">
            <AccordionTrigger>Who owns the data?</AccordionTrigger>
            <AccordionContent>
              Acme owns the authoritative business state and its operating
              policy.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )
    case "alert":
      return (
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>Model synchronized</AlertTitle>
          <AlertDescription>
            All generated projections match the current company source.
          </AlertDescription>
        </Alert>
      )
    case "alert-dialog":
      return (
        <div className="flex justify-center">
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" />}>
              Archive company
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive this company?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the company from active work. Historical records
                  remain available.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction>Archive</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )
    case "avatar":
      return (
        <div className="flex justify-center">
          <AvatarGroup>
            <Avatar size="lg">
              <AvatarFallback>TZ</AvatarFallback>
              <AvatarBadge />
            </Avatar>
            <Avatar size="lg">
              <AvatarFallback>AK</AvatarFallback>
            </Avatar>
            <AvatarGroupCount>+4</AvatarGroupCount>
          </AvatarGroup>
        </div>
      )
    case "badge":
      return (
        <div className="flex flex-wrap justify-center gap-2">
          <Badge>Active</Badge>
          <Badge variant="secondary">Qualified</Badge>
          <Badge variant="outline">Review</Badge>
          <Badge variant="destructive">Blocked</Badge>
        </div>
      )
    case "breadcrumb":
      return (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/develop">Develop</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/develop/design-system">
                Design system
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )
    case "button":
      return (
        <div className="flex flex-wrap justify-center gap-2">
          <Button>Save company</Button>
          <Button variant="outline">Cancel</Button>
          <Button variant="secondary">Review</Button>
          <Button variant="ghost">More</Button>
          <Button variant="destructive">Archive</Button>
          <Button disabled>Saving</Button>
        </div>
      )
    case "card":
      return (
        <Card className="mx-auto max-w-sm">
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
            <CardDescription>Qualified opportunities</CardDescription>
            <CardAction>
              <Badge variant="secondary">12</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="text-lg font-medium tabular-nums">
            $420,000 weighted value
          </CardContent>
          <CardFooter className="text-muted-foreground">
            Updated moments ago
          </CardFooter>
        </Card>
      )
    case "checkbox":
      return (
        <div className="mx-auto flex max-w-sm items-center gap-2">
          <Checkbox id="example-approval" defaultChecked />
          <Label htmlFor="example-approval">
            Require approval before execution
          </Label>
        </div>
      )
    case "command":
      return (
        <Command className="mx-auto max-w-md border">
          <CommandInput placeholder="Search company objects..." />
          <CommandList>
            <CommandEmpty>No objects found.</CommandEmpty>
            <CommandGroup heading="Objects">
              <CommandItem>
                <Building2Icon />
                Companies
                <CommandShortcut>⌘1</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <UsersIcon />
                Contacts
                <CommandShortcut>⌘2</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      )
    case "dialog":
      return (
        <div className="flex justify-center">
          <Dialog>
            <DialogTrigger render={<Button />}>Add contact</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add contact</DialogTitle>
                <DialogDescription>
                  Create a person associated with this company.
                </DialogDescription>
              </DialogHeader>
              <Input aria-label="Email" placeholder="person@example.com" />
              <DialogFooter>
                <Button>Create contact</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )
    case "dropdown-menu":
      return (
        <div className="flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon" />}
            >
              <MoreHorizontalIcon />
              <span className="sr-only">Company actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Company actions</DropdownMenuLabel>
                <DropdownMenuItem>
                  <SettingsIcon />
                  Edit company
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ArchiveIcon />
                  Archive company
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <Trash2Icon />
                Delete draft
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    case "empty":
      return (
        <Empty className="border">
          <EmptyMedia variant="icon">
            <Building2Icon />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No companies yet</EmptyTitle>
            <EmptyDescription>
              Add the first company to begin operating the pipeline.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button>
              <PlusIcon />
              Add company
            </Button>
          </EmptyContent>
        </Empty>
      )
    case "field":
      return (
        <Field className="mx-auto max-w-sm">
          <FieldLabel htmlFor="example-domain">Company domain</FieldLabel>
          <Input id="example-domain" placeholder="acme.example" />
          <FieldDescription>
            Used to match contacts and company activity.
          </FieldDescription>
          <FieldError />
        </Field>
      )
    case "input":
      return (
        <Input
          className="mx-auto max-w-sm"
          aria-label="Company name"
          placeholder="Acme"
        />
      )
    case "input-group":
      return (
        <InputGroup className="mx-auto max-w-sm">
          <InputGroupAddon>
            <InputGroupText>https://</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Company domain"
            placeholder="acme.example"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs">
              <SearchIcon />
              <span className="sr-only">Look up domain</span>
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      )
    case "label":
      return (
        <div className="mx-auto grid max-w-sm gap-2">
          <Label htmlFor="example-company-name">Company name</Label>
          <Input id="example-company-name" defaultValue="Acme" />
        </div>
      )
    case "popover":
      return (
        <div className="flex justify-center">
          <Popover>
            <PopoverTrigger render={<Button variant="outline" />}>
              Assignment
            </PopoverTrigger>
            <PopoverContent>
              <PopoverHeader>
                <PopoverTitle>Assign owner</PopoverTitle>
                <PopoverDescription>
                  Choose who is accountable for the next action.
                </PopoverDescription>
              </PopoverHeader>
              <Input className="mt-3" aria-label="Owner" placeholder="Search" />
            </PopoverContent>
          </Popover>
        </div>
      )
    case "progress":
      return (
        <Progress className="mx-auto max-w-md" value={68}>
          <ProgressLabel>Importing records</ProgressLabel>
          <ProgressValue />
        </Progress>
      )
    case "radio-group":
      return (
        <RadioGroup
          className="mx-auto max-w-sm"
          defaultValue="review"
          aria-label="Execution mode"
        >
          <div className="flex items-center gap-2 text-xs">
            <RadioGroupItem id="example-review" value="review" />
            <Label htmlFor="example-review">Review before execution</Label>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <RadioGroupItem id="example-automatic" value="automatic" />
            <Label htmlFor="example-automatic">
              Run automatically within policy
            </Label>
          </div>
        </RadioGroup>
      )
    case "select":
      return (
        <Select defaultValue="qualified">
          <SelectTrigger className="mx-auto w-full max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Pipeline status</SelectLabel>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      )
    case "separator":
      return (
        <div className="mx-auto flex h-8 max-w-sm items-center justify-center gap-4 text-xs">
          <span>Pipeline</span>
          <Separator orientation="vertical" />
          <span className="text-muted-foreground">12 qualified</span>
        </div>
      )
    case "sheet":
      return (
        <div className="flex justify-center">
          <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>
              Edit details
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Company details</SheetTitle>
                <SheetDescription>
                  Update supporting company information.
                </SheetDescription>
              </SheetHeader>
              <div className="px-4">
                <Input aria-label="Company name" defaultValue="Acme" />
              </div>
              <SheetFooter>
                <Button>Save changes</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      )
    case "sidebar":
      return (
        <SidebarProvider
          className="mx-auto min-h-64 max-w-lg overflow-hidden border"
          defaultWidth={208}
        >
          <Sidebar collapsible="none" className="border-r">
            <SidebarHeader className="border-b text-xs font-medium">
              Acme
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Operate</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton isActive>
                        <Building2Icon />
                        Companies
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <UsersIcon />
                        Contacts
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <div className="flex flex-1 items-center justify-center bg-background text-xs text-muted-foreground">
            Application content
          </div>
        </SidebarProvider>
      )
    case "skeleton":
      return (
        <div className="mx-auto flex max-w-sm items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      )
    case "switch":
      return (
        <div className="mx-auto flex max-w-sm items-center justify-between gap-4">
          <Label htmlFor="example-notifications">Operating notifications</Label>
          <Switch id="example-notifications" defaultChecked />
        </div>
      )
    case "table":
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Pipeline</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Acme</TableCell>
              <TableCell>
                <Badge variant="secondary">Qualified</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                $120,000
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Northstar</TableCell>
              <TableCell>
                <Badge variant="outline">Review</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">$80,000</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )
    case "tabs":
      return (
        <Tabs className="mx-auto max-w-md" defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="pt-4">
            Current company state and the work that needs attention.
          </TabsContent>
          <TabsContent value="activity" className="pt-4">
            Recent governed actions performed by people and agents.
          </TabsContent>
        </Tabs>
      )
    case "textarea":
      return (
        <Textarea
          className="mx-auto max-w-sm"
          aria-label="Operating note"
          placeholder="Add context for the next review..."
        />
      )
    case "tooltip":
      return (
        <div className="flex justify-center">
          <Tooltip>
            <TooltipTrigger render={<Button variant="outline" size="icon" />}>
              <SettingsIcon />
              <span className="sr-only">Settings</span>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        </div>
      )
  }

  return null
}
