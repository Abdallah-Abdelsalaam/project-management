import { z } from "zod";

/**
 * Environment contract. Parsed lazily so a missing DATABASE_URL fails at the
 * first query with a readable message rather than at import time — the shell
 * must still build and render before the database exists.
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(
      `Missing or invalid environment variables: ${missing}. Copy .env.example to .env.local and fill them in.`,
    );
  }

  cached = parsed.data;
  return cached;
}
