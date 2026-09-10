import { Badge } from "@company/ui/badge"
import { Button } from "@company/ui/button"
import { Calendar } from "@company/ui/calendar"
import { Checkbox } from "@company/ui/checkbox"
import { DateTimePicker } from "@company/ui/date-time-picker"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@company/ui/field"
import { Input } from "@company/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@company/ui/input-group"
import { Label } from "@company/ui/label"
import { PhoneInput } from "@company/ui/phone-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@company/ui/select"
import { Textarea } from "@company/ui/textarea"
import { LoaderCircleIcon, PlusIcon } from "lucide-react"
import { useState } from "react"

import { dateTimePage } from "#/app/ui/developer/design-system/date-time-examples.tsx"
import {
  Example,
  type ComponentSection,
} from "#/app/ui/developer/design-system/example.tsx"
import { scorePage } from "#/app/ui/developer/design-system/score-examples.tsx"
import { switchPage } from "#/app/ui/developer/design-system/switch-examples.tsx"

export const controlSections: ReadonlyArray<ComponentSection> = [
  scorePage,
  switchPage,
  dateTimePage,
  {
    id: "button",
    title: "Button",
    description:
      "Use a verb that describes the action. Keep one primary action in each decision area.",
    component: ButtonExamples,
    usage:
      'import { Button } from "@company/ui/button"\n\n<Button>Save changes</Button>\n<Button variant="outline">Cancel</Button>',
  },
  {
    id: "badge",
    title: "Badge",
    description:
      "Short, read-only labels for state or category. Use ObjectChoiceBadge for model-defined choices.",
    component: BadgeExamples,
    usage:
      'import { Badge } from "@company/ui/badge"\n\n<Badge variant="secondary">In review</Badge>',
  },
  {
    id: "input",
    title: "Input",
    description:
      "Single-line text with a visible label. Associate descriptions and errors with the input.",
    component: InputExamples,
    usage:
      'import { Input } from "@company/ui/input"\nimport { Label } from "@company/ui/label"\n\n<Label htmlFor="name">Name</Label>\n<Input id="name" placeholder="Company name" />',
  },
  {
    id: "textarea",
    title: "Textarea",
    description:
      "Plain text that needs more than one line. Use MarkdownEditor when formatting is part of the content.",
    component: TextareaExamples,
    usage:
      'import { Textarea } from "@company/ui/textarea"\n\n<Textarea aria-label="Description" placeholder="Add some context…" />',
  },
  {
    id: "field",
    title: "Field",
    description:
      "Compose a control, label, description, and validation feedback. Application forms own validation and drafts.",
    component: FieldExamples,
    usage:
      'import { Field, FieldDescription, FieldLabel } from "@company/ui/field"\nimport { Input } from "@company/ui/input"\n\n<Field>\n  <FieldLabel htmlFor="name">Name</FieldLabel>\n  <Input id="name" />\n  <FieldDescription>The name your team recognizes.</FieldDescription>\n</Field>',
  },
  {
    id: "label",
    title: "Label",
    description:
      "Give every control an accessible name. Match htmlFor to the control’s id.",
    component: LabelExamples,
    usage:
      'import { Label } from "@company/ui/label"\nimport { Input } from "@company/ui/input"\n\n<Label htmlFor="email">Email</Label>\n<Input id="email" type="email" />',
  },
  {
    id: "checkbox",
    title: "Checkbox",
    description:
      "Independent binary choices, with an indeterminate state for partial selections.",
    component: CheckboxExamples,
    usage:
      'import { Checkbox } from "@company/ui/checkbox"\nimport { Label } from "@company/ui/label"\n\n<Label htmlFor="notify">\n  <Checkbox id="notify" defaultChecked />\n  Notify owner\n</Label>',
  },
  {
    id: "input-group",
    title: "Input group",
    description:
      "Keep a prefix, suffix, or action visually attached to its input.",
    component: InputGroupExamples,
    usage:
      'import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@company/ui/input-group"\n\n<InputGroup>\n  <InputGroupAddon><InputGroupText>USD</InputGroupText></InputGroupAddon>\n  <InputGroupInput aria-label="Amount" inputMode="decimal" placeholder="0.00" />\n</InputGroup>',
  },
  {
    id: "select",
    title: "Select",
    description:
      "Choose one value from a known set. Supply items so the trigger can resolve the selected label.",
    component: SelectExamples,
    usage:
      'import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@company/ui/select"\n\n<Select defaultValue="draft" items={{ draft: "Draft", review: "In review" }}>\n  <SelectTrigger aria-label="Stage"><SelectValue /></SelectTrigger>\n  <SelectContent>\n    <SelectItem value="draft">Draft</SelectItem>\n    <SelectItem value="review">In review</SelectItem>\n  </SelectContent>\n</Select>',
  },
  {
    id: "phone-input",
    title: "Phone input",
    description:
      "Country-aware phone entry. Keep the value in the form draft through onValueChange.",
    component: PhoneExamples,
    usage:
      'import { useState } from "react"\nimport { PhoneInput } from "@company/ui/phone-input"\n\nfunction PhoneField() {\n  const [phone, setPhone] = useState("")\n  return <PhoneInput aria-label="Phone" value={phone} onValueChange={setPhone} />\n}',
  },
  {
    id: "calendar",
    title: "Calendar",
    description:
      "Choose a date or range. Keep date-only values separate from timestamps.",
    component: CalendarExamples,
    usage:
      'import { useState } from "react"\nimport { Calendar } from "@company/ui/calendar"\n\nfunction DateField() {\n  const [date, setDate] = useState<Date>()\n  return <Calendar mode="single" selected={date} onSelect={setDate} />\n}',
  },
  {
    id: "date-time-picker",
    title: "Date and time picker",
    description:
      "Edit a date and time together. Interpret the value using the field’s declared timezone semantics.",
    component: DateTimeExamples,
    usage:
      'import { useState } from "react"\nimport { DateTimePicker } from "@company/ui/date-time-picker"\n\nfunction ReviewDate() {\n  const [value, setValue] = useState("2026-09-09T09:30")\n  return <DateTimePicker aria-label="Review at" value={value} onValueChange={setValue} />\n}',
  },
]

function ButtonExamples() {
  return (
    <>
      <Example title="Variants" source="@company/ui/button">
        <div className="flex flex-wrap gap-3">
          <Button>Save changes</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete</Button>
          <Button variant="link">Link</Button>
        </div>
      </Example>
      <Example title="Sizes and icons" source="@company/ui/button">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="xs">Extra small</Button>
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
          <Button>
            <PlusIcon />
            New record
          </Button>
          <Button size="icon" aria-label="Add example">
            <PlusIcon />
          </Button>
        </div>
      </Example>
      <Example title="Disabled and pending" source="@company/ui/button">
        <div className="flex flex-wrap gap-3">
          <Button disabled>Unavailable</Button>
          <Button disabled>
            <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
            Saving…
          </Button>
        </div>
      </Example>
    </>
  )
}

function BadgeExamples() {
  return (
    <Example title="Variants" source="@company/ui/badge">
      <div className="flex flex-wrap gap-3">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Failed</Badge>
        <Badge variant="ghost">Ghost</Badge>
        <Badge variant="link">Link</Badge>
      </div>
    </Example>
  )
}

function InputExamples() {
  return (
    <>
      <Example title="Text and email" source="@company/ui/input">
        <FieldGroup className="max-w-md">
          <Field>
            <FieldLabel htmlFor="ds-name">Name</FieldLabel>
            <Input id="ds-name" placeholder="Company name" />
          </Field>
          <Field>
            <FieldLabel htmlFor="ds-email">Email</FieldLabel>
            <Input id="ds-email" type="email" placeholder="you@company.com" />
          </Field>
        </FieldGroup>
      </Example>
      <Example title="Invalid and disabled" source="@company/ui/input">
        <FieldGroup className="max-w-md">
          <Field data-invalid>
            <FieldLabel htmlFor="ds-invalid">Email</FieldLabel>
            <Input
              id="ds-invalid"
              defaultValue="not-an-email"
              aria-invalid
              aria-describedby="ds-email-error"
            />
            <FieldError id="ds-email-error">
              Enter a valid email address.
            </FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="ds-disabled">Managed value</FieldLabel>
            <Input
              id="ds-disabled"
              value="Managed by your integration"
              disabled
            />
          </Field>
        </FieldGroup>
      </Example>
    </>
  )
}

function TextareaExamples() {
  return (
    <>
      <Example title="Description" source="@company/ui/textarea">
        <Field className="max-w-md">
          <FieldLabel htmlFor="ds-description">Description</FieldLabel>
          <Textarea id="ds-description" placeholder="Add some context…" />
        </Field>
      </Example>
      <Example title="Invalid and disabled" source="@company/ui/textarea">
        <div className="grid gap-4 sm:grid-cols-2">
          <Textarea
            aria-label="Invalid description"
            aria-invalid
            placeholder="Description required"
          />
          <Textarea
            aria-label="Managed description"
            disabled
            value="Managed by your integration"
          />
        </div>
      </Example>
    </>
  )
}

function FieldExamples() {
  return (
    <>
      <Example title="Label and description" source="@company/ui/field">
        <Field className="max-w-md">
          <FieldLabel htmlFor="ds-field-name">Name</FieldLabel>
          <Input id="ds-field-name" aria-describedby="ds-name-help" />
          <FieldDescription id="ds-name-help">
            The name your team recognizes.
          </FieldDescription>
        </Field>
      </Example>
      <Example title="Validation feedback" source="@company/ui/field">
        <Field className="max-w-md" data-invalid>
          <FieldLabel htmlFor="ds-field-email">Email</FieldLabel>
          <Input
            id="ds-field-email"
            aria-invalid
            aria-describedby="ds-field-error"
            defaultValue="not-an-email"
          />
          <FieldError id="ds-field-error">
            Enter a valid email address.
          </FieldError>
        </Field>
      </Example>
    </>
  )
}

function LabelExamples() {
  return (
    <Example title="Associated controls" source="@company/ui/label">
      <div className="max-w-md space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ds-label-email">Email</Label>
          <Input id="ds-label-email" type="email" />
        </div>
        <Label htmlFor="ds-label-notify">
          <Checkbox id="ds-label-notify" />
          Notify owner
        </Label>
      </div>
    </Example>
  )
}

function CheckboxExamples() {
  return (
    <Example
      title="Unchecked, checked, partial, and disabled"
      source="@company/ui/checkbox"
    >
      <div className="flex flex-wrap gap-6">
        <Label htmlFor="ds-unchecked">
          <Checkbox id="ds-unchecked" />
          Notify team
        </Label>
        <Label htmlFor="ds-checked">
          <Checkbox id="ds-checked" defaultChecked />
          Notify owner
        </Label>
        <Label htmlFor="ds-partial">
          <Checkbox id="ds-partial" indeterminate />
          Some selected
        </Label>
        <Label htmlFor="ds-unavailable">
          <Checkbox id="ds-unavailable" disabled />
          Unavailable
        </Label>
      </div>
    </Example>
  )
}

function InputGroupExamples() {
  return (
    <Example
      title="Currency and domain prefixes"
      source="@company/ui/input-group"
    >
      <div className="max-w-md space-y-4">
        <InputGroup>
          <InputGroupAddon>
            <InputGroupText>USD</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Amount"
            inputMode="decimal"
            placeholder="0.00"
          />
        </InputGroup>
        <InputGroup>
          <InputGroupAddon>
            <InputGroupText>https://</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput aria-label="Website" placeholder="company.com" />
        </InputGroup>
      </div>
    </Example>
  )
}

function SelectExamples() {
  return (
    <Example
      title="Selection and unavailable choices"
      source="@company/ui/select"
    >
      <Field className="max-w-md">
        <FieldLabel htmlFor="ds-select">Stage</FieldLabel>
        <Select
          defaultValue="review"
          items={{ draft: "Draft", review: "In review", done: "Done" }}
        >
          <SelectTrigger id="ds-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="review">In review</SelectItem>
            <SelectItem value="done" disabled>
              Done
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </Example>
  )
}

function PhoneExamples() {
  const [phone, setPhone] = useState("")
  return (
    <Example title="Country-aware entry" source="@company/ui/phone-input">
      <Field className="max-w-md">
        <FieldLabel htmlFor="ds-phone">Phone</FieldLabel>
        <PhoneInput id="ds-phone" value={phone} onValueChange={setPhone} />
        <FieldDescription>
          {phone || "Choose a country and enter a number."}
        </FieldDescription>
      </Field>
    </Example>
  )
}

function CalendarExamples() {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 8, 9))
  return (
    <>
      <Example title="Single date" source="@company/ui/calendar">
        <Calendar
          mode="single"
          defaultMonth={new Date(2026, 8, 1)}
          selected={date}
          onSelect={setDate}
        />
      </Example>
      <Example title="Date range" source="@company/ui/calendar">
        <Calendar mode="range" defaultMonth={new Date(2026, 8, 1)} />
      </Example>
    </>
  )
}

function DateTimeExamples() {
  const [value, setValue] = useState("2026-09-09T09:30")
  return (
    <Example title="Date and time" source="@company/ui/date-time-picker">
      <Field className="max-w-md">
        <FieldLabel htmlFor="ds-date-time">Review at</FieldLabel>
        <DateTimePicker
          id="ds-date-time"
          value={value}
          onValueChange={setValue}
        />
      </Field>
    </Example>
  )
}
