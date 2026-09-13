import { Data, Effect, Exit } from "effect"
import { expect } from "vitest"

import { UserService } from "#/runtime/access/server/user-service.ts"
import { modelOperation } from "#/runtime/contract/operation-contract.ts"
import {
  defineAction,
  defineModel,
  defineLink,
  defineModule,
  defineObject,
  schema,
  EmailAddress,
  type ActionInput,
} from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import {
  Database,
  defineModuleServer,
  operationsFor,
  OperationExecutor,
} from "#/runtime/server/index.ts"
import {
  authenticatedInvocation,
  anonymousInvocation,
} from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const Sample = defineObject({
  id: "sample",
  collection: "samples",
  name: "Sample",
  pluralName: "Samples",
  properties: {
    name: schema.string(),
    code: schema.string({ immutable: true }),
    result: schema.string({ outputOnly: true, nullable: true }),
  },
  display: { title: "name" },
})
const CreateSample = defineAction({
  id: "createSample",
  name: "Create sample",
  description: "Exercise the common operation boundary.",
  input: {
    name: schema.string(),
    fail: schema.boolean(),
    invalidOutput: schema.boolean(),
  },
  output: { name: schema.string({ minLength: 1 }) },
})
const Samples = defineModule({
  id: "samples",
  name: "Samples",
  objects: [Sample],
  links: [
    defineLink({
      id: "sampleRelations",
      name: "Sample relations",
      from: { type: Sample, key: "related" },
      to: { type: Sample, key: "relatedBy" },
    }),
  ],
  actions: [CreateSample],
})
class IntentionalFailure extends Data.TaggedError("IntentionalFailure")<{}> {}
const server = defineModuleServer(Samples, {
  createSample: Effect.fn("sample.createSample")(function* (
    input: ActionInput<typeof CreateSample>
  ) {
    const samples = (yield* Database).repository(Sample)
    const record = yield* samples.create({ name: input.name, code: "fixed" })
    if (input.fail) return yield* Effect.fail(new IntentionalFailure())
    return { name: input.invalidOutput ? "" : record.name }
  }),
})

const model = defineModel({
  name: "Executor boundary",
  modules: [PlatformModule, Samples],
})
const fixture = testFoundation(model, { servers: [server] })

fixture.test(
  "admission and output validation surround custom writes and roll back their journal entries",
  () =>
    Effect.gen(function* () {
      const operations = yield* operationsFor(model)
      const database = yield* Database
      for (const input of [
        { name: "failure", fail: true, invalidOutput: false },
        { name: "invalid output", fail: false, invalidOutput: true },
      ]) {
        expect(
          Exit.isFailure(yield* Effect.exit(operations.createSample(input)))
        ).toBe(true)
      }
      expect(
        Exit.isFailure(
          yield* Effect.exit(
            operations
              .createSample({
                name: "anonymous",
                fail: false,
                invalidOutput: false,
              })
              .pipe(
                Effect.provideService(CurrentInvocation, anonymousInvocation)
              )
          )
        )
      ).toBe(true)
      expect((yield* database.repository(Sample).list()).totalSize).toBe(0)
      expect(
        (yield* database.sql`select count(*)::int as count from event_journal where type = 'sample.created'`)[0]
          ?.count
      ).toBe(0)
      expect(
        yield* operations.createSample({
          name: "accepted",
          fail: false,
          invalidOutput: false,
        })
      ).toEqual({ name: "accepted" })
      expect((yield* operations.sample.list()).totalSize).toBe(1)
    })
)

fixture.test(
  "repository transactions retain the complete Database API and enforce immutable fields",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const record = yield* database.transaction((transaction) =>
        transaction
          .repository(Sample)
          .create({ name: "original", code: "fixed" })
      )
      expect(
        yield* database
          .repository(Sample)
          .update({ id: record.id, code: "changed" })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "ImmutablePropertyError" })
      expect(
        (yield* database.repository(Sample).get({ id: record.id })).code
      ).toBe("fixed")
    })
)

fixture.test(
  "internal creates and updates can set action-owned fields; public writes cannot",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const repository = database.repository(Sample)
      const operations = yield* operationsFor(model)
      const created = yield* repository.create({
        name: "internal",
        code: "fixed",
        result: "initialized",
      })
      expect(created.result).toBe("initialized")
      expect(
        (yield* repository.update({ id: created.id, result: "updated" })).result
      ).toBe("updated")
      const input = { id: created.id, result: "public" }
      yield* operations.sample.update(input)
      expect((yield* repository.get({ id: created.id })).result).toBe("updated")
    })
)

fixture.test(
  "internal deletions share policy while public record and link writes protect system records",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const repository = database.repository(Sample)
      const operations = yield* operationsFor(model)
      const member = yield* (yield* UserService).provision({
        name: "Reviewer",
        email: EmailAddress("reviewer@example.test"),
      })
      const actor = yield* authenticatedInvocation(member.id)
      const first = yield* repository.create({ name: "one", code: "fixed" })
      const second = yield* repository.create({ name: "two", code: "fixed" })
      yield* repository.update({
        id: first.id,
        links: { related: [second.id] },
      })
      const table = (yield* ModelContext).storage.core.objects
      yield* database.sql`update ${table} set system_managed = true where id in (${first.id}, ${second.id})`
      for (const call of [
        operations.sample.delete({ id: first.id }),
        operations.sample.batchDelete({ ids: [second.id] }),
      ]) {
        expect(
          yield* call.pipe(
            Effect.provideService(CurrentInvocation, actor),
            Effect.flip
          )
        ).toMatchObject({ _tag: "SystemRecordReadOnly" })
      }
      const executor = yield* OperationExecutor
      for (const method of ["link", "unlink"]) {
        const error = yield* executor
          .run(actor, modelOperation(model, `sample.related.${method}`), {
            id: first.id,
            target: second.id,
          })
          .pipe(Effect.flip)
        expect(error).toMatchObject({ status: "PERMISSION_DENIED" })
      }
      yield* repository
        .delete({ id: first.id })
        .pipe(Effect.provideService(CurrentInvocation, actor))
      yield* repository
        .batchDelete({ ids: [second.id] })
        .pipe(Effect.provideService(CurrentInvocation, actor))
      expect((yield* repository.list()).totalSize).toBe(0)
    })
)
