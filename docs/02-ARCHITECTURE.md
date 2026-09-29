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

**Session 2 built this.** The guard lives in `src/app/[locale]/(app)/layout.tsx` and nowhere else: it resolves the session, redirects to `/login` when there is none, and passes the role and the user down to the shell as props. Putting a cookie-presence check in `src/proxy.ts` as well was considered and rejected — it could only ever be a hint, since the cookie may be expired, revoked or past the absolute session ceiling, and one authoritative check beats a fast one plus a real one that can drift apart. The cost is that every `(app)` route is now dynamic, which is what an authenticated shell means.

### The division of labour with Better Auth

Better Auth owns password hashing, session records and cookies, the single-use reset token, and the second-factor challenge (the half-authenticated cookie, the hashed code, the per-challenge attempt budget, the trusted-device grant). The `twoFactor` plugin with email OTP is configured entirely from `src/lib/policy.ts` — not one lifetime or limit in `src/lib/auth.ts` is a literal.

Three things Better Auth does not model are this project's, and each is added through a **hook** rather than in a Server Action, so it applies to every caller including anything POSTing straight to `/api/auth/*`:

| Concern                          | Where                                  | Why it exists                                     |
| -------------------------------- | -------------------------------------- | ------------------------------------------------- |
| Sign-in lockout                  | `before /sign-in/email`                | `/settings/security` promises N failures → a lock |
| Password composition and history | `before /reset-password`               | the reset screen lists five requirements          |
| Trusted-device register          | `src/features/auth/trusted-devices.ts` | `/settings/trusted-devices` lists OS, browser, IP |

The lockout ledger records the attempt in the `before` hook and clears it in the `after` hook. That inversion is forced: Better Auth throws on bad credentials and a thrown endpoint skips its `after` hooks, so there is no "on failure" hook to write from. Counting first and clearing on success over-counts only if a request dies between the two — which fails closed.

### Failing closed

`currentSession()` turns every failure — a missing `DATABASE_URL`, an unreachable database, a forged cookie — into `null`, and logs it. The function can deny access but never grant it, so a swallowed error costs a signed-in user a redirect to `/login` and nothing more. Letting the error escape would turn a database blip into a 500 on every page including the sign-in screen: less useful to an operator and no more secure.

### Two session lifetimes, one expiry

The policy has an idle timeout (ساعتان) and an absolute ceiling (7 أيام). Better Auth models one expiry refreshed on activity, so the idle window is `session.expiresIn` and the ceiling is enforced against `session.createdAt` in `src/features/auth/session.ts`. `updateAge` bounds how often the refresh writes, which makes the effective idle window `sessionIdleHours` plus at most `updateAge` — one write per quarter hour instead of one per request.

The organisation-wide policies on `/settings/security` and `/settings/two-factor` — password length and expiry, failed-attempt lockout, idle and maximum session age, code lifetime and length, trusted-device window and count, forced periodic re-verification — are **stored settings**, not constants. Better Auth is configured from them at runtime.

## Caching strategy

Static where it can be: with `next-intl`'s `setRequestLocale`, a route that reads no per-user data prerenders per locale. Since session 2 that is the auth screens and the error pages — everything inside `(app)` reads the session in its layout and is therefore dynamic, as an authenticated shell must be. Session 1's 61 static pages were static only because nobody was signed in.

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
