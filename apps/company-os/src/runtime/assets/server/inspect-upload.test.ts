import { Effect } from "effect"
import { expect, it } from "vitest"

import { inspectUpload } from "#/runtime/assets/server/inspect-upload.ts"

it("detects documents from bytes and rejects a falsely declared image", async () => {
  const pdf = new TextEncoder().encode(
    "%PDF-1.7\n% foundation document type fixture\n"
  )
  const metadata = await Effect.runPromise(
    inspectUpload(pdf, "application/octet-stream")
  )
  expect(metadata).toMatchObject({
    contentType: "application/pdf",
    width: null,
    height: null,
  })
  expect(metadata.checksum).toHaveLength(64)
  await expect(
    Effect.runPromise(inspectUpload(pdf, "image/png"))
  ).rejects.toMatchObject({ _tag: "AssetPrecondition" })
  expect(
    await Effect.runPromise(
      inspectUpload(new TextEncoder().encode("hello"), "text/plain")
    )
  ).toMatchObject({ contentType: "text/plain" })
})
