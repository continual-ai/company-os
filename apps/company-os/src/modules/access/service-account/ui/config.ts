import type { ObjectUi } from "@company/ui/model/object-ui"

import type { Model } from "#/app.model.ts"

export const serviceAccountUi = {
  navigation: { hidden: true },
} satisfies ObjectUi<typeof Model.objects.serviceAccount>
