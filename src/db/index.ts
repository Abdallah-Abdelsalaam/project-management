import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { serverEnv } from "@/lib/env";
import * as schema from "@/db/schema";

/**
 * Neon over HTTP: one round trip per query, no connection to pool, which is
 * what serverless functions want. Long transactions will need the WebSocket
 * driver instead — introduce it in the session that first needs one.
 *
 * Lazily constructed so importing this module never requires DATABASE_URL to
 * be set (the shell builds before the database exists).
 */
let client: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db() {
  if (!client) {
    client = drizzle(neon(serverEnv().DATABASE_URL), { schema, casing: "snake_case" });
  }
  return client;
}
