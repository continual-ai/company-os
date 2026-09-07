import { type ImageRef } from "@company/runtime"

import { assetContentUrl } from "./upload"
import { useAssetNames } from "./use-asset-names"

/** Batched metadata hydration and protected content delivery for a field's attachments. */
export function AssetPreviews({
  references,
  image = false,
}: {
  readonly references: ReadonlyArray<ImageRef>
  readonly image?: boolean
}) {
  const names = useAssetNames(references)

  return (
    <div className="flex flex-wrap gap-3">
      {references.map((reference, index) => (
        <a
          key={`${reference.assetId}-${index}`}
          href={assetContentUrl(reference.assetId)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-interactive hover:underline"
        >
          {image && (
            <img
              src={assetContentUrl(reference.assetId)}
              alt={reference.alt ?? ""}
              width={64}
              height={64}
              className="size-16 rounded-sm object-cover"
            />
          )}
          {names.get(reference.assetId) ?? "Download file"}
        </a>
      ))}
    </div>
  )
}
