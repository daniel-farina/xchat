import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

async function handleAuth(request: Request): Promise<Response> {
  try {
    return await auth.handler(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/auth] handler error:", err);
    // Surface a short message so the login UI can show something useful.
    // Never leak connection strings / secrets.
    const safe =
      message.includes("pglite") || message.includes("ENOENT")
        ? "Auth database is not available on this deploy. Re-publish or check DATABASE_URL."
        : message.includes("ECONNREFUSED") || message.includes("connect")
          ? "Could not reach the auth database. Re-publish so Postgres can be provisioned."
          : message.slice(0, 280) || "Sign-in failed";
    return new Response(JSON.stringify({ message: safe, code: "AUTH_HANDLER_ERROR" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuth(request),
      POST: ({ request }) => handleAuth(request),
    },
  },
});
