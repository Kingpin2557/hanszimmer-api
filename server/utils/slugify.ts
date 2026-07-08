/**
 * Slugify a title the exact same way the frontend does, so a slug generated
 * in the browser (e.g. "the-dark-knight") resolves to the same movie here.
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
