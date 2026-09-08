import { EngineeringModule } from "@company/engineering/model"
import { MarketingModule } from "@company/marketing/model"
import { NotesModule } from "@company/notes/model"
import { defineModel } from "@company/runtime/model"
import { Actor, AccessModule, Root } from "@company/runtime/model/access"
import { AssetsModule } from "@company/runtime/model/assets"
import { SalesModule } from "@company/sales/model"

import { modelMetadata } from "#/model-metadata.ts"
import { SupportEngineeringModule } from "#/modules/support-engineering/model/index.ts"
import { SupportModule } from "#/modules/support/model/index.ts"

/** Complete fixture composition; the running app installs only app.model.ts. */
export const Model = defineModel({
  actor: Actor,
  root: Root,
  name: modelMetadata.name,
  modules: [
    AccessModule,
    AssetsModule,
    NotesModule,
    SalesModule,
    MarketingModule,
    EngineeringModule,
    SupportModule,
    SupportEngineeringModule,
  ],
})
