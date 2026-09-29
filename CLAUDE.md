# CLAUDE.md

> At the start of every session: read `docs/PROGRESS.md` and `docs/sessions/NEXT_SESSION.md` before anything else. Detailed docs live in `/docs` — read only the files the current task needs.

**Project.** Internal operations system for مجموعة نُوى: the SEO department dispatches work to Programming and UI/UX, and the system tracks each task's lifecycle and scores its quality defensibly. Arabic-first (RTL), 5 roles, no public/anonymous surface.

**The wireframe in `wireframe/` is the spec.** Build it exactly — layout, section order, copy, fields, columns, states. Never add a screen, field or feature that is not in it. If something is missing or ambiguous, do not guess: add it to `docs/OPEN_QUESTIONS.md` and continue with the rest. If this file and the wireframe disagree, the wireframe wins.

## Commands

| Task             | Command                     |
| ---------------- | --------------------------- |
| Dev server       | `pnpm dev`                  |
| Production build | `pnpm build`                |
| Lint             | `pnpm lint`                 |
| Types            | `pnpm typecheck`            |
| Unit tests       | `pnpm test`                 |
| E2E              | `pnpm test:e2e`             |
| Screenshots      | `pnpm test:e2e screenshots` |
| Format           | `pnpm format`               |
| Everything       | `pnpm check`                |
| New migration    | `pnpm db:generate`          |
| Apply migrations | `pnpm db:migrate`           |
| Browse data      | `pnpm db:studio`            |

`pnpm check` must pass before every commit.

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind v4 · next-intl (`ar` default, `en`) · Drizzle + MySQL (Hostinger) · Better Auth · Zod · React Hook Form · Vitest + Playwright. Versions and env vars: `docs/01-TECH-STACK.md`.

## Folders

```
src/app/[locale]/(app)/      routes inside the shell
src/app/[locale]/(auth)/     login, 2FA, password reset — no shell
src/app/api/                 route handlers (auth only so far)
src/components/shell/        sidebar, topbar, task-creation dock
src/components/ui/           shared primitives
src/config/nav.ts            single source of truth for nav + palette
src/db/schema/               Drizzle tables, one file per area
src/lib/permissions.ts       the capability engine
src/i18n/                    routing, request config, locale-aware Link
messages/{ar,en}.json        every user-visible string
wireframe/                   the approved prototype — read-only reference
docs/                        this documentation system
```

Feature-based folders, small files, no dead code.

## Coding rules

- **Server Components by default.** `"use client"` only for real interactivity.
- **Every Server Action and route handler**: Zod-validate the input, then check the session _and_ the capability on the server. Never trust the client. DOM gating is a usability affordance, never a boundary.
- **Permissions are capabilities, never roles.** `can(session, "tasks.assign")`, never `if (role === "manager")`. Add a role by adding a row, not a branch.
- **Statuses are a state machine.** Only legal transitions are offered, and the server rejects illegal ones. Never a free-text status field.
- **Database**: index every foreign key and every column a list filters or sorts on; paginate every list; no N+1; transactions for multi-step writes.
- **Caching**: tag reads, revalidate the tags on mutation.
- **RTL is structural.** Logical Tailwind utilities only (`ms-/me-/ps-/pe-/start-/end-/text-start/text-end`) — never `left`/`right`. ESLint enforces this. Dates and numbers through `Intl`. Test both directions.
- **No hard-coded UI text.** Every string lives in `messages/ar.json` + `messages/en.json`.
- **No `any`.** ESLint enforces this too.
- **Design tokens only.** Colours, spacing, radii and durations come from `src/app/globals.css`. Three rules it encodes: borders not shadows (there is no card shadow); radius encodes role; brand red is never a status.
- **Performance budget**: LCP < 2.5s, no layout shift, images via `next/image`, fonts via `next/font`.

## Definition of done

A feature is done when it matches its wireframe screen (fidelity checklist ticked in `docs/04-SCREENS.md`), works in AR and EN at 1440px and 390px, enforces permissions server-side, has passing tests and build, deploys to a working preview, and has its docs updated.

## Session protocol

`/start-session` and `/end-session` are defined in `.claude/commands/`. Saying "wrap up" means run `/end-session` immediately, even if the feature is unfinished.
