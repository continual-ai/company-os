import { BlocksIcon, FilesIcon } from "lucide-react"

import { anonymousActorUi } from "#/runtime/access/ui/anonymous-actor/config.ts"
import { serviceAccountUi } from "#/runtime/access/ui/service-account/config.ts"
import { userUi } from "#/runtime/access/ui/user/config.ts"
import {
  PlatformModule,
  PlatformModel,
} from "#/runtime/platform/model/index.ts"
import { NoteSubjects } from "#/runtime/platform/model/note.ts"
import { ControllerOverview } from "#/runtime/platform/ui/controller-diagnostics.tsx"
import { noteUi } from "#/runtime/platform/ui/note/config.ts"
import { NoteFeed } from "#/runtime/platform/ui/note/note-feed.tsx"
import { defineCollectionView, defineModuleUi } from "#/runtime/ui/module.ts"

export const PlatformUi = defineModuleUi(
  PlatformModule,
  {
    note: noteUi,
    connector: {
      collection: {
        views: [
          defineCollectionView(
            PlatformModel,
            PlatformModel.objects.connector,
            "all",
            "All connectors",
            {
              columns: [
                "name",
                "authentication",
                "available",
                "module",
                "connections",
              ],
            }
          ),
        ],
      },
    },
    connection: {
      collection: {
        views: [
          defineCollectionView(
            PlatformModel,
            PlatformModel.objects.connection,
            "all",
            "All connections",
            {
              columns: [
                "account",
                "connector",
                "status",
                "lastError",
                "discoveredAt",
              ],
            }
          ),
        ],
      },
    },
    controllerInstance: {
      record: {
        properties: [
          "runs",
          "failures",
          "lastStartedAt",
          "lastSucceededAt",
          "requeueAt",
          "agentSessionId",
          "agentSessionUrl",
        ],
      },
      collection: {
        views: [
          defineCollectionView(
            PlatformModel,
            PlatformModel.objects.controllerInstance,
            "all",
            "All instances",
            {
              columns: ["label", "record", "state", "lastSucceededAt"],
            }
          ),
        ],
      },
    },
    controller: {
      record: {
        overviewComponent: ControllerOverview,
      },
    },
    user: userUi,
    serviceAccount: serviceAccountUi,
    asset: { navigation: { order: 30, icon: FilesIcon } },
    moduleSetting: {
      navigation: { path: "/settings/modules", hidden: true, icon: BlocksIcon },
    },
    anonymousActor: anonymousActorUi,
  },
  [{ link: NoteSubjects, side: "reverse", component: NoteFeed }]
)
