# Session 04 — Departments, task types and the status machine

Read first: CLAUDE.md, docs/PROGRESS.md (the session 3 entry — especially "The bug that verification found"), docs/07-ROADMAP.md (Session 4), docs/04-SCREENS.md (الأقسام وأنواع المهام, الحالات وسير العمل, الأقسام, تفاصيل القسم), docs/03-DATABASE.md

Wireframe screens: `wireframe/pages/settings/departments.html`, `wireframe/pages/settings/statuses.html`, `wireframe/pages/org/departments.html`, `wireframe/pages/org/department-detail.html`

Carry-over from last session:

- **Deploy first. Nobody can sign in to `https://pm.apqrinu-co.com` right now.** The deployed build predates ADR-023, so `sendTwoFactorOTP` is still called with the incoming request headers, the two-factor cookie is never presented, and every sign-in dies on the error boundary. The fix is committed. Deploy it, then sign in by hand and confirm a code arrives — that is the only proof that matters.
- **The E2E suite is real now.** 109+ specs run against `DATABASE_URL_TEST` (`u774058186_pmTest`), serially, on their own database. Keep it that way: it creates and deletes roles, toggles permissions and changes a password. ADR-024.
- **If you widened Hostinger's Remote MySQL allowlist to `%`, narrow it again.**
- Answers still wanted: **Q9** (the dynamic form builder — see below), **Q1**, **Q5**, **Q12**, and now **Q22** (the seeded accounts are one person's personal mailbox).

Goal: the configurability promise, proven — a new department with its own task types and statuses, and no code change to add one.

Tasks:

1. Deploy the sign-in fix and verify it by hand against the deployed app. Record the result in PROGRESS before writing new code.
2. Add `department`, `task_type`, `task_status`, `status_transition` and `app_setting`. Index every foreign key and every column the lists filter or sort on.
3. Seed 3 departments, their task types, and the 12 statuses with their transitions. The seed is the copy an admin edits, exactly as `role`/`permission` are — the code owns the catalog, the table owns the edits (ADR-020).
4. Typed `app_setting` accessors, in the shape `src/lib/policy.ts` already uses. Session 20 replaces the function bodies and nothing else changes (ADR-017).
5. `/settings/departments` and `/settings/statuses`: create, edit, reorder, toggle.
6. `/org/departments` and `/org/department-detail` (4 tabs).
7. **The status machine is a state machine, not a field.** Only legal transitions are offered, and the server rejects an illegal one — a transition with no row in `status_transition` is refused, and refused server-side.
8. Every mutation: Zod, session, capability **and** scope, one transaction, an audit row, revalidate. `src/features/access/actions.ts` is the pattern to copy.
9. Tests: Vitest over the transition rules as a pure function; Playwright over adding a department and seeing it appear everywhere a department is chosen, over reordering statuses changing board and filter order, and over the server refusing an illegal transition by a request that bypasses the UI.

Acceptance criteria:

- Adding a department makes it available everywhere a department is chosen, on the next request.
- Reordering statuses changes board and filter order.
- A transition with no row is rejected **server-side**, verified by a request that never touches the UI.
- Disabling a department hides it without deleting its history.
- Every change writes an audit row naming who changed what, when, and from what to what.
- All four screens match their wireframes at 1440px and 390px in AR and EN.
- `pnpm check` passes and the full E2E suite passes with no new skips.

Out of scope:

- **The dynamic form builder behind الحقول — blocked on Q9.** Do not start it. If session 4 makes the answer unavoidable, stop and ask rather than guessing: it is 2–3 sessions of its own and it changes the shape of `task_payload`.
- Tasks themselves (session 7+), employees (session 5), teams (session 6).
- The audit log screen (session 18), the security and 2FA settings screens (session 20).

A note on method, earned the hard way last session: a passing test tally is not evidence that a feature works. Three sessions of green output came from specs that had never executed. When something matters — a transition being refused, an audit row being written — read it back out of the database.

End with: /end-session
