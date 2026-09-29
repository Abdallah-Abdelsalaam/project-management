# Progress

Newest entry on top.

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
