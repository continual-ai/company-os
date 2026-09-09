import { Effect } from "effect"
import { expect } from "vitest"

import { AssetService } from "#/runtime/assets/server/asset-service.ts"
import { RecordId } from "#/runtime/model/index.ts"
import { ROOT_ID } from "#/runtime/model/system-records.ts"
import { anonymousInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { modelImplementation } from "#/runtime/server/model/implementation.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"
import { FixtureServer } from "#/runtime/testing/fixture-server.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const fixture = testFoundation(fixtureModel, { servers: [FixtureServer] })
const implementation = modelImplementation(fixtureModel)

fixture.test(
  "verifies uploads, protects content, and keeps references consistent through deletion",
  () =>
    Effect.gen(function* () {
      const assets = yield* AssetService
      const { services } = yield* implementation
      const png = Uint8Array.from(
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvX8AAAAASUVORK5CYII=",
          "base64"
        )
      )
      const upload = yield* assets.beginUpload({
        scope: RecordId("authorizationScope")(ROOT_ID),
        name: "logo.png",
        contentType: "image/png",
        size: png.length,
      })
      const pending = yield* Effect.result(
        assets.completeUpload({ id: upload.asset })
      )
      expect(pending._tag).toBe("Failure")
      const invalidRef = yield* Effect.result(
        services.account.create({
          name: "Pending",
          logo: { assetId: upload.asset },
        })
      )
      expect(invalidRef._tag).toBe("Failure")
      yield* assets.put(upload.asset, png)
      yield* assets.completeUpload({ id: upload.asset })
      const content = yield* assets.content(upload.asset)
      expect(content.record).toMatchObject({
        state: "ready",
        width: 1,
        height: 1,
        contentType: "image/png",
      })
      expect(content.bytes).toEqual(png)
      expect(content.record.checksum).toHaveLength(64)
      expect((yield* Effect.result(assets.put(upload.asset, png)))._tag).toBe(
        "Failure"
      )
      expect(
        (yield* Effect.result(
          assets
            .content(upload.asset)
            .pipe(Effect.provideService(CurrentInvocation, anonymousInvocation))
        ))._tag
      ).toBe("Failure")
      const account = yield* services.account.create({
        name: "Logo owner",
        logo: { assetId: upload.asset, alt: "Account logo" },
      })
      const document = yield* services.document.create({
        title: "Review logo",
        attachments: [{ assetId: upload.asset }],
      })
      expect(
        (yield* Effect.result(assets.delete({ id: upload.asset })))._tag
      ).toBe("Failure")
      yield* services.account.update({
        id: account.id,
        etag: account.etag,
        logo: null,
      })
      expect(
        (yield* Effect.result(assets.delete({ id: upload.asset })))._tag
      ).toBe("Failure")
      yield* services.document.update({
        id: document.id,
        etag: document.etag,
        attachments: [],
      })
      yield* assets.delete({ id: upload.asset })
      expect((yield* Effect.result(assets.content(upload.asset)))._tag).toBe(
        "Failure"
      )
    })
)
