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

/**
 * Email is configured separately from the rest, and optionally, because a
 * development machine must be able to run the auth flow before a domain is
 * verified in Resend. Without a key, `src/features/auth/mail.ts` logs the
 * message instead of sending it — see the note there.
 *
 * `EMAIL_FROM` defaults to Resend's sandbox sender, which delivers only to the
 * account owner's own address. The production value waits on
 * docs/OPEN_QUESTIONS.md Q5 (`no-reply@nuwa.sa`, pending DNS verification).
 */
const mailSchema = z.object({
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).default("onboarding@resend.dev"),
});

export type MailEnv = z.infer<typeof mailSchema>;

let cachedMail: MailEnv | null = null;

export function mailEnv(): MailEnv {
  if (cachedMail) return cachedMail;

  const parsed = mailSchema.safeParse(process.env);
  if (!parsed.success) {
    const invalid = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid email environment variables: ${invalid}.`);
  }

  cachedMail = parsed.data;
  return cachedMail;
}
