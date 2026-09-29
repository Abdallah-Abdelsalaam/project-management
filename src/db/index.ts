import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { serverEnv } from "@/lib/env";
import * as schema from "@/db/schema";

/**
 * MySQL over a mysql2 pool.
 *
 * The project ran on Neon Postgres over HTTP until session 3, when the
 * database moved to the organisation's own Hostinger MySQL instance —
 * `docs/DECISIONS.md` ADR-018 records the trade. Two consequences are worth
 * knowing here rather than discovering later:
 *
 *   - **A pool, not one request per query.** `neon-http` was stateless; a
 *     MySQL connection is not. `connectionLimit` is deliberately small because
 *     a serverless platform multiplies it by the number of warm instances, and
 *     shared MySQL hosting caps `max_connections` low. Raise it only with the
 *     server's limit in hand.
 *   - **Real transactions.** `neon-http` could only batch statements declared
 *     up front. `db().transaction()` here is interactive, which is what lets a
 *     permission change and its audit rows be written and read back inside one
 *     atomic unit.
 *
 * Every timestamp is UTC, end to end: `timezone: "Z"` makes mysql2 read and
 * write `DATETIME` as UTC, and the session time zone is pinned to `+00:00` so
 * anything the server computes agrees with it. Without both, a server whose
 * local zone is not UTC silently shifts every expiry by its offset — and an
 * expiry that is three hours out is an auth bug, not a display bug.
 */
let pool: mysql.Pool | null = null;
let client: ReturnType<typeof createClient> | null = null;

function createPool(): mysql.Pool {
  const created = mysql.createPool({
    uri: serverEnv().DATABASE_URL,
    timezone: "Z",
    connectionLimit: 5,
    waitForConnections: true,
    enableKeepAlive: true,
    // Dates come back as JS Date objects rather than strings.
    dateStrings: false,
  });

  // mysql2 has no "run this on every new connection" option, so pin the
  // session zone as connections are handed out by the pool.
  created.on("connection", (connection) => {
    void connection.query("SET time_zone = '+00:00'");
  });

  return created;
}

function createClient() {
  pool ??= createPool();
  return drizzle(pool, { schema, mode: "default", casing: "snake_case" });
}

export function db() {
  client ??= createClient();
  return client;
}

/** The drizzle client, for signatures that accept one or a transaction. */
export type Database = ReturnType<typeof db>;

/** Whatever `db().transaction()` hands its callback. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** A client or a transaction — what every write helper should accept. */
export type Executor = Database | Transaction;

/**
 * Closes the pool. Scripts (`pnpm db:seed`) and tests need this because an
 * open pool keeps the Node process alive; the app never calls it.
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    client = null;
  }
}
