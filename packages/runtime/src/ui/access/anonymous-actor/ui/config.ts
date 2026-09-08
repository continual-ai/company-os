import type { AnonymousActor } from "#/model/access/model.ts"
import type { ObjectUi } from "#/ui/model/object-ui.ts"

export const anonymousActorUi = {
  navigation: { hidden: true },
} satisfies ObjectUi<typeof AnonymousActor>
