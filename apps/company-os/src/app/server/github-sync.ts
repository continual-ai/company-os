import { Effect } from "effect"

import { Model } from "#/app.model.ts"
import { applicationRuntime } from "#/app/server/application-runtime.ts"
import { readGitHubSnapshot } from "#/app/server/github-snapshot.ts"
import { RecordId, Timestamp, WebUrl } from "#/runtime/model/index.ts"
import { activeModuleModel } from "#/runtime/platform/server/index.ts"
import { Authentication } from "#/runtime/server/auth/authentication.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { operationsFor } from "#/runtime/server/operation-executor.ts"

/** One bounded connector read followed by one transactional business operation. */
export async function syncGitHubRepository(request: Request, id: string) {
  const admitted = await applicationRuntime.runPromise(
    Effect.gen(function* () {
      const invocation = yield* (yield* Authentication).invocation(
        request.headers
      )
      if (!(yield* activeModuleModel()).model.objects.githubRepository)
        throw new Error("Enable the Engineering module before syncing.")
      const operations = yield* operationsFor(Model)
      const record = yield* operations.githubRepository
        .get({ id: RecordId("githubRepository")(id) })
        .pipe(Effect.provideService(CurrentInvocation, invocation))
      const connectionId = record.links.connection
      if (typeof connectionId !== "string")
        throw new Error("Repository connection is missing.")
      const connection = yield* operations.connection
        .get({ id: RecordId("connection")(connectionId) })
        .pipe(Effect.provideService(CurrentInvocation, invocation))
      if (!connection.platformConnectionId)
        throw new Error("Select a Continual Connection before syncing.")
      return {
        invocation,
        record,
        connectionId: connection.platformConnectionId,
      }
    })
  )
  const repository = await readGitHubSnapshot(
    request,
    admitted.connectionId,
    admitted.record.fullName
  )
  return applicationRuntime.runPromise(
    Effect.gen(function* () {
      if (!(yield* activeModuleModel()).model.objects.githubRepository)
        throw new Error("Enable the Engineering module before syncing.")
      const operations = yield* operationsFor(Model)
      return yield* operations.githubRepository
        .applySnapshot({
          id: admitted.record.id,
          etag: admitted.record.etag,
          nodeId: repository.node_id,
          fullName: repository.full_name,
          url: WebUrl(repository.html_url),
          description: repository.description,
          defaultBranch: repository.default_branch,
          visibility: repository.visibility,
          archived: repository.archived,
          sourceUpdatedAt: Timestamp(repository.updated_at),
        })
        .pipe(Effect.provideService(CurrentInvocation, admitted.invocation))
    })
  )
}
