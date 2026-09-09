import type { AnonymousActor } from "#/runtime/access/model/index.ts"
import type { ObjectUi } from "#/runtime/ui/model/object-ui.ts"

export const anonymousActorUi = {
  navigation: { hidden: true },
} satisfies ObjectUi<typeof AnonymousActor>
