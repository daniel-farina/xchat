export const SITE = {
  name: "X Vibe Chat",
  title: "X Vibe Chat — Join the group",
  description:
    "A warm X Chat for everyone — non-coders and coders — to explore AI, share prompts, build cool stuff, and vibe code together. No gatekeeping. Just good energy.",
  shortDescription:
    "No gatekeeping. Just good energy, experiments, and mutual support. Come join us.",
  joinUrl:
    "https://x.com/i/chat/group_join/g2082925090598215687/GajsWFuUFp",
  twitterHandle: "@Daniel_Farinax",
  locale: "en_US",
  themeColorDark: "#05060a",
  themeColorLight: "#f4f7fb",
  ogImagePath: "/og-image.png",
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt:
    "X Vibe Chat — a warm space to explore AI and vibe code together",
} as const;

/** Build absolute asset URL when origin is known; otherwise keep a root-relative path. */
export function absoluteUrl(path: string, origin?: string | null): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!origin) return normalized;
  return `${origin.replace(/\/$/, "")}${normalized}`;
}

type ShareMetaInput = {
  origin?: string | null;
  title?: string;
  description?: string;
  path?: string;
  imagePath?: string;
  imageAlt?: string;
  imageType?: string;
  imageWidth?: number;
  imageHeight?: number;
  type?: "website" | "article";
};

export function buildShareMeta({
  origin,
  title = SITE.title,
  description = SITE.description,
  path = "/",
  imagePath = SITE.ogImagePath,
  imageAlt = SITE.ogImageAlt,
  imageType = "image/png",
  imageWidth = SITE.ogImageWidth,
  imageHeight = SITE.ogImageHeight,
  type = "website",
}: ShareMetaInput = {}) {
  const ogImage = absoluteUrl(imagePath, origin);
  const pageUrl = origin
    ? `${origin.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`
    : undefined;
  const shortDesc =
    description.length > 200 ? `${description.slice(0, 197)}…` : description;

  return {
    title,
    meta: [
      { charSet: "utf-8" as const },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title },
      { name: "description", content: shortDesc },
      { name: "application-name", content: SITE.name },
      { name: "author", content: "X Vibe Chat" },
      {
        name: "keywords",
        content:
          "X Vibe Chat, showcase, AI apps, vibe coding, prompts, community",
      },
      { name: "theme-color", content: SITE.themeColorDark },
      { name: "color-scheme", content: "dark light" },
      { name: "robots", content: "index, follow" },

      { property: "og:type", content: type },
      { property: "og:site_name", content: SITE.name },
      { property: "og:locale", content: SITE.locale },
      { property: "og:title", content: title },
      { property: "og:description", content: shortDesc },
      { property: "og:image", content: ogImage },
      { property: "og:image:secure_url", content: ogImage },
      { property: "og:image:type", content: imageType },
      { property: "og:image:width", content: String(imageWidth) },
      { property: "og:image:height", content: String(imageHeight) },
      { property: "og:image:alt", content: imageAlt },
      ...(pageUrl ? [{ property: "og:url", content: pageUrl }] : []),

      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: SITE.twitterHandle },
      { name: "twitter:creator", content: SITE.twitterHandle },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: shortDesc },
      { name: "twitter:image", content: ogImage },
      { name: "twitter:image:alt", content: imageAlt },
    ],
    links: [
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
      ...(pageUrl ? [{ rel: "canonical", href: pageUrl }] : []),
    ],
  };
}

/** Crawlable absolute path for an app’s share card image. */
export function showcaseOgImagePath(slug: string): string {
  const clean = String(slug ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  return `/api/showcase/og/${clean}`;
}

export function buildAppShareMeta(opts: {
  origin?: string | null;
  appName: string;
  description: string;
  authorHandle: string;
  model?: string;
  category?: string;
  avgStars?: number | null;
  path: string;
  /** Friendly slug for the public OG image endpoint */
  slug: string;
  imageMime?: string | null;
}) {
  const rating =
    opts.avgStars != null ? ` · ${opts.avgStars.toFixed(1)}★` : "";
  const modelBit = opts.model ? ` · ${opts.model}` : "";
  const catBit = opts.category ? ` · ${opts.category}` : "";
  const title = `${opts.appName} — X Vibe Chat Showcase`;
  const description = `${opts.description.slice(0, 150)}${
    opts.description.length > 150 ? "…" : ""
  } By @${opts.authorHandle}${modelBit}${catBit}${rating}`;

  const imageType =
    opts.imageMime && opts.imageMime.startsWith("image/")
      ? opts.imageMime
      : "image/jpeg";

  return buildShareMeta({
    origin: opts.origin,
    title,
    description,
    path: opts.path,
    type: "article",
    imagePath: showcaseOgImagePath(opts.slug),
    imageAlt: `${opts.appName} by @${opts.authorHandle} on X Vibe Chat Showcase`,
    imageType,
    imageWidth: 1200,
    imageHeight: 630,
  });
}

export function xShareUrl(text: string, url: string): string {
  const params = new URLSearchParams({ text, url });
  return `https://x.com/intent/tweet?${params.toString()}`;
}
