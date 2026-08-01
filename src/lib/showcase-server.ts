import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { isAdminHandle, normalizeHandle } from "@/lib/admins";
import {
  formatChangeSummary,
  summarizeShowcaseChanges,
} from "@/lib/showcase-diff";
import {
  isShowcaseCategory,
  normalizeHttpUrl,
  promptStyleNeedsText,
  PROMPT_STYLES,
  type PromptStyleId,
  type ShowcaseCategoryId,
} from "@/lib/showcase-options";
import { uniqueSlug } from "@/lib/slug";

export type ShowcaseStatus = "pending" | "approved" | "rejected";

export type ShowcaseItem = {
  id: string;
  userId: string;
  slug: string;
  appName: string;
  category: string;
  authorName: string;
  authorHandle: string;
  description: string;
  tools: string;
  prompt: string;
  model: string;
  promptStyle: string;
  creationUrl: string;
  imageData: string;
  status: ShowcaseStatus;
  changeSummary: string;
  lastEditedBy: string | null;
  editCount: number;
  createdAt: string;
  updatedAt: string;
  avgStars: number | null;
  ratingCount: number;
  reviewCount: number;
};

type ShowcaseRow = {
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
  avg_stars?: string | number | null;
  rating_count?: string | number | null;
  review_count?: string | number | null;
};

function rowToItem(row: ShowcaseRow): ShowcaseItem {
  const appName =
    (row.app_name ?? "").trim() || row.author_name || "Untitled app";
  const ratingCount = Number(row.rating_count ?? 0);
  const avgRaw = row.avg_stars;
  const avgStars =
    ratingCount > 0 && avgRaw != null && avgRaw !== ""
      ? Math.round(Number(avgRaw) * 10) / 10
      : null;
  return {
    id: row.id,
    userId: row.user_id,
    slug: (row.slug ?? "").trim() || row.id,
    appName,
    category: isShowcaseCategory(row.category ?? "")
      ? (row.category as string)
      : "other",
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
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : row.created_at.toISOString(),
    updatedAt:
      typeof row.updated_at === "string"
        ? row.updated_at
        : row.updated_at.toISOString(),
    avgStars,
    ratingCount,
    reviewCount: Number(row.review_count ?? 0),
  };
}

function newId(): string {
  return crypto.randomUUID();
}

async function allocateSlug(
  appName: string,
  excludeId?: string,
): Promise<string> {
  const sql = await getSql();
  return uniqueSlug(appName, async (candidate) => {
    const rows = excludeId
      ? await sql<{ id: string }>`
          select id from showcase_items
          where lower(slug) = ${candidate.toLowerCase()}
            and id <> ${excludeId}
          limit 1
        `
      : await sql<{ id: string }>`
          select id from showcase_items
          where lower(slug) = ${candidate.toLowerCase()}
          limit 1
        `;
    return Boolean(rows[0]);
  });
}

function friendlyDbError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("pglite.data") ||
    msg.includes("DATABASE_URL") ||
    msg.includes("PGLite") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("password authentication") ||
    msg.includes("no such file")
  ) {
    return new Error(
      "Showcase database is still starting up or not linked to this publish yet. " +
        "Try re-publishing the app in a minute. If this persists, the host may not " +
        "have provisioned Postgres for this deploy.",
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

function assertUrl(url: string): string {
  const trimmed = normalizeHttpUrl(url);
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Creation link must be a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Creation link must start with http:// or https://.");
  }
  return parsed.toString();
}

function assertImage(data: string): string {
  const trimmed = data.trim();
  if (!trimmed.startsWith("data:image/")) {
    throw new Error("Photo must be an image upload.");
  }
  if (trimmed.length > 2_200_000) {
    throw new Error("Photo is too large. Try a smaller image (under ~1.5MB).");
  }
  return trimmed;
}

const VALID_STYLES = new Set(PROMPT_STYLES.map((s) => s.id));

function normalizeAppName(raw: string): string {
  const appName = String(raw ?? "").trim().slice(0, 80);
  if (appName.length < 2) {
    throw new Error("App name should be at least 2 characters.");
  }
  return appName;
}

function normalizeCategory(raw: unknown): ShowcaseCategoryId {
  const categoryRaw = String(raw ?? "").trim();
  if (!categoryRaw) {
    throw new Error("Pick a category for your app.");
  }
  if (!isShowcaseCategory(categoryRaw)) {
    throw new Error("Pick a valid category.");
  }
  return categoryRaw;
}

function normalizeSubmissionFields(input: {
  appName?: string;
  category?: string;
  description: string;
  tools: string;
  prompt: string;
  model?: string;
  promptStyle?: string;
  creationUrl: string;
  imageData?: string;
  authorName?: string;
  authorHandle?: string;
  requireImage?: boolean;
}) {
  const appName = normalizeAppName(String(input.appName ?? ""));
  const category = normalizeCategory(input.category);
  const description = String(input.description ?? "").trim();
  const tools = String(input.tools ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .join(", ");
  let promptStyle = String(
    input.promptStyle ?? "one_shot",
  ).trim() as PromptStyleId;
  if (!VALID_STYLES.has(promptStyle)) promptStyle = "one_shot";
  let prompt = String(input.prompt ?? "").trim();
  if (!promptStyleNeedsText(promptStyle)) {
    prompt =
      prompt ||
      "Long multi-day process — no single prompt (iterated across many sessions).";
  }
  const model = String(input.model ?? "").trim().slice(0, 80);

  if (description.length < 8) {
    throw new Error("Description should be at least a short sentence.");
  }
  if (description.length > 1200) {
    throw new Error("Description is too long (max 1200 characters).");
  }
  if (tools.length < 1 || tools.length > 400) {
    throw new Error("Add at least one tool (max ~400 characters total).");
  }
  if (promptStyleNeedsText(promptStyle)) {
    if (prompt.length < 1 || prompt.length > 4000) {
      throw new Error(
        "Prompt is required for this style (max 4000 characters).",
      );
    }
  } else if (prompt.length > 4000) {
    throw new Error("Prompt is too long (max 4000 characters).");
  }
  if (!model) {
    throw new Error("Select or enter the model you used.");
  }

  return {
    appName,
    category,
    description,
    tools,
    prompt,
    model,
    promptStyle,
    creationUrl: assertUrl(String(input.creationUrl ?? "")),
    imageData:
      input.requireImage === false && !input.imageData
        ? undefined
        : assertImage(String(input.imageData ?? "")),
    authorName: String(input.authorName ?? "").trim().slice(0, 80),
    authorHandle: normalizeHandle(String(input.authorHandle ?? "")),
  };
}

async function getProfileHandle(userId: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ x_handle: string }>`
    select x_handle from profiles where user_id = ${userId} limit 1
  `;
  return rows[0]?.x_handle ?? null;
}

async function requireAdmin(userId: string): Promise<void> {
  const handle = await getProfileHandle(userId);
  if (!isAdminHandle(handle)) {
    throw new Error("Forbidden");
  }
}

async function fetchItem(id: string): Promise<ShowcaseItem | null> {
  const sql = await getSql();
  const rows = await sql<ShowcaseRow>`
    select i.*,
      (select avg(stars)::float from showcase_ratings r where r.item_id = i.id) as avg_stars,
      (select count(*)::int from showcase_ratings r where r.item_id = i.id) as rating_count,
      (select count(*)::int from showcase_reviews v where v.item_id = i.id) as review_count
    from showcase_items i
    where i.id = ${id}
    limit 1
  `;
  return rows[0] ? rowToItem(rows[0]) : null;
}

export const getShowcaseSession = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const sql = await getSql();
      const users = await sql<{
        name: string;
        email: string | null;
        image: string | null;
      }>`
        select name, email, image from "user" where id = ${context.userId} limit 1
      `;
      const user = users[0];
      const handle = await getProfileHandle(context.userId);
      return {
        userId: context.userId,
        displayName: user?.name ?? null,
        email: user?.email ?? null,
        image: user?.image ?? null,
        xHandle: handle,
        isAdmin: isAdminHandle(handle),
      };
    } catch (err) {
      throw friendlyDbError(err);
    }
  });

export const setMyHandle = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { handle: string; displayName?: string }) => {
    const handle = normalizeHandle(String(input.handle ?? ""));
    if (!/^[a-zA-Z0-9_]{1,15}$/.test(handle)) {
      throw new Error(
        "X handle must be 1–15 letters, numbers, or underscores.",
      );
    }
    return {
      handle,
      displayName: (input.displayName ?? "").trim().slice(0, 80) || null,
    };
  })
  .handler(async ({ context, data }) => {
    try {
      const sql = await getSql();
      const taken = await sql<{ user_id: string }>`
        select user_id from profiles
        where lower(x_handle) = ${data.handle}
          and user_id <> ${context.userId}
        limit 1
      `;
      if (taken[0]) {
        throw new Error("That X handle is already linked to another account.");
      }

      await sql`
        insert into profiles (user_id, x_handle, display_name, created_at, updated_at)
        values (
          ${context.userId},
          ${data.handle},
          ${data.displayName},
          now(),
          now()
        )
        on conflict (user_id) do update set
          x_handle = excluded.x_handle,
          display_name = coalesce(excluded.display_name, profiles.display_name),
          updated_at = now()
      `;

      return {
        xHandle: data.handle,
        isAdmin: isAdminHandle(data.handle),
      };
    } catch (err) {
      throw friendlyDbError(err);
    }
  });

export const listApprovedShowcase = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const sql = await getSql();
      const rows = await sql<ShowcaseRow>`
        select i.*,
          (select avg(stars)::float from showcase_ratings r where r.item_id = i.id) as avg_stars,
          (select count(*)::int from showcase_ratings r where r.item_id = i.id) as rating_count,
          (select count(*)::int from showcase_reviews v where v.item_id = i.id) as review_count
        from showcase_items i
        where i.status = 'approved'
        order by
          coalesce(
            (select avg(stars)::float from showcase_ratings r where r.item_id = i.id),
            0
          ) desc,
          (select count(*)::int from showcase_ratings r where r.item_id = i.id) desc,
          i.created_at desc
      `;
      return rows.map(rowToItem);
    } catch (err) {
      console.error("[showcase] listApproved failed:", err);
      throw friendlyDbError(err);
    }
  },
);

/** Public builder presence — approved showcase items for an X handle. */
export const listApprovedShowcaseByHandle = createServerFn({ method: "POST" })
  .validator((input: { handle: string }) => {
    const handle = normalizeHandle(String(input?.handle ?? ""));
    if (!/^[a-z0-9_]{1,15}$/.test(handle)) {
      throw new Error("Invalid builder handle.");
    }
    return { handle };
  })
  .handler(async ({ data }) => {
    try {
      const sql = await getSql();
      const rows = await sql<ShowcaseRow>`
        select i.*,
          (select avg(stars)::float from showcase_ratings r where r.item_id = i.id) as avg_stars,
          (select count(*)::int from showcase_ratings r where r.item_id = i.id) as rating_count,
          (select count(*)::int from showcase_reviews v where v.item_id = i.id) as review_count
        from showcase_items i
        where i.status = 'approved'
          and lower(i.author_handle) = ${data.handle}
        order by i.created_at desc
      `;
      return rows.map(rowToItem);
    } catch (err) {
      console.error("[showcase] listApprovedByHandle failed:", err);
      throw friendlyDbError(err);
    }
  });

export const listMyShowcase = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const sql = await getSql();
      const rows = await sql<ShowcaseRow>`
        select i.*,
          (select avg(stars)::float from showcase_ratings r where r.item_id = i.id) as avg_stars,
          (select count(*)::int from showcase_ratings r where r.item_id = i.id) as rating_count,
          (select count(*)::int from showcase_reviews v where v.item_id = i.id) as review_count
        from showcase_items i
        where i.user_id = ${context.userId}
        order by i.created_at desc
      `;
      return rows.map(rowToItem);
    } catch (err) {
      throw friendlyDbError(err);
    }
  });

export const getMyShowcaseItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => {
    const id = String(input.id ?? "").trim();
    if (!id) throw new Error("Missing item id.");
    return { id };
  })
  .handler(async ({ context, data }) => {
    try {
      const item = await fetchItem(data.id);
      if (!item) throw new Error("Submission not found.");
      const admin = isAdminHandle(await getProfileHandle(context.userId));
      if (item.userId !== context.userId && !admin) {
        throw new Error("Forbidden");
      }
      return item;
    } catch (err) {
      throw friendlyDbError(err);
    }
  });

export const listPendingShowcase = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql<ShowcaseRow>`
      select *
      from showcase_items
      where status = 'pending'
      order by created_at asc
    `;
    return rows.map(rowToItem);
  });

export const listAllShowcaseAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      await requireAdmin(context.userId);
      const sql = await getSql();
      const rows = await sql<ShowcaseRow>`
        select *
        from showcase_items
        order by
          case status
            when 'pending' then 0
            when 'approved' then 1
            else 2
          end,
          updated_at desc
      `;
      return rows.map(rowToItem);
    } catch (err) {
      throw friendlyDbError(err);
    }
  });

export const createShowcaseItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      appName: string;
      category: string;
      description: string;
      tools: string;
      prompt: string;
      model: string;
      promptStyle: string;
      creationUrl: string;
      imageData: string;
      authorName?: string;
      authorHandle?: string;
    }) =>
      normalizeSubmissionFields({
        ...input,
        requireImage: true,
      }),
  )
  .handler(async ({ context, data }) => {
    try {
      const sql = await getSql();
      let handle = await getProfileHandle(context.userId);
      if (!handle) {
        if (!/^[a-z0-9_]{1,15}$/.test(data.authorHandle)) {
          throw new Error("Link your X handle before submitting.");
        }
        const taken = await sql<{ user_id: string }>`
          select user_id from profiles
          where lower(x_handle) = ${data.authorHandle}
            and user_id <> ${context.userId}
          limit 1
        `;
        if (taken[0]) {
          throw new Error("That X handle is already linked to another account.");
        }
        await sql`
          insert into profiles (user_id, x_handle, display_name, created_at, updated_at)
          values (
            ${context.userId},
            ${data.authorHandle},
            ${data.authorName || null},
            now(),
            now()
          )
          on conflict (user_id) do update set
            x_handle = excluded.x_handle,
            display_name = coalesce(excluded.display_name, profiles.display_name),
            updated_at = now()
        `;
        handle = data.authorHandle;
      }

      const users = await sql<{ name: string }>`
        select name from "user" where id = ${context.userId} limit 1
      `;
      const authorName =
        data.authorName || users[0]?.name || handle || "Creator";
      const id = newId();
      const slug = await allocateSlug(data.appName);

      await sql`
        insert into showcase_items (
          id, user_id, slug, app_name, category, author_name, author_handle,
          description, tools, prompt, model, prompt_style,
          creation_url, image_data,
          status, change_summary, last_edited_by, edit_count,
          created_at, updated_at
        ) values (
          ${id},
          ${context.userId},
          ${slug},
          ${data.appName},
          ${data.category},
          ${authorName},
          ${handle},
          ${data.description},
          ${data.tools},
          ${data.prompt},
          ${data.model},
          ${data.promptStyle},
          ${data.creationUrl},
          ${data.imageData},
          'pending',
          '',
          ${context.userId},
          0,
          now(),
          now()
        )
      `;

      return (await fetchItem(id))!;
    } catch (err) {
      throw friendlyDbError(err);
    }
  });

export const updateOwnerShowcaseItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      id: string;
      appName: string;
      category: string;
      description: string;
      tools: string;
      prompt: string;
      model: string;
      promptStyle: string;
      creationUrl: string;
      imageData?: string;
      authorName?: string;
    }) => {
      const id = String(input.id ?? "").trim();
      if (!id) throw new Error("Missing item id.");
      const fields = normalizeSubmissionFields({
        ...input,
        requireImage: false,
      });
      return { id, ...fields };
    },
  )
  .handler(async ({ context, data }) => {
    try {
      const existing = await fetchItem(data.id);
      if (!existing) throw new Error("Submission not found.");
      if (existing.userId !== context.userId) {
        throw new Error("Forbidden");
      }

      const nextImage = data.imageData ?? existing.imageData;
      const nextAuthor = data.authorName || existing.authorName;
      const changes = summarizeShowcaseChanges(
        {
          appName: existing.appName,
          category: existing.category,
          description: existing.description,
          tools: existing.tools,
          prompt: existing.prompt,
          model: existing.model,
          promptStyle: existing.promptStyle,
          creationUrl: existing.creationUrl,
          authorName: existing.authorName,
          authorHandle: existing.authorHandle,
          previousImageData: existing.imageData,
        },
        {
          appName: data.appName,
          category: data.category,
          description: data.description,
          tools: data.tools,
          prompt: data.prompt,
          model: data.model,
          promptStyle: data.promptStyle,
          creationUrl: data.creationUrl,
          authorName: nextAuthor,
          authorHandle: existing.authorHandle,
          imageData: nextImage,
          previousImageData: existing.imageData,
        },
      );

      if (!changes.length) {
        throw new Error("No changes to save.");
      }

      const summary = formatChangeSummary(changes);
      const nextSlug =
        data.appName.trim() !== existing.appName.trim()
          ? await allocateSlug(data.appName, data.id)
          : existing.slug;

      const sql = await getSql();
      await sql`
        update showcase_items set
          slug = ${nextSlug},
          app_name = ${data.appName},
          category = ${data.category},
          author_name = ${nextAuthor},
          description = ${data.description},
          tools = ${data.tools},
          prompt = ${data.prompt},
          model = ${data.model},
          prompt_style = ${data.promptStyle},
          creation_url = ${data.creationUrl},
          image_data = ${nextImage},
          status = 'pending',
          change_summary = ${summary},
          last_edited_by = ${context.userId},
          edit_count = coalesce(edit_count, 0) + 1,
          updated_at = now()
        where id = ${data.id}
          and user_id = ${context.userId}
      `;

      return (await fetchItem(data.id))!;
    } catch (err) {
      throw friendlyDbError(err);
    }
  });

export const updateShowcaseItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      id: string;
      appName: string;
      category: string;
      description: string;
      tools: string;
      prompt: string;
      model?: string;
      promptStyle?: string;
      creationUrl: string;
      imageData?: string;
      status?: ShowcaseStatus;
      authorName?: string;
      authorHandle?: string;
    }) => {
      const id = String(input.id ?? "").trim();
      if (!id) throw new Error("Missing item id.");
      const fields = normalizeSubmissionFields({
        appName: input.appName,
        category: input.category,
        description: input.description,
        tools: input.tools,
        prompt: input.prompt,
        model: input.model || "Unknown",
        promptStyle: input.promptStyle || "one_shot",
        creationUrl: input.creationUrl,
        imageData: input.imageData,
        authorName: input.authorName,
        authorHandle: input.authorHandle,
        requireImage: false,
      });
      const status = input.status;
      if (status && !["pending", "approved", "rejected"].includes(status)) {
        throw new Error("Invalid status.");
      }
      const authorName = fields.authorName || "";
      let authorHandle = fields.authorHandle;
      if (authorHandle && !/^[a-z0-9_]{1,15}$/.test(authorHandle)) {
        throw new Error("Handle must be 1–15 letters, numbers, or underscores.");
      }
      return {
        id,
        ...fields,
        authorName,
        authorHandle,
        status: status as ShowcaseStatus | undefined,
      };
    },
  )
  .handler(async ({ context, data }) => {
    try {
      await requireAdmin(context.userId);
      const existing = await fetchItem(data.id);
      if (!existing) throw new Error("Item not found.");

      const nextImage = data.imageData ?? existing.imageData;
      const nextName = data.authorName || existing.authorName;
      const nextHandle = data.authorHandle || existing.authorHandle;

      const changes = summarizeShowcaseChanges(
        {
          appName: existing.appName,
          category: existing.category,
          description: existing.description,
          tools: existing.tools,
          prompt: existing.prompt,
          model: existing.model,
          promptStyle: existing.promptStyle,
          creationUrl: existing.creationUrl,
          authorName: existing.authorName,
          authorHandle: existing.authorHandle,
          previousImageData: existing.imageData,
        },
        {
          appName: data.appName,
          category: data.category,
          description: data.description,
          tools: data.tools,
          prompt: data.prompt,
          model: data.model,
          promptStyle: data.promptStyle,
          creationUrl: data.creationUrl,
          authorName: nextName,
          authorHandle: nextHandle,
          imageData: nextImage,
          previousImageData: existing.imageData,
        },
      );
      if (data.status && data.status !== existing.status) {
        changes.push(`status → ${data.status}`);
      }
      const summary = changes.length
        ? `Admin: ${formatChangeSummary(changes)}`
        : existing.changeSummary;

      const sql = await getSql();
      const nextStatus = data.status ?? existing.status;
      const changeSummary =
        nextStatus === "approved" ? "" : summary || existing.changeSummary;

      const nextSlug =
        data.appName.trim() !== existing.appName.trim()
          ? await allocateSlug(data.appName, data.id)
          : existing.slug;

      await sql`
        update showcase_items set
          slug = ${nextSlug},
          app_name = ${data.appName},
          category = ${data.category},
          author_name = ${nextName},
          author_handle = ${nextHandle},
          description = ${data.description},
          tools = ${data.tools},
          prompt = ${data.prompt},
          model = ${data.model},
          prompt_style = ${data.promptStyle},
          creation_url = ${data.creationUrl},
          image_data = ${nextImage},
          status = ${nextStatus},
          change_summary = ${changeSummary},
          last_edited_by = ${context.userId},
          edit_count = coalesce(edit_count, 0) + ${changes.length ? 1 : 0},
          updated_at = now(),
          reviewed_by = ${context.userId},
          reviewed_at = now()
        where id = ${data.id}
      `;

      return (await fetchItem(data.id))!;
    } catch (err) {
      throw friendlyDbError(err);
    }
  });

export const setShowcaseStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; status: ShowcaseStatus }) => {
    const id = String(input.id ?? "").trim();
    const status = input.status;
    if (!id) throw new Error("Missing item id.");
    if (!["pending", "approved", "rejected"].includes(status)) {
      throw new Error("Invalid status.");
    }
    return { id, status };
  })
  .handler(async ({ context, data }) => {
    try {
      await requireAdmin(context.userId);
      const sql = await getSql();
      if (data.status === "approved") {
        await sql`
          update showcase_items set
            status = ${data.status},
            change_summary = '',
            updated_at = now(),
            reviewed_by = ${context.userId},
            reviewed_at = now()
          where id = ${data.id}
        `;
      } else {
        await sql`
          update showcase_items set
            status = ${data.status},
            updated_at = now(),
            reviewed_by = ${context.userId},
            reviewed_at = now()
          where id = ${data.id}
        `;
      }
      const item = await fetchItem(data.id);
      if (!item) throw new Error("Item not found.");
      return item;
    } catch (err) {
      throw friendlyDbError(err);
    }
  });

export const deleteShowcaseItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => {
    const id = String(input.id ?? "").trim();
    if (!id) throw new Error("Missing item id.");
    return { id };
  })
  .handler(async ({ context, data }) => {
    try {
      await requireAdmin(context.userId);
      const sql = await getSql();
      await sql`delete from showcase_items where id = ${data.id}`;
      return { ok: true as const };
    } catch (err) {
      throw friendlyDbError(err);
    }
  });

export async function fetchItemBySlugOrId(
  slugOrId: string,
): Promise<ShowcaseItem | null> {
  const key = String(slugOrId ?? "").trim();
  if (!key) return null;
  const sql = await getSql();
  const bySlug = await sql<ShowcaseRow>`
    select i.*,
      (select avg(stars)::float from showcase_ratings r where r.item_id = i.id) as avg_stars,
      (select count(*)::int from showcase_ratings r where r.item_id = i.id) as rating_count,
      (select count(*)::int from showcase_reviews v where v.item_id = i.id) as review_count
    from showcase_items i
    where lower(i.slug) = ${key.toLowerCase()}
    limit 1
  `;
  if (bySlug[0]) return rowToItem(bySlug[0]);
  const byId = await sql<ShowcaseRow>`
    select i.*,
      (select avg(stars)::float from showcase_ratings r where r.item_id = i.id) as avg_stars,
      (select count(*)::int from showcase_ratings r where r.item_id = i.id) as rating_count,
      (select count(*)::int from showcase_reviews v where v.item_id = i.id) as review_count
    from showcase_items i
    where i.id = ${key}
    limit 1
  `;
  return byId[0] ? rowToItem(byId[0]) : null;
}
