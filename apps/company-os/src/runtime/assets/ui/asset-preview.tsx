import { AssetPreviewButton } from "#/runtime/assets/ui/asset-viewer.tsx"
import { assetContentUrl } from "#/runtime/assets/ui/content-url.ts"
import { useAssetNames } from "#/runtime/assets/ui/use-asset-names.ts"
import { type ImageRef } from "#/runtime/model/index.ts"

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
        <AssetPreviewButton
          key={`${reference.assetId}-${index}`}
          reference={reference}
          name={names.get(reference.assetId) ?? "file"}
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
          {names.get(reference.assetId) ?? "View file"}
        </AssetPreviewButton>
      ))}
    </div>
  )
}
