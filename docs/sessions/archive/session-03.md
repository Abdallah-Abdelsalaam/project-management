# Session 03 — Roles, capabilities and the permission matrix

Read first: CLAUDE.md, docs/PROGRESS.md (session 2 entry, especially "The thing most likely to bite"), docs/07-ROADMAP.md (Session 3), docs/04-SCREENS.md (الأدوار and الصلاحيات), docs/03-DATABASE.md (Identity and access)

Wireframe screens: `wireframe/pages/settings/roles.html`, `wireframe/pages/settings/permissions.html`

Carry-over from last session:

- **Vercel and Neon are still not connected — this is now two sessions old and it blocks verification of everything session 2 built.** Do it first (Tasks 1–3). Everything it needs is ready: the migration is committed, `pnpm db:seed` creates one account per role, and `.env.example` documents every variable.
- **Nothing in the sign-in flow has run against a real database.** 58 E2E specs are written and have never executed. Session 2's PROGRESS entry lists four specific assumptions to check first; the load-bearing one is whether `auth.api.signInEmail` returns `{ twoFactorRedirect: true }` when called server-side. If it does not, sign-in skips the second factor entirely — a security failure, not a cosmetic one.
- `user.role` is a text key, not a foreign key. Session 3 migrates it to `role_id`.
- Answers wanted: **Q1** (system identity), **Q5** (email sending domain — `no-reply@nuwa.sa` needs DNS verification in Resend and that takes time, so start it early), **Q12** (post-login landing page per role). Proceed under the stated assumptions if they are still unanswered, and say so.

Goal: permissions become data — stored, editable by an admin, and enforced on the server — with session 2's auth verified end to end against a real database.

Tasks:

1. Install the Vercel CLI, link the project, and confirm the session-2 app deploys (`pnpm dlx vercel link`, then `pnpm dlx vercel`). Requires an interactive login — ask the user to run `! pnpm dlx vercel login` if it blocks.
2. Provision Neon through the Vercel Marketplace; put `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` in `.env.local` and in all three Vercel environments. Then `pnpm db:migrate && pnpm db:seed`.
3. **Verify session 2 before building on it.** Run the full E2E suite with `DATABASE_URL` and `AUTH_MAIL_OUTBOX` set — 58 specs that have never executed. Sign in once by hand and inspect `login_attempt`, `trusted_device` and `password_history` to confirm the three hooks actually fire. Fix what is broken and record it in PROGRESS before writing new code.
4. Tick the fidelity boxes in `docs/04-SCREENS.md` that session 2 left unticked with a reason, and capture the `two-factor` screenshots that could not be taken without a live challenge.
5. Add `role`, `permission` and `role_permission`; seed the 5 roles and 22 capabilities from `CAPABILITIES` and `ROLES` in `src/lib/permissions.ts` — that constant is the source, the table is the copy an admin edits. Migrate `user.role` (text) to `user.role_id` (fk) in the same migration.
6. Write the `requireCapability` / `requireScope` server helpers. `requireCapability` already exists in `src/features/auth/session.ts` reading the static map; move it to read the tables. **Scope is separate from capability and just as important** — a team leader holds `tasks.assign` but only for their own team, and no capability string expresses that.
7. Build `/settings/roles` to wireframe fidelity: list, create, edit, delete-when-unused, with the user count per role.
8. Build `/settings/permissions`: the 22 × 5 matrix, search, dirty state, save, restore defaults. The admin column is not editable.
9. One audit row per changed cell, written in the same transaction as the change. The audit _screen_ is session 18; the rows start now.
10. Drive the nav and shell gating from the stored role rather than the static map.
11. Tests: Vitest over wildcard resolution against the stored rows and over the scope helpers; Playwright over granting a capability and seeing it take effect on the next request, and over an agent being refused an admin route server-side.

Acceptance criteria:

- Session 2's auth is verified against a real database: sign-in → 2FA → dashboard, a trusted device skipping the second factor, lockout, and a single-use reset link all confirmed by a passing E2E run, not by a written test.
- The deployed preview works and someone can sign in to it.
- Granting a capability changes what that role sees on the next request.
- The admin column cannot be edited, from the UI or by posting directly.
- An agent hitting an admin route is refused **server-side**, not merely hidden — verified by a request that bypasses the UI.
- Every permission change writes an audit row naming who changed what, when, and from what to what.
- A role in use cannot be deleted.
- Both screens match their wireframe at 1440px and 390px in AR and EN.
- `pnpm check` and the full E2E suite pass, with **zero skipped specs** — the database exists now.

Out of scope:

- The audit log **screen** (session 18). Rows are written now, read later.
- The security, 2FA and trusted-device settings screens (session 20).
- Departments, task types and the status machine (session 4).
- Any task, team or employee feature.

End with: /end-session
