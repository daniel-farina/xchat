import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ImagePlus, Loader2, Pencil, Trash2, X } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ADMIN_HANDLES } from "@/lib/admins";
import { compressImageToDataUrl } from "@/lib/image-compress";
import {
  categoryLabel,
  isShowcaseCategory,
  normalizeHttpUrl,
  PROMPT_STYLES,
  promptStyleLabel,
  promptStyleNeedsText,
  SHOWCASE_CATEGORIES,
  type ShowcaseCategoryId,
} from "@/lib/showcase-options";
import {
  deleteShowcaseItem,
  getShowcaseSession,
  listAllShowcaseAdmin,
  setShowcaseStatus,
  updateShowcaseItem,
  type ShowcaseItem,
  type ShowcaseStatus,
} from "@/lib/showcase-server";
import { listShowcaseReports } from "@/lib/showcase-engagement";

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
  const [editing, setEditing] = useState<ShowcaseItem | null>(null);
  const [reports, setReports] = useState<
    { id: string; itemId: string; slug?: string; message: string; appName: string; authorHandle: string; createdAt: string }[]
  >([]);

  const reload = useCallback(async () => {
    const session = await getShowcaseSession();
    setHandle(session.xHandle);
    setIsAdmin(session.isAdmin);
    if (!session.isAdmin) {
      setItems([]);
      return;
    }
    const rows = await listAllShowcaseAdmin();
    setItems(rows);
    try {
      setReports(await listShowcaseReports());
    } catch {
      setReports([]);
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
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold text-fg">Admin only</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Moderation is limited to linked admin handles
            {handle ? (
              <>
                . You are signed in as{" "}
                <span className="font-medium text-fg">@{handle}</span>, which is
                not on the admin list.
              </>
            ) : (
              ". Link your X handle on the submit page first."
            )}
          </p>
          <p className="mt-4 text-xs text-subtle">
            Admins: {ADMIN_HANDLES.map((h) => `@${h}`).join(", ")}
          </p>
          <Link
            to="/showcase/submit"
            className="mt-8 inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium text-fg hover:border-border-glow"
          >
            Link handle / submit
          </Link>
        </main>
      </div>
    );
  }

  const reReview = items.filter(
    (i) => i.status === "pending" && i.changeSummary,
  );
  const pendingNew = items.filter(
    (i) => i.status === "pending" && !i.changeSummary,
  );
  const rest = items.filter((i) => i.status !== "pending");

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteHeader active="admin" />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-fg">
          Showcase admin
        </h1>
        <p className="mt-2 text-sm text-muted">
          Full edit of every field (name, handle, photo, status). Signed in as @
          {handle}.
        </p>

        {error ? (
          <p className="mt-6 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-fg">
            {error}
          </p>
        ) : null}

        <Section title={`Malicious reports (${reports.length})`}>
          {reports.length === 0 ? (
            <p className="text-sm text-subtle">No reports.</p>
          ) : (
            <ul className="space-y-3">
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm"
                >
                  <p className="font-medium text-fg">
                    {r.appName}{" "}
                    <span className="font-normal text-muted">
                      @{r.authorHandle}
                    </span>
                  </p>
                  <p className="mt-1 text-muted">{r.message}</p>
                  <Link
                    to="/showcase/$slug"
                    params={{ slug: r.slug || r.itemId }}
                    className="mt-2 inline-block text-xs text-accent-bright hover:underline"
                  >
                    Open app page
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={`Re-review after edits (${reReview.length})`}>
          {reReview.length === 0 ? (
            <p className="text-sm text-subtle">No edited items waiting.</p>
          ) : (
            <ul className="space-y-4">
              {reReview.map((item) => (
                <AdminCard
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  onApprove={() => void setStatus(item.id, "approved")}
                  onReject={() => void setStatus(item.id, "rejected")}
                  onDelete={() => void remove(item.id)}
                  onEdit={() => setEditing(item)}
                />
              ))}
            </ul>
          )}
        </Section>

        <Section title={`New pending (${pendingNew.length})`}>
          {pendingNew.length === 0 ? (
            <p className="text-sm text-subtle">Queue is clear.</p>
          ) : (
            <ul className="space-y-4">
              {pendingNew.map((item) => (
                <AdminCard
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  onApprove={() => void setStatus(item.id, "approved")}
                  onReject={() => void setStatus(item.id, "rejected")}
                  onDelete={() => void remove(item.id)}
                  onEdit={() => setEditing(item)}
                />
              ))}
            </ul>
          )}
        </Section>

        <Section title={`All other items (${rest.length})`}>
          {rest.length === 0 ? (
            <p className="text-sm text-subtle">No other items yet.</p>
          ) : (
            <ul className="space-y-4">
              {rest.map((item) => (
                <AdminCard
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  onApprove={() => void setStatus(item.id, "approved")}
                  onReject={() => void setStatus(item.id, "rejected")}
                  onDelete={() => void remove(item.id)}
                  onEdit={() => setEditing(item)}
                />
              ))}
            </ul>
          )}
        </Section>
      </main>

      {editing ? (
        <EditModal
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      ) : null}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function AdminCard({
  item,
  busy,
  onApprove,
  onReject,
  onDelete,
  onEdit,
}: {
  item: ShowcaseItem;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-surface/70">
      <div className="flex flex-col sm:flex-row">
        <img
          src={item.imageData}
          alt=""
          className="h-40 w-full object-cover sm:h-auto sm:w-40 sm:shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-subtle">
              {item.status}
            </span>
            {item.editCount > 0 ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-subtle">
                {item.editCount} edit{item.editCount === 1 ? "" : "s"}
              </span>
            ) : null}
            <p className="text-sm font-semibold text-fg">{item.appName}</p>
            <p className="text-[11px] text-subtle">{categoryLabel(item.category)}</p>
            <p className="text-xs text-muted">
              {item.authorName}{" "}
              <span className="text-subtle">@{item.authorHandle}</span>
            </p>
          </div>

          {item.changeSummary ? (
            <p className="mt-2 rounded-lg border border-border-glow bg-bg/60 px-3 py-2 text-xs font-medium text-accent-bright">
              Changes to review: {item.changeSummary}
            </p>
          ) : null}

          <p className="mt-2 line-clamp-2 text-sm text-muted">
            {item.description}
          </p>
          <p className="mt-1 text-xs text-subtle">
            {item.model ? `${item.model} · ` : ""}
            {promptStyleLabel(item.promptStyle)} · Tools: {item.tools}
          </p>
          <a
            href={item.creationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 truncate text-xs text-accent-bright hover:underline"
          >
            {item.creationUrl}
          </a>
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionBtn
              disabled={busy || item.status === "approved"}
              onClick={onApprove}
              icon={Check}
              label="Approve"
            />
            <ActionBtn
              disabled={busy || item.status === "rejected"}
              onClick={onReject}
              icon={X}
              label="Reject"
            />
            <ActionBtn
              disabled={busy}
              onClick={onEdit}
              icon={Pencil}
              label="Edit all"
            />
            <ActionBtn
              disabled={busy}
              onClick={onDelete}
              icon={Trash2}
              label="Delete"
              danger
            />
          </div>
        </div>
      </div>
    </li>
  );
}

function ActionBtn({
  label,
  icon: Icon,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  icon: typeof Check;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors disabled:opacity-50 ${
        danger
          ? "border-border text-muted hover:bg-surface-elevated"
          : "border-border text-fg hover:border-border-glow hover:bg-surface-elevated"
      }`}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}

function EditModal({
  item,
  onClose,
  onSaved,
}: {
  item: ShowcaseItem;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [appName, setAppName] = useState(item.appName);
  const [category, setCategory] = useState<ShowcaseCategoryId>(
    isShowcaseCategory(item.category) ? item.category : "other",
  );
  const [authorName, setAuthorName] = useState(item.authorName);
  const [authorHandle, setAuthorHandle] = useState(item.authorHandle);
  const [description, setDescription] = useState(item.description);
  const [tools, setTools] = useState(item.tools);
  const [prompt, setPrompt] = useState(item.prompt);
  const [model, setModel] = useState(item.model);
  const [promptStyle, setPromptStyle] = useState(item.promptStyle);
  const [creationUrl, setCreationUrl] = useState(item.creationUrl);
  const [status, setStatus] = useState<ShowcaseStatus>(item.status);
  const [imageData, setImageData] = useState(item.imageData);
  const [imageChanged, setImageChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const needsPrompt = promptStyleNeedsText(promptStyle);

  async function onPickImage(file: File | null) {
    if (!file) return;
    try {
      const data = await compressImageToDataUrl(file);
      setImageData(data);
      setImageChanged(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image failed.");
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateShowcaseItem({
        data: {
          id: item.id,
          appName,
          category,
          authorName,
          authorHandle,
          description,
          tools,
          prompt: needsPrompt
            ? prompt
            : "Long multi-day process — no single prompt (iterated across many sessions).",
          model,
          promptStyle,
          creationUrl: normalizeHttpUrl(creationUrl),
          imageData: imageChanged ? imageData : undefined,
          status,
        },
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-fg";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-xl"
      >
        <h3 className="text-lg font-semibold text-fg">Edit all details</h3>
        {item.changeSummary ? (
          <p className="mt-2 rounded-lg border border-border-glow bg-bg px-3 py-2 text-xs text-accent-bright">
            Author changes: {item.changeSummary}
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted">Photo</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-1 flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border px-3 py-4"
            >
              <img
                src={imageData}
                alt=""
                className="max-h-40 rounded-lg object-cover"
              />
              <span className="inline-flex items-center gap-1 text-xs font-medium text-fg">
                <ImagePlus className="size-3.5" />
                {imageChanged ? "New photo selected" : "Replace photo"}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
            />
          </div>

          <label className="block text-xs font-medium text-muted">
            App name
            <input
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className={field}
              maxLength={80}
            />
          </label>

          <label className="block text-xs font-medium text-muted">
            Category (required)
            <select
              required
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as ShowcaseCategoryId)
              }
              className={field}
            >
              {SHOWCASE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-muted">
            Author display name
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className={field}
              maxLength={80}
            />
          </label>

          <label className="block text-xs font-medium text-muted">
            X handle
            <div className="mt-1 flex items-center gap-1">
              <span className="text-sm text-subtle">@</span>
              <input
                value={authorHandle}
                onChange={(e) =>
                  setAuthorHandle(e.target.value.replace(/^@+/, ""))
                }
                className={field + " mt-0"}
                maxLength={15}
              />
            </div>
          </label>

          <label className="block text-xs font-medium text-muted">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={field + " min-h-20"}
            />
          </label>
          <label className="block text-xs font-medium text-muted">
            Tools (comma-separated)
            <input
              value={tools}
              onChange={(e) => setTools(e.target.value)}
              className={field}
            />
          </label>
          <label className="block text-xs font-medium text-muted">
            Model
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={field}
            />
          </label>
          <label className="block text-xs font-medium text-muted">
            Prompt style
            <select
              value={promptStyle}
              onChange={(e) => setPromptStyle(e.target.value)}
              className={field}
            >
              {PROMPT_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {needsPrompt ? (
            <label className="block text-xs font-medium text-muted">
              Prompt
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className={field + " min-h-24 font-mono"}
              />
            </label>
          ) : (
            <p className="rounded-lg border border-border bg-bg px-3 py-2 text-xs text-subtle">
              Multi-day style — no single prompt field.
            </p>
          )}
          <label className="block text-xs font-medium text-muted">
            Link
            <input
              value={creationUrl}
              onChange={(e) => setCreationUrl(e.target.value)}
              className={field}
            />
          </label>
          <label className="block text-xs font-medium text-muted">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ShowcaseStatus)}
              className={field}
            >
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </select>
          </label>
        </div>
        {error ? <p className="mt-3 text-sm text-muted">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm text-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save all"}
          </button>
        </div>
      </div>
    </div>
  );
}
