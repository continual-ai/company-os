import {
  BlocksIcon,
  CalculatorIcon,
  ChartNoAxesCombinedIcon,
  DatabaseIcon,
  CodeIcon,
  HandshakeIcon,
  HeadsetIcon,
  LifeBuoyIcon,
  MegaphoneIcon,
  NotebookPenIcon,
  UsersIcon,
  FileDiffIcon,
  ScanFaceIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

/** Example destinations for the navigation prototype; no tool execution is connected. */
export const toolPreviews = [
  {
    id: "headshot-studio",
    moduleId: "marketing",
    label: "Headshot Studio",
    description: "Turn a photo into a headshot that fits your company's style.",
    category: "Creative",
    icon: ScanFaceIcon,
    input: "A portrait photo and a visual style",
    output: "Headshots ready to review and save",
  },
  {
    id: "quote-calculator",
    moduleId: "sales",
    label: "Quote Calculator",
    description: "Work out pricing, costs, and margin before sending a quote.",
    category: "Operations",
    icon: CalculatorIcon,
    input: "Services, quantities, and pricing rules",
    output: "An itemized quote with a margin breakdown",
  },
  {
    id: "document-comparison",
    moduleId: "notes",
    label: "Document Comparison",
    description: "Compare two versions and review the changes that matter.",
    category: "Productivity",
    icon: FileDiffIcon,
    input: "Two versions of a document",
    output: "A comparison with highlighted changes",
  },
] as const

export const reportPreviews = [
  {
    id: "pipeline",
    moduleId: "sales",
    label: "Pipeline",
    description: "See the value and progress of your sales opportunities.",
    icon: ChartNoAxesCombinedIcon,
  },
] as const

export const workspaceModuleOrder = [
  "sales",
  "marketing",
  "engineering",
  "hiring",
  "support",
  "supportEngineering",
  "notes",
  "platform",
]

export const workspaceModuleIcons: Record<string, LucideIcon> = {
  platform: BlocksIcon,
  sales: HandshakeIcon,
  marketing: MegaphoneIcon,
  engineering: CodeIcon,
  hiring: UsersIcon,
  support: HeadsetIcon,
  supportEngineering: LifeBuoyIcon,
  notes: NotebookPenIcon,
}

export const workspaceSections = [
  { id: "data", label: "Data", to: "/data", icon: DatabaseIcon },
  { id: "tools", label: "Tools", to: "/tools", icon: WrenchIcon },
  {
    id: "reports",
    label: "Reports",
    to: "/reports",
    icon: ChartNoAxesCombinedIcon,
  },
] as const
