# 01 · Tech stack

Chosen for Vercel: fastest cold starts, edge caching, one deployable, horizontal scale with no server management.

## Decided

| Layer       | Choice                                                  | Why                                                                                |
| ----------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Runtime     | Node.js, pnpm                                           | Current LTS on Vercel; pnpm is fast and strict                                     |
| Framework   | Next.js (App Router) + TypeScript strict                | Frontend and backend in one app; Server Components, Server Actions, streaming, ISR |
| Database    | PostgreSQL on Neon (Vercel Marketplace)                 | Serverless Postgres, autoscaling, pooling, a DB branch per preview deploy          |
| ORM         | Drizzle ORM + drizzle-kit                               | Lightweight, SQL-first, fast cold starts, fully typed                              |
| Auth        | Better Auth (email + password, sessions in DB)          | Modern, self-hosted, role support, no vendor lock-in                               |
| Validation  | Zod, shared client and server                           | One schema per form and action                                                     |
| UI          | Tailwind CSS + shadcn/ui                                | Match the wireframe precisely; logical properties for RTL                          |
| i18n        | next-intl (`/ar`, `/en`)                                | Locale routing, `dir` switching, ICU messages                                      |
| Forms       | React Hook Form + Zod resolver                          |                                                                                    |
| Client data | TanStack Query, only where needed                       | Default is Server Components — no client fetching unless interactive               |
| Testing     | Vitest (logic, actions) + Playwright (E2E, screenshots) |                                                                                    |
| Quality     | ESLint + Prettier, `tsc --noEmit`                       | Must pass before every commit                                                      |

## Installed versions

As of session 1 (2026-09-29).

| Package                            | Version         |
| ---------------------------------- | --------------- |
| node                               | 22.14.0 (local) |
| pnpm                               | 10.23.0         |
| next                               | 16.3.7          |
| react / react-dom                  | 19.2.8          |
| typescript                         | 5.9.3           |
| tailwindcss / @tailwindcss/postcss | 4.3.3           |
| next-intl                          | 4.14.8          |
| drizzle-orm                        | 0.45.3          |
| drizzle-kit                        | 0.31.11         |
| @neondatabase/serverless           | 1.1.0           |
| better-auth                        | 1.7.6           |
| resend                             | 6.31.0          |
| zod                                | 4.6.5           |
| react-hook-form                    | 7.89.0          |
| @hookform/resolvers                | 5.9.1           |
| @tanstack/react-query              | 5.104.0         |
| lucide-react                       | 1.48.0          |
| class-variance-authority           | 0.7.1           |
| clsx / tailwind-merge              | 2.1.1 / 3.7.0   |
| vitest                             | 5.0.2           |
| @playwright/test                   | 1.63.0          |
| eslint / eslint-config-next        | 9.39.5 / 16.3.7 |
| prettier                           | 3.9.9           |

**Node version note.** The brief specifies Node 24.x. The machine has 22.14.0 (also an active LTS, and supported on Vercel). `package.json` sets `engines.node >= 22.14.0` and `.nvmrc` pins 22.14.0. Raise both to 24 once it is installed locally — nothing in the code depends on the difference. Tracked as `OPEN_QUESTIONS.md` Q14.

## Deferred — install only in the session that needs it

| Need                                               | Package                                | Session   |
| -------------------------------------------------- | -------------------------------------- | --------- |
| Task attachments (request assets + delivery files) | Vercel Blob                            | 9         |
| Notification email and the daily digest            | Resend — **installed in session 2**    | 19        |
| Charts on the reports screen                       | undecided — see `OPEN_QUESTIONS.md` Q6 | 17        |
| Daily digest                                       | Vercel Cron                            | 19        |
| shadcn/ui components                               | added per component, on demand         | as needed |

`shadcn/ui` is not initialised yet: it is a copy-in component library, and copying components before a screen needs them produces dead code. Its dependencies (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`) are installed and `cn()` lives in `src/lib/utils.ts`, so `pnpm dlx shadcn@latest add <component>` works the moment a session wants one.

## Environment variables

The template is `.env.example`. Copy it to `.env.local`; never commit a filled-in file. On Vercel, set the same keys per environment.

| Variable                | Required            | Purpose                                                                                                                                                         |
| ----------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | yes, from session 2 | Neon Postgres connection string                                                                                                                                 |
| `BETTER_AUTH_SECRET`    | yes, from session 2 | Session signing key — `openssl rand -base64 32`                                                                                                                 |
| `BETTER_AUTH_URL`       | yes, from session 2 | Canonical app URL for auth callbacks                                                                                                                            |
| `PLAYWRIGHT_BASE_URL`   | no                  | Point E2E at a deployed preview instead of localhost                                                                                                            |
| `RESEND_API_KEY`        | no, from session 2  | 2FA codes and reset links. Without it they go to the server log, so the flow still works locally.                                                               |
| `EMAIL_FROM`            | no, from session 2  | Sending address. Defaults to Resend's sandbox sender — see `OPEN_QUESTIONS.md` Q5.                                                                              |
| `AUTH_MAIL_OUTBOX`      | test runs only      | Appends every outgoing email to a JSON-lines file so the E2E suite can read a code. **Never set this in a deployed environment** — see `OPEN_QUESTIONS.md` Q18. |
| `SEED_PASSWORD`         | no                  | Overrides the password `pnpm db:seed` gives every seeded account.                                                                                               |
| `BLOB_READ_WRITE_TOKEN` | session 9           | Attachment storage                                                                                                                                              |
| `CRON_SECRET`           | session 19          | Shared secret for the digest cron route                                                                                                                         |

`src/lib/env.ts` parses the server variables with Zod **lazily**, so the shell still builds and renders before a database exists. The first query against a misconfigured environment fails with a readable message naming the missing keys — and, since session 2, `currentSession()` catches that failure and treats it as "not signed in", so a misconfigured deployment shows the sign-in screen rather than a stack trace on every route. Email is parsed separately by `mailEnv()` and is entirely optional.

## Toolchain configuration

- **ESLint** — `eslint-config-next` (core-web-vitals + typescript), `eslint-config-prettier`, plus two project rules: `@typescript-eslint/no-explicit-any` is an error, and a `no-restricted-syntax` rule rejects physical direction utilities (`ml-`, `pr-`, `text-left`, `border-r-`, …) in any `className`, so the RTL rule is enforced rather than remembered.
- **Prettier** — 100 columns, double quotes, trailing commas, `prettier-plugin-tailwindcss` for class ordering. `wireframe/`, `docs/superpowers/` and `docs/screenshots/` are excluded: they are read-only records of phase 1, not source.
- **Vitest** — `vitest.config.mts`, happy-dom, native tsconfig path resolution, `src/**/*.test.ts(x)` only (E2E is excluded).
- **Playwright** — two projects, `desktop` at 1440×900 and `mobile` at 390×844, both driven against `pnpm build && pnpm start`. `e2e/screenshots.spec.ts` writes the fidelity screenshots the end-of-session protocol requires.
- **Git** — `.gitattributes` normalises to LF (`.cmd` stays CRLF), so the Windows checkout does not produce whitespace-only diffs.
