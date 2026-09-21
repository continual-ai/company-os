import "#/sibling.ts"
import "#/nested/child.ts"
import "effect"
void import("#/nested/lazy.ts")
export type Valid = import("#/nested/types.ts").Valid
