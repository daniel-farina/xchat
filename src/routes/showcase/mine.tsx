import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { promptStyleLabel } from "@/lib/showcase-options";
import { listMyShowcase, type ShowcaseItem } from "@/lib/showcase-server";

export const Route = createFileRoute("/showcase/mine")({
  component: MinePage,
});

function MinePage() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    return (
      <div className="min-h-dvh bg-bg text-fg">
        <SiteHeader active="mine" />
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-subtle">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Checking session…
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" search={{ redirect: "/showcase/mine" }} />;
  }

  return <MineList />;
}

function MineList() {
  const [items, setItems] = useState<ShowcaseItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyShowcase()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load.");
          setItems([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteHeader active="mine" />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-fg">
              My submissions
            </h1>
            <p className="mt-2 text-sm text-muted">
              Edit any item anytime. Changes go back to pending for admin
              re-review.
            </p>
          </div>
          <Link
            to="/showcase/submit"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg"
          >
            <Plus className="size-4" aria-hidden />
            New submission
          </Link>
        </div>

        {error ? (
          <p className="mt-6 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}

        {items === null ? (
          <div className="mt-16 flex items-center justify-center gap-2 text-sm text-subtle">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <p className="font-medium text-fg">No submissions yet</p>
            <p className="mt-2 text-sm text-muted">
              Share your first creation with the group.
            </p>
            <Link
              to="/showcase/submit"
              className="mt-6 inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium"
            >
              Submit a creation
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex gap-3 rounded-2xl border border-border bg-surface/70 p-3 sm:p-4"
              >
                <img
                  src={item.imageData}
                  alt=""
                  className="size-20 shrink-0 rounded-xl object-cover sm:size-24"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-subtle">
                      {item.status}
                    </span>
                    {item.model ? (
                      <span className="text-[11px] font-medium text-muted">
                        {item.model}
                      </span>
                    ) : null}
                    <span className="text-[11px] text-subtle">
                      {promptStyleLabel(item.promptStyle)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-fg">
                    {item.appName}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                    {item.description}
                  </p>
                  {item.changeSummary ? (
                    <p className="mt-1 text-[11px] text-accent-bright">
                      {item.changeSummary} · awaiting re-review
                    </p>
                  ) : null}
                  <Link
                    to="/showcase/edit/$itemId"
                    params={{ itemId: item.id }}
                    className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border border-border-glow bg-bg px-3 text-xs font-semibold text-fg hover:bg-surface-elevated"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    Edit submission
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
