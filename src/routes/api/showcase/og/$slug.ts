import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

/**
 * Public crawlable image for OG / X cards.
 * Serves the approved app photo so share embeds show the creation, not the site hero.
 */
export const Route = createFileRoute("/api/showcase/og/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const key = String(params.slug ?? "").trim();
          if (!key) {
            return new Response("Not found", { status: 404 });
          }

          const sql = await getSql();
          let rows = await sql<{
            image_data: string;
            status: string;
            updated_at: string | Date;
          }>`
            select image_data, status, updated_at
            from showcase_items
            where lower(slug) = ${key.toLowerCase()}
            limit 1
          `;
          if (!rows[0]) {
            rows = await sql<{
              image_data: string;
              status: string;
              updated_at: string | Date;
            }>`
              select image_data, status, updated_at
              from showcase_items
              where id = ${key}
              limit 1
            `;
          }

          const row = rows[0];
          if (!row || row.status !== "approved") {
            return new Response("Not found", { status: 404 });
          }

          const parsed = parseDataUrl(row.image_data);
          if (!parsed) {
            return new Response("No image", { status: 404 });
          }

          const etag = `"${key}-${typeof row.updated_at === "string" ? row.updated_at : row.updated_at.toISOString()}"`;

          return new Response(new Uint8Array(parsed.bytes), {
            status: 200,
            headers: {
              "content-type": parsed.mime,
              "cache-control": "public, max-age=3600, s-maxage=86400",
              etag,
              "content-disposition": "inline",
            },
          });
        } catch (err) {
          console.error("[api/showcase/og] error:", err);
          return new Response("Error", { status: 500 });
        }
      },
    },
  },
});

function parseDataUrl(
  dataUrl: string,
): { mime: string; bytes: Buffer } | null {
  const trimmed = String(dataUrl ?? "").trim();
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i.exec(
    trimmed,
  );
  if (!match) return null;
  try {
    const mime = match[1]!.toLowerCase();
    const bytes = Buffer.from(match[2]!, "base64");
    if (bytes.length < 32) return null;
    return { mime, bytes };
  } catch {
    return null;
  }
}
