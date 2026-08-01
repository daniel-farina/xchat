import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "@/lib/theme";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const COMING_SOON = "Coming Soon";
const TEASER_MS = 10_000;
const TYPE_MS = 55;

export function SiteHeader({
  active,
}: {
  active?:
    | "home"
    | "showcase"
    | "submit"
    | "mine"
    | "admin"
    | "login"
    | "buzz";
}) {
  const { user, isPending } = useCurrentUserState();

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Link
            to="/"
            className="truncate text-sm font-semibold tracking-tight text-fg"
          >
            X Vibe Chat
          </Link>
          <nav className="flex items-center gap-0.5 overflow-x-auto text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <NavLink to="/" label="Home" active={active === "home"} />
            <NavLink
              to="/showcase"
              label="Showcase"
              active={active === "showcase"}
            />
            <NavLink
              to="/showcase/submit"
              label="Submit"
              active={active === "submit"}
            />
            <NavLink to="/buzz" label="Buzz" active={active === "buzz"} />
            <AugmentTeaserNav />
            {user ? (
              <NavLink
                to="/showcase/mine"
                label="My posts"
                active={active === "mine"}
              />
            ) : null}
            {user ? (
              <NavLink
                to="/showcase/admin"
                label="Admin"
                active={active === "admin"}
              />
            ) : null}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isPending ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-surface-elevated" />
          ) : user ? (
            <UserButton />
          ) : (
            <Link
              to="/login"
              search={{ redirect: "/showcase" }}
              className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:border-border-glow hover:bg-surface-elevated"
            >
              Sign in
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function AugmentTeaserNav() {
  const [typed, setTyped] = useState("");
  const [playing, setPlaying] = useState(false);
  const [cursorOn, setCursorOn] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    setTyped("");
    setPlaying(false);
    setCursorOn(false);
  }, [clearTimers]);

  const play = useCallback(() => {
    if (playing) return;
    clearTimers();
    setPlaying(true);
    setCursorOn(true);
    setTyped("");

    for (let i = 1; i <= COMING_SOON.length; i++) {
      const id = window.setTimeout(() => {
        setTyped(COMING_SOON.slice(0, i));
      }, i * TYPE_MS);
      timers.current.push(id);
    }

    const typedDone = COMING_SOON.length * TYPE_MS + 200;
    timers.current.push(window.setTimeout(() => setCursorOn(false), typedDone));
    timers.current.push(window.setTimeout(reset, TEASER_MS));
  }, [playing, clearTimers, reset]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <button
      type="button"
      aria-label={playing ? "Coming soon" : "Augment, coming soon"}
      onClick={play}
      onMouseEnter={play}
      className="whitespace-nowrap rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-surface hover:text-fg sm:px-2.5"
    >
      {playing ? (
        <span className="inline-flex items-center font-medium text-orange-500">
          {typed}
          {cursorOn ? (
            <span
              className="ml-px inline-block w-[0.45ch] animate-pulse bg-orange-500 align-[-0.1em]"
              style={{ height: "0.95em" }}
              aria-hidden
            />
          ) : null}
        </span>
      ) : (
        "Augment"
      )}
    </button>
  );
}

function NavLink({
  to,
  label,
  active,
}: {
  to:
    | "/"
    | "/showcase"
    | "/showcase/submit"
    | "/showcase/mine"
    | "/showcase/admin"
    | "/buzz"
    | "/login";
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-sm transition-colors sm:px-2.5 ${
        active
          ? "bg-surface-elevated font-medium text-fg"
          : "text-muted hover:bg-surface hover:text-fg"
      }`}
    >
      {label}
    </Link>
  );
}
