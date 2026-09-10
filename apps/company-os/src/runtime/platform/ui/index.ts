import { BlocksIcon, FilesIcon } from "lucide-react"

import { anonymousActorUi } from "#/runtime/access/ui/anonymous-actor/config.ts"
import { serviceAccountUi } from "#/runtime/access/ui/service-account/config.ts"
import { userUi } from "#/runtime/access/ui/user/config.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { defineModuleUi } from "#/runtime/ui/module.ts"

export const PlatformUi = defineModuleUi(PlatformModule, {
  user: userUi,
  serviceAccount: serviceAccountUi,
  asset: { navigation: { order: 30, icon: FilesIcon } },
  moduleSetting: {
    navigation: { path: "/modules", order: 40, icon: BlocksIcon },
  },
  anonymousActor: anonymousActorUi,
})
