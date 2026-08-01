import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { isAdminHandle, normalizeHandle } from "@/lib/admins";
import { type ShowcaseItem, type ShowcaseStatus } from "@/lib/showcase-server";

export type ShowcaseReview = {
  id: string;
  itemId: string;
  userId: string;
  authorName: string;
  authorHandle: string;
  body: string;
  stars: number | null;
  createdAt: string;
};

export type ItemStats = {
  avgStars: number | null;
  ratingCount: number;
  reviewCount: number;
};

type ItemRow = {
  id: string;
  user_id: string;
  slug: string | null;
  app_name: string | null;
  category: string | null;
  author_name: string;
  author_handle: string;
  description: string;
  tools: string;
  prompt: string;
  model: string | null;
  prompt_style: string | null;
  creation_url: string;
  image_data: string;
  status: ShowcaseStatus;
  change_summary: string | null;
  last_edited_by: string | null;
  edit_count: number | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type ReviewRow = {
  id: string;
  item_id: string;
  user_id: string;
  author_name: string;
  author_handle: string;
  body: string;
  stars: number | null;
  created_at: string | Date;
};

function toIso(v: string | Date): string {
  return typeof v === "string" ? v : v.toISOString();
}

function rowToItem(row: ItemRow, stats?: ItemStats): ShowcaseItem {
  const appName =
    (row.app_name ?? "").trim() || row.author_name || "Untitled app";
  return {
    id: row.id,
    userId: row.user_id,
    slug: (row.slug ?? "").trim() || row.id,
    appName,
    category: row.category || "other",
    authorName: row.author_name,
    authorHandle: row.author_handle,
    description: row.description,
    tools: row.tools,
    prompt: row.prompt,
    model: row.model ?? "",
    promptStyle: row.prompt_style ?? "one_shot",
    creationUrl: row.creation_url,
    imageData: row.image_data,
    status: row.status,
    changeSummary: row.change_summary ?? "",
    lastEditedBy: row.last_edited_by ?? null,
    editCount: Number(row.edit_count ?? 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    avgStars: stats?.avgStars ?? null,
    ratingCount: stats?.ratingCount ?? 0,
    reviewCount: stats?.reviewCount ?? 0,
  };
}

function rowToReview(row: ReviewRow): ShowcaseReview {
  return {
    id: row.id,
    itemId: row.item_id,
    userId: row.user_id,
    authorName: row.author_name,
    authorHandle: row.author_handle,
    body: row.body,
    stars: row.stars,
    createdAt: toIso(row.created_at),
  };
}

function friendly(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("pglite") ||
    msg.includes("DATABASE_URL") ||
    msg.includes("no such file") ||
    msg.includes("ECONNREFUSED")
  ) {
    return new Error(
      "Showcase database is still starting up or not linked yet.",
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

async function getProfile(userId: string): Promise<{
  handle: string | null;
  displayName: string | null;
}> {
  const sql = await getSql();
  const profiles = await sql<{
    x_handle: string;
    display_name: string | null;
  }>`
    select x_handle, display_name from profiles where user_id = ${userId} limit 1
  `;
  const users = await sql<{ name: string }>`
    select name from "user" where id = ${userId} limit 1
  `;
  return {
    handle: profiles[0]?.x_handle ?? null,
    displayName: profiles[0]?.display_name ?? users[0]?.name ?? null,
  };
}

async function resolveItemId(slugOrId: string): Promise<string | null> {
  const key = String(slugOrId ?? "").trim();
  if (!key) return null;
  const sql = await getSql();
  const bySlug = await sql<{ id: string }>`
    select id from showcase_items where lower(slug) = ${key.toLowerCase()} limit 1
  `;
  if (bySlug[0]) return bySlug[0].id;
  const byId = await sql<{ id: string }>`
    select id from showcase_items where id = ${key} limit 1
  `;
  return byId[0]?.id ?? null;
}

async function loadStats(itemId: string): Promise<ItemStats> {
  const sql = await getSql();
  const ratingRows = await sql<{ avg: string | number | null; cnt: string }>`
    select avg(stars)::float as avg, count(*)::text as cnt
    from showcase_ratings
    where item_id = ${itemId}
  `;
  const reviewRows = await sql<{ cnt: string }>`
    select count(*)::text as cnt from showcase_reviews where item_id = ${itemId}
  `;
  const cnt = Number(ratingRows[0]?.cnt ?? 0);
  const avgRaw = ratingRows[0]?.avg;
  const avg =
    cnt > 0 && avgRaw != null ? Math.round(Number(avgRaw) * 10) / 10 : null;
  return {
    avgStars: avg,
    ratingCount: cnt,
    reviewCount: Number(reviewRows[0]?.cnt ?? 0),
  };
}

export const getShowcaseItemDetail = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => {
    const id = String(input?.id ?? "").trim();
    if (!id) throw new Error("Missing item id.");
    return { id };
  })
  .handler(async ({ data }) => {
    try {
      const sql = await getSql();
      const key = data.id;
      let rows = await sql<ItemRow>`
        select * from showcase_items
        where lower(slug) = ${key.toLowerCase()} and status = 'approved'
        limit 1
      `;
      if (!rows[0]) {
        rows = await sql<ItemRow>`
          select * from showcase_items
          where id = ${key} and status = 'approved'
          limit 1
        `;
      }
      if (!rows[0]) throw new Error("App not found or not approved yet.");

      const stats = await loadStats(rows[0].id);
      const reviews = await sql<ReviewRow>`
        select * from showcase_reviews
        where item_id = ${rows[0].id}
        order by created_at desc
        limit 100
      `;

      return {
        item: rowToItem(rows[0], stats),
        stats,
        reviews: reviews.map(rowToReview),
      };
    } catch (err) {
      throw friendly(err);
    }
  });

export const getMyItemEngagement = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => {
    const id = String(input?.id ?? "").trim();
    if (!id) throw new Error("Missing item id.");
    return { id };
  })
  .handler(async ({ context, data }) => {
    try {
      const sql = await getSql();
      const itemId = await resolveItemId(data.id);
      if (!itemId) throw new Error("App not found.");

      const ratings = await sql<{ stars: number }>`
        select stars from showcase_ratings
        where item_id = ${itemId} and user_id = ${context.userId}
        limit 1
      `;
      const reports = await sql<{ id: string }>`
        select id from showcase_reports
        where item_id = ${itemId} and user_id = ${context.userId}
        limit 1
      `;
      return {
        myStars: ratings[0]?.stars ?? null,
        hasReported: Boolean(reports[0]),
      };
    } catch (err) {
      throw friendly(err);
    }
  });

export const setItemStars = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { itemId: string; stars: number }) => {
    const itemId = String(input.itemId ?? "").trim();
    const stars = Number(input.stars);
    if (!itemId) throw new Error("Missing item.");
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      throw new Error("Pick 1–5 stars.");
    }
    return { itemId, stars };
  })
  .handler(async ({ context, data }) => {
    try {
      const sql = await getSql();
      const itemId = await resolveItemId(data.itemId);
      if (!itemId) throw new Error("App not found.");
      const items = await sql<{ id: string; status: string }>`
        select id, status from showcase_items where id = ${itemId} limit 1
      `;
      if (!items[0] || items[0].status !== "approved") {
        throw new Error("Only approved apps can be rated.");
      }
      await sql`
        insert into showcase_ratings (item_id, user_id, stars, created_at, updated_at)
        values (${itemId}, ${context.userId}, ${data.stars}, now(), now())
        on conflict (item_id, user_id) do update set
          stars = excluded.stars,
          updated_at = now()
      `;
      return {
        myStars: data.stars,
        stats: await loadStats(itemId),
      };
    } catch (err) {
      throw friendly(err);
    }
  });

export const createReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      itemId: string;
      body: string;
      stars?: number | null;
      authorName?: string;
    }) => {
      const itemId = String(input.itemId ?? "").trim();
      const body = String(input.body ?? "").trim();
      if (!itemId) throw new Error("Missing item.");
      if (body.length < 8) {
        throw new Error("Review should be at least a short sentence.");
      }
      if (body.length > 2000) throw new Error("Review is too long (max 2000).");
      let stars: number | null = null;
      if (input.stars != null) {
        const s = Number(input.stars);
        if (!Number.isInteger(s) || s < 1 || s > 5) {
          throw new Error("Stars must be 1–5 if provided.");
        }
        stars = s;
      }
      return {
        itemId,
        body,
        stars,
        authorName: String(input.authorName ?? "").trim().slice(0, 80),
      };
    },
  )
  .handler(async ({ context, data }) => {
    try {
      const sql = await getSql();
      const itemId = await resolveItemId(data.itemId);
      if (!itemId) throw new Error("App not found.");
      const items = await sql<{ id: string; status: string }>`
        select id, status from showcase_items where id = ${itemId} limit 1
      `;
      if (!items[0] || items[0].status !== "approved") {
        throw new Error("Only approved apps can be reviewed.");
      }

      const profile = await getProfile(context.userId);
      const authorName =
        data.authorName || profile.displayName || profile.handle || "Member";
      const authorHandle = profile.handle
        ? normalizeHandle(profile.handle)
        : "";

      const id = crypto.randomUUID();
      await sql`
        insert into showcase_reviews (
          id, item_id, user_id, author_name, author_handle, body, stars, created_at, updated_at
        ) values (
          ${id},
          ${itemId},
          ${context.userId},
          ${authorName},
          ${authorHandle},
          ${data.body},
          ${data.stars},
          now(),
          now()
        )
      `;

      if (data.stars != null) {
        await sql`
          insert into showcase_ratings (item_id, user_id, stars, created_at, updated_at)
          values (${itemId}, ${context.userId}, ${data.stars}, now(), now())
          on conflict (item_id, user_id) do update set
            stars = excluded.stars,
            updated_at = now()
        `;
      }

      const reviewRows = await sql<ReviewRow>`
        select * from showcase_reviews where id = ${id} limit 1
      `;
      return {
        review: rowToReview(reviewRows[0]!),
        stats: await loadStats(itemId),
        myStars: data.stars,
      };
    } catch (err) {
      throw friendly(err);
    }
  });

export const reportShowcaseItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { itemId: string; message: string }) => {
    const itemId = String(input.itemId ?? "").trim();
    const message = String(input.message ?? "").trim();
    if (!itemId) throw new Error("Missing item.");
    if (message.length < 4) {
      throw new Error("Please add a short reason for the report.");
    }
    if (message.length > 500) throw new Error("Report is too long (max 500).");
    return { itemId, message };
  })
  .handler(async ({ context, data }) => {
    try {
      const sql = await getSql();
      const itemId = await resolveItemId(data.itemId);
      if (!itemId) throw new Error("App not found.");
      const existing = await sql<{ id: string }>`
        select id from showcase_reports
        where item_id = ${itemId} and user_id = ${context.userId}
        limit 1
      `;
      if (existing[0]) {
        throw new Error("You already reported this app. Thanks for the flag.");
      }

      await sql`
        insert into showcase_reports (id, item_id, user_id, message, created_at)
        values (
          ${crypto.randomUUID()},
          ${itemId},
          ${context.userId},
          ${data.message},
          now()
        )
      `;
      return { ok: true as const };
    } catch (err) {
      throw friendly(err);
    }
  });

export const listShowcaseReports = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const sql = await getSql();
      const profiles = await sql<{ x_handle: string }>`
        select x_handle from profiles where user_id = ${context.userId} limit 1
      `;
      if (!isAdminHandle(profiles[0]?.x_handle ?? null)) {
        throw new Error("Forbidden");
      }
      const rows = await sql<{
        id: string;
        item_id: string;
        user_id: string;
        message: string;
        created_at: string | Date;
        slug: string | null;
        app_name: string | null;
        author_handle: string;
      }>`
        select r.id, r.item_id, r.user_id, r.message, r.created_at,
               i.slug, i.app_name, i.author_handle
        from showcase_reports r
        join showcase_items i on i.id = r.item_id
        order by r.created_at desc
        limit 100
      `;
      return rows.map((r) => ({
        id: r.id,
        itemId: r.item_id,
        userId: r.user_id,
        message: r.message,
        createdAt: toIso(r.created_at),
        slug: r.slug || r.item_id,
        appName: r.app_name || "Untitled",
        authorHandle: r.author_handle,
      }));
    } catch (err) {
      throw friendly(err);
    }
  });
