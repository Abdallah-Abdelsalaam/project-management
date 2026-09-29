# Project Management — Wireframe Design Spec

**Date:** 2026-09-29
**Phase:** 1 of 2 — static UI/UX wireframe (HTML + CSS + minimal vanilla JS)
**Next phase:** full system architecture documentation

---

## 1. What this is

An internal operations system for an organization where the **SEO department continuously dispatches work** to two delivery departments:

- Programming (البرمجة)
- UI/UX (التصميم)

The primary users are SEO specialists creating tasks, team leaders assigning and reviewing them, department heads managing team composition, and managers overseeing departments.

The primary job of the interface: **dispatch work, track its lifecycle, and judge its quality defensibly.**

This phase builds the interface only. No backend, no persistence, no application logic.

---

## 2. Confirmed decisions

| Axis | Decision |
|---|---|
| Language / direction | Arabic, `dir="rtl"`, `lang="ar"` as primary |
| Interactivity | Minimal vanilla JS — no framework, no build step |
| Shell | Collapsible sidebar + topbar |
| Build order | Foundation + dashboard first, then remaining pages |
| Brand color | `#e7033e` |
| Code structure | Multi-page HTML, shell rendered from one JS template |

### Why the shell is JS-rendered

The prototype must open from the filesystem (`file://`). HTML partials fetched with `fetch()` fail there on CORS. So `shell.js` carries the shell markup as a template literal and a single `NAV` config object. Adding a module to the sidebar is one array entry, edited once, reflected on every page.

---

## 3. Visual language

The aesthetic is drawn from **operations dispatch boards and job tickets**, not from marketing-site conventions. Three enforced rules keep it away from the generic dashboard look:

1. **Borders, not shadows.** A shadow means "this floats above the page" and is used only for dropdowns, popovers, modals, drawers, and toasts. Static surfaces are separated by a 1px border.
2. **Radius encodes role.** Data surfaces `4px`, interactive controls `6px`, floating overlays `10px`, pills fully round. Not one radius everywhere.
3. **Brand red is never a status.** `#e7033e` is reserved for primary actions, active navigation, and the brand mark. Lifecycle statuses have their own hues, and rejection uses a distinct deep crimson (`#a8022d`) so "error" is never confused with "brand."

### Signature device: the status spine

Every task row carries a colored border on its inline-start edge encoding lifecycle state. The table becomes scannable as a board rather than a grid of text. This is structural, not decorative: the color *is* the status.

### The dashboard hero: the dispatch strip

The dashboard opens on a horizontal flow of SEO → Programming / UI-UX showing counts at each lifecycle stage. Each stage is clickable and filters the table below. It replaces the default "four big gradient numbers" treatment with something specific to this product's actual workflow.

### Color tokens (base)

| Name | Value | Role |
|---|---|---|
| `ink` | `#14121A` | Primary text. Cool violet cast to harmonize with the crimson brand |
| `paper` | `#FBFAFC` | App background |
| `surface` | `#FFFFFF` | Raised panels, table surface |
| `line` | `#E4E1E9` | Borders, dividers |
| `brand` | `#E7033E` | Fills, active states, primary actions |
| `brand-deep` | `#A8022D` | Brand text on light backgrounds, hover states |

**Accessibility note:** `#e7033e` as small text on white measures ~4.5:1, which is borderline. The token system therefore splits usage — `brand` for fills with white text, `brand-deep` for small text and links. Never brand-500 on white at body size.

### Typography

One family: **IBM Plex Sans Arabic**, weights 400 / 500 / 600 / 700. It is legible at 12px, has genuine Arabic design intent rather than being a Latin face with Arabic bolted on, and reads as engineered rather than friendly — correct for an operations tool.

No monospace secondary face. Numeric alignment is solved with `font-variant-numeric: tabular-nums lining-nums` on every data cell, so columns lock into vertical rhythm without a font switch.

Digits are Latin (`0-9`), not Arabic-Indic, matching business-software convention in the region and keeping mixed-language data legible.

### RTL as structure, not a patch

`<html dir="rtl" lang="ar">` and the stylesheet uses **only** logical properties: `margin-inline-start`, `padding-inline`, `inset-inline-start`, `border-inline-start`, `text-align: start/end`. There is no `left`, `right`, `margin-left`, or `padding-right` anywhere in the CSS.

Consequence: switching the entire application to LTR is changing one attribute. Direction-implying icons flip via a `[dir="rtl"]` transform.

---

## 4. Task lifecycle

```
مسودة → مُنشأة → مُسندة → قيد التنفيذ → مُقدَّمة → قيد المراجعة → معتمدة → مغلقة
```

Rejection path:

```
مُقدَّمة → مرفوضة → تحتاج تعديل → أُعيد التقديم → قيد المراجعة
```

Side states: `معلّقة` (on hold), `ملغاة` (cancelled).

Each status is a token carrying a label, a color, and its set of legal next transitions. The UI renders only legal actions — the workflow is a state machine, not a free-text field.

| Status | Token | Color |
|---|---|---|
| مسودة | `draft` | `#64748B` |
| مُنشأة | `created` | `#6D28D9` |
| مُسندة | `assigned` | `#3730A3` |
| قيد التنفيذ | `progress` | `#0E7C86` |
| مُقدَّمة | `submitted` | `#0369A1` |
| قيد المراجعة | `review` | `#B45309` |
| معتمدة | `approved` | `#15803D` |
| مغلقة | `closed` | `#475569` |
| مرفوضة | `rejected` | `#A8022D` |
| تحتاج تعديل | `revision` | `#C2410C` |
| معلّقة | `hold` | `#78716C` |
| ملغاة | `cancelled` | `#94A3B8` |

---

## 5. Quality, made auditable

A bare "92%" invites distrust and cannot survive a performance review. Every score in this system opens a breakdown showing its weighted components.

### Task quality (0–100)

| Component | Weight | Basis |
|---|---|---|
| Brief completeness | 20 | Required fields and assets supplied at creation |
| Requirement adherence | 25 | Reviewer checklist items passed |
| First-pass approval | 20 | Full marks with zero rejections, −10 per rejection, floor 0 |
| On-time delivery | 15 | Scaled by lateness against due date |
| Revision count | 10 | −5 per revision, floor 0 |
| Reviewer score | 10 | Reviewer's 1–5 rating, mapped |

### Employee quality (0–100), rolling 90 days

| Component | Weight |
|---|---|
| Average task quality | 50 |
| Completion rate | 15 |
| On-time rate | 15 |
| Inverse rejection rate | 10 |
| Cycle time vs. department median | 10 |

Both render through one component — a labeled meter whose popover shows the weight table and the employee's value per row. The number is always defensible.

---

## 6. Roles and permissions

| Role | Arabic | Scope |
|---|---|---|
| Employee / Agent | موظف | Own tasks; status changes gated by team-leader setting |
| Team Leader | قائد الفريق | Assign within team, review quality, manage team issues |
| Head | رئيس القسم | Assign employees to team leaders, move them, department stats |
| Manager | مدير | Add/remove/manage heads, oversee departments, high-level reports |
| Organization Admin | مسؤول النظام | Full system administration |

Permissions are **capability strings**, not role checks. Markup carries `data-perm="tasks.assign"` and `role.js` hides elements the active role lacks. Adding a role later is adding a row to a capability map — no restructuring.

### Role switcher (prototype-only)

The topbar carries a role selector that re-renders the page as any role. This makes the permission model reviewable in a browser instead of theoretical, and it is the single highest-value addition in this phase. It is explicitly a prototype affordance and does not ship to production.

---

## 7. Information architecture

| Group | Pages |
|---|---|
| نظرة عامة | لوحة التحكم، مهامي |
| المهام | كل المهام، قائمة المراجعة، المرفوضة والتعديلات، أنواع المهام |
| الأشخاص | الموظفون، الفرق، الأقسام |
| المنظمة | الهيكل التنظيمي، رؤساء الأقسام، قادة الفرق |
| التحليلات | التقارير، سجل النشاط |
| الإعدادات | الأدوار، الصلاحيات، الأمان، المصادقة الثنائية، الأجهزة الموثوقة، الإشعارات، إعدادات المهام، الحالات، الأقسام |

Authentication pages sit outside the shell.

### Fixed task-creation buttons

A fixed pair of buttons — `+ مهمة برمجة` and `+ مهمة UI/UX` — is rendered by the shell at the bottom inline-start of every page, gated on `data-perm="tasks.create"`. They open the department-specific creation form.

---

## 8. Additions beyond the literal brief

Accepted in the design review:

1. **Role switcher** — makes the permission model reviewable in-browser.
2. **"مهامي" page** — the dashboard is manager-shaped; agents need a focused view.
3. **Review queue** — a first-class team-leader page with approve/reject-with-reason.
4. **Component gallery** (`ui/components.html`) — living style guide, becomes the phase-2 developer handoff artifact.
5. **Command palette** (Ctrl+K) — navigation that scales past 30 pages.
6. **Empty, loading-skeleton, and error states** for every list — real handoffs fail on these.
7. **Security posture page** — active sessions, trusted devices with last-seen, 2FA status, recent security events, revoke controls.
8. **Audit entry component** with `from → to` diff rendering.
9. **Bulk actions**, **density toggle**, **SLA health dots**, skip-link and visible focus rings throughout.

---

## 9. File structure

```
project-management/
├─ index.html                     redirect to dashboard
├─ README.md
├─ assets/
│  ├─ css/
│  │  ├─ main.css                 @layer order + imports
│  │  ├─ 01-tokens.css            all design tokens
│  │  ├─ 02-reset.css
│  │  ├─ 03-base.css              typography, links, focus
│  │  ├─ 04-layout.css            shell grid, page scaffolding
│  │  ├─ 99-utilities.css
│  │  └─ components/
│  │     ├─ buttons.css
│  │     ├─ forms.css
│  │     ├─ nav.css               sidebar, topbar, tabs, pagination, breadcrumb
│  │     ├─ data.css              table, badges, meters, priority, avatar, tiles, dispatch strip
│  │     ├─ overlays.css          dropdown, popover, modal, drawer, toast, palette
│  │     └─ feedback.css          empty, skeleton, alerts, audit entries
│  └─ js/
│     ├─ shell.js                 NAV config + shell template + render
│     ├─ ui.js                    tabs, modals, dropdowns, drawer, toasts, palette, density
│     └─ role.js                  role switcher + data-perm gating
├─ pages/
│  ├─ auth/        login, 2fa, forgot-password, reset-password, trusted-devices
│  ├─ dashboard/   index, my-work
│  ├─ tasks/       list, detail, create-programming, create-uiux, review, rejected, history
│  ├─ people/      employees, employee-profile, teams, team-detail
│  ├─ org/         departments, department-detail, structure, heads, team-leaders
│  ├─ insights/    reports, activity-log
│  └─ settings/    roles, permissions, security, two-factor, notifications,
│                  task-settings, statuses, departments
└─ ui/components.html             style guide
```

---

## 10. Phase 1 deliverable

1. Token system and CSS architecture
2. `shell.js`, `ui.js`, `role.js`
3. `ui/components.html` — component gallery
4. `pages/dashboard/index.html` — dispatch strip, stat tiles, saved views, filter bar, task table with status spine and quality meters, bulk actions, pagination
5. `pages/auth/login.html` — validates the brand outside the shell

Remaining ~28 pages are produced against this approved baseline in the next pass.

---

## 11. Quality floor

Non-negotiable for every page built:

- Responsive to 360px; sidebar collapses to a rail at 1100px and an off-canvas drawer at 768px; tables reflow to stacked cards on mobile
- Visible keyboard focus on every interactive element; skip-to-content link
- `prefers-reduced-motion` respected
- Semantic landmarks, `aria-*` on custom controls, labelled form fields
- Dark mode via `[data-theme="dark"]` and `prefers-color-scheme`
- No `left`/`right` physical properties in CSS
