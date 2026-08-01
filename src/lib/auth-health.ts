import { createServerFn } from "@tanstack/react-start";

/**
 * Non-sensitive auth/config probes for the login page when sign-in fails.
 * Booleans only — never returns secrets or connection strings.
 */
export const getAuthHealth = createServerFn({ method: "GET" }).handler(
  async () => {
    const has = (key: string) => {
      const v = process.env[key];
      return typeof v === "string" && v.trim().length > 0;
    };
    // Dynamic key build so build tooling cannot blank the check.
    const hasDatabaseUrl =
      has("DATABASE_URL") ||
      has("POSTGRES_URL") ||
      Boolean(process.env["DATA" + "BASE_URL"]?.trim());

    return {
      hasDatabaseUrl,
      hasGrokAuthClient: has("GROK_AUTH_CLIENT_ID"),
      hasGrokAuthSecret: has("GROK_AUTH_CLIENT_SECRET"),
      hasBetterAuthUrl: has("BETTER_AUTH_URL"),
      hasBetterAuthSecret: has("BETTER_AUTH_SECRET"),
      usingPreviewClientFallback: !has("GROK_AUTH_CLIENT_ID"),
      onVercel: Boolean(process.env["VERCEL"] || process.env["VERCEL_ENV"]),
    };
  },
);
