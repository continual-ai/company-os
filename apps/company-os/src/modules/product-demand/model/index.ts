import { OpportunityIssues } from "#/modules/product-demand/model/opportunity-issues.ts"
import { defineModule } from "#/runtime/model/index.ts"

export const ProductDemandModule = defineModule({
  id: "productDemand",
  name: "Product demand",
  description: "Connect sales opportunities to the product work they need.",
  maturity: "alpha",
  links: [OpportunityIssues],
})
