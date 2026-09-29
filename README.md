# Project Management — UI/UX Wireframe

A static, Arabic-first (RTL) interface prototype for an internal operations system where the **SEO department dispatches work to Programming and UI/UX**.

This is **phase 1: the interface only.** No backend, no persistence, no application logic. The point is to settle and approve the complete interface before any architecture work begins.

Brand color: `#e7033e`

---

## Open it

Double-click **`index.html`** — it's the prototype index and links to every built page.

If you'd rather preview over http, run **`serve.cmd`** and open `http://127.0.0.1:5173`.

Start here:

| Page | What it shows |
|---|---|
| `pages/dashboard/index.html` | The main dashboard — the most complete screen |
| `ui/components.html` | The component gallery — every token, component, and state |
| `pages/auth/login.html` | Login, with the trusted-device option |

---

## Two things to try first

**1. The role switcher.** Top bar, marked with a dashed border: *"معاينة كـ"*. Switch between موظف / قائد الفريق / رئيس القسم / مدير / مسؤول النظام and watch controls, nav items, and whole sections appear and disappear. This makes the permission model reviewable in a browser instead of theoretical.

**2. Quality breakdowns.** On the dashboard's first task row, click the `94%` quality chip. It opens the weighted calculation behind the number. A bare percentage can't survive a performance review; every score in this system is auditable.

Also worth a look: `Ctrl+K` opens the command palette, and the two fixed buttons at the bottom of every page are the task-creation shortcuts from the brief.

---

## What's built

All **35 pages** are complete. Every internal link resolves — there are no dead ends.

| Area | Pages |
|---|---|
| Foundation | Token system with dark mode, `@layer` CSS architecture, app shell, component gallery |
| Auth | Login, 2FA, forgot password, reset password, trusted devices |
| Tasks | My work, all tasks, task detail, create programming, create UI/UX, review queue, rejected/revisions, task history |
| People | Employees, employee profile (4 tabs), teams, team detail |
| Organization | Departments, department detail (4 tabs), org structure, heads, team leaders |
| Insights | Reports (4 tabs), activity & audit log |
| Settings | Roles, permissions matrix, security, 2FA, notifications, task settings, statuses & workflow, departments & task types |

Plus a prototype index (`index.html`) listing every page.

---

## Design rules this codebase enforces

These are not preferences; they're constraints that keep the system coherent as it grows.

**1. Borders, not shadows.** A shadow means "this floats above the page," so it appears only on dropdowns, popovers, modals, drawers, and toasts. Static surfaces are separated by a 1px border. There is deliberately no shadow token for cards.

**2. Radius encodes role.** Data surfaces `4px`, controls `6px`, panels `8px`, floating overlays `10px`, pills fully round. Not one radius on everything.

**3. Brand red is never a status.** `#e7033e` is reserved for primary actions, active navigation, and the brand mark. Lifecycle statuses have their own hues, and rejection uses a distinct deep crimson (`#a8022d`) so "error" never reads as "brand."

**4. `brand-500` for fills, `brand-700` for text.** `#e7033e` as small text on white measures ~4.5:1, which is borderline. The token system splits the two uses so contrast never depends on someone remembering.

**5. RTL is structural.** The stylesheet uses **only** logical properties — `margin-inline-start`, `inset-inline-start`, `border-inline-start`, `text-align: start`. There is no `left`, `right`, `margin-left`, or `padding-right` anywhere in `assets/css/`. Switching the whole application to LTR is changing one attribute on `<html>`.

**6. Permissions are capabilities, not roles.** Markup says `data-perm="tasks.assign"`, never "if manager." Adding a role is one entry in `ROLES` in `assets/js/role.js`.

### The signature devices

- **The status spine** — every task row carries a colored border on its leading edge encoding lifecycle state, turning a long table into a scannable board.
- **The dispatch strip** — the dashboard opens on the actual shape of the business (SEO → Programming / UI-UX with counts per stage) rather than on four decorative figures. Every stage is a filter.

---

## Structure

```
project-management/
├─ index.html                     prototype index
├─ serve.cmd                      optional local preview server
├─ assets/
│  ├─ css/
│  │  ├─ main.css                 @layer order + imports (the only file pages link)
│  │  ├─ 01-tokens.css            every design token
│  │  ├─ 02-reset.css
│  │  ├─ 03-base.css              typography, links, focus
│  │  ├─ 04-layout.css            shell grid, page scaffolding
│  │  ├─ 99-utilities.css
│  │  └─ components/
│  │     ├─ buttons.css
│  │     ├─ forms.css
│  │     ├─ nav.css               sidebar, topbar, tabs, pagination, breadcrumb
│  │     ├─ data.css              table, status, meters, tiles, dispatch strip
│  │     ├─ overlays.css          dropdown, popover, modal, drawer, toast, palette
│  │     └─ feedback.css          empty, skeleton, alerts, timeline, audit diff
│  └─ js/
│     ├─ shell.js                 NAV config + shell template
│     ├─ ui.js                    tabs, modals, dropdowns, toasts, palette
│     └─ role.js                  capabilities + role switcher
├─ pages/
│  ├─ auth/ · dashboard/ · tasks/ · people/ · org/ · insights/ · settings/
├─ ui/components.html             component gallery
└─ docs/superpowers/specs/        the approved design spec
```

### Adding a page

1. Copy `pages/dashboard/index.html` as a starting point.
2. Set its identity near the bottom: `window.PM_PAGE = { id: 'your-id', base: '../../' }`.
3. If it belongs in the sidebar, add one entry to `NAV` in `assets/js/shell.js` — it appears on every page and becomes searchable in the command palette at the same time.

The shell is rendered from a JS template rather than HTML partials because the prototype has to open from the filesystem, where `fetch()` of a local partial is blocked by the `file://` origin rules.

---

## Verification status

Checked programmatically across all 35 pages:

- **Structure** — HTML tags balance, no duplicate IDs, no mis-nested elements
- **Wiring** — every page declares the correct `base` path for its folder depth, loads the stylesheet, and shell pages load all three scripts plus a skip link
- **Links** — all 200+ internal links resolve to files that exist
- **Overlay and tab targets** — every `data-open`, `data-close`, `data-menu`, `data-popover`, and `aria-controls` points at an element that exists on the page
- **Permissions** — all 18 distinct capability strings used in markup are defined in `role.js`
- **Navigation** — every `NAV` entry points at a real file; every page id exists in the nav config
- **Labels** — every input, select, and textarea has an `aria-label`, a `<label for>`, or a wrapping `<label>`
- **RTL discipline** — zero physical `left`/`right` box properties across all 13 stylesheets
- **Serving** — all 35 pages and 16 assets return 200 over http
- **JS** — all three files pass a syntax check

**Not verified: rendered appearance.** Chrome in this environment refuses loopback connections, so no screenshot, interaction test, or responsive check was possible. Everything above confirms the prototype is structurally sound and fully wired; how it *looks* is unreviewed. That's yours to judge.

---

## Next

Review the interface. Once the direction holds, phase 2 documents the system architecture, database structure, roles and permissions, workflows, security model, task lifecycle, APIs, and scalability strategy in organized `.md` files.

The approved design spec for this phase is in `docs/superpowers/specs/2026-09-29-project-management-wireframe-design.md`.
