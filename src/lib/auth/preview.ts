import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Shared LIVE-PREVIEW OAuth client (server-only — NEVER import from the client).
 *
 * The sandbox serves each live preview on a dynamic `https://*.grok-sandbox.com`
 * URL, which can't be pre-registered per app. The broker instead exposes ONE
 * shared "preview" client that accepts any
 * `https://*.grok-sandbox.com/api/auth/oauth2/callback/*`.
 *
 * When deployed, the platform injects per-app `GROK_AUTH_CLIENT_ID` /
 * `GROK_AUTH_CLIENT_SECRET` (see `server.ts`). Those always win.
 *
 * The preview secret is intentionally **not** hardcoded in git:
 * 1. `GROK_AUTH_CLIENT_SECRET` / `GROK_PREVIEW_CLIENT_SECRET` (env)
 * 2. Optional local file `src/lib/auth/preview.local.json` (gitignored)
 *
 * Without one of those, federated sign-in stays off until credentials exist.
 */

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

function loadLocalPreviewSecret(): string {
  // cwd is project root in Vite/Nitro; try a few stable locations.
  const candidates = [
    join(process.cwd(), "src/lib/auth/preview.local.json"),
    join(process.cwd(), "preview.local.json"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const raw = readFileSync(path, "utf8");
      const parsed = JSON.parse(raw) as {
        clientId?: string;
        clientSecret?: string;
        PREVIEW_CLIENT_SECRET?: string;
      };
      const secret =
        parsed.clientSecret?.trim() ||
        parsed.PREVIEW_CLIENT_SECRET?.trim() ||
        "";
      if (secret) return secret;
    } catch {
      /* ignore malformed local file */
    }
  }
  return "";
}

function loadLocalPreviewClientId(): string {
  const candidates = [
    join(process.cwd(), "src/lib/auth/preview.local.json"),
    join(process.cwd(), "preview.local.json"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as {
        clientId?: string;
        PREVIEW_CLIENT_ID?: string;
      };
      const id = parsed.clientId?.trim() || parsed.PREVIEW_CLIENT_ID?.trim();
      if (id) return id;
    } catch {
      /* ignore */
    }
  }
  return "";
}

/** Public client id for the shared sandbox preview broker client. */
export const PREVIEW_CLIENT_ID =
  env("GROK_AUTH_CLIENT_ID") ||
  env("GROK_PREVIEW_CLIENT_ID") ||
  loadLocalPreviewClientId() ||
  "grok_preview";

/**
 * Secret for the shared sandbox preview client — env or gitignored local file only.
 * Never commit a real value here.
 */
export const PREVIEW_CLIENT_SECRET =
  env("GROK_AUTH_CLIENT_SECRET") ||
  env("GROK_PREVIEW_CLIENT_SECRET") ||
  loadLocalPreviewSecret();

/** The shared auth broker issuer (OIDC discovery lives under it). */
export const GROK_ISSUER_DEFAULT = "https://auth.grok.me";

/**
 * Host patterns whose callbacks the preview client accepts. Better Auth derives
 * the live preview's real origin from the request host and validates it against
 * this list (wildcard-matched), so the OAuth `redirect_uri` becomes the concrete
 * `https://<preview-host>/api/auth/oauth2/callback/...` the broker allows.
 */
export const PREVIEW_ALLOWED_HOSTS = ["*.grok-sandbox.com"] as const;
