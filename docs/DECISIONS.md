# Decisions (ADRs)

Short records: what was decided, why, and when. Newest last. A decision that later turns out wrong gets a new entry superseding the old one; entries are not edited away.

---

## ADR-001 · The wireframe is the specification

**2026-09-29 · session 1**

The 35-page prototype in `wireframe/` defines layout, section order, copy, fields, columns, states and navigation. Where the kickoff brief and the wireframe disagree, the wireframe wins and the conflict is logged in `OPEN_QUESTIONS.md`.

**Why:** the prototype was built and approved as phase 1 precisely so the interface could be settled before architecture. Re-litigating it during implementation would waste that approval. It is also far more specific than prose: it answers questions a brief cannot.

---

## ADR-002 · The prototype moved to `wireframe/`; the Next.js app owns the repo root

**2026-09-29 · session 1**

The prototype occupied the root (`index.html`, `assets/`, `pages/`, `ui/`). It was committed as-is first, then moved wholesale into `wireframe/`.

**Why:** Vercel expects the app at the root, and the brief's own kickoff line already pointed at `./wireframe/`. Committing the baseline before moving means the move is a reviewable rename rather than a mystery.

The prototype is **read-only** from here: it is the spec, and editing it would destroy the reference. It is excluded from Prettier and ESLint for the same reason.

---

## ADR-003 · Capabilities in code, permissions in the database

**2026-09-29 · session 1**

`src/lib/permissions.ts` holds the 22 capability strings and the seed role grants, ported from the prototype's `role.js`. From session 3 the authoritative role-permission mapping lives in the database and is editable by an admin; the code constant becomes the seed and the type source.

**Why:** the capability _vocabulary_ is referenced by code (`can(session, "tasks.assign")`) and must be typed and greppable. The _mapping_ is a business decision the wireframe explicitly puts in an admin's hands. Splitting them gives type safety where code needs it and runtime flexibility where the product promises it.

The same module is imported on client and server, so the UI's gating and the server's enforcement can never drift apart — with the server always being the boundary and the client only ever an affordance.

---

## ADR-004 · The prototype's role switcher does not ship

**2026-09-29 · session 1**

The wireframe's topbar carries a dashed-border "معاينة كـ" selector that re-renders any page as any role.

**Why:** the design spec calls it "explicitly a prototype affordance" that "does not ship to production", and it is a privilege-escalation control by construction. It is deliberately not ported.

A safe equivalent — an admin _impersonation_ feature with its own audit trail and a visible banner — is a different feature and would need its own wireframe and session.

---

## ADR-005 · Reads go straight from Server Components; writes go through Server Actions

**2026-09-29 · session 1**

No API layer between a page and its data. Route handlers exist only for external callers: Better Auth today, the digest cron later.

**Why:** a route handler that only wraps a query adds a network hop, a serialization boundary and a second place to enforce permissions. Server Components can query directly and still stream. Server Actions give the write path one shape — session, validate, authorize, transact, audit, revalidate — that can be reviewed the same way every time.

---

## ADR-006 · Status transitions are rows, not code

**2026-09-29 · session 1**

`status_transition(from_key, to_key, required_permission)` is the state machine. A transition with no row cannot happen, and the server rejects it regardless of what the client sent.

**Why:** the wireframe's own settings screen makes the argument — a free-text status field lets a task become "معتمدة" without ever being reviewed, and every statistic built on it collapses. Correct by design rather than by attention. It also keeps the promise that an admin can add a status without a deploy.

---

## ADR-007 · Quality weights are stored per score, not read at display time

**2026-09-29 · session 1**

`task_quality_component` stores the weight that applied **when the task was scored**, alongside the achieved value.

**Why:** the task-settings screen promises that changing the weights affects new tasks only and never recomputes history. If the breakdown read today's weights, last month's 94% would silently stop adding up to 94, and the entire "every score is auditable" premise would fail. This is the cheapest possible way to keep that promise.

---

## ADR-008 · Department-specific brief fields live in `jsonb`

**2026-09-29 · session 1**

`task_payload` has real columns for what both departments share (goal, scope, acceptance, references) and a `fields` jsonb for the rest — URLs, environment, device and repro for Programming; deliverable, audience, direction, breakpoints, copy and constraints for UI/UX.

**Why:** these fields are written once and read as a block, never filtered or sorted on, so columns would buy nothing. And since an admin can add departments and task types at runtime, a column-per-field schema would need a migration every time someone adds a task type — which directly contradicts the product's central promise.

Anything that later becomes filterable gets promoted to a real column in the session that makes it filterable.

---

## ADR-009 · Design tokens ported value-for-value, not reinterpreted

**2026-09-29 · session 1**

Every colour, size, radius, shadow and duration in `src/app/globals.css` is the exact value from `wireframe/assets/css/01-tokens.css`, including both dark-mode variants and the compact density overrides.

**Why:** the token system encodes three deliberate rules — borders not shadows, radius encodes role, brand red is never a status — plus a contrast decision (`brand-500` for fills, `brand-700` for small text). Any "improvement" during the port would quietly break one of them. Tailwind v4's `@theme` maps them to utilities without a translation layer.

The RTL rule is enforced rather than remembered: an ESLint rule rejects physical direction utilities in any `className`.

---

## ADR-010 · The DOM owns theme and density; React subscribes

**2026-09-29 · session 1**

The theme and density toggles write `data-theme` and `data-density` on `documentElement`. React reads them back through `useSyncExternalStore` instead of holding its own copy, and an inline boot script applies the stored values before first paint.

**Why:** the token overrides are CSS selectors on `:root`, so the DOM is genuinely the source of truth. Mirroring it in React state creates two truths that disagree during hydration — which is exactly what produces a flash of the wrong theme. Subscribing instead means the boot script, the CSS and the UI cannot get out of step, and the theme icon is chosen by a CSS variant so it is correct on first paint too.

---

## ADR-011 · Environment variables are parsed lazily

**2026-09-29 · session 1**

`src/lib/env.ts` validates with Zod on first use, not at module load. The Drizzle client and the Better Auth instance are both built on first call.

**Why:** the shell must build, prerender and deploy before a database exists — which is exactly what session 1 delivers. Eager validation at import time would make the foundation undeployable until session 2. The trade-off is that a misconfiguration surfaces at the first query rather than at boot, so the error message names the missing keys and how to fix them.

---

## ADR-012 · Node 22.14.0 for now, not the brief's Node 24

**2026-09-29 · session 1**

`engines.node >= 22.14.0`, `.nvmrc` pinned to 22.14.0.

**Why:** 22.14.0 is what is installed, it is an active LTS, and Vercel supports it. Nothing in the stack needs a 24-only feature. Raising the pins is two lines whenever 24 is installed. Tracked as `OPEN_QUESTIONS.md` Q14 rather than silently ignored.

---

## ADR-013 · Better Auth's `twoFactor` plugin, not a hand-rolled second factor

**2026-09-29 · session 2**

The email second factor is Better Auth's `twoFactor` plugin with `otpOptions`, configured from `src/lib/policy.ts`. TOTP is disabled.

**Why:** the plugin already models the exact shape the wireframe describes — a half-authenticated cookie after the password, a hashed code in the verification table, a per-challenge attempt budget, an account-level lock, and a trusted-device grant that skips the factor entirely. Writing that by hand would mean minting sessions outside the library, which is the part of an auth system least worth improvising.

It also gives the four distinct refusals the screen needs — `INVALID_CODE`, `OTP_HAS_EXPIRED`, `TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE`, `ACCOUNT_TEMPORARILY_LOCKED` — where a hand-rolled version would have had to invent them. TOTP is off because the wireframe's 2FA settings screen offers only "رمز عبر البريد الإلكتروني"; an authenticator option is a product decision nobody has made.

---

## ADR-014 · Project rules are enforced in Better Auth hooks, not in Server Actions

**2026-09-29 · session 2**

The sign-in lockout and the password composition/history rules run in `hooks.before` on `/sign-in/email` and `/reset-password`, not inside the Server Actions that call them.

**Why:** `/api/auth/*` is a live catch-all route. A rule enforced only in a Server Action is a rule an attacker skips by POSTing to the endpoint directly. The hook sits on the endpoint, so every caller gets it.

The lockout ledger records the attempt in the `before` hook and clears it in the `after` hook, which is an inversion forced by the library: Better Auth throws on bad credentials, and a thrown endpoint skips its `after` hooks, so there is no "on failure" hook to write from. Counting first and clearing on success over-counts only when a request dies between the two — the safe direction.

---

## ADR-015 · The trusted-device table describes; Better Auth decides

**2026-09-29 · session 2**

`trusted_device` is keyed by Better Auth's own `trust-device-<random>` verification identifier and carries only the label, OS, browser, IP and last-seen time. Whether a device is trusted is decided by the signed cookie and the `verification` row, never by this table.

**Why:** the wireframe's trusted-device list needs metadata Better Auth does not store, so a table is unavoidable. Making that table _authoritative_ would create two sources that can disagree about who is allowed in — and the failure mode is silent, one-directional and in the attacker's favour. One authority, one register beside it, and revocation deletes both.

---

## ADR-016 · `currentSession()` fails closed

**2026-09-29 · session 2**

A missing `DATABASE_URL`, an unreachable database and a forged cookie all resolve to `null`, logged but not thrown.

**Why:** the function can deny access but never grant it, so an error it swallows costs a signed-in user a redirect to `/login` and nothing else. Letting the error escape turns a database blip into a 500 on every route including the sign-in screen — worse for an operator, no better for security. It is also what makes the route guard testable without a database, which is how session 2's E2E suite verified the guard at all.

---

## ADR-017 · Policy values live behind a typed accessor from day one

**2026-09-29 · session 2**

Not one lifetime, length or limit in `src/lib/auth.ts` is a literal. Every one comes from `securityPolicy()` or `twoFactorPolicy()` in `src/lib/policy.ts`, whose defaults are the options marked `selected` on the wireframe's own settings screens.

**Why:** the wireframe states the requirement in its own words — "هذه القيم قابلة للتعديل من إعدادات المصادقة الثنائية، ولا يحتاج تغييرها إلى تعديل النظام". Session 20 ships the screens that write them. Introducing the indirection now costs one file; retrofitting it later would mean touching the auth config, four screens, the message files and every test that quotes a number.

---

## ADR-018 · A mail outbox, rather than readable codes, for the E2E suite

**2026-09-29 · session 2**

`AUTH_MAIL_OUTBOX` appends every outgoing email to a JSON-lines file. The Playwright fixtures read the verification code from there.

**Why:** codes are stored hashed and delivered by email, so no test can learn one from the database — which is the property we want. The alternatives were to store codes in plain text (weakening the product to suit the tests) or to poll a real inbox over the network (slow, needs a key in CI, and writes the same file to the runner anyway). The seam is opt-in by environment variable, logs loudly whenever it is active, and is recorded as `OPEN_QUESTIONS.md` Q18.
