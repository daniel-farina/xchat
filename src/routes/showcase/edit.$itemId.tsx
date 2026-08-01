import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ImagePlus, Loader2, Save, X } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { compressImageToDataUrl } from "@/lib/image-compress";
import {
  CODING_MODELS,
  isShowcaseCategory,
  normalizeHttpUrl,
  PROMPT_STYLES,
  promptStyleNeedsText,
  SHOWCASE_CATEGORIES,
  TOOL_SUGGESTIONS,
  type PromptStyleId,
  type ShowcaseCategoryId,
} from "@/lib/showcase-options";
import {
  getMyShowcaseItem,
  updateOwnerShowcaseItem,
  type ShowcaseItem,
} from "@/lib/showcase-server";

export const Route = createFileRoute("/showcase/edit/$itemId")({
  component: EditPage,
});

function EditPage() {
  const { itemId } = Route.useParams();
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
    return (
      <Navigate
        to="/login"
        search={{ redirect: `/showcase/edit/${itemId}` }}
      />
    );
  }

  return <EditForm itemId={itemId} />;
}

function EditForm({ itemId }: { itemId: string }) {
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<ShowcaseItem | null>(null);
  const [appName, setAppName] = useState("");
  const [category, setCategory] = useState<ShowcaseCategoryId>("other");
  const [authorName, setAuthorName] = useState("");
  const [description, setDescription] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const [toolDraft, setToolDraft] = useState("");
  const [promptStyle, setPromptStyle] = useState<PromptStyleId>("one_shot");
  const [prompt, setPrompt] = useState("");
  const [modelPick, setModelPick] = useState("Grok 4.5");
  const [modelOther, setModelOther] = useState("");
  const [creationUrl, setCreationUrl] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageChanged, setImageChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const needsPrompt = promptStyleNeedsText(promptStyle);
  const knownModels = CODING_MODELS.filter((m) => m !== "Other") as string[];
  const resolvedModel =
    modelPick === "Other" ? modelOther.trim() : modelPick.trim();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMyShowcaseItem({ data: { id: itemId } })
      .then((row) => {
        if (cancelled) return;
        setItem(row);
        setAppName(row.appName);
        setCategory(
          isShowcaseCategory(row.category) ? row.category : "other",
        );
        setAuthorName(row.authorName);
        setDescription(row.description);
        setTools(
          row.tools
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        );
        setPromptStyle(
          (PROMPT_STYLES.some((s) => s.id === row.promptStyle)
            ? row.promptStyle
            : "one_shot") as PromptStyleId,
        );
        setPrompt(row.prompt);
        if (knownModels.includes(row.model)) {
          setModelPick(row.model);
          setModelOther("");
        } else {
          setModelPick("Other");
          setModelOther(row.model);
        }
        setCreationUrl(row.creationUrl);
        setImageData(row.imageData);
        setImageChanged(false);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load item.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per itemId
  }, [itemId]);

  async function onPickImage(file: File | null) {
    if (!file) return;
    setError(null);
    try {
      const data = await compressImageToDataUrl(file);
      setImageData(data);
      setImageChanged(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read image.");
    }
  }

  function addTool(raw: string) {
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setTools((prev) => {
      const next = [...prev];
      for (const p of parts) {
        if (!next.some((t) => t.toLowerCase() === p.toLowerCase())) {
          next.push(p);
        }
      }
      return next;
    });
    setToolDraft("");
  }

  function onToolKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (toolDraft.trim()) addTool(toolDraft);
      return;
    }
    if (e.key === ",") {
      e.preventDefault();
      if (toolDraft.trim()) addTool(toolDraft);
      return;
    }
    if (e.key === "Backspace" && !toolDraft && tools.length) {
      setTools((prev) => prev.slice(0, -1));
    }
  }

  function onToolChange(value: string) {
    if (value.includes(",")) {
      const parts = value.split(",");
      const complete = parts.slice(0, -1).join(",");
      const rest = parts[parts.length - 1] ?? "";
      if (complete.trim()) addTool(complete);
      setToolDraft(rest);
      return;
    }
    setToolDraft(value);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!item || !imageData) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const finalTools = toolDraft.trim()
        ? [
            ...tools,
            ...toolDraft
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          ]
        : tools;
      if (!resolvedModel) throw new Error("Pick or type the model you used.");
      if (!category) throw new Error("Pick a category for your app.");

      const updated = await updateOwnerShowcaseItem({
        data: {
          id: item.id,
          appName,
          category,
          authorName,
          description,
          tools: finalTools.join(", "),
          prompt: needsPrompt
            ? prompt
            : "Long multi-day process — no single prompt (iterated across many sessions).",
          model: resolvedModel,
          promptStyle,
          creationUrl: normalizeHttpUrl(creationUrl),
          imageData: imageChanged ? imageData : undefined,
        },
      });
      setItem(updated);
      setImageChanged(false);
      setMessage(
        updated.changeSummary
          ? `${updated.changeSummary}. Sent back for admin review.`
          : "Saved and sent back for admin review.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-bg text-fg">
        <SiteHeader active="mine" />
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-subtle">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading submission…
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-dvh bg-bg text-fg">
        <SiteHeader active="mine" />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-fg">{error || "Submission not found."}</p>
          <Link
            to="/showcase/mine"
            className="mt-6 inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm"
          >
            My submissions
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteHeader active="mine" />
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-12">
        <Link
          to="/showcase/mine"
          className="text-sm font-medium text-muted hover:text-fg"
        >
          ← My submissions
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-fg">
          Edit submission
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Saving changes sets status back to{" "}
          <span className="font-medium text-fg">pending</span> so an admin can
          re-review.
        </p>

        {item.changeSummary ? (
          <p className="mt-4 rounded-xl border border-border-glow bg-surface px-4 py-3 text-sm text-fg">
            Last changes:{" "}
            <span className="font-medium">{item.changeSummary}</span>
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="mt-8 space-y-6">
          <Field
            label="App name"
            hint="Title of your creation (shown on the showcase card)."
          >
            <input
              required
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className={inputClass}
              maxLength={80}
              placeholder="e.g. Neon Todo"
            />
          </Field>

          <fieldset>
            <legend className="text-sm font-medium text-fg">
              Category <span className="text-accent-bright">*</span>
            </legend>
            <p className="mt-0.5 text-xs text-subtle">Required</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SHOWCASE_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    category === c.id
                      ? "border-border-glow bg-accent text-accent-fg"
                      : "border-border bg-surface text-muted"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </fieldset>

          <Field label="Your display name">
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className={inputClass}
              maxLength={80}
            />
          </Field>

          <p className="rounded-xl border border-border bg-surface/50 px-4 py-3 text-sm text-muted">
            Posted as{" "}
            <span className="font-medium text-fg">@{item.authorHandle}</span>
            <span className="text-subtle"> (handle is locked to your account)</span>
          </p>

          <Field label="Photo">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface/40 px-4 py-6"
            >
              {imageData ? (
                <img
                  src={imageData}
                  alt="Preview"
                  className="max-h-48 rounded-lg border border-border object-cover"
                />
              ) : (
                <ImagePlus className="size-8 text-subtle" />
              )}
              <span className="text-sm font-medium text-fg">
                {imageChanged ? "New photo selected" : "Change photo"}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
            />
          </Field>

          <Field label="Description">
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} min-h-24 resize-y`}
              maxLength={1200}
            />
          </Field>

          <Field
            label="Tools used"
            hint="Spaces allowed. Enter or comma adds a tag."
          >
            <div className="rounded-xl border border-border bg-bg px-2.5 py-2">
              <div className="flex flex-wrap gap-1.5">
                {tools.map((tool) => (
                  <span
                    key={tool}
                    className="inline-flex items-center gap-1 rounded-full border border-border-glow bg-surface-elevated px-2.5 py-1 text-xs font-medium"
                  >
                    {tool}
                    <button
                      type="button"
                      onClick={() =>
                        setTools((prev) => prev.filter((t) => t !== tool))
                      }
                      className="rounded-full p-0.5 text-subtle hover:text-fg"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={toolDraft}
                  onChange={(e) => onToolChange(e.target.value)}
                  onKeyDown={onToolKeyDown}
                  onBlur={() => toolDraft.trim() && addTool(toolDraft)}
                  className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-sm outline-none"
                  placeholder="e.g. Grok Build web"
                />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TOOL_SUGGESTIONS.filter(
                (s) => !tools.some((t) => t.toLowerCase() === s.toLowerCase()),
              )
                .slice(0, 12)
                .map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addTool(s)}
                    className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted hover:text-fg"
                  >
                    + {s}
                  </button>
                ))}
            </div>
          </Field>

          <fieldset>
            <legend className="text-sm font-medium text-fg">
              How did you prompt?
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {PROMPT_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setPromptStyle(style.id)}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm ${
                    promptStyle === style.id
                      ? "border-border-glow bg-surface-elevated ring-2 ring-accent/30"
                      : "border-border bg-surface/40"
                  }`}
                >
                  <span className="font-medium text-fg">{style.label}</span>
                  <span className="mt-0.5 block text-[11px] text-subtle">
                    {style.hint}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          {needsPrompt ? (
            <Field label="Prompt">
              <textarea
                required
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className={`${inputClass} min-h-28 resize-y font-mono text-sm`}
                maxLength={4000}
              />
            </Field>
          ) : (
            <p className="rounded-xl border border-border bg-surface/50 px-4 py-3 text-sm text-muted">
              Multi-day process — no single prompt field.
            </p>
          )}

          <Field label="Model used">
            <div className="flex flex-wrap gap-1.5">
              {CODING_MODELS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModelPick(m)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    modelPick === m
                      ? "border-border-glow bg-accent text-accent-fg"
                      : "border-border bg-surface text-muted"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {modelPick === "Other" ? (
              <input
                required
                value={modelOther}
                onChange={(e) => setModelOther(e.target.value)}
                className={`${inputClass} mt-3`}
                maxLength={80}
              />
            ) : null}
          </Field>

          <Field label="Link to creation">
            <input
              required
              type="text"
              inputMode="url"
              value={creationUrl}
              onChange={(e) => setCreationUrl(e.target.value)}
              onBlur={() =>
                creationUrl.trim() &&
                setCreationUrl(normalizeHttpUrl(creationUrl))
              }
              className={inputClass}
            />
          </Field>

          {error ? (
            <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-xl border border-border-glow bg-surface px-4 py-3 text-sm">
              {message}{" "}
              <Link to="/showcase/mine" className="font-medium underline">
                View my posts
              </Link>
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[15px] font-semibold text-accent-fg shadow-[0_0_24px_var(--glow)] disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="size-4" />
                Save & request re-review
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-fg outline-none placeholder:text-subtle focus:border-border-glow focus:ring-2 focus:ring-accent/25";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-subtle">{hint}</p> : null}
      <div className="mt-2" id={id}>
        {children}
      </div>
    </div>
  );
}
