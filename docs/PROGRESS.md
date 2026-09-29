# Progress

Newest entry on top.

---

## Session 2 — Authentication

**2026-09-29** · branch: `session-02-authentication`

### Goal

A real user signs in with email and password, passes an emailed second factor, can trust the device for 30 days, and can reset a forgotten password — with the shell rendering their actual identity and role.

### Done

**Database** — the first migration, `drizzle/0000_calm_johnny_storm.sql`, eight tables.

Better Auth's five (`user`, `session`, `account`, `verification`, `two_factor`) plus three the wireframe demands and Better Auth does not model:

| Table              | Why it exists                                                                     |
| ------------------ | --------------------------------------------------------------------------------- |
| `trusted_device`   | `auth/trusted-devices.html` lists a device by label, OS, browser, IP and last use |
| `login_attempt`    | `settings/security.html` promises lockout after N failed sign-ins                 |
| `password_history` | `auth/reset-password.html` promises "لا تطابق آخر خمس كلمات مرور استخدمتها"       |

Every foreign key indexed, plus every column the lockout, trust and session-list lookups filter or sort on — 16 indexes across the eight tables. Two departures from `03-DATABASE.md`'s stated conventions, both deliberate and both now documented there: primary keys are `text` not `uuid` (Better Auth generates its own string ids and owns five of the eight tables), and `user.role` is a text key rather than `role_id` (the role tables are session 3's, and the roadmap's boundary for this session was "seed the five roles only as far as session 2 needs to resolve a user's role").

**Policy as data, from day one** — `src/lib/policy.ts`. Not one lifetime, length or limit in `src/lib/auth.ts` is a literal. Every value comes from `securityPolicy()` or `twoFactorPolicy()`, whose defaults are the options marked `selected` on the wireframe's own settings screens: 12-char password · 90-day expiry · last 5 remembered · 5 failed sign-ins → 15-minute lock · 2h idle · 7-day session · 6-digit code · 10-minute lifetime · 5 attempts · 45s resend · 30-day trust · max 5 devices · 60-day absolute re-verification. Session 20 replaces two function bodies and nothing else changes. ADR-017.

**Auth** — Better Auth 1.7.6 with the `twoFactor` plugin (email OTP, TOTP disabled), `nextCookies`, and the Drizzle adapter. Codes are stored **hashed**, never plain or reversibly encrypted. ADR-013.

Three project rules are enforced in Better Auth **hooks**, not in Server Actions, because `/api/auth/*` is a live catch-all route and a rule enforced in only one of two paths is not a rule (ADR-014):

- `before /sign-in/email` — refuses a locked account, then counts the attempt
- `after /sign-in/email` — clears the failure budget (reaching an `after` hook _is_ the proof the password was right, including on the 2FA branch)
- `before /reset-password` — password composition, then the last-five check

**Server Actions** — `src/features/auth/actions.ts`. Sign in, verify, resend, request reset, reset, sign out. Every one Zod-validates its input and returns a **state key**, never a message, so the screens own the strings and the tests assert on states rather than on Arabic prose. Invalid credentials, an unknown address and a credential-less account all collapse to one `invalidCredentials`; forgot-password always returns `sent`.

**Screens** — all four, to the wireframe. The two-pane `auth` grid with the aside removed (not stacked) below 960px; the "مسار العمل في النظام" workflow map; six auto-advancing, paste-aware digit boxes that also accept Arabic-Indic numerals; the live five-row password checklist; the resend cooldown seeded from the server so the button is correct on first paint.

**Route guard and identity** — `src/app/[locale]/(app)/layout.tsx` resolves the session, redirects to `/login` when there is none, and passes the role and user down. `PLACEHOLDER_ROLE` and `PLACEHOLDER_USER` are gone; the topbar renders the real name, derived initials and role label, and a POST sign-out. Q13 is resolved.

**Fail-closed session resolution** (ADR-016) — a missing `DATABASE_URL`, an unreachable database and a forged cookie all resolve to `null`, logged but not thrown. The function can deny access but never grant it, so a swallowed error costs a signed-in user a redirect and nothing more. It is also what made the route guard testable at all without a database.

**Email** — Resend 6.31.0, RTL HTML messages for the code and the reset link. Without a key they go to the server log, so the flow still works locally. Failing to send never fails the request, because a delivery error surfaced to the user is an account-existence oracle.

**Tests**

| Check            | Result                                     |
| ---------------- | ------------------------------------------ |
| `pnpm lint`      | clean                                      |
| `pnpm typecheck` | clean                                      |
| `pnpm test`      | **83 passed** (11 from session 1 + 72 new) |
| `pnpm build`     | compiled, 61 static pages, no warnings     |
| `pnpm test:e2e`  | **36 passed, 58 skipped, 0 failed**        |

72 new unit tests over the four pure modules — the lockout rule, the code lifetime and resend cooldown, device description and the trust window, and the password policy — plus a new `src/i18n/messages.test.ts` that fails the build if `ar.json` and `en.json` drift in keys, placeholders or empties. That one is permanent infrastructure: "no hard-coded UI text" only holds if every string exists in both locales, and next-intl will not fail a build over a missing key.

The 58 skipped E2E specs are every spec that signs in. They need a database; see **Not done**.

### Not done

**Vercel and Neon are still not connected.** Both need an interactive login, so the user chose "build now, connect at the end" at the start of the session. Everything they need is ready: the migration is generated and committed, `pnpm db:seed` creates one account per role, and `.env.example` documents every variable.

The consequence is specific and worth stating plainly: **nothing in the sign-in flow has been executed against a real database.** It is covered by tests that have never run. The four things most likely to be wrong are listed under _The thing most likely to bite_ below.

Also not done, because it depends on the above: no preview deploy, and the `two-factor` screen has never been rendered — it only exists mid-challenge.

### Known issues

None observed. Every check in the table above was run and passed on the final code.

That is not the same as "no bugs". 58 E2E specs did not run, and the whole database-backed half of the feature is unexercised.

### Fidelity differences from the wireframe

Compared each captured screenshot against its wireframe file at 1440px and 390px, in both directions.

1. **Found and fixed during the comparison: the back arrow pointed the wrong way in RTL.** The wireframe's `.icon--dir` rule mirrors a left-pointing arrow under RTL, so "back" points **right** in Arabic. The first implementation used a right-pointing icon mirrored under RTL, which pointed left — backwards. Now `ArrowLeft` + `rtl:-scale-x-100`, matching the wireframe exactly. This is the only bug the screenshot pass caught, and it would not have been caught by any test.

2. **The forgot-password success alert is not rendered alongside the form.** The wireframe shows it inline, and says why in its own comment: "shown here so the copy can be reviewed". In the build it replaces the form on submit, so a user cannot mistake a delivered link for a failed one and send five more. _Deliberate; the wireframe's inline copy was a review affordance, not a state._

3. **The reset-password checklist has a third state the wireframe does not show.** The wireframe marks all five requirements pass or fail. The fifth — "لا تطابق آخر خمس كلمات مرور استخدمتها" — cannot be decided in the browser without handing it the user's last five passwords, so it renders as _pending_ until the server answers, and every row is pending before the user types rather than showing five red crosses to someone who has not started. Logged as **Q16**.

4. **The login aside's counts (284 / 168 / 116) are copy, not data.** They live in the message files at the wireframe's values. Making them live would put an organisation's size on an anonymous page and make it uncacheable. Logged as **Q17**.

5. **Placeholder identity is gone, so the topbar now shows whoever is signed in.** The wireframe's "أحمد سالم" is the manager in the seed, so a seeded manager reproduces the wireframe exactly. _Not a difference so much as the point of the session._

Carried forward unchanged from session 1: the component gallery is still out of the nav (Q8), the prototype role switcher is still not ported (ADR-004), and the task-creation dock still overlaps the sidebar (Q15).

Not yet comparable: `two-factor` has never been rendered, and the reset-password form's live states need a valid token. Their fidelity boxes in `04-SCREENS.md` are deliberately unticked with the reason written next to them.

### New open questions

- **Q16** — the reset screen's fifth requirement cannot be checked in the browser
- **Q17** — the login aside's numbers are copy, not data
- **Q18** — the E2E suite needs a mail outbox to read a verification code

**Q13 is resolved** (the shell's hard-coded role) — by construction, as predicted.

Still unanswered and still assumed: **Q1** (the build is the نُوى system), **Q5** (`no-reply@nuwa.sa`; using Resend's sandbox sender until the domain is verified), **Q12** (agents land on `/my-work`, everyone else on `/dashboard` — one function, `landingPathFor`).

### Carry-over into session 3

1. **Connect Vercel and Neon, apply the migration, seed, and run the database-backed half of the suite.** This is now two sessions old and it is the only thing standing between "tested" and "verified".
2. Run `pnpm test:e2e` with `DATABASE_URL` and `AUTH_MAIL_OUTBOX` set, and tick the fidelity boxes in `04-SCREENS.md` that could not be ticked honestly.
3. Session 3's own work — roles, capabilities and the permission matrix — which includes migrating `user.role` from a text key to `role_id`.

### The thing most likely to bite next session

**The first real sign-in.** Four specific assumptions have never been executed:

1. **`auth.api.signInEmail` returning `{ twoFactorRedirect: true }` when called server-side.** The plugin's `after` hook returns it, and the client receives it — but `auth.api.*` with `asResponse: false` returning the _hook's_ body rather than the endpoint's is the single load-bearing assumption in the whole flow. If it does not, sign-in mints a session and skips the second factor entirely, which is a security failure, not a cosmetic one. **Verify this first.**
2. **The trust cookie's shape.** `parseTrustIdentifier` expects `<hmac>!<identifier>`, possibly still carrying a cookie signature. If it parses wrong the register silently stays empty — trust still works, because Better Auth owns that decision, but the settings screen in session 20 would list nothing.
3. **The `before`/`after` hook pair on `/sign-in/email`.** If `after` does not run on the 2FA branch, a successful password entry never clears the ledger and a legitimate user locks themselves out in five sign-ins.
4. **`assertPasswordAcceptable` reading `reset-password:<token>`.** The verification identifier prefix is taken from Better Auth's source. If it changed, the last-five rule silently does not apply — the composition rules still do.

All four are cheap to check the moment a database exists: sign in once, and look at `login_attempt`, `trusted_device` and `password_history`.

---

## Session 1 — Foundation: docs, scaffold, app shell

**2026-09-29** · branch: `main` (no feature branch; this session created the repository)

### Goal

A documented, deployable empty shell whose chrome matches the wireframe. No features, no tables, no real data.

### Done

**Analysis**

- Read all 35 wireframe screens and extracted every table column, form field, select option, button, permission string and state.
- Mapped 33 product screens to routes; identified core entities, the five roles and the 22 capabilities; drafted a 21-session roadmap.
- Found and logged 15 open questions, including the one that matters: the kickoff brief and the wireframe describe **different products**.

**Repository**

- `git init`; committed the prototype as-is as the baseline, then moved it wholesale to `wireframe/` so the Next.js app could own the root. Two commits, so the move is a reviewable rename.
- `.gitattributes` normalises line endings (LF, `.cmd` CRLF) — without it every Windows checkout produces whitespace-only diffs.

**Documentation system**

- `CLAUDE.md` (under 150 lines) plus `docs/00`–`07`, `PROGRESS.md`, `DECISIONS.md` (12 ADRs), `OPEN_QUESTIONS.md` (15 entries), `sessions/NEXT_SESSION.md`, `sessions/archive/`.
- `.claude/commands/start-session.md` and `end-session.md`.
- `04-SCREENS.md` has a block for every one of the 33 screens with its wireframe file, access capability, sections in wireframe order, fields, states, data needs, target session and an unticked fidelity checklist.

**Scaffold**

- Next.js 16.3.7 (App Router, Turbopack) · React 19.2.8 · TypeScript strict · Tailwind v4.3.3 · pnpm 10.23.0.
- next-intl 4.14.8: `ar` default, `en` second, `/[locale]` routing, `dir` and `lang` from the locale, locale negotiation in `src/proxy.ts`.
- Drizzle 0.45.3 + `@neondatabase/serverless` 1.1.0, lazy client, `drizzle.config.ts`, empty schema barrel.
- Better Auth 1.7.6 skeleton with the Drizzle adapter and the catch-all route handler.
- Zod, React Hook Form, TanStack Query, lucide-react, cva/clsx/tailwind-merge installed.
- ESLint (with two project rules), Prettier, Vitest, Playwright. `.env.example` with every variable, present and deferred.

**Design system**

- All tokens ported **value-for-value** from `wireframe/assets/css/01-tokens.css` into Tailwind v4 `@theme`: brand ramp, neutrals, semantic surfaces, feedback, 12 status colours, 3 department colours, 6 viz colours, type scale, radii, shadows, layout, motion — plus the dark theme (both `[data-theme]` and `prefers-color-scheme`) and the compact density overrides.
- IBM Plex Sans Arabic via `next/font`; tabular lining figures on every data cell; focus rings; `prefers-reduced-motion`; skip link.
- A `dark:` variant defined to follow the same precedence as the tokens, so CSS and tokens cannot disagree.

**Capability engine**

- `src/lib/permissions.ts` ports `role.js`: 22 typed capabilities, 5 seed roles, wildcard resolution. **11 unit tests, all passing.**

**App shell**

- Sidebar: inline at ≥768px, collapsing to a 68px rail from a button in its own foot; off-canvas drawer below 768px opened by the topbar hamburger (hidden above that breakpoint, matching the wireframe's `only-md`); Escape and a breakpoint resize both dismiss it. Nav groups whose items are all gated away hide their heading.
- Topbar: command-palette trigger, notification bell with unread dot, density toggle, theme toggle, user chip.
- Task-creation dock, gated on `tasks.create`.
- 33 placeholder routes, each naming its wireframe file and its roadmap session, so an unbuilt page is self-documenting.
- `not-found` and `error` boundaries.

**Verification** — all run, all passing:

| Check            | Result                         |
| ---------------- | ------------------------------ |
| `pnpm lint`      | clean                          |
| `pnpm typecheck` | clean                          |
| `pnpm test`      | 11/11 passed                   |
| `pnpm build`     | 61 static pages, no warnings   |
| `pnpm test:e2e`  | 33 passed, 1 correctly skipped |

Screenshots captured for dashboard, tasks, settings/roles and login × {ar, en} × {1440, 390} in `docs/screenshots/session-01/`.

### Not done

- **Vercel is not connected.** The `vercel` CLI is not installed and logging in is interactive, so it could not be done unattended. Everything it needs is ready. See the handoff below.

### Known issues

None. Every check above passed on the final code.

### Fidelity differences from the wireframe

Deliberate, each with a reason:

1. **The component gallery (دليل الواجهة) is not in the nav.** The wireframe has it under النظام, ungated, meaning an ordinary employee would see a style guide in their navigation. Left out pending `OPEN_QUESTIONS.md` Q8. _Recorded deviation._
2. **The prototype role switcher is not ported.** The design spec calls it a prototype affordance that does not ship, and it is a privilege-escalation control by construction. `DECISIONS.md` ADR-004.
3. **The `Ctrl K` hint is hidden below 640px.** The wireframe keeps it at all widths, which at 390px squeezes the search label down to a single letter. A keyboard hint is meaningless on a touch device. _Small deliberate deviation._
4. **The task-creation dock overlaps the sidebar.** The wireframe positions it at `inset-inline-start`, which in RTL is the same edge the sidebar occupies. The port reproduces this faithfully and it looks wrong; the wireframe's own README says its rendered appearance was never verified. Logged as Q15 rather than silently "fixed".

Not yet comparable: every page body is a placeholder, so layout, copy and states can only be judged from session 2 onward. No fidelity checklist in `04-SCREENS.md` is ticked yet, correctly.

### Carry-over into session 2

- Connect Vercel and confirm the deployed preview (the one unfinished session-1 task).
- Provision Neon and fill `.env.local`.
- Replace the shell's hard-coded `manager` role with the real session (Q13 — resolves by construction).
- Answers wanted before or during session 2: **Q1** (system identity), **Q5** (email domain), **Q12** (post-login landing page per role). Q2 would be useful but is not blocking.

### The thing most likely to bite next session

**Q9 — the dynamic form builder.** The wireframe promises a new department gets its own task types with no code change, yet the two creation forms are hard-coded and each task type has an unwireframed **الحقول** button. If that turns out to be in scope it is 2–3 sessions of its own, and it changes the shape of `task_payload`. Worth answering before session 4, not during it.
