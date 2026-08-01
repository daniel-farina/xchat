import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { ThemeProvider, THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import { absoluteUrl, SITE } from "@/lib/seo";
import { resolvePageOrigin } from "@/lib/site-origin";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  loader: async () => ({
    origin: await resolvePageOrigin(),
  }),
  head: ({ loaderData }) => {
    const origin =
      loaderData?.origin ||
      (typeof window !== "undefined" ? window.location.origin : undefined) ||
      undefined;
    const icon512 = absoluteUrl("/icon-512.png", origin);

    // Base document chrome only — page routes own OG/Twitter so share
    // cards don't inherit the landing hero image.
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "application-name", content: SITE.name },
        { name: "theme-color", content: SITE.themeColorDark },
        { name: "color-scheme", content: "dark light" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-title", content: SITE.name },
        { name: "msapplication-TileColor", content: SITE.themeColorDark },
        { name: "msapplication-TileImage", content: icon512 },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "/favicon.ico", sizes: "any" },
        {
          rel: "icon",
          href: "/favicon-32.png",
          type: "image/png",
          sizes: "32x32",
        },
        {
          rel: "apple-touch-icon",
          href: "/apple-touch-icon.png",
          sizes: "180x180",
        },
      ],
      scripts: [
        {
          children: THEME_BOOTSTRAP_SCRIPT,
        },
      ],
    };
  },
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthProvider>
          <ThemeProvider>
            <Outlet />
          </ThemeProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
