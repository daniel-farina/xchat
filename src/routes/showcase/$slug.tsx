import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Flag,
  Loader2,
  Share2,
  Star,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { categoryLabel, promptStyleLabel } from "@/lib/showcase-options";
import {
  createReview,
  getMyItemEngagement,
  getShowcaseItemDetail,
  reportShowcaseItem,
  setItemStars,
  type ItemStats,
  type ShowcaseReview,
} from "@/lib/showcase-engagement";
import { type ShowcaseItem } from "@/lib/showcase-server";
import { buildAppShareMeta, xShareUrl } from "@/lib/seo";
import { resolvePageOrigin } from "@/lib/site-origin";

export const Route = createFileRoute("/showcase/$slug")({
  loader: async ({ params }) => {
    const origin = await resolvePageOrigin();
    try {
      const detail = await getShowcaseItemDetail({
        data: { id: params.slug },
      });
      return { origin, detail, error: null as string | null };
    } catch (err) {
      return {
        origin,
        detail: null,
        error: err instanceof Error ? err.message : "Not found",
      };
    }
  },
  head: ({ loaderData }) => {
    const origin = loaderData?.origin ?? null;
    const item = loaderData?.detail?.item;
    const stats = loaderData?.detail?.stats;
    if (!item) {
      return {
        meta: [
          { title: "App not found — X Vibe Chat" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const pathSlug = item.slug || item.id;
    const mimeMatch = /^data:(image\/[a-zA-Z0-9.+-]+);/i.exec(
      item.imageData || "",
    );
    const share = buildAppShareMeta({
      origin,
      appName: item.appName,
      description: item.description,
      authorHandle: item.authorHandle,
      model: item.model,
      category: item.category,
      avgStars: stats?.avgStars ?? null,
      path: `/showcase/${pathSlug}`,
      slug: pathSlug,
      imageMime: mimeMatch?.[1] ?? null,
    });
    return {
      meta: share.meta,
      links: share.links,
    };
  },
  component: AppDetailPage,
});

function AppDetailPage() {
  const { slug } = Route.useParams();
  const { detail, error: loadError, origin } = Route.useLoaderData();
  const { user, isPending } = useCurrentUserState();

  const [item, setItem] = useState<ShowcaseItem | null>(detail?.item ?? null);
  const [stats, setStats] = useState<ItemStats | null>(detail?.stats ?? null);
  const [reviews, setReviews] = useState<ShowcaseReview[]>(
    detail?.reviews ?? [],
  );
  const [myStars, setMyStars] = useState<number | null>(null);
  const [hasReported, setHasReported] = useState(false);
  const [error, setError] = useState<string | null>(loadError);
  const [busyStars, setBusyStars] = useState(false);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewStars, setReviewStars] = useState<number | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMsg, setReportMsg] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  const friendly = item?.slug || slug;

  useEffect(() => {
    if (detail) {
      setItem(detail.item);
      setStats(detail.stats);
      setReviews(detail.reviews);
      setError(null);
    }
  }, [detail]);

  useEffect(() => {
    if (!user || !slug) return;
    let cancelled = false;
    getMyItemEngagement({ data: { id: slug } })
      .then((eng) => {
        if (cancelled) return;
        setMyStars(eng.myStars);
        setHasReported(eng.hasReported);
        setReportDone(eng.hasReported);
      })
      .catch(() => {
        /* optional */
      });
    return () => {
      cancelled = true;
    };
  }, [user, slug]);

  const pageUrl = useMemo(() => {
    const base =
      origin ||
      (typeof window !== "undefined" ? window.location.origin : "");
    return `${base.replace(/\/$/, "")}/showcase/${friendly}`;
  }, [origin, friendly]);

  const shareHref = useMemo(() => {
    if (!item) return "#";
    const text = `Check out ${item.appName} by @${item.authorHandle} on X Vibe Chat Showcase`;
    return xShareUrl(text, pageUrl);
  }, [item, pageUrl]);

  async function rate(stars: number) {
    if (!user) {
      window.location.href = `/login?redirect=${encodeURIComponent(`/showcase/${friendly}`)}`;
      return;
    }
    setBusyStars(true);
    setError(null);
    try {
      const res = await setItemStars({ data: { itemId: slug, stars } });
      setMyStars(res.myStars);
      setStats(res.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save stars.");
    } finally {
      setBusyStars(false);
    }
  }

  async function onReview(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      window.location.href = `/login?redirect=${encodeURIComponent(`/showcase/${friendly}`)}`;
      return;
    }
    setReviewBusy(true);
    setError(null);
    setReviewMsg(null);
    try {
      const res = await createReview({
        data: {
          itemId: slug,
          body: reviewBody,
          stars: reviewStars,
        },
      });
      setReviews((prev) => [res.review, ...prev]);
      setStats(res.stats);
      if (res.myStars != null) setMyStars(res.myStars);
      setReviewBody("");
      setReviewStars(null);
      setReviewMsg("Review posted. Thanks!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post review.");
    } finally {
      setReviewBusy(false);
    }
  }

  async function onReport(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      window.location.href = `/login?redirect=${encodeURIComponent(`/showcase/${friendly}`)}`;
      return;
    }
    setReportBusy(true);
    setError(null);
    try {
      await reportShowcaseItem({
        data: { itemId: slug, message: reportMsg },
      });
      setHasReported(true);
      setReportDone(true);
      setReportOpen(false);
      setReportMsg("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send report.");
    } finally {
      setReportBusy(false);
    }
  }

  if (!item) {
    return (
      <div className="min-h-dvh bg-bg text-fg">
        <SiteHeader active="showcase" />
        <main className="mx-auto max-w-lg px-4 py-20 text-center">
          <p className="text-lg font-medium text-fg">
            {error || "App not found"}
          </p>
          <Link
            to="/showcase"
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm"
          >
            <ArrowLeft className="size-4" />
            Back to showcase
          </Link>
        </main>
      </div>
    );
  }

  const tools = item.tools
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const isMultiDay = item.promptStyle === "multi_day";

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteHeader active="showcase" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          to="/showcase"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Showcase
        </Link>

        <article className="mt-6 overflow-hidden rounded-3xl border border-border bg-surface/80">
          <div className="aspect-[16/10] bg-bg sm:aspect-[2/1]">
            <img
              src={item.imageData}
              alt={item.appName}
              className="size-full object-cover"
            />
          </div>

          <div className="p-5 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
                  {item.appName}
                </h1>
                <p className="mt-1 text-sm text-muted">
                  by {item.authorName}{" "}
                  <a
                    href={`https://x.com/${item.authorHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-bright hover:underline"
                  >
                    @{item.authorHandle}
                  </a>
                </p>
                <p className="mt-1 font-mono text-[11px] text-subtle">
                  /showcase/{item.slug}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={shareHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-bg px-3.5 text-sm font-medium text-fg hover:border-border-glow"
                >
                  <Share2 className="size-4" aria-hidden />
                  Share on X
                </a>
                <a
                  href={item.creationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-3.5 text-sm font-semibold text-accent-fg hover:bg-accent-bright"
                >
                  Open app
                  <ArrowUpRight className="size-4" aria-hidden />
                </a>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <StarRow
                value={stats?.avgStars ?? 0}
                count={stats?.ratingCount ?? 0}
                label="Community"
              />
              <span className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-medium text-muted">
                {categoryLabel(item.category)}
              </span>
              {item.model ? (
                <span className="rounded-full border border-border-glow bg-bg px-2.5 py-1 text-xs font-semibold text-accent-bright">
                  {item.model}
                </span>
              ) : null}
              <span className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs text-muted">
                {promptStyleLabel(item.promptStyle)}
              </span>
            </div>

            <p className="mt-5 text-base leading-relaxed text-muted">
              {item.description}
            </p>

            {tools.length > 0 ? (
              <div className="mt-5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">
                  Tools
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tools.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border bg-surface-elevated px-2.5 py-1 text-xs text-fg"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 rounded-2xl border border-border bg-bg/50 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">
                Prompt
              </h2>
              {isMultiDay ? (
                <p className="mt-2 text-sm italic text-muted">
                  Long multi-day process — no single prompt.
                </p>
              ) : (
                <p className="mt-2 whitespace-pre-wrap font-mono text-sm leading-relaxed text-muted">
                  {item.prompt}
                </p>
              )}
            </div>

            <section className="mt-8 border-t border-border pt-8">
              <h2 className="text-lg font-semibold text-fg">Your rating</h2>
              <p className="mt-1 text-sm text-muted">
                Tap stars anytime — no written review required.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <StarPicker
                  value={myStars}
                  disabled={busyStars || isPending}
                  onChange={(s) => void rate(s)}
                />
                {myStars ? (
                  <span className="text-xs text-subtle">
                    You rated {myStars}/5
                  </span>
                ) : null}
                {!user && !isPending ? (
                  <Link
                    to="/login"
                    search={{ redirect: `/showcase/${friendly}` }}
                    className="text-xs font-medium text-accent-bright hover:underline"
                  >
                    Sign in to rate
                  </Link>
                ) : null}
              </div>
            </section>

            <section className="mt-10 border-t border-border pt-8">
              <h2 className="text-lg font-semibold text-fg">
                Reviews
                {stats ? (
                  <span className="ml-2 text-sm font-normal text-subtle">
                    ({stats.reviewCount})
                  </span>
                ) : null}
              </h2>

              {user ? (
                <form onSubmit={onReview} className="mt-4 space-y-3">
                  <p className="text-xs text-subtle">
                    Optional stars with your review (or rate above without
                    writing).
                  </p>
                  <StarPicker
                    value={reviewStars}
                    onChange={setReviewStars}
                    disabled={reviewBusy}
                  />
                  <textarea
                    required
                    value={reviewBody}
                    onChange={(e) => setReviewBody(e.target.value)}
                    maxLength={2000}
                    rows={4}
                    placeholder="What did you like? Anything to watch out for?"
                    className="w-full resize-y rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-fg outline-none placeholder:text-subtle focus:border-border-glow focus:ring-2 focus:ring-accent/25"
                  />
                  <button
                    type="submit"
                    disabled={reviewBusy || reviewBody.trim().length < 8}
                    className="inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50"
                  >
                    {reviewBusy ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Posting…
                      </>
                    ) : (
                      "Post review"
                    )}
                  </button>
                  {reviewMsg ? (
                    <p className="text-sm text-accent-bright">{reviewMsg}</p>
                  ) : null}
                </form>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  <Link
                    to="/login"
                    search={{ redirect: `/showcase/${friendly}` }}
                    className="font-medium text-accent-bright hover:underline"
                  >
                    Sign in
                  </Link>{" "}
                  to leave a review.
                </p>
              )}

              <ul className="mt-6 space-y-4">
                {reviews.length === 0 ? (
                  <li className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-subtle">
                    No reviews yet — be the first.
                  </li>
                ) : (
                  reviews.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-xl border border-border bg-bg/40 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-fg">
                          {r.authorName}
                        </span>
                        {r.authorHandle ? (
                          <span className="text-xs text-subtle">
                            @{r.authorHandle}
                          </span>
                        ) : null}
                        {r.stars != null ? (
                          <span className="inline-flex items-center gap-0.5 text-xs text-accent-bright">
                            <Star className="size-3 fill-current" />
                            {r.stars}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                        {r.body}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="mt-10 border-t border-border pt-8">
              <button
                type="button"
                onClick={() => setReportOpen((v) => !v)}
                className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-fg"
              >
                <Flag className="size-4" aria-hidden />
                Report as malicious
              </button>
              {reportDone || hasReported ? (
                <p className="mt-2 text-xs text-subtle">
                  Report received — admins will review it.
                </p>
              ) : null}
              {reportOpen && !hasReported ? (
                <form onSubmit={onReport} className="mt-3 max-w-md space-y-3">
                  {!user ? (
                    <p className="text-sm text-muted">
                      <Link
                        to="/login"
                        search={{ redirect: `/showcase/${friendly}` }}
                        className="text-accent-bright hover:underline"
                      >
                        Sign in
                      </Link>{" "}
                      to send a report.
                    </p>
                  ) : (
                    <>
                      <textarea
                        required
                        value={reportMsg}
                        onChange={(e) => setReportMsg(e.target.value)}
                        maxLength={500}
                        rows={3}
                        placeholder="Briefly describe the issue (scam, malware, phishing…)"
                        className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-border-glow"
                      />
                      <button
                        type="submit"
                        disabled={reportBusy || reportMsg.trim().length < 4}
                        className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium text-fg disabled:opacity-50"
                      >
                        {reportBusy ? "Sending…" : "Submit report"}
                      </button>
                    </>
                  )}
                </form>
              ) : null}
            </section>

            {error ? (
              <p className="mt-6 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
                {error}
              </p>
            ) : null}
          </div>
        </article>
      </main>
    </div>
  );
}

function StarRow({
  value,
  count,
  label,
}: {
  value: number;
  count: number;
  label: string;
}) {
  const filled = Math.round(value);
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`size-3.5 ${
              n <= filled
                ? "fill-accent text-accent"
                : "text-subtle opacity-40"
            }`}
            aria-hidden
          />
        ))}
      </div>
      <span className="text-xs font-medium text-fg">
        {count > 0 ? value.toFixed(1) : "—"}
      </span>
      <span className="text-[10px] text-subtle">
        {label}
        {count > 0 ? ` · ${count}` : ""}
      </span>
    </div>
  );
}

function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? value ?? 0;
  return (
    <div
      className="flex gap-1"
      role="radiogroup"
      aria-label="Star rating"
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          className="rounded-md p-1.5 transition-colors hover:bg-surface-elevated disabled:opacity-50"
        >
          <Star
            className={`size-6 transition-colors ${
              n <= active
                ? "fill-accent text-accent"
                : "text-subtle opacity-50"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
