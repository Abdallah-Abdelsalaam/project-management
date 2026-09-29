# Session 02 — Authentication

Read first: CLAUDE.md, docs/PROGRESS.md, docs/07-ROADMAP.md (Session 2), docs/04-SCREENS.md (Authentication section), docs/02-ARCHITECTURE.md (Auth flow)

Wireframe screens: `wireframe/pages/auth/login.html`, `wireframe/pages/auth/two-factor.html`, `wireframe/pages/auth/forgot-password.html`, `wireframe/pages/auth/reset-password.html`

Carry-over from last session:

- Vercel is not connected — do this first (see Tasks 1–2). Everything it needs is ready.
- The shell renders a hard-coded `manager` role in `src/app/[locale]/(app)/layout.tsx` (OPEN_QUESTIONS Q13). Removing it is a task below.
- Answers wanted: **Q1** (system identity — confirms the whole build is the نُوى system), **Q5** (email sending domain, needed for real code delivery), **Q12** (post-login landing page per role). Proceed under the stated assumptions if they are still unanswered, and say so.

Goal: a real user can sign in with email and password, pass the email second factor, optionally trust their device, and reset a forgotten password — with the shell rendering their actual role.

Tasks:

1. Install the Vercel CLI, link the project, and confirm the session-1 shell deploys (`pnpm dlx vercel link`, then `pnpm dlx vercel`). Requires an interactive login — ask the user to run `! pnpm dlx vercel login` if it blocks.
2. Provision Neon through the Vercel Marketplace; put `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` in `.env.local` and in all three Vercel environments.
3. Generate Better Auth's Drizzle schema (`user`, `session`, `account`, `verification`), add the project's `trusted_device` table, and run the first migration. Index every foreign key.
4. Configure Better Auth: email + password, sessions in the database, the session lifetimes from `docs/00-OVERVIEW.md`. Read policy values through a typed accessor with defaults — the settings screens that write them ship in session 20.
5. Wire Resend; send the 2FA code and the password-reset link. Use the sandbox address until Q5 is answered.
6. Build `/login` to wireframe fidelity: email, password, the "trust this device" checkbox, the forgot-password link, the "مسار العمل في النظام" panel. Handle invalid credentials and lockout after N failed attempts.
7. Build `/two-factor`: six auto-advancing, paste-aware digit inputs, trust-this-device, resend with its cooldown. Handle wrong code, expired code and attempts exhausted.
8. Build `/forgot-password` and `/reset-password`. The sent-confirmation must be identical whether or not the address exists.
9. Trusted devices: a device inside its trust window skips the second factor. Record device label, OS, browser, IP and last-seen.
10. Add the route guard — unauthenticated requests inside `(app)` redirect to `/login` — and replace the hard-coded role in the `(app)` layout with the real session. Delete `PLACEHOLDER_USER` from the topbar and render the signed-in user.
11. Tests: Vitest over the code lifetime, lockout and trust-window logic; Playwright over sign-in → 2FA → dashboard, wrong code, and the redirect for an unauthenticated visitor.

Acceptance criteria:

- Signing in with valid credentials on an untrusted device lands on `/two-factor`, and a correct code lands on the dashboard.
- A device within its trust window skips `/two-factor` entirely; once the window expires it does not.
- N consecutive failed sign-ins lock the account for the configured duration, and the message does not reveal whether the email exists.
- A wrong 2FA code, an expired code and exhausted attempts each produce their own distinct state.
- A reset link works exactly once and enforces the password policy.
- An unauthenticated request to any `(app)` route redirects to `/login`; after signing in the user lands on their role's landing page (Q12).
- The topbar shows the real signed-in name, initials and role. No `PLACEHOLDER_USER` remains anywhere.
- All four screens match their wireframe at 1440px and 390px in both AR and EN.
- `pnpm check` and the full E2E suite pass; the deployed preview works.

Out of scope:

- The security, 2FA and trusted-device **settings screens** (session 20). Policy values come from typed defaults this session.
- Roles and the permission matrix (session 3) — seed the five roles only as far as session 2 needs to resolve a user's role.
- Any task, team or employee feature.

End with: /end-session
