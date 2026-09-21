import {
  BlocksIcon,
  CalculatorIcon,
  ChartNoAxesCombinedIcon,
  DatabaseIcon,
  CodeIcon,
  HandshakeIcon,
  HeadsetIcon,
  MessageSquareIcon,
  MegaphoneIcon,
  UsersIcon,
  ScanFaceIcon,
  WrenchIcon,
  ListTodoIcon,
  type LucideIcon,
} from "lucide-react"

/** Example destinations for the navigation prototype; no tool execution is connected. */
export const toolPreviews = [
  {
    id: "headshot-studio",
    moduleId: "marketing",
    label: "Headshot Studio",
    description: "Turn a photo into a headshot that fits your account's style.",
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
  "crm",
  "sales",
  "marketing",
  "work",
  "engineering",
  "hiring",
  "service",
  "feedback",
  "workDemand",
  "platform",
]

export const workspaceModuleIcons: Record<string, LucideIcon> = {
  platform: BlocksIcon,
  crm: UsersIcon,
  sales: HandshakeIcon,
  marketing: MegaphoneIcon,
  work: ListTodoIcon,
  engineering: CodeIcon,
  hiring: UsersIcon,
  service: HeadsetIcon,
  feedback: MessageSquareIcon,
  workDemand: HandshakeIcon,
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
