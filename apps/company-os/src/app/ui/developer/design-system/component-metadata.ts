export const componentGroups = [
  {
    label: "Actions",
    components: [
      {
        slug: "button",
        name: "Button",
        description: "Triggers an action or submits a form.",
      },
    ],
  },
  {
    label: "Forms",
    components: [
      {
        slug: "checkbox",
        name: "Checkbox",
        description: "Selects one or more independent options.",
      },
      {
        slug: "date-time-picker",
        name: "Date & Time Picker",
        description:
          "Selects a local date and time with a calendar and time input.",
      },
      {
        slug: "field",
        name: "Field",
        description: "Composes labels, controls, descriptions, and errors.",
      },
      {
        slug: "input",
        name: "Input",
        description: "Collects a single line of text or structured input.",
      },
      {
        slug: "input-group",
        name: "Input Group",
        description: "Combines an input with contextual text or actions.",
      },
      {
        slug: "label",
        name: "Label",
        description: "Names an associated form control.",
      },
      {
        slug: "phone-input",
        name: "Phone Input",
        description:
          "Collects and formats an international phone number with country selection.",
      },
      {
        slug: "radio-group",
        name: "Radio Group",
        description: "Selects exactly one option from a short set.",
      },
      {
        slug: "select",
        name: "Select",
        description: "Chooses one option from a longer list.",
      },
      {
        slug: "switch",
        name: "Switch",
        description: "Changes a setting that takes effect immediately.",
      },
      {
        slug: "textarea",
        name: "Textarea",
        description: "Collects multiline text.",
      },
    ],
  },
  {
    label: "Feedback",
    components: [
      {
        slug: "alert",
        name: "Alert",
        description: "Communicates important contextual information.",
      },
      {
        slug: "empty",
        name: "Empty",
        description: "Explains an empty state and its next useful action.",
      },
      {
        slug: "progress",
        name: "Progress",
        description: "Shows completion of a bounded operation.",
      },
      {
        slug: "skeleton",
        name: "Skeleton",
        description: "Reserves layout while content is loading.",
      },
      {
        slug: "spinner",
        name: "Spinner",
        description: "Indicates an operation in progress.",
      },
      {
        slug: "toast",
        name: "Toast",
        description: "Announces the outcome of an action briefly.",
      },
    ],
  },
  {
    label: "Data display",
    components: [
      {
        slug: "avatar",
        name: "Avatar",
        description: "Represents a person or organization visually.",
      },
      {
        slug: "badge",
        name: "Badge",
        description: "Displays compact status or classification metadata.",
      },
      {
        slug: "card",
        name: "Card",
        description: "Groups a bounded piece of supporting content.",
      },
      {
        slug: "chart",
        name: "Chart",
        description: "Visualizes series data with themed chart colors.",
      },
      {
        slug: "table",
        name: "Table",
        description: "Displays structured records for comparison and scanning.",
      },
    ],
  },
  {
    label: "Conversation",
    components: [
      {
        slug: "attachment",
        name: "Attachment",
        description: "Shows a file with its upload lifecycle and actions.",
      },
      {
        slug: "bubble",
        name: "Bubble",
        description: "Displays one message's content in a conversation.",
      },
      {
        slug: "chat",
        name: "Chat",
        description:
          "Composes a transcript and prompt composer into a chat surface.",
      },
      {
        slug: "marker",
        name: "Marker",
        description: "Annotates a conversation with a non-message event.",
      },
      {
        slug: "message",
        name: "Message",
        description: "Lays out a conversation turn with avatar and metadata.",
      },
      {
        slug: "message-scroller",
        name: "Message Scroller",
        description:
          "Keeps a growing transcript readable with scroll anchoring.",
      },
    ],
  },
  {
    label: "Navigation and disclosure",
    components: [
      {
        slug: "accordion",
        name: "Accordion",
        description: "Reveals sections of related content progressively.",
      },
      {
        slug: "breadcrumb",
        name: "Breadcrumb",
        description: "Shows location within a nested information hierarchy.",
      },
      {
        slug: "command",
        name: "Command",
        description: "Supports keyboard-first search and action selection.",
      },
      {
        slug: "dropdown-menu",
        name: "Dropdown Menu",
        description: "Presents a compact set of contextual actions.",
      },
      {
        slug: "tabs",
        name: "Tabs",
        description: "Switches between peer views without changing context.",
      },
    ],
  },
  {
    label: "Overlays",
    components: [
      {
        slug: "alert-dialog",
        name: "Alert Dialog",
        description: "Requires acknowledgement before a consequential action.",
      },
      {
        slug: "dialog",
        name: "Dialog",
        description: "Focuses a short task without leaving the current view.",
      },
      {
        slug: "popover",
        name: "Popover",
        description:
          "Displays supplemental interactive content near a trigger.",
      },
      {
        slug: "sheet",
        name: "Sheet",
        description: "Opens a supporting task from the edge of the viewport.",
      },
      {
        slug: "tooltip",
        name: "Tooltip",
        description:
          "Adds a brief accessible label or hint on hover and focus.",
      },
    ],
  },
  {
    label: "Layout",
    components: [
      {
        slug: "separator",
        name: "Separator",
        description: "Creates a semantic division between adjacent content.",
      },
      {
        slug: "sidebar",
        name: "Sidebar",
        description: "Provides persistent, responsive application navigation.",
      },
    ],
  },
] as const

const components = componentGroups.flatMap((group) =>
  group.components.map((component) => ({ ...component, group: group.label }))
)

export type ComponentSlug = (typeof components)[number]["slug"]

export function getComponent(slug: string) {
  return components.find((component) => component.slug === slug)
}
