/** X handles with showcase moderation powers (case-insensitive). */
export const ADMIN_HANDLES = [
  "Daniel_Farinax",
  "XFreeze",
  "tetsuoai",
] as const;

export type AdminHandle = (typeof ADMIN_HANDLES)[number];

export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

export function isAdminHandle(handle: string | null | undefined): boolean {
  if (!handle) return false;
  const n = normalizeHandle(handle);
  return ADMIN_HANDLES.some((h) => normalizeHandle(h) === n);
}
