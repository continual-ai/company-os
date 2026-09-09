/** Deterministic markdown examples shared by demo and performance scenarios.
 * The caller owns persistence, audit identity, and links to other records. */
export function noteSeed(index: number, subject: string) {
  const serial = String(index + 1).padStart(4, "0")
  return {
    content: `### Review ${serial}\n\nDiscussed next steps for **${subject}**.\n\n${index % 3 === 0 ? "- [x] Review current status\n- [ ] Confirm next steps\n\n" : ""}${"Keep decisions and their context available to everyone working on this record. ".repeat(index % 9 === 0 ? 30 : 2)}`,
  }
}
