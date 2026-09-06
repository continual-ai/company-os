import { Data } from "effect"
export class AssetPrecondition extends Data.TaggedError("AssetPrecondition")<{
  readonly message: string
  readonly field?: string
}> {}
