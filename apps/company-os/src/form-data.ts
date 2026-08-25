/** Reads one textual browser form field without admitting File values. */
export function formText(form: FormData, name: string): string {
  const value = form.get(name)
  // FormData is the browser I/O boundary being narrowed here.
  // oxlint-disable-next-line anti-slop/no-runtime-typeof
  return typeof value === "string" ? value : ""
}
