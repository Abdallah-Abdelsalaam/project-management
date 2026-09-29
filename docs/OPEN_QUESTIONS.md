# Open questions

Anything unclear in the wireframe, or where the kickoff brief and the wireframe disagree. **The rule: don't guess.** Each entry states the question, the assumption the build is proceeding under, and what it would cost to change the answer later.

Answer by editing the **Answer** line. Resolved entries move to the bottom.

---

## Q1 · System identity — the brief and the wireframe describe different products

**Status:** open · raised session 1 · **blocking nothing, but it invalidates part of the brief**

The kickoff's "System context" line describes an _AI Operations_ task management system with two internal accounts (me = member, manager = admin) plus anonymous public requesters submitting through a shareable link.

The wireframe describes something else entirely: **مجموعة نُوى**, an internal system where the **SEO department dispatches work to Programming and UI/UX**, with **5 roles, 18 employees, 5 teams, 3 departments**, and **no public form, no anonymous requester and no shareable link on any of the 35 screens**.

**Assumption:** the wireframe wins, per the kickoff's own rule. The build is the نُوى system. The public-request-link feature and the two-account model are dropped, and the roadmap has no session for them.

**Cost of changing:** a public request form is a new screen, a new anonymous-write path, Turnstile and rate limiting, and a triage surface for the requests — roughly a full session, plus a wireframe for it, since none exists.

**Answer:** _(pending)_

---

## Q2 · Arabic only, or Arabic and English?

**Status:** open · raised session 1

The stack mandates next-intl with `/ar` and `/en` and a `dir` switch. The wireframe has **no language switcher** anywhere, and every string in all 35 screens is Arabic.

**Assumption:** build the locale routing and externalise every string (cheap now, very expensive to retrofit), ship `ar` as the default, and render **no visible switcher** because the wireframe has none. `en` messages exist and are kept current, and `/en/...` works if you type it.

**Cost of changing:** adding a switcher later is one topbar control plus a cookie — small. Retrofitting i18n onto hard-coded strings later would be days. This is why the structure is being built now regardless.

**Answer:** _(pending)_

---

## Q3 · Is `أُعيد التقديم` (resubmitted) a status or a transition?

**Status:** open · raised session 1 · **blocks part of session 4**

The design spec's rejection path reads `مُقدَّمة → مرفوضة → تحتاج تعديل → أُعيد التقديم → قيد المراجعة`, and the statuses settings screen shows the same flow. But `أُعيد التقديم` has **no colour token** (there are 12, and it is not among them) and **no row** in the statuses table on that screen, which lists 8.

**Assumption:** it is a **transition**, not a status — the act of moving from `تحتاج تعديل` back to `قيد المراجعة` — and the resubmission is tracked by `task_submission.round`, not by a distinct status.

**Cost of changing:** if it is a real status, it needs a token, a row, two transitions and a board column. Small if decided before session 10, annoying afterwards because task rows will already carry status keys.

**Answer:** _(pending)_

---

## Q4 · Attachment rules

**Status:** open · needed by session 9

Task requests and deliveries both carry files (`المرفقات 4`, with download). The wireframe does not state a maximum size, allowed types, total quota per task, or whether files are scanned.

**Assumption:** Vercel Blob; 25 MB per file; 10 files per task per kind; allow images, PDF, common design files (`.fig`, `.sketch`, `.xd`), archives and plain text; no virus scanning in v1.

**Cost of changing:** limits are configuration. Adding scanning later means a third-party service and an async pipeline — a session of its own.

**Answer:** _(pending)_

---

## Q5 · Email sending domain

**Status:** open · needed by session 2

2FA codes, password resets, employee invitations and the daily digest all need email. Resend is the chosen provider. The sending domain and from-address are not specified.

**Assumption:** `no-reply@nuwa.sa` pending confirmation, with the domain verified in Resend before session 2 ships. Until then, development uses Resend's sandbox address.

**Cost of changing:** trivial, it is an environment variable — but DNS verification takes time, so it is worth starting early.

**Answer:** _(pending)_

---

## Q6 · Chart library

**Status:** open · needed by session 17

The reports screen has roughly twelve visualisations: trend lines, distributions, per-team and per-type quality, time-in-stage, rejection reasons. No chart library is in the stack table.

**Assumption:** **Recharts** in client islands for anything interactive, and hand-written SVG for the small static shapes (sparklines, meters, the dispatch strip). Both use the non-red `viz-1…6` palette and must be legible in both themes and both directions.

**Cost of changing:** a library swap at session 17 is contained. After session 17 it means rewriting twelve panels.

**Answer:** _(pending)_

---

## Q7 · How does an employee account get its password?

**Status:** open · needed by session 5

`إضافة موظف` collects name, work email, department, role and team leader. There is no password field and no invitation flow on any screen.

**Assumption:** creating an employee sends an email invitation with a single-use link that lands on the existing **تعيين كلمة مرور جديدة** screen. The account is inactive until the password is set.

**Cost of changing:** small. The alternative (admin sets a temporary password) is a field and a forced-change flag.

**Answer:** _(pending)_

---

## Q8 · Does the component gallery ship?

**Status:** open · raised session 1 · **a recorded deviation until answered**

`wireframe/ui/components.html` (دليل الواجهة) sits in the wireframe's production sidebar under النظام, **ungated** — meaning an ordinary employee would see a style guide in their navigation.

**Assumption:** **not** in the app's nav for now. This is a deliberate, recorded deviation from the wireframe rather than an oversight. The wireframe file remains available as a developer reference.

**Options:** (a) leave it out; (b) ship it behind `settings.view`; (c) ship it in development builds only; (d) ship it exactly as the wireframe has it, ungated.

**Cost of changing:** one entry in `src/config/nav.ts` plus a route. Minutes.

**Answer:** _(pending)_

---

## Q9 · Is a dynamic task-form builder in scope?

**Status:** open · raised session 1 · **the largest scope question in the build; blocks part of session 4**

The wireframe promises, in its own words, that a new department gets its own creation button and its own task types **دون تعديل الشيفرة** (without editing code). Departments, task types, statuses, roles and the permission matrix are all runtime-creatable.

But the task **creation forms are per-department and hard-coded** (`create-programming`, `create-uiux`), each with a bespoke field set — and `settings/departments` puts a **الحقول** (fields) button next to every task type, implying a field editor that has no wireframe.

**Assumption for now:** build the two forms exactly as wireframed, store the department-specific part of the brief in `task_payload.fields` (jsonb) so the shape is already flexible, and leave **الحقول** non-functional with a note. A new department gets a generic form until someone writes its specific one.

**Cost of changing:** a real form builder — field types, validation rules, ordering, conditional display, plus a renderer and a migration path for existing payloads — is **2–3 sessions of its own**, not a slice of session 4. It needs its own wireframe before it can be built.

**Answer:** _(pending)_

---

## Q10 · Seed the reference organisation, or start empty?

**Status:** open · needed by session 4

The wireframe is populated with a specific organisation: نُوى, 3 departments, 5 teams, 18 named employees, ~284 tasks.

**Assumption:** seed it. Development and preview environments get the full reference organisation so every screen has realistic data and the E2E suite has something to assert against. Production gets a minimal seed — the statuses, the 22 permissions, the 5 roles, and one admin account — and the real organisation is entered through the UI.

**Cost of changing:** low. Seeds are scripts.

**Answer:** _(pending)_

---

## Q11 · Are rejection reasons a fixed enum or admin-editable?

**Status:** open · needed by session 11

Two screens show a rejection-reason list, and **the two lists differ**: the dashboard's modal has 5 options, the review screen's has 6 (it adds `التسليم غير كامل`). Both end with `سبب آخر`.

**Assumption:** a `rejection_reason` table seeded with the **union** of both lists (6 reasons + other), not admin-editable in v1 but shaped so it can become editable without a migration. The reports screen aggregates by reason, which is the argument for a stable key.

**Cost of changing:** making it editable later is one settings panel. The table already supports it.

**Answer:** _(pending)_

---

## Q12 · Which page is the post-login landing page, per role?

**Status:** open · needed by session 2

The dashboard is explicitly manager-shaped ("لوحة التحكم تعرض الصورة الإدارية الكاملة؛ هذه الصفحة تعرض عملك فقط" — from the مهامي screen). An agent landing on the dashboard lands on a view mostly about other people.

**Assumption:** agents land on `/my-work`; every other role lands on `/dashboard`.

**Cost of changing:** one conditional redirect.

**Answer:** _(pending)_

---

## Q13 · The shell currently renders as `manager`

**Status:** **resolved** session 2 · informational

Until Better Auth is wired, `src/app/[locale]/(app)/layout.tsx` passes a hard-coded `manager` role so every nav group is visible for review. This is a placeholder, marked in the code, and session 2 replaces it with the real session.

**Cost of changing:** none — it is one constant, and removing it is a session-2 acceptance criterion.

**Answer:** **resolved.** Session 2 deleted `PLACEHOLDER_ROLE` and
`PLACEHOLDER_USER`. `src/app/[locale]/(app)/layout.tsx` resolves the real
session through `requireSession()` and passes the role and the user down to the
shell.

---

## Q14 · Node 22 locally, Node 24 in the brief

**Status:** open · raised session 1 · low impact

The brief specifies Node 24.x. This machine has **22.14.0**, also an active LTS and fully supported on Vercel. `package.json` sets `engines.node >= 22.14.0` and `.nvmrc` pins 22.14.0.

**Assumption:** proceed on 22.14.0; raise both pins to 24 once it is installed. Nothing in the code depends on the difference.

**Cost of changing:** two lines, plus the Vercel project's Node setting.

**Answer:** _(pending)_

---

## Q15 · The task-creation dock overlaps the sidebar

**Status:** open · raised session 1 · fidelity note

The wireframe positions `.fab-dock` at `inset-inline-start: var(--sp-6)`. In RTL the sidebar is also on the inline-start edge, so the two floating buttons sit over the bottom of the sidebar. The port reproduces this faithfully — and it looks wrong.

The wireframe's own README states its rendered appearance was never verified ("Chrome in this environment refuses loopback connections"), so this is plausibly a prototype bug rather than an intention.

**Assumption:** match the wireframe exactly for now, and flag it. The fix, if wanted, is to offset the dock by the sidebar width on desktop.

**Cost of changing:** one class.

**Answer:** _(pending)_

---

## Q16 · The reset screen's fifth requirement cannot be checked in the browser

**Status:** open · raised session 2 · fidelity note

`pages/auth/reset-password.html` lists five password requirements, each with its
own pass/fail mark, and the fifth is **لا تطابق آخر خمس كلمات مرور استخدمتها**.
The first four are decidable from the password alone. The fifth needs the
account's password history, which the browser does not have and must not be
given — that would be an oracle for five of the user's previous passwords.

**Assumption:** the row renders in a third state, _pending_, until the server
answers, and turns red only when the server rejects the password as reused. The
other four tick live as the user types, exactly as wireframed. A row that
claimed a pass it had not checked would be worse than one that waits.

**Options:** (a) keep the pending state; (b) drop the row from the live
checklist and surface reuse only as a submit error; (c) check it live against a
server endpoint on every keystroke — rejected, it is a password oracle.

**Cost of changing:** one function in `src/features/auth/password-policy.ts` and
one branch in the reset form. Minutes.

**Answer:** _(pending)_

---

## Q17 · The login aside's numbers are copy, not data

**Status:** open · raised session 2 · low impact

The "مسار العمل في النظام" panel on the sign-in screen shows 284 / 168 / 116
tasks and "3 فرق · 11 موظفًا". On a screen shown to someone who is _not_ signed
in, those are either sample figures or a public disclosure of the organisation's
size.

**Assumption:** sample figures, living in `messages/{ar,en}.json` as part of the
copy. They stay frozen at the wireframe's values rather than becoming live
counts, because a sign-in page should not answer questions for an anonymous
visitor — and because a live count would make the page uncacheable.

**Cost of changing:** if they should be live, it is one cached query and moving
three strings out of the message files. Small, but it changes the page from
static to dynamic.

**Answer:** _(pending)_

---

## Q18 · The E2E suite needs a mail outbox to read a verification code

**Status:** open · raised session 2 · informational

The second factor is stored hashed and delivered by email, so no test can learn
a code by reading the database. `src/features/auth/mail.ts` therefore writes
every message to a JSON-lines file when `AUTH_MAIL_OUTBOX` is set, and the
Playwright fixtures read it from there.

**Assumption:** this is an acceptable test seam. It is opt-in by environment
variable, nothing sets it outside a test run, it logs loudly whenever it is
active, and the alternative — storing codes in plain text so a test can read
them — weakens the product to suit the tests.

**Cost of changing:** the alternative is a Resend sandbox inbox polled over
their API, which is slower, needs a network and a key in CI, and still leaves
the same file on disk in the runner.

**Answer:** _(pending)_

---

## Resolved

_(none yet)_
