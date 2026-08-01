import { createFileRoute, Link } from "@tanstack/react-router";
import { buildShareMeta } from "@/lib/seo";
import { resolvePageOrigin } from "@/lib/site-origin";
import { useEffect, useState } from "react";
import { ArrowUpRight, Heart, Lightbulb, Shield, Users } from "lucide-react";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/")({
  loader: async () => ({
    origin: await resolvePageOrigin(),
  }),
  head: ({ loaderData }) => {
    const share = buildShareMeta({ origin: loaderData?.origin });
    return { meta: share.meta, links: share.links };
  },
  component: VibeChatLanding,
});

const JOIN_URL =
  "https://x.com/i/chat/group_join/g2082925090598215687/GajsWFuUFp";

const RULES = [
  {
    icon: Heart,
    title: "Good energy only",
    body: "Be kind. Celebrate experiments. Leave ego at the door.",
  },
  {
    icon: Users,
    title: "Everyone belongs",
    body: "Coders and non-coders welcome. No gatekeeping, ever.",
  },
  {
    icon: Lightbulb,
    title: "Share & build",
    body: "Prompts, ideas, and half-finished projects all count.",
  },
  {
    icon: Shield,
    title: "Keep it clean",
    body: "No spam, scams, or harassment. Mutual support first.",
  },
] as const;

type Admin = {
  name: string;
  handle: string;
  href: string;
  photo: string;
};

const ADMINS: Admin[] = [
  {
    name: "Daniel Farinax",
    handle: "Daniel_Farinax",
    href: "https://x.com/Daniel_Farinax",
    photo: "/admin-Daniel_Farinax.jpg",
  },
  {
    name: "XFreeze",
    handle: "XFreeze",
    href: "https://x.com/XFreeze",
    photo: "/admin-XFreeze.jpg",
  },
  {
    name: "tetsuoai",
    handle: "tetsuoai",
    href: "https://x.com/tetsuoai",
    photo: "/admin-tetsuoai.jpg",
  },
];

function shuffleAdmins(list: Admin[]): Admin[] {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

function VibeChatLanding() {
  const [admins, setAdmins] = useState<Admin[]>(() => [...ADMINS]);

  useEffect(() => {
    setAdmins(shuffleAdmins(ADMINS));
  }, []);

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-bg text-fg">
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2 sm:right-6 sm:top-6">
        <Link
          to="/showcase"
          className="inline-flex h-10 items-center rounded-xl border border-border bg-surface/80 px-3 text-sm font-medium text-fg backdrop-blur-sm transition-colors hover:border-border-glow hover:bg-surface-elevated"
        >
          Showcase
        </Link>
        <Link
          to="/buzz"
          className="inline-flex h-10 items-center rounded-xl border border-border bg-surface/80 px-3 text-sm font-medium text-fg backdrop-blur-sm transition-colors hover:border-border-glow hover:bg-surface-elevated"
        >
          Buzz
        </Link>
        <ThemeToggle />
      </div>

      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="glow-orb absolute left-1/2 top-[-12%] h-[52vh] w-[min(90vw,720px)] -translate-x-1/2 rounded-full blur-2xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,var(--glow),transparent_55%)] opacity-40" />
        <div
          className="theme-grid absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--fg) 1px, transparent 1px), linear-gradient(to bottom, var(--fg) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse 70% 60% at 50% 35%, black, transparent)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 py-10 sm:px-8 sm:py-14 lg:px-10 lg:py-16">
        <section className="flex flex-1 flex-col items-center text-center">
          <img
            src="/x-vibe-chat-logo.jpeg"
            alt="X Vibe Chat"
            className="h-24 w-24 rounded-2xl border border-border-glow object-cover shadow-[0_0_40px_var(--glow)] sm:h-28 sm:w-28"
            width={112}
            height={112}
          />
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.16em] text-accent-bright">
            X Chat group
          </p>
          <h1 className="mt-3 max-w-2xl text-balance text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
            X Vibe Chat
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted sm:text-lg">
            A warm space for everyone — non-coders and coders — to explore AI,
            share prompts, build cool stuff, and vibe code together.
          </p>
          <p className="mt-3 max-w-md text-sm text-subtle">
            No gatekeeping. Just good energy, experiments, and mutual support.
          </p>

          <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href={JOIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-accent px-5 text-[15px] font-semibold text-accent-fg shadow-[0_0_28px_var(--glow)] transition-[transform,background-color] hover:bg-accent-bright active:scale-[0.99] sm:flex-none sm:px-8"
            >
              Join the Xchat Group
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
            <Link
              to="/showcase"
              className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl border border-border bg-surface/80 px-5 text-[15px] font-medium text-fg backdrop-blur-sm transition-colors hover:border-border-glow sm:flex-none"
            >
              Showcase
            </Link>
          </div>

          <div className="mt-10 w-full max-w-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-subtle">
              Scan to join from your phone
            </p>
            {/* One visible QR: light/dark variants swapped by html.light / html.dark */}
            <div className="relative mx-auto mt-3 inline-flex size-[calc(10rem+1.5rem)] items-center justify-center rounded-2xl border border-border bg-surface p-3">
              <img
                src="/join-qr.png"
                alt="QR code to join X Vibe Chat"
                className="qr-theme-dark size-40 rounded-lg"
                width={160}
                height={160}
              />
              <img
                src="/join-qr-light.png"
                alt=""
                aria-hidden
                className="qr-theme-light absolute size-40 rounded-lg"
                width={160}
                height={160}
              />
            </div>
          </div>
        </section>

        <section className="mt-16 border-t border-border pt-12">
          <h2 className="text-center text-sm font-semibold uppercase tracking-[0.14em] text-subtle">
            House rules
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {RULES.map((rule) => (
              <li
                key={rule.title}
                className="rounded-2xl border border-border bg-surface/60 p-4 text-left"
              >
                <rule.icon
                  className="size-5 text-accent-bright"
                  aria-hidden
                />
                <p className="mt-3 text-sm font-semibold text-fg">
                  {rule.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {rule.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16 border-t border-border pt-12 pb-6">
          <h2 className="text-center text-sm font-semibold uppercase tracking-[0.14em] text-subtle">
            Administrators
          </h2>
          <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4">
            {admins.map((admin) => (
              <li key={admin.handle}>
                <a
                  href={admin.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface/50 p-3 transition-colors hover:border-border-glow hover:bg-surface"
                >
                  <img
                    src={admin.photo}
                    alt=""
                    className="size-12 rounded-full border border-border object-cover sm:size-14"
                    width={56}
                    height={56}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <span className="w-full truncate text-center text-[11px] font-medium text-fg sm:text-xs">
                    @{admin.handle}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
