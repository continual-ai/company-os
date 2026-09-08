import "#/sibling.ts"
import "#/nested/child.ts"
import "@company/runtime/ui/button"
void import("#/nested/lazy.ts")
export type Valid = import("#/nested/types.ts").Valid
