import { Button } from "@company/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@company/ui/card"
import { CodeBlock } from "@company/ui/code-block"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@company/ui/empty"
import { Markdown } from "@company/ui/markdown"
import { MarkdownEditor } from "@company/ui/markdown-editor"
import { Separator } from "@company/ui/separator"
import { Skeleton } from "@company/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@company/ui/table"
import { FileTextIcon } from "lucide-react"
import { useState } from "react"

import {
  Example,
  type ComponentSection,
} from "#/app/ui/developer/design-system/example.tsx"

export const contentSections: ReadonlyArray<ComponentSection> = [
  {
    id: "card",
    title: "Card",
    description: "Group related content and actions into a bounded surface.",
    component: CardExamples,
    usage:
      'import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@company/ui/card"\n\n<Card>\n  <CardHeader>\n    <CardTitle>Review queue</CardTitle>\n    <CardDescription>Upcoming decisions for your team.</CardDescription>\n  </CardHeader>\n  <CardContent>Two requests need a decision.</CardContent>\n</Card>',
  },
  {
    id: "table",
    title: "Table",
    description:
      "A semantic table for structured content. For model-backed editing and filtering, use the Object table pattern.",
    component: TableExamples,
    usage:
      'import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@company/ui/table"\n\n<Table>\n  <TableHeader><TableRow><TableHead>Request</TableHead></TableRow></TableHeader>\n  <TableBody><TableRow><TableCell>Workshop</TableCell></TableRow></TableBody>\n</Table>',
  },
  {
    id: "separator",
    title: "Separator",
    description:
      "Separate adjacent groups without adding another enclosing surface.",
    component: SeparatorExamples,
    usage:
      'import { Separator } from "@company/ui/separator"\n\n<Separator />\n<div className="flex h-6 items-center gap-3">\n  <span>Overview</span><Separator orientation="vertical" /><span>Activity</span>\n</div>',
  },
  {
    id: "empty",
    title: "Empty",
    description:
      "Explain why there is no content and offer the next useful action.",
    component: EmptyExamples,
    usage:
      'import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@company/ui/empty"\n\n<Empty>\n  <EmptyHeader>\n    <EmptyTitle>No notes yet</EmptyTitle>\n    <EmptyDescription>Keep decisions and their context together.</EmptyDescription>\n  </EmptyHeader>\n</Empty>',
  },
  {
    id: "skeleton",
    title: "Skeleton",
    description:
      "Reserve the shape of loading content to reduce layout shifts.",
    component: SkeletonExamples,
    usage:
      'import { Skeleton } from "@company/ui/skeleton"\n\n<div aria-label="Loading" className="space-y-3">\n  <Skeleton className="h-6 w-32" />\n  <Skeleton className="h-4 w-full" />\n</div>',
  },
  {
    id: "markdown",
    title: "Markdown",
    description:
      "Render prose, links, lists, and tables without executing user-supplied markup.",
    component: MarkdownExamples,
    usage:
      'import { Markdown } from "@company/ui/markdown"\n\n<Markdown>{"## Decision\\n\\nProceed with the **pilot**."}</Markdown>',
  },
  {
    id: "markdown-editor",
    title: "Markdown editor",
    description:
      "Edit formatted text in a controlled draft with a live preview.",
    component: MarkdownEditorExamples,
    usage:
      'import { useState } from "react"\nimport { MarkdownEditor } from "@company/ui/markdown-editor"\n\nfunction NotesDraft() {\n  const [value, setValue] = useState("")\n  return <MarkdownEditor aria-label="Notes" value={value} onValueChange={setValue} />\n}',
  },
  {
    id: "code-block",
    title: "Code block",
    description:
      "Readable code with syntax highlighting and an accessible copy action.",
    component: CodeExamples,
    usage:
      'import { CodeBlock } from "@company/ui/code-block"\n\n<CodeBlock language="tsx" label="Example" code={\'<Button>Save</Button>\'} />',
  },
]

function CardExamples() {
  return (
    <>
      <Example title="Title and supporting content" source="@company/ui/card">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Review queue</CardTitle>
            <CardDescription>Upcoming decisions for your team.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Two requests need a decision.</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline">Review requests</Button>
          </CardFooter>
        </Card>
      </Example>
      <Example title="Compact summary" source="@company/ui/card">
        <Card className="max-w-xs">
          <CardHeader>
            <CardDescription>Open requests</CardDescription>
            <CardTitle className="text-3xl tabular-nums">12</CardTitle>
          </CardHeader>
        </Card>
      </Example>
    </>
  )
}

function TableExamples() {
  return (
    <Example title="Numeric alignment" source="@company/ui/table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Request</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Workshop</TableCell>
            <TableCell className="text-right tabular-nums">2,400 USD</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Research</TableCell>
            <TableCell className="text-right tabular-nums">800 USD</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Example>
  )
}

function SeparatorExamples() {
  return (
    <>
      <Example title="Horizontal" source="@company/ui/separator">
        <div className="space-y-4 text-sm">
          <p>Request details</p>
          <Separator />
          <p>Related work</p>
        </div>
      </Example>
      <Example title="Vertical" source="@company/ui/separator">
        <div className="flex h-6 items-center gap-3 text-sm">
          <span>Overview</span>
          <Separator orientation="vertical" />
          <span>Activity</span>
        </div>
      </Example>
    </>
  )
}

function EmptyExamples() {
  const [started, setStarted] = useState(false)
  return (
    <Example title="A next action" source="@company/ui/empty">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileTextIcon />
          </EmptyMedia>
          <EmptyTitle>
            {started ? "Your example is ready" : "No notes yet"}
          </EmptyTitle>
          <EmptyDescription>
            {started
              ? "Reset to inspect the initial state again."
              : "Keep decisions and their context together."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => setStarted(!started)}>
            {started ? "Reset example" : "Create example note"}
          </Button>
        </EmptyContent>
      </Empty>
    </Example>
  )
}

function SkeletonExamples() {
  return (
    <>
      <Example title="Text and content" source="@company/ui/skeleton">
        <output className="block space-y-4" aria-label="Loading content">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-24 w-full" />
        </output>
      </Example>
      <Example title="Identity" source="@company/ui/skeleton">
        <output
          className="flex items-center gap-3"
          aria-label="Loading identity"
        >
          <Skeleton className="size-9 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </output>
      </Example>
    </>
  )
}

const exampleMarkdown =
  "## Meeting notes\n\nA **clear decision** with its supporting context.\n\n- [x] Review the proposal\n- [ ] Confirm the next step"
function MarkdownExamples() {
  return (
    <>
      <Example title="Prose and task lists" source="@company/ui/markdown">
        <Markdown>{exampleMarkdown}</Markdown>
      </Example>
      <Example title="Tables and code" source="@company/ui/markdown">
        <Markdown>
          {
            "| Request | State |\n| --- | --- |\n| Pilot | In review |\n\nUse `request.status` to read the current state."
          }
        </Markdown>
      </Example>
    </>
  )
}

function MarkdownEditorExamples() {
  const [markdown, setMarkdown] = useState(exampleMarkdown)
  return (
    <Example
      title="Controlled draft and rendered content"
      source="@company/ui/markdown-editor"
    >
      <div className="space-y-6">
        <MarkdownEditor
          aria-label="Example Markdown"
          value={markdown}
          onValueChange={setMarkdown}
        />
        <Markdown>{markdown}</Markdown>
      </div>
    </Example>
  )
}

function CodeExamples() {
  return (
    <>
      <Example title="TypeScript" source="@company/ui/code-block">
        <CodeBlock
          language="tsx"
          label="Shared primitive"
          code={
            'import { Button } from "@company/ui/button"\n\n<Button variant="outline">Review request</Button>'
          }
        />
      </Example>
      <Example title="Plain text" source="@company/ui/code-block">
        <CodeBlock label="Install a primitive" code="pnpm ui:add accordion" />
      </Example>
    </>
  )
}
