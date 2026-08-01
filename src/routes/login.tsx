import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getAuthHealth } from "@/lib/auth-health";
import { ThemeToggle } from "@/lib/theme";

type LoginSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect:
      typeof search.redirect === "string" && search.redirect.startsWith("/")
        ? search.redirect
        : "/showcase",
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [healthHint, setHealthHint] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && user) {
      void navigate({ to: redirect || "/showcase" });
    }
  }, [user, isPending, navigate, redirect]);

  const providers = [
    ...GROK_PROVIDERS.filter((p) => p.providerId === "grok-x"),
    ...GROK_PROVIDERS.filter((p) => p.providerId !== "grok-x"),
  ];

  async function onSignIn(providerId: string, label: string) {
    setBusy(providerId);
    setError(null);
    setHealthHint(null);
    try {
      await signIn(providerId, {
        callbackURL: redirect || "/showcase",
        errorCallbackURL: "/login",
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Sign-in failed. Please try again.";
      setError(msg);
      try {
        const health = await getAuthHealth();
        const issues: string[] = [];
        if (!health.hasDatabaseUrl) {
          issues.push("database is not linked to this publish");
        }
        if (health.usingPreviewClientFallback && health.onVercel) {
          issues.push("production auth client was not provisioned");
        }
        if (issues.length) {
          setHealthHint(
            `Config: ${issues.join("; ")}. Re-publish the app so hosting can finish wiring auth.`,
          );
        }
      } catch {
        /* ignore health probe failures */
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-16">
        <Link
          to="/"
          className="mb-8 text-sm font-semibold text-muted hover:text-fg"
        >
          ← X Vibe Chat
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          Sign in
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Use your X account to submit creations to the community showcase.
        </p>

        <div className="mt-8 space-y-3">
          {authEnabled ? (
            providers.map((p) => (
              <button
                key={p.providerId}
                type="button"
                disabled={busy !== null}
                onClick={() => void onSignIn(p.providerId, p.label)}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-[15px] font-semibold text-fg transition-[background-color,border-color,transform] duration-200 hover:border-border-glow hover:bg-surface-elevated active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
              >
                {busy === p.providerId
                  ? `Connecting to ${p.label}…`
                  : `Continue with ${p.label}`}
              </button>
            ))
          ) : (
            <p className="text-sm text-subtle">Sign-in is disabled.</p>
          )}
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-fg">
            <p className="font-medium">Sign-in failed</p>
            <p className="mt-1 text-muted">{error}</p>
            {healthHint ? (
              <p className="mt-2 text-xs leading-relaxed text-subtle">
                {healthHint}
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="mt-8 text-xs leading-relaxed text-subtle">
          After signing in, link your X handle once so the community knows it is
          you — admins are recognized by handle.
        </p>
      </main>
    </div>
  );
}
