import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { isAdminHandle } from "@/lib/admins";
import { isShowcaseCategory } from "@/lib/showcase-options";
import { uniqueSlug } from "@/lib/slug";
import seed00 from "@/data/seed_chunks/seed_00.json";
import seed01 from "@/data/seed_chunks/seed_01.json";
import seed02 from "@/data/seed_chunks/seed_02.json";
import seed03 from "@/data/seed_chunks/seed_03.json";
import seed04 from "@/data/seed_chunks/seed_04.json";
import seed05 from "@/data/seed_chunks/seed_05.json";
import seed06 from "@/data/seed_chunks/seed_06.json";
import seed07 from "@/data/seed_chunks/seed_07.json";
import seed08 from "@/data/seed_chunks/seed_08.json";
import seed09 from "@/data/seed_chunks/seed_09.json";
import seed10 from "@/data/seed_chunks/seed_10.json";
import seed11 from "@/data/seed_chunks/seed_11.json";
import seed12 from "@/data/seed_chunks/seed_12.json";
import seed13 from "@/data/seed_chunks/seed_13.json";
import seed14 from "@/data/seed_chunks/seed_14.json";
import seed15 from "@/data/seed_chunks/seed_15.json";
import seed16 from "@/data/seed_chunks/seed_16.json";
import seed17 from "@/data/seed_chunks/seed_17.json";

const IMPORT_USER_ID = "hub-import-system";

export const IMPORT_PLACEHOLDER_IMAGE =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"800\" height=\"450\"><defs><linearGradient id=\"g\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0%\" stop-color=\"#0f172a\"/><stop offset=\"100%\" stop-color=\"#1e3a5f\"/></linearGradient></defs><rect width=\"800\" height=\"450\" fill=\"url(#g)\"/><text x=\"400\" y=\"220\" text-anchor=\"middle\" fill=\"#94a3b8\" font-family=\"system-ui,sans-serif\" font-size=\"26\">Grok Build App</text><text x=\"400\" y=\"255\" text-anchor=\"middle\" fill=\"#64748b\" font-family=\"system-ui,sans-serif\" font-size=\"14\">Imported catalog</text></svg>`,
  ).toString("base64");

type CompactPost = {
  i?: string | null;
  u?: string | null;
  a?: string | null;
  l?: number | null;
};

type CompactSeed = {
  s: string;
  n: string;
  c: string;
  an: string;
  ah: string;
  d: string;
  t?: string;
  u: string;
  h: string;
  hv?: number | null;
  hl?: number | null;
  hr?: number | null;
  xl?: number | null;
  pt?: number | null;
  pm?: number | null;
  p?: CompactPost[];
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
  hub_rating?: number | null;
  hub_views?: number | null;
  hub_likes?: number | null;
  x_top_likes?: number | null;
  post_likes_total?: number | null;
  post_likes_max?: number | null;
  posts: {
    post_id?: string | null;
    post_url?: string | null;
    author_username?: string | null;
    likes?: number | null;
  }[];
};

function expand(c: CompactSeed): SeedItem {
  return {
    slug: c.s,
    app_name: c.n,
    category: c.c,
    author_name: c.an,
    author_handle: c.ah,
    description: c.d,
    tools: c.t || "Grok Build web",
    prompt:
      "Imported from Grok Build Hub / explore.grok.me / X — original prompt not available.",
    model: "Grok Build",
    prompt_style: "multi_day",
    creation_url: c.u,
    hostname: c.h,
    hub_rating: c.hr ?? null,
    hub_views: c.hv ?? null,
    hub_likes: c.hl ?? null,
    x_top_likes: c.xl ?? c.pm ?? null,
    post_likes_total: c.pt ?? null,
    post_likes_max: c.pm ?? null,
    posts: (c.p || []).map((p) => ({
      post_id: p.i,
      post_url: p.u,
      author_username: p.a,
      likes: p.l,
    })),
  };
}

function loadSeed(): SeedItem[] {
  const raw = [
    ...(seed00 as CompactSeed[]),
    ...(seed01 as CompactSeed[]),
    ...(seed02 as CompactSeed[]),
    ...(seed03 as CompactSeed[]),
    ...(seed04 as CompactSeed[]),
    ...(seed05 as CompactSeed[]),
    ...(seed06 as CompactSeed[]),
    ...(seed07 as CompactSeed[]),
    ...(seed08 as CompactSeed[]),
    ...(seed09 as CompactSeed[]),
    ...(seed10 as CompactSeed[]),
    ...(seed11 as CompactSeed[]),
    ...(seed12 as CompactSeed[]),
    ...(seed13 as CompactSeed[]),
    ...(seed14 as CompactSeed[]),
    ...(seed15 as CompactSeed[]),
    ...(seed16 as CompactSeed[]),
    ...(seed17 as CompactSeed[]),
  ];
  return raw.map(expand);
}

function newId(): string {
  return crypto.randomUUID();
}

async function requireAdmin(userId: string): Promise<void> {
  const sql = await getSql();
  const rows = await sql<{ x_handle: string }> `
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
        const hostname = String(item.hostname ?? "").trim().toLowerCase();
        if (!hostname) {
          skipped += 1;
          continue;
        }

        const existing = await sql<{ id: string }> `
          select id from showcase_items
          where lower(source_hostname) = ${hostname}
          limit 1
        `;

        const category = isShowcaseCategory(item.category) ? item.category : "other";
        const authorHandle = sanitizeHandle(item.author_handle);
        const authorName = (item.author_name || authorHandle || "Grok Builder").slice(0, 80);
        const appName = (item.app_name || hostname).trim().slice(0, 80);
        let description = (item.description || `${appName} built with Grok Build.`).trim();
        if (description.length < 8) description = `${appName} — ${item.creation_url}`;
        description = description.slice(0, 1200);
        const tools = (item.tools || "Grok Build web").slice(0, 400);
        const prompt = item.prompt.slice(0, 4000);
        const model = (item.model || "Grok Build").slice(0, 80);
        const promptStyle = item.prompt_style || "multi_day";
        const creationUrl = item.creation_url.startsWith("http")
          ? item.creation_url
          : `https://${item.creation_url}`;
        const postsJson = JSON.stringify(item.posts ?? []);
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
          await sql `
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
          const rows = await sql<{ id: string }> `
            select id from showcase_items
            where lower(slug) = ${candidate.toLowerCase()}
            limit 1
          `;
          return Boolean(rows[0]);
        });

        const id = newId();
        await sql `
          insert into showcase_items (
            id, user_id, slug, app_name, category, author_name, author_handle,
            description, tools, prompt, model, prompt_style,
            creation_url, image_data,
            status, change_summary, last_edited_by, edit_count,
            source_hostname, hub_views, hub_likes, hub_rating,
            x_top_likes, post_likes_total, post_likes_max,
            source_posts,
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

    return { totalSeed: items.length, inserted, updated, skipped, errors };
  });

export const getHubImportStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const items = loadSeed();
    const rows = await sql<{ cnt: number }> `
      select count(*)::int as cnt from showcase_items
      where source_hostname is not null
    `;
    return {
      seedCount: items.length,
      alreadyImported: Number(rows[0]?.cnt ?? 0),
    };
  });
