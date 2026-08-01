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
import { ImagePlus, Loader2, Pencil, Send, X } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { compressImageToDataUrl } from "@/lib/image-compress";
import {
  CODING_MODELS,
  normalizeHttpUrl,
  PROMPT_STYLES,
  promptStyleNeedsText,
  SHOWCASE_CATEGORIES,
  TOOL_SUGGESTIONS,
  type PromptStyleId,
  type ShowcaseCategoryId,
} from "@/lib/showcase-options";
import {
  createShowcaseItem,
  getShowcaseSession,
  listMyShowcase,
  setMyHandle,
  type ShowcaseItem,
} from "@/lib/showcase-server";

export const Route = createFileRoute("/showcase/submit")({
  component: SubmitPage,
});

function SubmitPage() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    return (
      <div className="min-h-dvh bg-bg text-fg">
        <SiteHeader active="submit" />
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-subtle">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Checking session…
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" search={{ redirect: "/showcase/submit" }} />;
  }

  return <SubmitForm />;
}

function SubmitForm() {
  const { user } = useCurrentUserState();
  const [xHandle, setXHandle] = useState("");
  const [handleReady, setHandleReady] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [appName, setAppName] = useState("");
  const [category, setCategory] = useState<ShowcaseCategoryId | null>(null);
  const [description, setDescription] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const [toolDraft, setToolDraft] = useState("");
  const [promptStyle, setPromptStyle] = useState<PromptStyleId>("one_shot");
  const [prompt, setPrompt] = useState("");
  const [modelPick, setModelPick] = useState("Grok 4.5");
  const [modelOther, setModelOther] = useState("");
  const [creationUrl, setCreationUrl] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [mine, setMine] = useState<ShowcaseItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllTools, setShowAllTools] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const needsPrompt = promptStyleNeedsText(promptStyle);
  const resolvedModel =
    modelPick === "Other" ? modelOther.trim() : modelPick.trim();

  const unusedTools = TOOL_SUGGESTIONS.filter(
    (s) => !tools.some((t) => t.toLowerCase() === s.toLowerCase()),
  );
  const visibleTools = showAllTools ? unusedTools : unusedTools.slice(0, 16);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getShowcaseSession(), listMyShowcase()])
      .then(([session, items]) => {
        if (cancelled) return;
        if (session.xHandle) {
          setXHandle(session.xHandle);
          setHandleReady(true);
        }
        if (session.displayName) setDisplayName(session.displayName);
        setMine(items);
      })
      .catch(() => {
        /* form still usable */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onPickImage(file: File | null) {
    if (!file) return;
    setError(null);
    try {
      const data = await compressImageToDataUrl(file);
      setImageData(data);
      setImageName(file.name);
    } catch (err) {
      setImageData(null);
      setImageName(null);
      setError(err instanceof Error ? err.message : "Could not read image.");
    }
  }

  function addTool(raw: string) {
    // Only comma splits multiple tags — spaces are part of the name (e.g. "Grok Build")
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setTools((prev) => {
      const next = [...prev];
      for (const p of parts) {
        if (
          !next.some((t) => t.toLowerCase() === p.toLowerCase()) &&
          next.join(", ").length + p.length < 380
        ) {
          next.push(p);
        }
      }
      return next;
    });
    setToolDraft("");
  }

  function onToolKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Commit on Enter or comma only — space allowed inside names like "Grok Build"
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
    // If user pastes "A, B, C" commit completed segments, keep trailing draft
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

  async function ensureHandle(): Promise<void> {
    if (handleReady && xHandle) return;
    const result = await setMyHandle({
      data: { handle: xHandle, displayName },
    });
    setHandleReady(true);
    setXHandle(result.xHandle);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!imageData) throw new Error("Add a photo of your creation.");
      if (!tools.length && !toolDraft.trim()) {
        throw new Error("Add at least one tool.");
      }
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

      await ensureHandle();
      const item = await createShowcaseItem({
        data: {
          appName,
          category,
          description,
          tools: finalTools.join(", "),
          prompt: needsPrompt
            ? prompt
            : "Long multi-day process — no single prompt (iterated across many sessions).",
          model: resolvedModel,
          promptStyle,
          creationUrl: normalizeHttpUrl(creationUrl),
          imageData,
          authorName: displayName,
          authorHandle: xHandle,
        },
      });
      setMessage(
        "Submitted! An admin will review it before it appears publicly.",
      );
      setMine((prev) => [item, ...prev]);
      setAppName("");
      setCategory(null);
      setDescription("");
      setTools([]);
      setToolDraft("");
      setPrompt("");
      setPromptStyle("one_shot");
      setModelPick("Grok 4.5");
      setModelOther("");
      setCreationUrl("");
      setImageData(null);
      setImageName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    !busy &&
    Boolean(imageData) &&
    appName.trim().length >= 2 &&
    Boolean(category) &&
    description.trim().length >= 8 &&
    (tools.length > 0 || toolDraft.trim().length > 0) &&
    Boolean(resolvedModel) &&
    Boolean(creationUrl.trim()) &&
    (needsPrompt ? prompt.trim().length > 0 : true) &&
    (handleReady || xHandle.trim().length > 0);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteHeader active="submit" />
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-fg">
          Submit a creation
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Share a photo, stack, model, and how you prompted. Submissions stay
          private until an admin approves them. You can edit later — edits go
          back to review.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-6">
          {!handleReady ? (
            <Field
              label="Your X handle"
              hint="Used to show you as the creator. Admins are recognized by handle."
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-subtle">@</span>
                <input
                  required
                  value={xHandle}
                  onChange={(e) =>
                    setXHandle(e.target.value.replace(/^@+/, "").trim())
                  }
                  placeholder="yourhandle"
                  className={inputClass}
                  maxLength={15}
                  autoComplete="username"
                  pattern="[A-Za-z0-9_]{1,15}"
                />
              </div>
            </Field>
          ) : (
            <p className="rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm text-muted">
              Posting as{" "}
              <span className="font-medium text-fg">@{xHandle}</span>
            </p>
          )}

          <Field label="Display name">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
              maxLength={80}
              placeholder="How your name appears"
            />
          </Field>

          <Field label="Photo" hint="Screenshot or photo of the creation.">
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface/40 px-4 py-8 text-sm text-muted transition-colors hover:border-border-glow hover:bg-surface"
              >
                {imageData ? (
                  <img
                    src={imageData}
                    alt="Preview"
                    className="max-h-48 rounded-lg border border-border object-cover"
                  />
                ) : (
                  <>
                    <ImagePlus className="size-8 text-subtle" aria-hidden />
                    <span className="font-medium text-fg">
                      Choose or drop a photo
                    </span>
                    <span className="text-xs text-subtle">
                      PNG, JPG — compressed automatically
                    </span>
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
              />
              {imageName ? (
                <p className="text-xs text-subtle">{imageName}</p>
              ) : null}
            </div>
          </Field>

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
              placeholder="e.g. Neon Todo, Vibe Portfolio"
            />
          </Field>

          <fieldset>
            <legend className="text-sm font-medium text-fg">
              Category <span className="text-accent-bright">*</span>
            </legend>
            <p className="mt-0.5 text-xs text-subtle">
              Required — one click so people can browse the showcase.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SHOWCASE_CATEGORIES.map((c) => {
                const selected = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    title={c.hint}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? "border-border-glow bg-accent text-accent-fg"
                        : "border-border bg-surface text-muted hover:border-border-glow hover:text-fg"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            {!category ? (
              <p className="mt-2 text-xs text-subtle">Select a category to continue.</p>
            ) : null}
          </fieldset>

          <Field label="Description">
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} min-h-24 resize-y`}
              maxLength={1200}
              placeholder="What did you make? What was fun or surprising?"
            />
            <CharCount value={description} max={1200} />
          </Field>

          <Field
            label="Tools used"
            hint="Names can include spaces (e.g. Grok Build). Press Enter or comma to add a tag."
          >
            <div className="rounded-xl border border-border bg-bg px-2.5 py-2 focus-within:border-border-glow focus-within:ring-2 focus-within:ring-accent/25">
              <div className="flex flex-wrap gap-1.5">
                {tools.map((tool) => (
                  <span
                    key={tool}
                    className="inline-flex items-center gap-1 rounded-full border border-border-glow bg-surface-elevated px-2.5 py-1 text-xs font-medium text-fg"
                  >
                    {tool}
                    <button
                      type="button"
                      aria-label={`Remove ${tool}`}
                      onClick={() =>
                        setTools((prev) => prev.filter((t) => t !== tool))
                      }
                      className="rounded-full p-0.5 text-subtle hover:bg-bg hover:text-fg"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={toolDraft}
                  onChange={(e) => onToolChange(e.target.value)}
                  onKeyDown={onToolKeyDown}
                  onBlur={() => {
                    if (toolDraft.trim()) addTool(toolDraft);
                  }}
                  placeholder={
                    tools.length ? "Add another…" : "e.g. Grok Build CLI"
                  }
                  className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-sm text-fg outline-none placeholder:text-subtle"
                />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {visibleTools.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addTool(s)}
                  className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:border-border-glow hover:text-fg"
                >
                  + {s}
                </button>
              ))}
              {unusedTools.length > 16 ? (
                <button
                  type="button"
                  onClick={() => setShowAllTools((v) => !v)}
                  className="rounded-full border border-border-glow bg-bg px-2.5 py-1 text-[11px] font-medium text-accent-bright"
                >
                  {showAllTools
                    ? "Show less"
                    : `+${unusedTools.length - 16} more`}
                </button>
              ) : null}
            </div>
          </Field>

          <fieldset>
            <legend className="text-sm font-medium text-fg">
              How did you prompt?
            </legend>
            <p className="mt-0.5 text-xs text-subtle">
              Pick the workflow that best matches this build.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {PROMPT_STYLES.map((style) => {
                const selected = promptStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setPromptStyle(style.id)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      selected
                        ? "border-border-glow bg-surface-elevated ring-2 ring-accent/30"
                        : "border-border bg-surface/40 hover:border-border-glow"
                    }`}
                  >
                    <span className="block text-sm font-medium text-fg">
                      {style.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-subtle">
                      {style.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {needsPrompt ? (
            <Field
              label="Prompt"
              hint="The main prompt or instructions you used (or a representative one)."
            >
              <textarea
                required
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className={`${inputClass} min-h-28 resize-y font-mono text-sm`}
                maxLength={4000}
                placeholder="Paste the key prompt here…"
              />
              <CharCount value={prompt} max={4000} />
            </Field>
          ) : (
            <div className="rounded-xl border border-border bg-surface/50 px-4 py-3 text-sm text-muted">
              <p className="font-medium text-fg">No single prompt needed</p>
              <p className="mt-1 text-xs leading-relaxed text-subtle">
                Long multi-day builds usually span many chats. We'll note
                that on your card instead of showing one prompt.
              </p>
            </div>
          )}

          <Field
            label="Model used"
            hint="Which coding / AI model powered this? Pick from the list or choose Other."
          >
            <div className="flex flex-wrap gap-1.5">
              {CODING_MODELS.map((m) => {
                const selected = modelPick === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModelPick(m)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? "border-border-glow bg-accent text-accent-fg"
                        : "border-border bg-surface text-muted hover:border-border-glow hover:text-fg"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            {modelPick === "Other" ? (
              <input
                required
                value={modelOther}
                onChange={(e) => setModelOther(e.target.value)}
                className={`${inputClass} mt-3`}
                maxLength={80}
                placeholder="Type the model name"
              />
            ) : null}
          </Field>

          <Field
            label="Link to creation"
            hint="Demo, post, repo, or share link — https:// is added automatically."
          >
            <input
              required
              type="text"
              inputMode="url"
              value={creationUrl}
              onChange={(e) => setCreationUrl(e.target.value)}
              onBlur={() => {
                if (creationUrl.trim()) {
                  setCreationUrl(normalizeHttpUrl(creationUrl));
                }
              }}
              className={inputClass}
              placeholder="x.com/… or github.com/… or your-demo.vercel.app"
            />
          </Field>

          {error ? (
            <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-fg">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-xl border border-border-glow bg-surface px-4 py-3 text-sm text-fg">
              {message}{" "}
              <Link
                to="/showcase"
                className="font-medium text-accent-bright underline"
              >
                View showcase
              </Link>
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-accent px-5 text-[15px] font-semibold text-accent-fg shadow-[0_0_24px_var(--glow)] transition-[transform,opacity,box-shadow] hover:bg-accent-bright hover:shadow-[0_0_32px_var(--glow)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Submitting for review…
              </>
            ) : (
              <>
                <Send
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
                Submit for review
              </>
            )}
          </button>
          <p className="text-center text-[11px] text-subtle">
            An admin will approve before it appears in the public showcase.
          </p>
        </form>

        {mine.length > 0 ? (
          <section className="mt-12 border-t border-border pt-8">
            <h2 className="text-lg font-semibold text-fg">Your submissions</h2>
            <ul className="mt-4 space-y-3">
              {mine.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-xl border border-border bg-surface/60 p-3"
                >
                  <img
                    src={item.imageData}
                    alt=""
                    className="size-16 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">
                      {item.appName}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                      {item.description}
                    </p>
                    <p className="mt-1 text-xs text-subtle">
                      {item.model ? (
                        <span className="mr-2 font-medium text-muted">
                          {item.model}
                        </span>
                      ) : null}
                      Status:{" "}
                      <span className="font-medium capitalize text-muted">
                        {item.status}
                      </span>
                    </p>
                    {item.changeSummary ? (
                      <p className="mt-1 text-[11px] text-accent-bright">
                        {item.changeSummary}
                      </p>
                    ) : null}
                    <Link
                      to="/showcase/edit/$itemId"
                      params={{ itemId: item.id }}
                      className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-fg hover:border-border-glow"
                    >
                      <Pencil className="size-3" aria-hidden />
                      Edit
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-fg outline-none transition-[border-color,box-shadow] placeholder:text-subtle focus:border-border-glow focus:ring-2 focus:ring-accent/25";

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <p className="mt-1 text-right text-[10px] tabular-nums text-subtle">
      {value.length}/{max}
    </p>
  );
}

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
    <div className="block">
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
