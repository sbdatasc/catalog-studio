/**
 * Converts a display name to a URL-safe, GraphQL-compatible slug.
 */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
