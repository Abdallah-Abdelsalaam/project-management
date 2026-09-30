# 07 · Roadmap

One session ≈ 3 hours = **one vertical slice**: DB migration → server logic → UI screen(s) → tests → docs. Never "all the database in one session, all the UI in another".

Order: auth and roles → core entity CRUD → main dashboards and views → manager features → notifications and extras → polish, performance and security.

There is no public-request-link session. The wireframe has no public or anonymous surface — see `OPEN_QUESTIONS.md` Q1.

21 sessions. If one turns out to be bigger than ~3h, split it and renumber the rest.

---

## ✅ Session 1 — Foundation: docs, scaffold, app shell

**Goal:** a documented, deployable empty shell that matches the wireframe's chrome.

- [x] Analyse all 35 wireframe screens; agree scope
- [x] Create the documentation system and the session commands
- [x] Git init; commit the wireframe baseline; move the prototype to `wireframe/`
- [x] Scaffold Next.js 16 + TS strict + Tailwind v4 + pnpm
- [x] Port the design tokens value-for-value
- [x] next-intl with `ar` default and `en`, `dir` switching, all strings externalised
- [x] Drizzle + Neon client, Better Auth skeleton, `.env.example`
- [x] Capability engine ported from `role.js`, with unit tests
- [x] App shell: sidebar (inline + rail + mobile drawer), topbar, task-creation dock
- [x] Placeholder pages for all 33 routes, each naming its wireframe file and session
- [x] ESLint + Prettier + Vitest + Playwright; lint, typecheck, tests and build all pass
- [ ] Connect Vercel and confirm the deployed preview

**Acceptance:** `pnpm check` passes · every nav link resolves · AR renders RTL and EN renders LTR · shell works at 1440px and 390px.
**Out of scope:** any feature, any table, any real data.

---

## Session 2 — Authentication

**Goal:** a real user can sign in, pass 2FA, trust a device and reset a password.
**Wireframe screens:** `auth/login`, `auth/two-factor`, `auth/forgot-password`, `auth/reset-password`

- [x] Better Auth tables + `trusted_device`; first migration
- [x] Email + password sign-in, session in the database
- [x] Email OTP second factor; trusted-device window skips it
- [x] Forgot / reset password, honouring the org password policy
- [x] Route guard: unauthenticated requests redirect to `/login`
- [x] Replace the shell's hard-coded role with the real session
- [x] Resend wired for code and reset emails
- [x] Build all four auth screens to wireframe fidelity
- [ ] **Carried to session 3:** connect Vercel + Neon, apply the migration, seed, and run the database-backed half of the suite

**Acceptance:** sign in → 2FA → dashboard · wrong code and expired code both handled · lockout after N failures · a trusted device skips 2FA until its window expires · reset link is single-use.
**Out of scope:** the security and 2FA _settings_ screens (session 20) — policy values are read from defaults until then.

---

## Session 3 — Roles, capabilities and the permission matrix

**Goal:** permissions become data, editable by an admin, enforced on the server.
**Wireframe screens:** `settings/roles`, `settings/permissions`

- [x] **Unplanned: ported the whole stack from Neon Postgres to MySQL on Hostinger** — ADR-019
- [x] `role`, `permission`, `role_permission`, `audit_log`; seed the 5 roles and 30 capabilities (Q19)
- [x] `user.role` (text) → `user.role_id` (fk), in the regenerated baseline migration
- [x] `requireCapability` / `requireScope` server helpers, reading the tables
- [x] Roles screen: list, create, edit, delete-when-unused
- [x] Permission matrix: 30 × 5 grid, search, dirty state, save, restore defaults
- [x] One audit row per changed cell, in the same transaction as the change
- [x] Nav and shell gating driven by the stored grants, not a role key

- [x] **Closeout: the E2E suite ran for the first time** — against its own database, `DATABASE_URL_TEST` (ADR-024)
- [x] **Closeout: found and fixed the bug that made sign-in impossible** — the two-factor cookie was never presented to `sendTwoFactorOTP`, so no code was ever sent (ADR-023)
- [x] Closeout: session 2's four unverified assumptions checked against a real database, by query rather than by test
- [x] Closeout: fidelity boxes ticked for roles, permissions, two-factor, login and reset-password

**Acceptance:** granting a capability changes what that role sees on the next request · the admin column cannot be edited · every change is in the audit log · an agent hitting an admin route is refused server-side, not just hidden. **All confirmed by a passing E2E run and by reading the rows back.**
**Out of scope:** the audit _log screen_ (session 18); rows are written now, read later.

---

## Session 4 — Departments, task types and the status machine

**Goal:** the configurability promise, proven: a new department with its own task types and statuses, no code change.
**Wireframe screens:** `settings/departments`, `settings/statuses`, `org/departments`, `org/department-detail`

- [ ] `department`, `task_type`, `task_status`, `status_transition`, `app_setting`
- [ ] Seed 3 departments, their task types, and the 12 statuses with their transitions
- [ ] Settings screens for departments, task types and statuses (create, edit, reorder, toggle)
- [ ] Departments list and department detail (4 tabs)
- [ ] Typed `app_setting` accessors

**Acceptance:** adding a department makes it available everywhere a department is chosen · reordering statuses changes board and filter order · a transition with no row is rejected by the server · disabling a department hides it without deleting its history.
**Out of scope:** the dynamic form builder behind **الحقول** — blocked on `OPEN_QUESTIONS.md` Q9.

---

## Session 5 — Employees

**Goal:** people exist, with profiles.
**Wireframe screens:** `people/employees`, `people/employee-profile`

- [ ] Extend `user` with org fields and `can_change_own_status`
- [ ] Employees list: search, filters, sort, pagination, scope by role
- [ ] Add employee → email invite → set password (reuses the reset screen)
- [ ] Employee profile: identity header + 4 tabs, with the tasks tab stubbed until session 8

**Acceptance:** an invited employee can set a password and sign in · list scope respects the role · pagination and sort work against real indexes.

---

## Session 6 — Teams

**Goal:** team structure and the per-member status switch.
**Wireframe screens:** `people/teams`, `people/team-detail`

- [ ] `team`; derived load; `setMemberStatusPermission`
- [ ] Teams list and team detail
- [ ] Move an employee between teams, with the open-task choice
- [ ] Leader assignment

**Acceptance:** toggling a member's switch changes what that member can do on a task, enforced server-side · load recalculates from active tasks · moving an employee preserves their history.

---

## Session 7 — Task creation

**Goal:** the SEO department can dispatch work.
**Wireframe screens:** `tasks/create-programming`, `tasks/create-uiux`

- [ ] `task`, `task_payload`; reference generator (`PRG-`, `UIX-`)
- [ ] Both creation forms, all fields, all validation, per-department options
- [ ] Live brief-completeness meter
- [ ] Save as draft, and create-and-send
- [ ] Routing selects showing each candidate's load and quality

**Acceptance:** a created task lands in `created` with the right reference and payload · a draft is visible only to its creator · the completeness meter matches the brief-completeness component of the quality formula · minimum due-date lead time enforced.

---

## Session 8 — Task list, filters and saved views

**Goal:** finding work at scale.
**Wireframe screens:** `tasks/list`

- [ ] Paginated, indexed list query with every wireframe filter and sort
- [ ] Count chips, search by title or reference, column chooser
- [ ] `saved_view`
- [ ] Bulk selection bar (actions wired in session 10)
- [ ] Status spine, quality chips, empty and filtered-empty states

**Acceptance:** every filter and sort hits an index · 1000 seeded tasks paginate without an N+1 · a saved view restores filters and columns · the employee profile's tasks tab now renders.

---

## Session 9 — Task detail: requirements, delivery, attachments, comments

**Goal:** the task record is complete and readable.
**Wireframe screens:** `tasks/detail`, `tasks/history`

- [ ] `task_attachment` (Vercel Blob), `task_comment`, `task_submission`
- [ ] Task detail: all five tabs, both sidebar panels
- [ ] Submit for review with a delivery description and files
- [ ] Task history timeline with `from → to` diffs
- [ ] Read-only banner for members without status permission

**Acceptance:** upload, download and delete respect scope · comments are scoped to people with task access · history shows every event · the read-only banner appears for exactly the right members.

---

## Session 10 — Assignment and the status machine

**Goal:** work moves through its lifecycle, legally.
**Wireframe screens:** `tasks/detail` (actions), `tasks/list` (bulk)

- [ ] `changeStatus` as the single gateway: legal transition + capability + per-member switch + lifecycle timestamps + audit + revalidate
- [ ] Assign, reassign, hold, cancel, duplicate
- [ ] Bulk assign, bulk status, bulk priority
- [ ] Only legal actions rendered

**Acceptance:** an illegal transition is rejected server-side even when forged · an agent without the switch can only submit · every transition writes an audit row inside the same transaction · bulk actions are transactional and partial failures report per row.

---

## Session 11 — Review queue

**Goal:** a team leader can judge work.
**Wireframe screens:** `tasks/review`

- [ ] `task_review`, `rejection_reason`
- [ ] Review queue with the four sort orders
- [ ] Side-by-side requirements against delivery
- [ ] Approve with a 1–5 score and notes
- [ ] Reject with a required reason and required changes, optional resubmit date
- [ ] Nav badge count

**Acceptance:** approving moves the task to `approved` and triggers scoring · rejecting increments the rejection count and moves to `rejected` · a rejection without a reason is refused · the queue respects scope.

---

## Session 12 — Rejections and resubmission

**Goal:** the correction loop closes.
**Wireframe screens:** `tasks/rejected`

- [ ] Rejected & revisions screen with its four count chips
- [ ] Resubmission: increments the round, returns to review, preserves the trail
- [ ] Rejection-reason and per-department revision aggregates

**Acceptance:** a resubmitted task appears in the review queue as round 2 · the revision counter feeds the quality formula · the full path stays in the history.

---

## Session 13 — The quality engine

**Goal:** every number becomes defensible.
**Wireframe screens:** `settings/task-settings`, the quality panels on detail and profile

- [ ] `task_quality_component`, `employee_quality_snapshot`
- [ ] Task quality computed on approval, weights **stored per row**
- [ ] Employee snapshot over the rolling window
- [ ] Task settings screen: weights, penalties, SLAs, defaults
- [ ] The quality meter component and its breakdown popover, used everywhere a score appears

**Acceptance:** weights must total 100 to save · changing weights does not alter any existing score · every score opens a breakdown that adds to the displayed total · the profile's score modal matches the wireframe's five rows.

---

## Session 14 — Dashboard

**Goal:** the screen the whole product is judged by.
**Wireframe screens:** `dashboard/index`

- [ ] Dispatch strip with per-stage counts, each stage filtering the table
- [ ] Six stat tiles with period deltas
- [ ] The task panel: saved views, column chooser, view chips, filter bar, bulk bar, table, pagination
- [ ] Status distribution and team quality panels
- [ ] Reject-with-reason modal from the row menu

**Acceptance:** counts reconcile with the task list under the same filters · clicking a dispatch stage filters the table · the dashboard is scoped by role · no N+1 and no unindexed sort.

---

## Session 15 — مهامي (My work)

**Goal:** the employee's focused view.
**Wireframe screens:** `dashboard/my-work`

- [ ] Board and list modes
- [ ] Own performance panel
- [ ] Activity strip over own tasks

**Acceptance:** shows only the signed-in user's tasks, in every role · board columns follow the configured status order · ordering puts the most urgent first.

---

## Session 16 — Org structure, heads and team leaders

**Goal:** the management layer.
**Wireframe screens:** `org/structure`, `org/heads`, `org/team-leaders`

- [ ] Org tree, expandable, exportable
- [ ] Appoint and remove heads, with the reason recorded
- [ ] Team leaders table with review latency and rejection rate
- [ ] Bulk employee redistribution between teams

**Acceptance:** the tree renders in one query · removing a head requires a destination choice for the department · redistribution is transactional · every change is audited.

---

## Session 17 — Reports

**Goal:** organisation-level reading.
**Wireframe screens:** `insights/reports`

- [ ] Chart library decision resolved (Q6) and installed
- [ ] Four tabs, all twelve panels
- [ ] Range selector, PDF and CSV export
- [ ] Time-based revalidation

**Acceptance:** every figure traces back to the tasks that produced it · export matches what is on screen · charts are readable in both themes and both directions · the palette is the non-red `viz-*` sequence.

---

## Session 18 — Activity and audit log

**Goal:** the record you consult when you distrust the rest.
**Wireframe screens:** `insights/activity-log`

- [ ] Audit log screen: search, filters, `from → to` diffs, pagination, export
- [ ] Verify coverage: every mutating action from sessions 3–17 writes a row
- [ ] Never cached; no update or delete path exists

**Acceptance:** every mutation implemented so far appears · diffs render before and after · the log is provably append-only.

---

## Session 19 — Notifications

**Goal:** the right interruptions, and no others.
**Wireframe screens:** `settings/notifications`, the topbar drawer

- [ ] `notification`, `notification_preference`, user digest settings
- [ ] 18 events × 3 channels, wired to the actions that raise them
- [ ] Notification drawer with unread state and mark-all-read
- [ ] Email via Resend; daily digest via Vercel Cron, honouring quiet hours
- [ ] Preferences screen

**Acceptance:** an event with its channel off sends nothing · the digest respects time, days and quiet hours · the cron route rejects a request without `CRON_SECRET` · mobile push stays visibly disabled.

---

## Session 20 — Security, sessions, 2FA settings and trusted devices

**Goal:** the security posture is administrable.
**Wireframe screens:** `settings/security`, `settings/two-factor`, `settings/trusted-devices`

- [ ] `security_event`; session listing and revocation
- [ ] Org policy: password length and expiry, lockout, idle and maximum session age
- [ ] 2FA policy: method, code lifetime and length, attempts, resend wait, trusted-device window and count, forced re-verification
- [ ] Trusted devices: list, revoke one, revoke all
- [ ] Policy writes require re-authentication
- [ ] Session 2's auth now reads these settings instead of defaults

**Acceptance:** changing the password policy affects the next password change · revoking a session signs that device out on its next request · revoking trust forces 2FA next time · every security event is logged.

---

## Session 21 — Polish, performance, accessibility and security pass

**Goal:** ship quality.

- [ ] Full fidelity sweep: every screen against its wireframe, both directions, both viewports
- [ ] Complete every screen's fidelity checklist in `04-SCREENS.md`
- [ ] Performance: LCP < 2.5s, no layout shift, bundle audit, `next/image` everywhere
- [ ] Accessibility: keyboard path through every flow, focus traps in overlays, axe clean
- [ ] Security: re-verify every Server Action checks session, capability **and** scope; rate limits on public endpoints; dependency audit
- [ ] Resolve or close every remaining item in `OPEN_QUESTIONS.md`

**Acceptance:** no unchecked fidelity boxes · no open question left silently unanswered · `pnpm check` and the full E2E suite green · production deploy verified.
