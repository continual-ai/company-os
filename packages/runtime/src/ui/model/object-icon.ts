import {
  BoxIcon,
  Building2Icon,
  UserRoundIcon,
  MegaphoneIcon,
  FileTextIcon,
  UsersIcon,
  SendIcon,
  LifeBuoyIcon,
  MessageSquareIcon,
  FolderKanbanIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  ListTodoIcon,
  CircleDotIcon,
  type LucideIcon,
} from "lucide-react"

const icons: Readonly<Record<string, LucideIcon>> = {
  building: Building2Icon,
  person: UserRoundIcon,
  party: UserRoundIcon,
  megaphone: MegaphoneIcon,
  fileText: FileTextIcon,
  users: UsersIcon,
  mail: SendIcon,
  headset: LifeBuoyIcon,
  messageSquare: MessageSquareIcon,
  folder: FolderKanbanIcon,
  code: GitBranchIcon,
  gitPullRequest: GitPullRequestIcon,
  checkSquare: ListTodoIcon,
  circleDot: CircleDotIcon,
}

/** Semantic display tokens keep the portable model independent of React. */
export const objectIcon = (token: string | undefined): LucideIcon =>
  icons[token ?? ""] ?? BoxIcon
