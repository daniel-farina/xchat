import { createFileRoute, Link } from "@tanstack/react-router";
import { buildShareMeta } from "@/lib/seo";
import { resolvePageOrigin } from "@/lib/site-origin";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ImageIcon,
  Loader2,
  MessageSquare,
  Star,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import {
  categoryLabel,
  isShowcaseCategory,
  promptStyleLabel,
  SHOWCASE_CATEGORIES,
  type ShowcaseCategoryId,
} from "@/lib/showcase-options";
import {
  listApprovedShowcase,
  type ShowcaseItem,
} from "@/lib/showcase-server";

export const Route = createFileRoute("/showcase/")({
  loader: async () => ({
    origin: await resolvePageOrigin(),
  }),
  head: ({ loaderData }) => {
    const share = buildShareMeta({
      origin: loaderData?.origin,
      title: "Showcase — X Vibe Chat",
      description:
        "Community builds, experiments, and vibe-coded creations from X Vibe Chat. Rate, review, and share.",
      path: "/showcase",
    });
    return { meta: share.meta, links: share.links };
  },
  component: ShowcasePage,
});

type SortKey = "rating" | "reviews" | "newest" | "name";

function ShowcasePage() {
  const [items, setItems] = useState<ShowcaseItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("rating");
  const [category, setCategory] = useState<ShowcaseCategoryId | "all">("all");

  useEffect(() => {
    let cancelled = false;
    listApprovedShowcase()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load showcase.",
          );
          setItems([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    if (!items) return [];
    let list = [...items];
    if (category !== "all") {
      list = list.filter((i) => i.category === category);
    }
    list.sort((a, b) => {
      switch (sort) {
        case "rating": {
          const av = a.avgStars ?? -1;
          const bv = b.avgStars ?? -1;
          if (bv !== av) return bv - av;
          if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
          return b.createdAt.localeCompare(a.createdAt);
        }
        case "reviews":
          if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
          return (b.avgStars ?? 0) - (a.avgStars ?? 0);
        case "name":
          return a.appName.localeCompare(b.appName, undefined, {
            sensitivity: "base",
          });
        case "newest":
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
    return list;
  }, [items, sort, category]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of items ?? []) {
      const c = isShowcaseCategory(i.category) ? i.category : "other";
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return map;
  }, [items]);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteHeader active="showcase" />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent-bright">
              Community
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
              Showcase
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              Builds from the group — filter by category, sorted by stars by
              default.
            </p>
          </div>
          <Link
            to="/showcase/submit"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-fg transition-[transform,background-color] hover:bg-accent-bright active:scale-[0.98]"
          >
            Submit yours
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>

        {/* Sort */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-subtle">
              Sort
            </span>
            {(
              [
                ["rating", "Top rated"],
                ["reviews", "Most reviews"],
                ["newest", "Newest"],
                ["name", "Name A–Z"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  sort === key
                    ? "border-border-glow bg-accent text-accent-fg"
                    : "border-border bg-surface text-muted hover:text-fg"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {items ? (
            <p className="text-xs text-subtle">
              {visible.length} of {items.length} apps
            </p>
          ) : null}
        </div>

        {/* Categories */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
              category === "all"
                ? "border-border-glow bg-surface-elevated text-fg"
                : "border-border bg-bg text-muted hover:text-fg"
            }`}
          >
            All
            {items ? (
              <span className="ml-1 text-subtle">({items.length})</span>
            ) : null}
          </button>
          {SHOWCASE_CATEGORIES.map((c) => {
            const count = categoryCounts.get(c.id) ?? 0;
            if (items && items.length > 0 && count === 0) return null;
            return (
              <button
                key={c.id}
                type="button"
                title={c.hint}
                onClick={() => setCategory(c.id)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                  category === c.id
                    ? "border-border-glow bg-surface-elevated text-fg"
                    : "border-border bg-bg text-muted hover:text-fg"
                }`}
              >
                {c.label}
                {count > 0 ? (
                  <span className="ml-1 text-subtle">({count})</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="mt-8 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
            {error}
          </p>
        ) : null}

        {items === null ? (
          <div className="mt-16 flex items-center justify-center gap-2 text-sm text-subtle">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading creations…
          </div>
        ) : items.length === 0 ? (
          <div className="mt-14 rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-16 text-center">
            <ImageIcon className="mx-auto size-8 text-subtle" aria-hidden />
            <p className="mt-4 text-base font-medium text-fg">
              Nothing approved yet
            </p>
            <p className="mt-2 text-sm text-muted">
              Be the first — submit a creation and an admin will review it.
            </p>
            <Link
              to="/showcase/submit"
              className="mt-6 inline-flex h-10 items-center rounded-xl border border-border bg-bg px-4 text-sm font-medium text-fg hover:border-border-glow"
            >
              Submit a creation
            </Link>
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-14 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm text-muted">
              No apps in {categoryLabel(category === "all" ? "other" : category)}{" "}
              yet.
            </p>
            <button
              type="button"
              onClick={() => setCategory("all")}
              className="mt-4 text-sm font-medium text-accent-bright hover:underline"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((item) => (
              <ShowcaseCard key={item.id} item={item} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function ShowcaseCard({ item }: { item: ShowcaseItem }) {
  const toolList = item.tools
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const avg = item.avgStars;
  const filled = avg != null ? Math.round(avg) : 0;

  return (
    <li>
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface/70 transition-colors hover:border-border-glow">
        <Link
          to="/showcase/$slug"
          params={{ slug: item.slug || item.id }}
          className="block overflow-hidden bg-bg"
        >
          <div className="relative aspect-[4/3]">
            <img
              src={item.imageData}
              alt={item.appName}
              className="size-full object-cover transition-transform duration-300 hover:scale-[1.02]"
              loading="lazy"
            />
            <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-bg/90 px-2 py-0.5 text-[10px] font-medium text-fg backdrop-blur-sm">
                <span className="inline-flex" aria-hidden>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`size-2.5 ${
                        avg != null && n <= filled
                          ? "fill-accent text-accent"
                          : "text-subtle opacity-40"
                      }`}
                    />
                  ))}
                </span>
                <span className="tabular-nums">
                  {avg != null ? avg.toFixed(1) : "—"}
                </span>
                <span className="text-subtle">
                  ({item.ratingCount})
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-bg/90 px-2 py-0.5 text-[10px] font-medium text-fg backdrop-blur-sm">
                <MessageSquare className="size-2.5 text-subtle" aria-hidden />
                {item.reviewCount}
              </span>
            </div>
          </div>
        </Link>
        <div className="flex flex-1 flex-col p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/showcase/$slug"
              params={{ slug: item.slug || item.id }}
              className="text-base font-semibold tracking-tight text-fg hover:underline"
            >
              {item.appName}
            </Link>
            <span className="rounded-full border border-border bg-bg px-2 py-0.5 text-[10px] font-medium text-muted">
              {categoryLabel(item.category)}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {item.authorName}
            <Link
              to="/showcase/builder/$handle"
              params={{ handle: item.authorHandle }}
              className="ml-1 text-subtle hover:text-accent-bright hover:underline"
            >
              @{item.authorHandle}
            </Link>
          </p>
          <Link
            to="/showcase/$slug"
            params={{ slug: item.slug || item.id }}
            className="mt-2 flex flex-1 flex-col"
          >
            <p className="line-clamp-3 text-sm leading-relaxed text-muted">
              {item.description}
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.model ? (
                <span className="rounded-full border border-border-glow bg-bg px-2 py-0.5 text-[10px] font-semibold text-accent-bright">
                  {item.model}
                </span>
              ) : null}
              <span className="rounded-full border border-border bg-bg px-2 py-0.5 text-[10px] font-medium text-muted">
                {promptStyleLabel(item.promptStyle)}
              </span>
            </div>

            {toolList.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {toolList.slice(0, 4).map((tool) => (
                  <span
                    key={tool}
                    className="rounded-full border border-border/80 bg-surface-elevated px-2 py-0.5 text-[10px] text-subtle"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            ) : null}

            <span className="mt-4 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg text-sm font-medium text-fg">
              View details
              <ArrowUpRight className="size-3.5" aria-hidden />
            </span>
          </Link>
        </div>
      </article>
    </li>
  );
}
