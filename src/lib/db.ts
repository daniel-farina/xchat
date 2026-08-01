/** Which database backend is active. */
export type DbSource = "neon" | "pglite";

/**
 * Read env at **call time** with bracket access so bundlers (Vite/Nitro) cannot
 * replace `process.env.DATABASE_URL` with `undefined` at build time. Deployed
 * apps inject the real Neon URL only at runtime.
 */
function readEnv(key: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const value = process.env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/** True on Vercel / Lambda where the PGLite WASM data file is not available. */
export function isServerlessRuntime(): boolean {
  if (typeof process === "undefined") return false;
  return Boolean(
    process.env["VERCEL"] ||
      process.env["AWS_LAMBDA_FUNCTION_NAME"] ||
      process.env["LAMBDA_TASK_ROOT"] ||
      process.env["VERCEL_ENV"],
  );
}

/**
 * Active backend: real **Neon** when `DATABASE_URL` is set (deployed), otherwise
 * embedded **PGLite** for the sandbox live preview only. Never use PGLite on
 * serverless — its `pglite.data` asset is not present under `/var/task`.
 */
export function resolveDbSource(): DbSource {
  if (readEnv("DATABASE_URL")) return "neon";
  if (isServerlessRuntime()) return "neon";
  return "pglite";
}

/** Snapshot at first import — prefer resolveDbSource() for runtime accuracy. */
export const dbSource: DbSource = resolveDbSource();

export interface Sql {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
}

const globalRef = globalThis as typeof globalThis & {
  __pgSqlPromise__?: Promise<Sql>;
  __pgliteInstance__?: Promise<import("@electric-sql/pglite").PGlite>;
  __pgliteMigrateChain__?: Promise<void>;
  __neonMigratePromise__?: Promise<void>;
};

const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_INTERVAL = 1186;
const identity = (v: string) => v;

type Run = <T>(text: string, params: unknown[]) => Promise<T[]>;

function toSql(run: Run): Sql {
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]> => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1)
      text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as unknown as Sql;
  sql.query = <T = Record<string, unknown>>(
    text: string,
    params: unknown[] = [],
  ) => run<T>(text, params);
  return sql;
}

/** Apply migrations/*.sql against a Neon pool (idempotent via `_migrations`). */
async function applyNeonMigrations(pool: import("pg").Pool): Promise<void> {
  globalRef.__neonMigratePromise__ ??= (async () => {
    const client = await pool.connect();
    try {
      await client.query(
        "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
      );
      const doneRes = await client.query<{ name: string }>(
        "select name from _migrations",
      );
      const done = new Set(doneRes.rows.map((r) => r.name));
      const migrations = import.meta.glob("/migrations/*.sql", {
        query: "?raw",
        import: "default",
        eager: true,
      }) as Record<string, string>;
      for (const [path, text] of Object.entries(migrations).sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        const name = path.split("/").pop() as string;
        if (done.has(name)) continue;
        try {
          await client.query("begin");
          await client.query(text);
          await client.query("insert into _migrations (name) values ($1)", [
            name,
          ]);
          await client.query("commit");
        } catch (err) {
          try {
            await client.query("rollback");
          } catch {
            /* keep original */
          }
          throw err;
        }
      }
    } finally {
      client.release();
    }
  })().catch((err) => {
    globalRef.__neonMigratePromise__ = undefined;
    throw err;
  });
  return globalRef.__neonMigratePromise__;
}

function createNeonSql(connectionString: string): Promise<Sql> {
  globalRef.__pgSqlPromise__ ??= (async () => {
    const { Pool, types } = await import("pg");
    types.setTypeParser(OID_INT8, Number);
    types.setTypeParser(OID_DATE, identity);
    types.setTypeParser(OID_INTERVAL, identity);
    const pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 15_000,
      ssl:
        connectionString.includes("sslmode=require") ||
        connectionString.includes("neon.tech")
          ? { rejectUnauthorized: false }
          : undefined,
    });
    // Safety net if build-time migrate was skipped (no DATABASE_URL at build).
    await applyNeonMigrations(pool);
    return toSql(async <T>(text: string, params: unknown[]) => {
      const res = await pool.query(text, params);
      return res.rows as T[];
    });
  })().catch((err) => {
    globalRef.__pgSqlPromise__ = undefined;
    throw err;
  });
  return globalRef.__pgSqlPromise__;
}

async function createPgliteSql(): Promise<Sql> {
  if (isServerlessRuntime()) {
    throw new Error(
      "Database is not configured for production (DATABASE_URL missing). " +
        "PGLite cannot run on the publish host.",
    );
  }

  globalRef.__pgliteInstance__ ??= (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite({
      parsers: {
        [OID_INT8]: Number,
        [OID_DATE]: identity,
        [OID_INTERVAL]: identity,
      },
    });
    await pg.waitReady;
    await pg.exec(
      "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    return pg;
  })().catch((err) => {
    globalRef.__pgliteInstance__ = undefined;
    throw err;
  });
  const pg = await globalRef.__pgliteInstance__;

  const migrate = async (): Promise<void> => {
    const migrations = import.meta.glob("/migrations/*.sql", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const doneRows = await pg.query<{ name: string }>(
      "select name from _migrations",
    );
    const done = new Set(doneRows.rows.map((r) => r.name));
    for (const [path, text] of Object.entries(migrations).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const name = path.split("/").pop() as string;
      if (done.has(name)) continue;
      await pg.transaction(async (tx) => {
        await tx.exec(text);
        await tx.query("insert into _migrations (name) values ($1)", [name]);
      });
    }
  };
  const pass = (globalRef.__pgliteMigrateChain__ ?? Promise.resolve())
    .catch(() => undefined)
    .then(migrate);
  globalRef.__pgliteMigrateChain__ = pass;
  await pass;

  return toSql(async <T>(text: string, params: unknown[]) => {
    const result = await pg.query<T>(text, params);
    return result.rows;
  });
}

let sqlPromise: Promise<Sql> | null = null;

async function createSql(): Promise<Sql> {
  if (typeof window !== "undefined") {
    throw new Error(
      "@/lib/db is server-only — call getSql() from a createServerFn handler " +
        "or a server route loader, never from client code.",
    );
  }

  const databaseUrl = readEnv("DATABASE_URL");
  if (databaseUrl) {
    return createNeonSql(databaseUrl);
  }

  if (isServerlessRuntime()) {
    throw new Error(
      "DATABASE_URL is not set on the published app. " +
        "The showcase needs a Postgres database — re-publish so the host can " +
        "provision it. If this keeps happening after a fresh publish, contact support.",
    );
  }

  return createPgliteSql();
}

export function getSql(): Promise<Sql> {
  sqlPromise ??= createSql().catch((err) => {
    sqlPromise = null;
    throw err;
  });
  return sqlPromise;
}

export async function getPglite(): Promise<import("@electric-sql/pglite").PGlite> {
  if (readEnv("DATABASE_URL") || isServerlessRuntime()) {
    throw new Error(
      "getPglite() is only available on the PGLite fallback (no DATABASE_URL)",
    );
  }
  await getSql();
  const pg = await globalRef.__pgliteInstance__;
  if (!pg) throw new Error("PGLite instance failed to initialize");
  return pg;
}

export function ensureDbReady(): Promise<void> {
  if (readEnv("DATABASE_URL") || isServerlessRuntime()) {
    return Promise.resolve();
  }
  return getSql().then(() => undefined);
}

const globalBoot = globalThis as typeof globalThis & {
  __pgBootstrapPromise__?: Promise<void>;
};
if (
  typeof window === "undefined" &&
  !readEnv("DATABASE_URL") &&
  !isServerlessRuntime()
) {
  globalBoot.__pgBootstrapPromise__ ??= ensureDbReady().catch((err) => {
    globalBoot.__pgBootstrapPromise__ = undefined;
    console.error("[db] PGLite bootstrap failed:", err);
    throw err;
  });
}
