import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, ExternalLink, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { buildShareMeta } from "@/lib/seo";
import { resolvePageOrigin } from "@/lib/site-origin";

const BUZZ_INVITE =
  "https://vibecoding.communities.buzz.xyz/invite/v2.nSbAtcQiBcYNijp5rvap0YZN0vMiJAij4nFomQzJZzU";

export const Route = createFileRoute("/buzz")({
  loader: async () => ({
    origin: await resolvePageOrigin(),
  }),
  head: ({ loaderData }) => {
    const share = buildShareMeta({
      origin: loaderData?.origin,
      title: "We're also on Buzz — X Vibe Chat",
      description:
        "Join the X Vibe Chat community on Buzz for channels, DMs, and live vibecoding energy.",
      path: "/buzz",
      imagePath: "/buzz-preview.png",
      imageAlt: "X Vibe Chat community on Buzz",
      imageWidth: 1200,
      imageHeight: 800,
    });
    return { meta: share.meta, links: share.links };
  },
  component: BuzzPage,
});

function BuzzPage() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteHeader active="buzz" />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-accent-bright">
          <Sparkles className="size-3.5" aria-hidden />
          Community space
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          We're also on Buzz
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
          Same vibe, extra rooms — channels like{" "}
          <span className="font-medium text-fg">#project-showcase</span>,{" "}
          <span className="font-medium text-fg">#welcome-everyone</span>, and
          direct messages. Hop in if you prefer a chat-style hangout alongside X
          Chat.
        </p>

        <a
          href={BUZZ_INVITE}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 group block overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_0_0_1px_transparent] transition-[border-color,box-shadow] hover:border-border-glow hover:shadow-[0_0_28px_var(--glow)]"
        >
          <img
            src="/buzz-preview.png"
            alt="Buzz community preview — welcome channel with members chatting"
            className="w-full object-cover object-top"
            width={1200}
            height={800}
          />
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg">
                vibecoding on Buzz
              </p>
              <p className="truncate text-xs text-subtle">
                vibecoding.communities.buzz.xyz
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-accent-bright">
              Open invite
              <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </div>
        </a>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href={BUZZ_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent px-6 text-[15px] font-semibold text-accent-fg shadow-[0_0_24px_var(--glow)] transition-[transform,background-color] hover:bg-accent-bright active:scale-[0.99]"
          >
            Join on Buzz
            <ExternalLink className="size-4" aria-hidden />
          </a>
          <Link
            to="/showcase"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-border bg-surface px-6 text-sm font-medium text-fg hover:border-border-glow"
          >
            Browse showcase
          </Link>
        </div>

        <p className="mt-6 break-all rounded-xl border border-border bg-surface/50 px-4 py-3 font-mono text-[11px] leading-relaxed text-subtle">
          {BUZZ_INVITE}
        </p>
      </main>
    </div>
  );
}
