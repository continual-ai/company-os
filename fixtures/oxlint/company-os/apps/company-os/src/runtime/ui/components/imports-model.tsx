import { useAppForm } from "#/runtime/ui/forms/app-form.ts"
import { cn } from "#/runtime/ui/lib/utils.ts"
import { useObjectClient } from "#/runtime/ui/model/use-object-client.ts"

export function Broken() {
  return cn(String(useObjectClient), String(useAppForm))
}
