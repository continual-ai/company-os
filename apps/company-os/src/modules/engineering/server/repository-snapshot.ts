import { Effect } from "effect"

import {
  GitHubRepository,
  type ApplyRepositorySnapshot,
} from "#/modules/engineering/model/github-repository.ts"
import type { ActionInput } from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/index.ts"

export const applyRepositorySnapshot = Effect.fn(
  "githubRepository.applySnapshot"
)(function* (input: ActionInput<typeof ApplyRepositorySnapshot>) {
  const repository = (yield* Database).repository(GitHubRepository)
  const current = yield* repository.get({ id: input.id })
  if (current.nodeId !== input.nodeId)
    return yield* Effect.fail({
      status: "FAILED_PRECONDITION" as const,
      reason: "FAILED_PRECONDITION" as const,
      message: "The GitHub node ID does not match this repository.",
    })
  if (
    current.sourceUpdatedAt &&
    Date.parse(current.sourceUpdatedAt) >= Date.parse(input.sourceUpdatedAt)
  )
    return { applied: false }
  if (current.etag !== input.etag)
    return yield* Effect.fail({
      status: "FAILED_PRECONDITION" as const,
      reason: "FAILED_PRECONDITION" as const,
      message:
        "Repository configuration changed during sync. Read it again and retry.",
    })
  yield* repository.update({ ...input, etag: current.etag, syncError: null })
  return { applied: true }
})
