/** Path segments reserved by static showcase routes. */
export const RESERVED_SHOWCASE_SLUGS = new Set([
  "submit",
  "admin",
  "mine",
  "edit",
  "login",
  "new",
  "api",
]);

/** Turn a display name into a URL-safe base slug. */
export function slugify(raw: string): string {
  const base = String(raw ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-$/g, "");

  return base || "app";
}

/**
 * Pick a unique slug. `exists` returns true if the candidate is already taken
 * (should exclude the current item when editing).
 */
export async function uniqueSlug(
  appName: string,
  exists: (candidate: string) => Promise<boolean>,
  preferred?: string | null,
): Promise<string> {
  const seed = preferred && preferred.trim() ? preferred : slugify(appName);
  let base = slugify(seed);
  if (RESERVED_SHOWCASE_SLUGS.has(base)) {
    base = `${base}-app`;
  }

  let candidate = base;
  let n = 2;
  while (await exists(candidate)) {
    const suffix = `-${n}`;
    candidate = `${base.slice(0, Math.max(1, 60 - suffix.length))}${suffix}`;
    n += 1;
    if (n > 500) {
      candidate = `${base.slice(0, 40)}-${Date.now().toString(36)}`;
      if (!(await exists(candidate))) break;
    }
  }
  return candidate;
}
