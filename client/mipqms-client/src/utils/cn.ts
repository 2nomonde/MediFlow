/** Joins class names, skipping falsy values. No external dependency needed for this. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
