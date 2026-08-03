import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { isAdminHandle } from "@/lib/admins";
import { isShowcaseCategory } from "@/lib/showcase-options";
import { uniqueSlug } from "@/lib/slug";
import seedPart1 from "@/data/showcase_seed_part1.json";
import seedPart2 from "@/data/showcase_seed_part2.json";
import seedPart3 from "@/data/showcase_seed_part3.json";
import seedPart4 from "@/data/showcase_seed_part4.json";
import seedPart5 from "@/data/showcase_seed_part5.json";

const IMPORT_USER_ID = "hub-import-system";

/** Minimal SVG placeholder used when no app screenshot is available. */
export const IMPORT_PLACEHOLDER_IMAGE =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e3a5f"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)"/><text x="400" y="220" text-anchor="middle" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="26">Grok Build App</text><text x="400" y="255" text-anchor="middle" fill="#64748b" font-family="system-ui,sans-serif" font-size="14">Imported catalog</text></svg>`,
  ).toString("base64");

type SeedPost = {
  post_id?: string | null;
  post_url?: string | null;
  author_username?: string | null;
  likes?: number | null;
  reposts?: number | null;
  views?: number | null;
  posted_at?: string | null;
  content?: string | null;
};

type SeedItem = {
  slug: string;
  app_name: string;
  category: string;
  author_name: string;
  author_handle: string;
  description: string;
  tools: string;
  prompt: string;
  model: string;
  prompt_style: string;
  creation_url: string;
  hostname: string;
  status?: string;
  hub_rating?: number | null;
  hub_views?: number | null;
  hub_likes?: number | null;
  x_top_likes?: number | null;
  post_likes_total?: number | null;
  post_likes_max?: number | null;
  posts?: SeedPost[];
  hero_image_url?: string | null;
  sources?: string[];
};

function loadSeed(): SeedItem[] {
  return [
    ...(seedPart1 as SeedItem[]),
    ...(seedPart2 as SeedItem[]),
    ...(seedPart3 as SeedItem[]),
    ...(seedPart4 as SeedItem[]),
    ...(seedPart5 as SeedItem[]),
  ];
}

function newId(): string {
  return crypto.randomUUID();
}

async function requireAdmin(userId: string): Promise<void> {
  const sql = await getSql();
  const rows = await sql<{ x_handle: string }>`
    select x_handle from profiles where user_id = ${userId} limit 1
  `;
  if (!isAdminHandle(rows[0]?.x_handle ?? null)) {
    throw new Error("Forbidden");
  }
}

function sanitizeHandle(raw: string): string {
  const h = String(raw ?? "")
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 15)
    .toLowerCase();
  return h || "grokbuild";
}

/**
 * Admin-only: upsert the merged Hub / Explore / X catalog into showcase_items.
 * Idempotent on source_hostname. Existing user-submitted rows (no hostname) are untouched.
 */
export const importHubCatalog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { mode?: "insert_only" | "upsert" } = {}) => ({
    mode: input?.mode === "upsert" ? ("upsert" as const) : ("insert_only" as const),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const items = loadSeed();

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        const hostname = String(item.hostname ?? "")
          .trim()
          .toLowerCase();
        if (!hostname) {
          skipped += 1;
          continue;
        }

        const existing = await sql<{ id: string; slug: string }>`
          select id, slug from showcase_items
          where lower(source_hostname) = ${hostname}
          limit 1
        `;

        const category = isShowcaseCategory(item.category)
          ? item.category
          : "other";
        const authorHandle = sanitizeHandle(item.author_handle);
        const authorName = (item.author_name || authorHandle || "Grok Builder").slice(
          0,
          80,
        );
        const appName = (item.app_name || hostname).trim().slice(0, 80);
        let description = (item.description || `${appName} built with Grok Build.`).trim();
        if (description.length < 8) {
          description = `${appName} — ${item.creation_url}`;
        }
        description = description.slice(0, 1200);
        const tools = (item.tools || "Grok Build web").slice(0, 400);
        const prompt = (
          item.prompt ||
          "Imported from Grok Build Hub / explore.grok.me / X — original prompt not available."
        ).slice(0, 4000);
        const model = (item.model || "Grok Build").slice(0, 80);
        const promptStyle = item.prompt_style || "multi_day";
        const creationUrl = item.creation_url.startsWith("http")
          ? item.creation_url
          : `https://${item.creation_url}`;
        const postsJson = JSON.stringify(item.posts ?? []);
        const importSources = (item.sources || []).join(",");
        const hubViews = item.hub_views ?? null;
        const hubLikes = item.hub_likes ?? null;
        const hubRating = item.hub_rating ?? null;
        const xTopLikes = item.x_top_likes ?? item.post_likes_max ?? null;
        const postLikesTotal = item.post_likes_total ?? null;
        const postLikesMax = item.post_likes_max ?? null;

        if (existing[0]) {
          if (data.mode === "insert_only") {
            skipped += 1;
            continue;
          }
          await sql`
            update showcase_items set
              app_name = ${appName},
              category = ${category},
              author_name = ${authorName},
              author_handle = ${authorHandle},
              description = ${description},
              tools = ${tools},
              prompt = ${prompt},
              model = ${model},
              prompt_style = ${promptStyle},
              creation_url = ${creationUrl},
              status = 'approved',
              hub_views = ${hubViews},
              hub_likes = ${hubLikes},
              hub_rating = ${hubRating},
              x_top_likes = ${xTopLikes},
              post_likes_total = ${postLikesTotal},
              post_likes_max = ${postLikesMax},
              source_posts = ${postsJson}::jsonb,
              import_sources = ${importSources},
              change_summary = '',
              updated_at = now(),
              reviewed_by = ${context.userId},
              reviewed_at = now()
            where id = ${existing[0].id}
          `;
          updated += 1;
          continue;
        }

        const slug = await uniqueSlug(appName, async (candidate) => {
          const rows = await sql<{ id: string }>`
            select id from showcase_items
            where lower(slug) = ${candidate.toLowerCase()}
            limit 1
          `;
          return Boolean(rows[0]);
        });

        const id = newId();
        await sql`
          insert into showcase_items (
            id, user_id, slug, app_name, category, author_name, author_handle,
            description, tools, prompt, model, prompt_style,
            creation_url, image_data,
            status, change_summary, last_edited_by, edit_count,
            source_hostname, hub_views, hub_likes, hub_rating,
            x_top_likes, post_likes_total, post_likes_max,
            source_posts, import_sources,
            created_at, updated_at, reviewed_by, reviewed_at
          ) values (
            ${id},
            ${IMPORT_USER_ID},
            ${slug},
            ${appName},
            ${category},
            ${authorName},
            ${authorHandle},
            ${description},
            ${tools},
            ${prompt},
            ${model},
            ${promptStyle},
            ${creationUrl},
            ${IMPORT_PLACEHOLDER_IMAGE},
            'approved',
            '',
            ${context.userId},
            0,
            ${hostname},
            ${hubViews},
            ${hubLikes},
            ${hubRating},
            ${xTopLikes},
            ${postLikesTotal},
            ${postLikesMax},
            ${postsJson}::jsonb,
            ${importSources},
            now(),
            now(),
            ${context.userId},
            now()
          )
        `;
        inserted += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${item.hostname || item.slug}: ${msg}`);
        if (errors.length > 25) break;
      }
    }

    return {
      totalSeed: items.length,
      inserted,
      updated,
      skipped,
      errors,
    };
  });

/** Count how many seed hostnames are already in the DB. */
export const getHubImportStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const items = loadSeed();
    const hostnames = items
      .map((i) => String(i.hostname ?? "").trim().toLowerCase())
      .filter(Boolean);

    const rows = await sql<{ cnt: number }>`
      select count(*)::int as cnt from showcase_items
      where source_hostname is not null
    `;
    const imported = Number(rows[0]?.cnt ?? 0);

    return {
      seedCount: hostnames.length,
      alreadyImported: imported,
    };
  });
