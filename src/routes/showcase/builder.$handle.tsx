import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  ImageIcon,
  MessageSquare,
  Share2,
  Star,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { normalizeHandle } from "@/lib/admins";
import { categoryLabel, promptStyleLabel } from "@/lib/showcase-options";
import {
  listApprovedShowcaseByHandle,
  type ShowcaseItem,
} from "@/lib/showcase-server";
import {
  builderAnnounceText,
  builderPresencePath,
  buildBuilderShareMeta,
  xShareUrl,
} from "@/lib/seo";
import { resolvePageOrigin } from "@/lib/site-origin";

export const Route = createFileRoute("/showcase/builder/$handle")({
  loader: async ({ params }) => {
    const origin = await resolvePageOrigin();
    const handle = normalizeHandle(params.handle ?? "");
    try {
      const items = await listApprovedShowcaseByHandle({
        data: { handle },
      });
      return { origin, handle, items, error: null as string | null };
    } catch (err) {
      return {
        origin,
        handle,
        items: [] as ShowcaseItem[],
        error: err instanceof Error ? err.message : "Failed to load builder apps.",
      };
    }
  },
  head: ({ loaderData }) => {
    const handle = loaderData?.handle || "builder";
    const items = loaderData?.items ?? [];
    const path = builderPresencePath(handle);
    const share = buildBuilderShareMeta({
      origin: loaderData?.origin,
      handle,
      displayName: items[0]?.authorName ?? null,
      buildCount: items.length,
      path,
    });
    return { meta: share.meta, links: share.links };
  },
  component: BuilderPresencePage,
});

function BuilderPresencePage() {
  const { handle, items, error, origin } = Route.useLoaderData() as {
    handle: string;
    items: ShowcaseItem[];
    error: string | null;
    origin: string | null;
  };
  const [copied, setCopied] = useState(false);

  const displayName = items[0]?.authorName ?? handle;
  const pagePath = builderPresencePath(handle);
  const pageUrl = useMemo(() => {
    const base =
      origin ||
      (typeof window !== "undefined" ? window.location.origin : "");
    return `${base.replace(/\/$/, "")}${pagePath}`;
  }, [origin, pagePath]);

  const announce = useMemo(
    () =>
      builderAnnounceText({
        handle,
        builderUrl: pageUrl,
      }),
    [handle, pageUrl],
  );

  const shareHref = useMemo(
    () => xShareUrl(announce, pageUrl),
    [announce, pageUrl],
  );

  async function copyAnnounce() {
    try {
      await navigator.clipboard.writeText(announce);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteHeader active="showcase" />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Link
          to="/showcase"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Showcase
        </Link>

        <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent-bright">
              Builder presence
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
              {displayName}
            </h1>
            <p className="mt-2 text-sm text-muted sm:text-base">
              <a
                href={`https://x.com/${handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent-bright hover:underline"
              >
                @{handle}
              </a>
              <span className="text-subtle">
                {" "}
                · {items.length} approved{" "}
                {items.length === 1 ? "build" : "builds"} in the showcase
              </span>
            </p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
              Public page for what this builder has shipped. Share in X Chat or
              Buzz — presence only, no payment required.
            </p>
            <p className="mt-1 font-mono text-[11px] text-subtle">{pagePath}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyAnnounce()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-sm font-medium text-fg hover:border-border-glow"
            >
              {copied ? (
                <Check className="size-4 text-accent-bright" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              {copied ? "Copied announce" : "Copy chat announce"}
            </button>
            <a
              href={shareHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-bg px-3.5 text-sm font-medium text-fg hover:border-border-glow"
            >
              <Share2 className="size-4" aria-hidden />
              Share builder
            </a>
            <a
              href={`https://x.com/${handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-3.5 text-sm font-semibold text-accent-fg hover:bg-accent-bright"
            >
              Open on X
              <ExternalLink className="size-4" aria-hidden />
            </a>
          </div>
        </header>

        {error ? (
          <p className="mt-8 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
            {error}
          </p>
        ) : null}

        {!error && items.length === 0 ? (
          <div className="mt-14 rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-16 text-center">
            <ImageIcon className="mx-auto size-8 text-subtle" aria-hidden />
            <p className="mt-4 text-base font-medium text-fg">
              No approved builds yet
            </p>
            <p className="mt-2 text-sm text-muted">
              When @{handle} gets a creation approved, it will show up here.
            </p>
            <Link
              to="/showcase"
              className="mt-6 inline-flex h-10 items-center rounded-xl border border-border bg-bg px-4 text-sm font-medium text-fg hover:border-border-glow"
            >
              Browse showcase
            </Link>
          </div>
        ) : (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <BuilderAppCard key={item.id} item={item} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function BuilderAppCard({ item }: { item: ShowcaseItem }) {
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
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-bg">
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
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-bg/90 px-2 py-0.5 text-[10px] font-medium text-fg backdrop-blur-sm">
                <MessageSquare className="size-2.5 text-subtle" aria-hidden />
                {item.reviewCount}
              </span>
            </div>
          </div>
          <div className="flex flex-1 flex-col p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold tracking-tight text-fg">
                {item.appName}
              </p>
              <span className="rounded-full border border-border bg-bg px-2 py-0.5 text-[10px] font-medium text-muted">
                {categoryLabel(item.category)}
              </span>
            </div>
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
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
          </div>
        </Link>
      </article>
    </li>
  );
}
