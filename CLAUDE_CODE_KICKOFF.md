# Session 1 — Kickoff Prompt (paste into Claude Code)

> Edit the 2 lines marked `EDIT` before pasting. Everything else is ready.

---

## Role
You are the lead full-stack engineer on this project. I work with you in **daily ~3-hour sessions**. Each session ships **one complete, tested feature** and ends with a ready prompt for the next session. Treat the wireframe as the spec — build it exactly, don't redesign it.

## System context
- **EDIT →** System: AI Operations task management system — I log/manage my work, my manager follows progress and assigns tasks, other departments submit requests through a public shareable link.
- Users: 2 internal accounts (Me = member, Manager = admin) + anonymous public requesters (form only).
- Languages: Arabic (RTL) + English (LTR), switchable.
- Hosting: Vercel.
- If anything here conflicts with the wireframe, **the wireframe wins** — log the conflict in `docs/OPEN_QUESTIONS.md`.

## Source of truth: the wireframe
- **EDIT →** Wireframe location: `./wireframe/`  _(or Figma link: ___)_
- Read **every** screen before doing anything else.
- Build output must match the wireframe: layout, section order, labels/copy, fields, buttons, tables/columns, empty/loading/error states, and navigation.
- Never add screens, fields, or features that aren't in the wireframe. If something is missing or ambiguous (a state, a validation rule, a permission), **don't guess** — add it to `docs/OPEN_QUESTIONS.md` and continue with the rest.

## Tech stack (decided — don't re-debate, only flag real blockers)
Chosen for Vercel: fastest cold starts, edge caching, one deployable, scales horizontally with zero server management.

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js **24.x**, **pnpm** | Current LTS on Vercel; pnpm = fast, strict installs |
| Framework | **Next.js (latest stable, App Router) + TypeScript (strict)** | Frontend + backend in one app; Server Components, Server Actions, streaming, ISR — best-optimized framework on Vercel |
| Database | **PostgreSQL on Neon** (via Vercel Marketplace) | Serverless Postgres, autoscaling, connection pooling, DB branch per preview deploy |
| ORM | **Drizzle ORM + drizzle-kit migrations** | Lightweight, SQL-first, fast serverless cold starts, fully typed |
| Auth | **Better Auth** (email + password, sessions in DB) | Modern, self-hosted, role support; no vendor lock-in |
| Validation | **Zod** (shared client + server) | One schema per form/action |
| UI | **Tailwind CSS + shadcn/ui** | Match wireframe precisely; logical properties for RTL |
| i18n | **next-intl** (`/ar`, `/en`) | Locale routing, `dir` switching, ICU messages |
| Forms | React Hook Form + Zod resolver | |
| Client data (only where needed) | TanStack Query | Default is Server Components — no client fetching unless interactive |
| Public link protection | Cloudflare Turnstile + Upstash rate limit | Stop spam on the public request form |
| Only if the wireframe needs it | Resend (email), Vercel Blob (files), Vercel Cron (scheduled jobs) | Don't install until a session needs it |
| Testing | Vitest (logic/actions) + Playwright (E2E + screenshots) | |
| Quality | ESLint + Prettier, `tsc --noEmit` | Must pass before every commit |

## What to do in THIS session (Session 1 — foundation, no features yet)

### Step 1 — Analyze, then stop for my OK
Read the wireframe fully, then reply with **only**:
- List of screens found (name → proposed route)
- Core entities + key fields
- Roles & what each can see/do
- Draft session roadmap (titles only)
- Open questions

**Wait for my approval before Step 2.**

### Step 2 — Create the documentation system
Create exactly this structure:

```
CLAUDE.md                        ← auto-loaded every session; keep it under ~150 lines
docs/
  00-OVERVIEW.md                 ← purpose, users, roles & permissions matrix
  01-TECH-STACK.md               ← stack table above + versions installed + env vars list
  02-ARCHITECTURE.md             ← folder structure, data flow, auth flow, caching strategy
  03-DATABASE.md                 ← every table: columns, types, relations, indexes (+ Mermaid ERD)
  04-SCREENS.md                  ← one section per wireframe screen (template below)
  05-API.md                      ← every Server Action / route handler: input, output, who can call it
  06-DESIGN-SYSTEM.md            ← colors, fonts, spacing, radius, components — extracted from the wireframe; RTL rules
  07-ROADMAP.md                  ← all sessions, in order (rules below)
  PROGRESS.md                    ← session log (newest on top)
  DECISIONS.md                   ← short ADRs: decision, reason, date
  OPEN_QUESTIONS.md              ← anything unclear for me to answer
  sessions/
    NEXT_SESSION.md              ← ready-to-paste prompt for the next session
    archive/                     ← old NEXT_SESSION files: session-01.md, session-02.md …
.claude/commands/
  start-session.md               ← /start-session
  end-session.md                 ← /end-session
```

**`04-SCREENS.md` — one block per screen:**
```
## <Screen name>  — route: /[locale]/...
- Wireframe ref: <file/frame>
- Who can access:
- Sections (top → bottom, exactly as wireframe):
- Fields / columns / actions:
- States: empty / loading / error / success
- Data needed (tables + queries):
- Built in session: # (fill when done)
- Fidelity checklist: [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR
```

**`CLAUDE.md` must contain:** project one-liner, stack summary, commands (dev / build / test / lint / db:migrate / db:studio), folder conventions, coding rules (below), and this line at the top:
> At the start of every session: read `docs/PROGRESS.md` and `docs/sessions/NEXT_SESSION.md` before anything else. Detailed docs live in `/docs` — read only the files the current task needs.

### Step 3 — Scaffold & ship an empty shell
- Init Next.js + TypeScript strict + pnpm, Tailwind, shadcn/ui, next-intl (`ar` default, `en`), Drizzle + Neon connection, Better Auth skeleton, ESLint/Prettier, Vitest, Playwright.
- App layout shell matching the wireframe (header/sidebar/nav only, placeholder pages for each route).
- `.env.example` with every variable; never commit `.env`.
- Git init, first commit, connect Vercel. Confirm the shell builds and deploys.

### Step 4 — Run the end-of-session protocol (below).

## Roadmap rules (`07-ROADMAP.md`)
- One session ≈ 3h = **one vertical slice**: DB migration → server logic → UI screen(s) → tests → docs. Never "all DB in one session, all UI in another".
- Order: auth & roles → core entity CRUD → main dashboards/views → manager features → public request link → notifications/extras → polish, performance & security pass.
- Each session entry: goal, wireframe screens covered, tasks, acceptance criteria, out of scope.
- If a session looks bigger than ~3h, split it.

## Session protocol

**`/start-session` does:**
1. Read `CLAUDE.md`, `docs/PROGRESS.md`, `docs/sessions/NEXT_SESSION.md`, and only the docs/wireframe screens it references.
2. Create branch `session-NN-<slug>`.
3. Reply with a 5-bullet plan, then start building.

**`/end-session` does** (also when I say "wrap up" — stop feature work immediately, even if unfinished):
1. Run lint, typecheck, tests, build. Fix or clearly log failures.
2. Playwright screenshots of every screen touched, at 1440px and 390px, in AR and EN → compare to the wireframe → list any differences.
3. Update: `PROGRESS.md` (done / not done / known bugs / fidelity diffs), `07-ROADMAP.md` checkboxes, `04-SCREENS.md` "built in session", `03-DATABASE.md`/`05-API.md` if changed, `DECISIONS.md`, `OPEN_QUESTIONS.md`.
4. Commit, merge to `main` only if checks pass (otherwise leave on branch and say so).
5. Move the old `NEXT_SESSION.md` to `sessions/archive/session-NN.md`, write the new one using the template below, and **print it in the chat** so I can copy it.

**`NEXT_SESSION.md` template:**
```
# Session NN — <feature>
Read first: CLAUDE.md, docs/PROGRESS.md, docs/07-ROADMAP.md (Session NN), docs/04-SCREENS.md (<screens>)
Wireframe screens: <list>
Carry-over from last session: <unfinished items / bugs>
Goal: <one sentence>
Tasks: <numbered>
Acceptance criteria: <testable bullets>
Out of scope: <list>
End with: /end-session
```

## Coding rules
- Server Components by default; `"use client"` only for real interactivity.
- Every Server Action / route: Zod-validate input + check session **and role on the server**. Never trust the client.
- DB: indexes on every foreign key and filter/sort column; paginate all lists; no N+1 queries; use transactions for multi-step writes.
- Cache reads with tags; revalidate on mutation.
- RTL: logical Tailwind utilities only (`ms-/me-/ps-/pe-/start-/end-`), never `left/right`; dates & numbers via `Intl`; test both directions.
- No hard-coded UI text — all strings in `messages/ar.json` + `messages/en.json`.
- Small files, feature-based folders, no dead code, no `any`.
- Performance budget: LCP < 2.5s, no layout shift, images via `next/image`, fonts via `next/font`.

## Definition of done (every feature)
- Matches the wireframe screen (fidelity checklist ticked)
- Works in AR + EN, desktop + mobile
- Permissions enforced server-side
- Tests pass, build passes, deployed preview works
- Docs updated

Start with **Step 1** now.
