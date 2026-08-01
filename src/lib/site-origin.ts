import { createServerFn } from "@tanstack/react-start";

/**
 * Public origin for absolute OG/canonical URLs.
 * Server uses request host (incl. x-forwarded-*); client uses window.location.
 */
export const getSiteOrigin = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const { getRequestUrl, getRequest } = await import(
        "@tanstack/react-start/server"
      );

      try {
        const url = getRequestUrl({
          xForwardedHost: true,
          xForwardedProto: true,
        });
        if (url?.origin && url.origin !== "null") return url.origin;
      } catch {
        /* fall through */
      }

      const request = getRequest();
      const host =
        request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
        request.headers.get("host");
      if (host) {
        const proto =
          request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
          "https";
        return `${proto}://${host}`;
      }
      return new URL(request.url).origin;
    } catch {
      return null;
    }
  },
);

export async function resolvePageOrigin(): Promise<string | null> {
  if (!import.meta.env.SSR && typeof window !== "undefined") {
    return window.location.origin;
  }
  try {
    return await getSiteOrigin();
  } catch {
    return typeof window !== "undefined" ? window.location.origin : null;
  }
}
