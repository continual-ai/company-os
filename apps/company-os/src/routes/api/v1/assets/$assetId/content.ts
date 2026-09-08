import { createFileRoute } from "@tanstack/react-router"

import { handleAssetContent } from "#/server/transport/asset-content.ts"
export const Route = createFileRoute("/api/v1/assets/$assetId/content")({
  server: {
    handlers: {
      GET: ({ request, params }) => handleAssetContent(request, params.assetId),
      PUT: ({ request, params }) => handleAssetContent(request, params.assetId),
    },
  },
})
