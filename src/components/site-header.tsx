import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "@/lib/theme";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const COMING_SOON = "Coming Soon";
const AUGMENT = "Augment";
const HOLD_MS = 2_200;
const TYPE_MS = 48;

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
  const [label, setLabel] = useState(AUGMENT);
  const [playing, setPlaying] = useState(false);
  const [orange, setOrange] = useState(false);
  const [cursorOn, setCursorOn] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }, []);

  const play = useCallback(() => {
    if (playing) return;
    clearTimers();
    setPlaying(true);
    setOrange(true);
    setCursorOn(true);
    setLabel("");

    let t = 0;
    // Type "Coming Soon"
    for (let i = 1; i <= COMING_SOON.length; i++) {
      t += TYPE_MS;
      const n = i;
      schedule(() => setLabel(COMING_SOON.slice(0, n)), t);
    }
    // Hold
    t += HOLD_MS;
    // Delete "Coming Soon"
    for (let i = COMING_SOON.length - 1; i >= 0; i--) {
      t += TYPE_MS;
      const n = i;
      schedule(() => setLabel(COMING_SOON.slice(0, n)), t);
    }
    // Type "Augment" back
    for (let i = 1; i <= AUGMENT.length; i++) {
      t += TYPE_MS;
      const n = i;
      schedule(() => {
        setOrange(false);
        setLabel(AUGMENT.slice(0, n));
      }, t);
    }
    // Done — look totally normal
    t += TYPE_MS;
    schedule(() => {
      setLabel(AUGMENT);
      setOrange(false);
      setCursorOn(false);
      setPlaying(false);
      clearTimers();
    }, t);
  }, [playing, clearTimers, schedule]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <button
      type="button"
      aria-label={orange ? "Coming soon" : "Augment, coming soon"}
      onClick={play}
      onMouseEnter={play}
      className="whitespace-nowrap rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-surface hover:text-fg sm:px-2.5"
    >
      <span
        className={`inline-flex min-h-[1.25em] items-center ${
          orange ? "font-medium text-orange-500" : ""
        }`}
      >
        {label}
        {cursorOn ? (
          <span
            className={`ml-px inline-block w-[0.45ch] animate-pulse align-[-0.1em] ${
              orange ? "bg-orange-500" : "bg-muted"
            }`}
            style={{ height: "0.95em" }}
            aria-hidden
          />
        ) : null}
      </span>
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
