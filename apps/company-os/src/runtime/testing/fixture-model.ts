import { User } from "#/runtime/access/model/index.ts"
import {
  defineEvent,
  defineInterface,
  defineLink,
  defineModel,
  defineModule,
  defineObject,
  schema,
  standardErrors,
} from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"

/** Polymorphic role shared by accounts and people. */
export const Participant = defineInterface({
  id: "participant",
  name: "Participant",
  pluralName: "Participants",
  properties: {
    image: schema.image({ label: "Image", nullable: true }),
    name: schema.string({ label: "Name" }),
  },
  display: { icon: "participant", image: "image", title: "name" },
})

/** Marker role for records a memo can be about. */
const Topic = defineInterface({
  id: "topic",
  name: "Topic",
  pluralName: "Topics",
})

export const Account = defineObject({
  id: "account",
  collection: "accounts",
  name: "Account",
  pluralName: "Accounts",
  description: "An organization the company works with.",
  implements: [
    { interface: Topic },
    {
      interface: Participant,
      propertyMapping: { image: "logo", name: "name" },
    },
  ],
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
    logo: schema.image({ label: "Logo", aspectRatio: 1, nullable: true }),
    domain: schema.domain({ label: "Domain", maxLength: 253, nullable: true }),
    website: schema.url({ label: "Website", maxLength: 2_048, nullable: true }),
    industry: schema.select({
      label: "Industry",
      nullable: true,
      options: [
        { value: "software", label: "Software" },
        { value: "services", label: "Services" },
      ],
    }),
    stage: schema.select({
      label: "Stage",
      default: "prospect",
      options: [
        { value: "prospect", label: "Prospect", color: "blue" },
        { value: "customer", label: "Customer", color: "green" },
        { value: "inactive", label: "Inactive", color: "gray" },
      ],
    }),
  },
  search: { fields: ["name", "website"] },
  display: {
    icon: "building",
    image: "logo",
    title: "name",
    subtitle: "domain",
    status: "stage",
  },
})

export const Person = defineObject({
  id: "person",
  collection: "people",
  name: "Person",
  pluralName: "People",
  implements: [
    { interface: Topic },
    {
      interface: Participant,
      propertyMapping: { image: "photo", name: "name" },
    },
  ],
  properties: {
    photo: schema.image({ label: "Photo", aspectRatio: 1, nullable: true }),
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
    email: schema.email({ label: "Email", maxLength: 320, nullable: true }),
    phone: schema.phone({ label: "Phone", maxLength: 50, nullable: true }),
    consent: schema.select({
      label: "Email consent",
      default: "unknown",
      options: [
        { value: "unknown", label: "Unknown" },
        { value: "optedIn", label: "Opted in" },
        { value: "optedOut", label: "Opted out" },
      ],
    }),
  },
  search: { fields: ["name", "email"] },
  display: { icon: "person", image: "photo", title: "name", subtitle: "email" },
})

const PersonAccounts = defineLink({
  id: "personAccounts",
  name: "Person accounts",
  from: Person,
  to: Account,
  forward: {
    key: "accounts",
    min: 0,
    label: "Accounts",
  },
  reverse: {
    key: "people",
    min: 0,
    label: "People",
  },
})

const PersonPrimaryAccount = defineLink({
  id: "personPrimaryAccount",
  name: "Person primary account",
  subsetOf: PersonAccounts,
  from: Person,
  to: Account,
  forward: {
    key: "primaryAccount",
    min: 0,
    max: 1,
    label: "Primary account",
  },
  reverse: {
    key: "primaryPeople",
    min: 0,
    label: "Primary people",
  },
})

export const Prospect = defineObject({
  id: "prospect",
  collection: "prospects",
  name: "Prospect",
  pluralName: "Prospects",
  implements: [{ interface: Topic }],
  actions: {
    convert: {
      name: "Convert prospect",
      description:
        "Creates a person and links it to a new account named after the prospect.",
      idempotent: true,
      scope: "object",
      output: {
        account: schema.recordId({ id: "account" }),
        person: schema.recordId({ id: "person" }),
      },
      errors: [
        standardErrors.aborted,
        standardErrors.alreadyExists,
        standardErrors.failedPrecondition,
      ],
    },
  },
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
    accountName: schema.string({
      label: "Account name",
      minLength: 1,
      maxLength: 200,
      nullable: true,
    }),
    email: schema.email({ label: "Email", maxLength: 320, nullable: true }),
    source: schema.select({
      label: "Source",
      default: "unknown",
      options: [
        { value: "unknown", label: "Unknown" },
        { value: "inbound", label: "Inbound" },
        { value: "referral", label: "Referral" },
      ],
    }),
    status: schema.select({
      label: "Status",
      default: "new",
      options: [
        { value: "new", label: "New" },
        { value: "working", label: "Working" },
        { value: "qualified", label: "Qualified" },
      ],
    }),
    convertedAt: schema.timestamp({
      label: "Converted at",
      nullable: true,
      outputOnly: true,
    }),
  },
  search: { fields: ["name", "accountName", "email"] },
  display: {
    icon: "prospect",
    title: "name",
    subtitle: "accountName",
    status: "status",
  },
})

const ProspectConvertedAccount = defineLink({
  id: "prospectConvertedAccount",
  outputOnly: true,
  name: "Prospect Converted account",
  from: Prospect,
  to: Account,
  forward: { key: "convertedAccount", label: "Converted account", max: 1 },
  reverse: { key: "convertedProspects", label: "Converted prospects" },
})

const ProspectConvertedPerson = defineLink({
  id: "prospectConvertedPerson",
  outputOnly: true,
  name: "Prospect Converted person",
  from: Prospect,
  to: Person,
  forward: { key: "convertedPerson", label: "Converted person", max: 1 },
  reverse: { key: "convertedProspects", label: "Converted prospects" },
})

export const ProspectConverted = defineEvent({
  type: "prospect.converted",
  version: 1,
  subject: Prospect,
  data: schema.object({
    account: schema.recordId(Account),
    person: schema.recordId(Person),
  }),
})

export const Order = defineObject({
  id: "order",
  collection: "orders",
  name: "Order",
  pluralName: "Orders",
  implements: [{ interface: Topic }],
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
    stage: schema.select({
      label: "Stage",
      default: "draft",
      options: [
        { value: "draft", label: "Draft" },
        { value: "quoted", label: "Quoted" },
        { value: "won", label: "Won" },
        { value: "lost", label: "Lost" },
      ],
    }),
    amount: schema.money({ label: "Amount", nullable: true }),
    expectedCloseDate: schema.date({
      label: "Expected close date",
      nullable: true,
    }),
    nextStep: schema.string({
      label: "Next step",
      maxLength: 5_000,
      nullable: true,
    }),
    nextStepDate: schema.date({ label: "Next step due", nullable: true }),
  },
  search: { fields: ["name", "nextStep"] },
  display: { icon: "order", title: "name", status: "stage" },
})

const OrderOwner = defineLink({
  id: "orderOwner",
  name: "Order Owner",
  from: Order,
  to: User,
  forward: { key: "owner", label: "Owner", max: 1 },
  reverse: { key: "orders", label: "Orders" },
})

export const OrderLine = defineObject({
  id: "orderLine",
  collection: "orderLines",
  name: "Order line",
  pluralName: "Order lines",
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
    quantity: schema.number({
      label: "Quantity",
      default: 1,
      integer: true,
      minimum: 1,
    }),
    unitPrice: schema.money({ label: "Unit price", nullable: true }),
  },
  search: { fields: ["name"] },
  display: { icon: "orderLine", title: "name", subtitle: "quantity" },
})

const Document = defineObject({
  id: "document",
  collection: "documents",
  name: "Document",
  pluralName: "Documents",
  properties: {
    title: schema.string({ label: "Title", minLength: 1, maxLength: 200 }),
    attachments: schema.array(schema.file({ maxBytes: 25_000_000 }), {
      label: "Attachments",
      default: [],
    }),
  },
  display: { icon: "document", title: "title" },
})

export const Memo = defineObject({
  id: "memo",
  collection: "memos",
  name: "Memo",
  pluralName: "Memos",
  properties: {
    content: schema.string({
      label: "Content",
      minLength: 1,
      maxLength: 10_000,
    }),
  },
  search: { fields: ["content"] },
  display: { icon: "memo", title: "content" },
})

const MemoTopics = defineLink({
  id: "memoTopics",
  name: "Memo topics",
  from: Memo,
  to: Topic,
  forward: {
    key: "topics",
    min: 0,
    label: "Topics",
  },
  reverse: {
    key: "memos",
    min: 0,
    label: "Memos",
  },
})

const AccountOrders = defineLink({
  id: "accountOrders",
  name: "Account orders",
  from: Account,
  to: Order,
  forward: { key: "orders", label: "Orders" },
  reverse: { key: "account", label: "Account", min: 1, max: 1 },
})
const OrderLines = defineLink({
  id: "orderLines",
  name: "Order lines",
  from: Order,
  to: OrderLine,
  forward: { key: "lines", label: "Lines", onDelete: "cascade" },
  reverse: { key: "order", label: "Order", min: 1, max: 1 },
})

/** A representative business domain for kernel tests: ownership, interfaces, links, and a custom action. */
export const FixtureModule = defineModule({
  id: "fixture",
  name: "Fixture",
  interfaces: [Participant, Topic],
  events: [ProspectConverted],
  links: [
    AccountOrders,
    OrderLines,
    PersonAccounts,
    PersonPrimaryAccount,
    MemoTopics,
    ProspectConvertedAccount,
    ProspectConvertedPerson,
    OrderOwner,
  ],
  objects: [Account, Person, Prospect, Order, OrderLine, Document, Memo],
})

/** Only the kernel modules. */
export const kernelModel = defineModel({
  name: "Kernel",
  modules: [PlatformModule],
})

/** The kernel modules plus the fixture domain. */
export const fixtureModel = defineModel({
  name: "Fixture",
  modules: [PlatformModule, FixtureModule],
})
