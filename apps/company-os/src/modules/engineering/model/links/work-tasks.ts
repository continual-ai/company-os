import { GitHubIssue } from "#/modules/engineering/model/github-issue.ts"
import { GitHubPullRequest } from "#/modules/engineering/model/github-pull-request.ts"
import { Task } from "#/modules/work/model/task.ts"
import { defineLink } from "#/runtime/model/index.ts"

export const TaskGitHubPullRequests = defineLink({
  id: "taskGithubPullRequests",
  name: "Task GitHub pull requests",
  from: {
    object: Task,
    key: "githubPullRequests",
    label: "GitHub pull requests",
  },
  to: {
    object: GitHubPullRequest,
    key: "tasks",
    label: "Tasks",
  },
})

export const TaskGitHubIssues = defineLink({
  id: "taskGithubIssues",
  name: "Task GitHub issues",
  from: { object: Task, key: "githubIssues", label: "GitHub issues" },
  to: { object: GitHubIssue, key: "tasks", label: "Tasks" },
})
