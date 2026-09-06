import { RecordId } from "@company/runtime"
import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Effect, Layer } from "effect"
import { expect } from "vitest"

import { makeApplicationLayer } from "@/server/application-layer"
import { Database } from "@/server/database/database"
import { itDatabase } from "@/server/database/it-database"
import {
  anonymousInvocation,
  systemInvocation,
} from "@/server/invocation-context"
import { ModelImplementation } from "@/server/model/model-implementation"
import { PageTokens } from "@/server/page-tokens"
import { seedSystem } from "@/server/seeds/seed-system"
import { ROOT_ID } from "@/system-records"

import { AssetService } from "./asset-service"

itDatabase(
  "verifies uploads, protects content, and keeps references consistent through deletion",
  Effect.fn(function* () {
    const database = yield* Database
    const tokens = PageTokens.layerTest
    yield* seedSystem().pipe(Effect.provide(tokens))
    yield* Effect.gen(function* () {
      const assets = yield* AssetService
      const { services } = yield* ModelImplementation
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
        services.company.create({
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
      const company = yield* services.company.create({
        name: "Logo owner",
        logo: { assetId: upload.asset, alt: "Company logo" },
      })
      const issue = yield* services.issue.create({
        title: "Review logo",
        attachments: [{ assetId: upload.asset }],
      })
      expect(
        (yield* Effect.result(assets.delete({ id: upload.asset })))._tag
      ).toBe("Failure")
      yield* services.company.update({
        id: company.id,
        etag: company.etag,
        logo: null,
      })
      expect(
        (yield* Effect.result(assets.delete({ id: upload.asset })))._tag
      ).toBe("Failure")
      yield* services.issue.update({
        id: issue.id,
        etag: issue.etag,
        attachments: [],
      })
      yield* assets.delete({ id: upload.asset })
      expect((yield* Effect.result(assets.content(upload.asset)))._tag).toBe(
        "Failure"
      )
    }).pipe(
      Effect.provideService(CurrentInvocation, systemInvocation),
      Effect.provide(
        makeApplicationLayer({
          database: Layer.succeed(Database, database),
          pageTokens: tokens,
        })
      )
    )
  })
)
