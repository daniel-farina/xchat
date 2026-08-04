import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  deleteShowcaseItem,
  getShowcaseSession,
  listAllShowcaseAdmin,
  setShowcaseStatus,
  type ShowcaseItem,
  type ShowcaseStatus,
} from "@/lib/showcase-server";
import {
  getHubImportStatus,
  importHubCatalog,
} from "@/lib/showcase-import";

export const Route = createFileRoute("/showcase/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    return (
      <div className="min-h-dvh bg-bg text-fg">
        <SiteHeader active="admin" />
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-subtle">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Checking session…
        </div>
      </div>
    );
  }

  if (!user) return <RedirectToSignIn to="/login" />;

  return <AdminPanel />;
}

function AdminPanel() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hubStatus, setHubStatus] = useState<{
    seedCount: number;
    alreadyImported: number;
  } | null>(null);
  const [hubBusy, setHubBusy] = useState(false);
  const [hubResult, setHubResult] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const session = await getShowcaseSession();
    setHandle(session.xHandle);
    setIsAdmin(session.isAdmin);
    if (!session.isAdmin) {
      setItems([]);
      return;
    }
    setItems(await listAllShowcaseAdmin());
    try {
      setHubStatus(await getHubImportStatus());
    } catch {
      setHubStatus(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    reload().catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Failed to load admin.");
        setIsAdmin(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function runHubImport(mode: "insert_only" | "upsert") {
    setHubBusy(true);
    setHubResult(null);
    setError(null);
    try {
      const res = await importHubCatalog({ data: { mode } });
      setHubResult(
        `Seed ${res.totalSeed}: inserted ${res.inserted}, updated ${res.updated}, skipped ${res.skipped}` +
          (res.errors.length
            ? ` · errors: ${res.errors.slice(0, 5).join("; ")}`
            : ""),
      );
      setHubStatus(await getHubImportStatus());
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hub import failed.");
    } finally {
      setHubBusy(false);
    }
  }

  async function setStatus(id: string, status: ShowcaseStatus) {
    setBusyId(id);
    setError(null);
    try {
      await setShowcaseStatus({ data: { id, status } });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this showcase item permanently?")) return;
    setBusyId(id);
    setError(null);
    try {
      await deleteShowcaseItem({ data: { id } });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (isAdmin === null) {
    return (
      <div className="min-h-dvh bg-bg text-fg">
        <SiteHeader active="admin" />
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-subtle">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading…
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-dvh bg-bg text-fg">
        <SiteHeader active="admin" />
        <main className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="text-2xl font-semibold text-fg">Admin only</h1>
          <p className="mt-2 text-sm text-muted">
            Signed in as @{handle ?? "unknown"} — not an admin handle.
          </p>
        </main>
      </div>
    );
  }

  const pending = items.filter((i) => i.status === "pending");
  const approved = items.filter((i) => i.status === "approved");

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteHeader active="admin" />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-fg">
          Showcase admin
        </h1>
        <p className="mt-2 text-sm text-muted">
          Signed in as @{handle}. {items.length} total apps in DB.
        </p>

        {error ? (
          <p className="mt-6 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-fg">
            {error}
          </p>
        ) : null}

        <section className="mt-8 rounded-2xl border border-border bg-surface/60 p-5">
          <h2 className="text-lg font-semibold text-fg">
            Hub catalog import (Grok Build)
          </h2>
          <p className="mt-2 text-sm text-muted">
            Merge of hub.grok.me + explore.grok.me + high-engagement X posts
            with per-post likes.
            {hubStatus
              ? ` Seed has ${hubStatus.seedCount} apps; ${hubStatus.alreadyImported} already imported.`
              : " Loading status…"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={hubBusy || !hubStatus}
              onClick={() => void runHubImport("insert_only")}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50"
            >
              {hubBusy ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : null}
              Import missing only
            </button>
            <button
              type="button"
              disabled={hubBusy || !hubStatus}
              onClick={() => void runHubImport("upsert")}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-bg px-4 text-sm font-medium text-fg disabled:opacity-50"
            >
              Upsert all (refresh likes)
            </button>
          </div>
          {hubResult ? (
            <p className="mt-3 rounded-lg border border-border bg-bg px-3 py-2 text-xs text-muted">
              {hubResult}
            </p>
          ) : null}
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-fg">
            Pending ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <p className="mt-2 text-sm text-subtle">Queue is clear.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {pending.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-border bg-surface/60 px-4 py-3"
                >
                  <p className="font-medium text-fg">{item.appName}</p>
                  <p className="text-xs text-muted">
                    @{item.authorHandle} · {item.category}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void setStatus(item.id, "approved")}
                      className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-accent-fg"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void setStatus(item.id, "rejected")}
                      className="rounded-lg border border-border px-3 py-1 text-xs"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void remove(item.id)}
                      className="rounded-lg border border-border px-3 py-1 text-xs text-rose-400"
                    >
                      Delete
                    </button>
                    <Link
                      to="/showcase/$slug"
                      params={{ slug: item.slug || item.id }}
                      className="rounded-lg border border-border px-3 py-1 text-xs text-accent-bright"
                    >
                      Open
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-fg">
            Approved ({approved.length})
          </h2>
          <ul className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto">
            {approved.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-bg/40 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium text-fg">{item.appName}</span>
                  <span className="ml-2 text-xs text-subtle">
                    @{item.authorHandle}
                  </span>
                </div>
                <Link
                  to="/showcase/$slug"
                  params={{ slug: item.slug || item.id }}
                  className="text-xs text-accent-bright hover:underline"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
