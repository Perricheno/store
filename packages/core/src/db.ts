import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { migration } from "./migration";
import * as schema from "./schema";
export type Row = Record<string, any>;
export interface DB {
  query<T extends Row = Row>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string): Promise<void>;
}
interface DatabaseState {
  ready?: Promise<DB>;
  beginTransaction?: (fn: (db: DB) => Promise<any>) => Promise<any>;
  closeDatabase?: () => Promise<void>;
  drizzleDatabase?: unknown;
}
// Next creates separate server bundles and reloads modules in development. One process must
// still own a single PGlite connection/queue for its on-disk database.
const runtime = globalThis as typeof globalThis & {
  __urbanmagDatabase?: DatabaseState;
};
const state = (runtime.__urbanmagDatabase ??= {});
// postgres.unsafe receives raw values; serialize rich JS values explicitly rather
// than relying on prepared-statement parameter inference. Keep SQL arrays intact.
function postgresParameters(params: unknown[]) {
  return params.map((value) =>
    value instanceof Date
      ? value.toISOString()
      : value !== null &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          !(value instanceof Uint8Array)
        ? JSON.stringify(value)
        : value,
  );
}
export function database(): Promise<DB> {
  return (state.ready ??= connect().catch(async (error) => {
    try {
      await state.closeDatabase?.();
    } catch {}
    state.ready = undefined;
    state.beginTransaction = undefined;
    state.closeDatabase = undefined;
    throw error;
  }));
}
export async function transaction<T>(fn: (db: DB) => Promise<T>): Promise<T> {
  await database();
  return state.beginTransaction!(fn);
}
export async function getDrizzle() {
  await database();
  return state.drizzleDatabase;
}
export async function closeCoreDatabase() {
  await state.closeDatabase?.();
  state.ready = undefined;
  state.beginTransaction = undefined;
  state.closeDatabase = undefined;
  state.drizzleDatabase = undefined;
}
async function connect(): Promise<DB> {
  const production = process.env.APP_ENV === "production";
  if (production) {
    for (const key of ["DATABASE_URL", "MAIL_ENCRYPTION_KEY", "APP_SECRET"])
      if (!process.env[key])
        throw new Error(`Missing required production secret: ${key}`);
    if ((process.env.APP_SECRET?.length || 0) < 32)
      throw new Error("APP_SECRET must have at least 32 characters");
    if (!/^(sandbox|production)$/.test(process.env.APIPAY_MODE || ""))
      throw new Error("Production requires APIPAY_MODE=sandbox or production");
  }
  let db: DB;
  if (process.env.DATABASE_URL) {
    const { default: postgres } = await import("postgres");
    const sql = postgres(process.env.DATABASE_URL, { max: 10, prepare: false });
    db = {
      query: async (text, params = []) =>
        Array.from(
          await sql.unsafe(text, postgresParameters(params) as never[]),
        ) as any,
      exec: async (text) => {
        await sql.unsafe(text);
      },
    };
    state.beginTransaction = async (fn) =>
      sql.begin(async (sqltx: any) =>
        fn({
          query: async (text, params = []) =>
            Array.from(
              await sqltx.unsafe(text, postgresParameters(params)),
            ) as any,
          exec: async (text) => {
            await sqltx.unsafe(text);
          },
        }),
      );
    const { drizzle } = await import("drizzle-orm/postgres-js");
    state.drizzleDatabase = drizzle(sql, { schema });
    state.closeDatabase = () => sql.end();
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const dataDir = process.env.PGLITE_DATA_DIR || ".data/core";
    if (dataDir !== "memory://")
      await mkdir(dirname(resolve(dataDir)), { recursive: true });
    const pg = new PGlite(dataDir);
    db = {
      query: async (text, params = []) =>
        (await pg.query(text, params)).rows as any,
      exec: async (text) => {
        await pg.exec(text);
      },
    };
    // The embedded driver uses one connection: queue every operation so unrelated reads cannot enter another transaction.
    let tail: Promise<unknown> = Promise.resolve();
    const raw = db;
    const queued = <T>(fn: () => Promise<T>) => {
      const next = tail.then(fn, fn);
      tail = next.catch(() => {});
      return next;
    };
    db = {
      query: (text, params) => queued(() => raw.query(text, params)),
      exec: (text) => queued(() => raw.exec(text)),
    };
    state.beginTransaction = (fn) =>
      queued(async () => {
        await raw.exec("BEGIN");
        try {
          const value = await fn(raw);
          await raw.exec("COMMIT");
          return value;
        } catch (e) {
          await raw.exec("ROLLBACK");
          throw e;
        }
      });
    const { drizzle } = await import("drizzle-orm/pglite");
    state.drizzleDatabase = drizzle(pg, { schema });
    state.closeDatabase = () => pg.close();
  }
  await db.exec(migration);
  await db.exec(
    "CREATE TABLE IF NOT EXISTS visitor_locks (visitor_id text PRIMARY KEY)",
  );
  return db;
}
