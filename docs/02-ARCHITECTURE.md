# 02 · Architecture

## Folder structure

```
project-management/
├─ CLAUDE.md                     auto-loaded context, kept under ~150 lines
├─ .claude/commands/             /start-session, /end-session
├─ docs/                         this documentation system
│  ├─ screenshots/session-NN/    fidelity screenshots per session
│  ├─ sessions/                  NEXT_SESSION.md + archive/
│  └─ superpowers/specs/         the approved phase-1 design spec (read-only)
├─ wireframe/                    the approved 35-page prototype (read-only spec)
│  ├─ index.html · serve.cmd · README.md
│  ├─ assets/css/ · assets/js/
│  ├─ pages/{auth,dashboard,tasks,people,org,insights,settings}/
│  └─ ui/components.html         component gallery
├─ drizzle/                      generated SQL migrations (committed)
├─ e2e/                          Playwright specs
├─ messages/{ar,en}.json         every user-visible string
├─ public/
└─ src/
   ├─ app/
   │  ├─ layout.tsx              pass-through; the real <html> is per-locale
   │  ├─ [locale]/
   │  │  ├─ layout.tsx           <html lang dir>, font, theme boot, skip link
   │  │  ├─ page.tsx             redirects to /dashboard
   │  │  ├─ error.tsx · not-found.tsx
   │  │  ├─ (app)/               inside the shell
   │  │  │  ├─ layout.tsx        <AppShell>
   │  │  │  ├─ dashboard/ · my-work/
   │  │  │  ├─ tasks/ · tasks/[ref]/ · tasks/new/{programming,uiux}/
   │  │  │  ├─ review/ · rejected/
   │  │  │  ├─ employees/[id]/ · teams/[id]/ · departments/[id]/
   │  │  │  ├─ org/{structure,heads,team-leaders}/
   │  │  │  ├─ reports/ · activity/
   │  │  │  └─ settings/{roles,permissions,security,two-factor,
   │  │  │               trusted-devices,notifications,tasks,statuses,departments}/
   │  │  └─ (auth)/              outside the shell
   │  │     ├─ layout.tsx        centred column, no nav
   │  │     └─ login/ · two-factor/ · forgot-password/ · reset-password/
   │  ├─ api/auth/[...all]/      Better Auth catch-all
   │  └─ globals.css             design tokens + base layer
   ├─ components/
   │  ├─ shell/                  app-shell, sidebar, topbar, nav-icon, placeholder
   │  └─ ui/                     shared primitives (shadcn components land here)
   ├─ config/nav.ts              single source of truth for nav + command palette
   ├─ db/
   │  ├─ index.ts                lazy Neon + Drizzle client
   │  └─ schema/                 one file per area, re-exported from index.ts
   ├─ i18n/                      routing, request config, locale-aware navigation
   ├─ lib/
   │  ├─ permissions.ts          the capability engine
   │  ├─ env.ts                  lazily parsed environment contract
   │  └─ utils.ts                cn()
   └─ proxy.ts                   locale negotiation (Next 16's middleware)
```

Route groups `(app)` and `(auth)` do not appear in URLs. They exist so the shell is applied by a layout rather than repeated per page, and so the auth screens can opt out of it entirely — which is exactly how the wireframe is organised.

## Data flow

**Reads.** A Server Component calls a query function in `src/db/` directly. No API layer sits between a page and its data — a route handler that only wraps a query adds a network hop and a serialization boundary for nothing. Route handlers exist only where an external caller needs one (today: Better Auth; later: the digest cron).

**Writes.** Server Actions, always in this order:

1. Resolve the session on the server.
2. Zod-parse the input.
3. Check the capability with `can()` **and** check scope (own / team / department / all).
4. Do the work, in a transaction if it touches more than one table.
5. Write an audit row.
6. Revalidate the affected cache tags.
7. Return a typed result the form can render.

Steps 1 and 3 are not optional and are never inherited from the client. The UI hides controls the role lacks, but that is an affordance; the server is the boundary. `src/lib/permissions.ts` is deliberately the same module on both sides so the two can never drift.

**Client state.** The default is none. `"use client"` appears only where there is real interactivity: the shell's nav toggles, the command palette, filter bars, forms. TanStack Query is installed but unused so far — it enters only when a screen genuinely polls or mutates optimistically.

## Auth flow

Better Auth with email + password and sessions stored in Postgres via the Drizzle adapter.

```
/login  ─ credentials ─→  valid?
                            │
                            ├─ trusted device cookie still inside the window → session issued
                            └─ otherwise → /two-factor → email code → session issued
                                                            │
                                                            └─ "trust this device" → device row + cookie
```

On every request the locale proxy runs first, then the `(app)` layout resolves the session and the user's role. Unauthenticated requests are redirected to `/login`; the layout passes the resolved role down to the shell, which is why no component ever decides who the user is.

Session 1 ships the skeleton only: the Better Auth instance, the Drizzle adapter wiring and the catch-all route exist, but no route is guarded and the shell renders as `manager` so every nav group is reviewable. Session 2 replaces that constant with the real session.

The organisation-wide policies on `/settings/security` and `/settings/two-factor` — password length and expiry, failed-attempt lockout, idle and maximum session age, code lifetime and length, trusted-device window and count, forced periodic re-verification — are **stored settings**, not constants. Better Auth is configured from them at runtime.

## Caching strategy

Static by default: with `next-intl`'s `setRequestLocale`, every shell route that does not read per-user data prerenders per locale. Session 1's build produces 61 static pages.

Once data lands, reads are tagged and mutations revalidate:

| Tag                          | Covers                                             | Revalidated by                                     |
| ---------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| `tasks`                      | list, board, dashboard counts                      | any task create / status / assignment change       |
| `task:<id>`                  | one task and its tabs                              | edits, comments, attachments, reviews on that task |
| `review-queue`               | the review list and its nav badge                  | submit, approve, reject                            |
| `employees`, `employee:<id>` | people lists and profiles                          | create, move, permission change                    |
| `teams`, `team:<id>`         | teams and members                                  | membership and leader changes                      |
| `departments`                | departments and the org tree                       | department and head changes                        |
| `settings`                   | every settings screen and anything derived from it | any settings write                                 |
| `reports:<range>`            | report aggregates                                  | time-based revalidation, not per-write             |

Two deliberate exceptions. The **audit log is never cached** — it is the record you consult when you distrust the rest of the system. **Reports** use time-based revalidation rather than tag invalidation: they aggregate across the whole org, so invalidating them on every task write would mean never serving a cached report.

Per-user pages (`/my-work`, anything scoped to "my team") are dynamic. They are cheap, and caching per user multiplies the cache by the headcount for no benefit.

## Rendering and i18n

`src/proxy.ts` (Next 16's renamed middleware) negotiates the locale and enforces the `/ar` | `/en` prefix. `src/app/[locale]/layout.tsx` sets `lang` and `dir` from the locale, loads IBM Plex Sans Arabic through `next/font` (no network request at runtime, no layout shift), and runs a tiny inline script that applies the stored theme and density **before first paint** so a dark-mode user never sees a light flash.

Because `dir` is an attribute and the CSS uses only logical properties, switching the whole application to LTR is switching the locale. Nothing else changes.

## Why the shell is a client component

`AppShell`, `Sidebar` and `Topbar` are client components for a narrow reason: the collapse state, the mobile drawer, and the theme and density toggles are interactive. Everything inside `{children}` stays a Server Component — the shell wraps, it does not render pages.

The sidebar has two modes, as the quality floor requires: inline at ≥768px, collapsing to a 68px icon rail from a button in its own foot, and an off-canvas drawer below 768px opened by the topbar's hamburger (which is hidden above that breakpoint, matching the wireframe's `only-md` rule). Escape and a resize past the breakpoint both dismiss the drawer.

The theme and density toggles write to `documentElement`, because that is where the token overrides live (`:root[data-theme]`, `:root[data-density]`). React subscribes to those attributes through `useSyncExternalStore` rather than holding its own copy, so the boot script and the toggles can never disagree.
