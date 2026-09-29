# 06 · Design system

Extracted from `wireframe/assets/css/` and the approved spec. The tokens live in `src/app/globals.css` and were ported value-for-value. **Nothing in the app defines a raw colour, size or duration** — if a value is needed and no token has it, add the token.

## The three rules

These are constraints, not preferences. They are what keeps the product from drifting into the generic dashboard look.

**1 · Borders, not shadows.** A shadow means "this floats above the page". It belongs only to dropdowns, popovers, modals, drawers and toasts. Static surfaces are separated by a 1px border. There is deliberately **no shadow token for cards** — if you reach for one, use `border border-line` instead.

**2 · Radius encodes role.** Data surfaces `4px`, interactive controls `6px`, panels `8px`, floating overlays `10px`, pills fully round. Not one radius on everything. A table cell and a button are different kinds of thing, and the corner says so.

**3 · Brand red is never a status.** `#e7033e` is reserved for primary actions, active navigation and the brand mark. Lifecycle statuses have their own hues, and rejection uses a distinct deep crimson `#a8022d` so "error" never reads as "brand".

## Colour

### Brand ramp

`brand-50` `#fff1f4` · `100` `#ffe0e7` · `200` `#ffc6d2` · `300` `#ff9db1` · `400` `#fb5f81` · **`500` `#e7033e`** · `600` `#c90235` · **`700` `#a8022d`** · `800` `#8a0626` · `900` `#740c24`

**The split matters.** `#e7033e` as small text on white measures ~4.5:1 — borderline. So `brand-500` is for **fills** (always with white text) and `brand-700` is for **small text, links and icon-only affordances** on light surfaces. Never `brand-500` on white at body size. The token system enforces this so contrast never depends on someone remembering.

### Neutrals

A cool violet cast rather than warm grey, so neutrals sit with the crimson brand instead of fighting it.

`ink` `#14121a` · `ink-2` `#3b3747` · `ink-3` `#625d72` · `ink-4` `#8b8599` · `neutral-50` `#fbfafc` → `neutral-900` `#1f1c28`

### Semantic surfaces

Components use these, never the ramps directly. They are reassigned per theme.

| Token          | Light     | Dark      |
| -------------- | --------- | --------- |
| `paper`        | `#fbfafc` | `#100e15` |
| `surface`      | `#ffffff` | `#1a1822` |
| `surface-sunk` | `#f4f2f7` | `#14121a` |
| `surface-alt`  | `#fbfafc` | `#201d29` |
| `line`         | `#e4e1e9` | `#2e2a3a` |
| `line-strong`  | `#cbc6d4` | `#423d52` |
| `line-soft`    | `#e9e6ef` | `#252231` |
| `text`         | `#14121a` | `#f2f0f6` |
| `text-muted`   | `#625d72` | `#a8a2b6` |
| `text-subtle`  | `#8b8599` | `#7d7689` |
| `accent`       | `#e7033e` | `#ff2e5f` |
| `accent-text`  | `#a8022d` | `#ff7d9a` |

The brand ramp lightens one step in dark mode so the mark holds its saturation against a dark surface.

### Feedback

`success` `#15803d` · `warning` `#b45309` · `danger` `#a8022d` · `info` `#0369a1`, each with a `-soft` background pair.

### Task lifecycle — twelve statuses

| Status       | Token          | Light     | Dark      |
| ------------ | -------------- | --------- | --------- |
| مسودة        | `st-draft`     | `#64748b` | `#94a3b8` |
| مُنشأة       | `st-created`   | `#6d28d9` | `#a78bfa` |
| مُسندة       | `st-assigned`  | `#3730a3` | `#818cf8` |
| قيد التنفيذ  | `st-progress`  | `#0e7c86` | `#2dd4bf` |
| مُقدَّمة     | `st-submitted` | `#0369a1` | `#60a5fa` |
| قيد المراجعة | `st-review`    | `#b45309` | `#fbbf24` |
| معتمدة       | `st-approved`  | `#15803d` | `#4ade80` |
| مغلقة        | `st-closed`    | `#475569` | `#94a3b8` |
| مرفوضة       | `st-rejected`  | `#a8022d` | `#ff6b85` |
| تحتاج تعديل  | `st-revision`  | `#c2410c` | `#fb923c` |
| معلّقة       | `st-hold`      | `#78716c` | `#a8a29e` |
| ملغاة        | `st-cancelled` | `#94a3b8` | `#64748b` |

### Departments

`dept-seo` `#6d28d9` · `dept-prog` `#0e7c86` · `dept-uiux` `#c2410c`. Used only for the dispatch strip, department chips and the two task-creation buttons.

### Data visualisation

`viz-1` … `viz-6`: `#0e7c86` `#3730a3` `#b45309` `#6d28d9` `#0369a1` `#15803d`. Deliberately **non-red**, so a chart series never implies "error".

## Typography

One family: **IBM Plex Sans Arabic**, weights 400 / 500 / 600 / 700, loaded through `next/font` (self-hosted, no runtime request, no layout shift). It is legible at 12px, has genuine Arabic design intent rather than being a Latin face with Arabic bolted on, and reads as engineered rather than friendly — correct for an operations tool.

**No monospace secondary face.** Numeric alignment is solved with `font-variant-numeric: tabular-nums lining-nums`, applied in the base layer to every `td`, `th` and `[data-numeric]`. Columns lock into vertical rhythm without a font switch.

**Digits are Latin** (`0-9`), not Arabic-Indic — business-software convention in the region, and it keeps mixed-language data legible.

| Token      | Size | Use                        |
| ---------- | ---- | -------------------------- |
| `text-3xs` | 11px | dense table meta           |
| `text-2xs` | 12px | labels, chips              |
| `text-xs`  | 13px | table body, secondary      |
| `text-sm`  | 14px | UI default                 |
| `text-md`  | 15px | body                       |
| `text-lg`  | 17px | card titles                |
| `text-xl`  | 20px | page titles                |
| `text-2xl` | 24px | section heroes             |
| `text-3xl` | 30px | stat figures               |
| `text-4xl` | 40px | auth wordmark, big metrics |

Line heights: tight 1.25 · snug 1.4 · normal 1.6 · loose 1.75. Arabic benefits from marginally looser tracking at small sizes.

## Spacing, radius, elevation

**Spacing** is Tailwind's 4px base, unchanged.

**Radius:** `rounded-data` 4px · `rounded-control` 6px · `rounded-panel` 8px · `rounded-overlay` 10px · `rounded-pill` 999px.

**Elevation:** `shadow-overlay` for dropdowns and popovers, `shadow-modal` for modals and drawers. That is the complete set.

## Layout

| Token           | Value                    |
| --------------- | ------------------------ |
| `w-sidebar`     | 264px                    |
| `w-rail`        | 68px (collapsed sidebar) |
| `h-topbar`      | 56px                     |
| `max-w-content` | 1560px                   |

**Breakpoints:** the sidebar collapses to a rail at 1100px and becomes an off-canvas drawer at 768px; tables reflow to stacked cards on mobile. Responsive down to 360px.

## Density

`:root[data-density="compact"]` swaps `--row-h` 48px → 36px and tightens cell padding, for managers scanning hundreds of rows. The toggle lives in the topbar and writes the attribute on `documentElement`.

## Theme

Three states, resolved in this order: an explicit `data-theme` on `<html>` wins; otherwise `prefers-color-scheme` decides. An inline boot script in the locale layout applies the stored choice **before first paint**, so a dark-mode user never sees a light flash. The `dark:` Tailwind variant is defined to follow exactly the same rule, so CSS and tokens can never disagree.

## RTL is structural, not a patch

`<html dir="rtl" lang="ar">`, and the stylesheet uses **only** logical properties: `margin-inline-start`, `padding-inline`, `inset-inline-start`, `border-inline-start`, `text-align: start | end`. There is no `left`, `right`, `margin-left` or `padding-right` anywhere — verified across all 13 wireframe stylesheets, and enforced in the app by an ESLint rule that rejects `ml-`, `pr-`, `text-left`, `border-r-` and friends in any `className`.

In Tailwind terms: `ms-` `me-` `ps-` `pe-` `start-` `end-` `text-start` `text-end` `border-s` `border-e` `rounded-s` `rounded-e`.

Direction-implying icons flip with `rtl:-scale-x-100`.

The consequence is the point: **switching the entire application to LTR is switching the locale.** Nothing else changes.

## Signature devices

**The status spine.** Every task row carries a coloured border on its inline-start edge encoding lifecycle state. A long table becomes a scannable board rather than a grid of text. This is structural, not decorative: the colour _is_ the status.

**The dispatch strip.** The dashboard opens on the actual shape of the business — SEO → Programming / UI-UX with counts per stage — rather than four decorative figures. Every stage is a filter on the table below.

**The quality meter.** Every score renders as a labelled meter whose popover shows the weight table and the subject's value per row. A bare percentage cannot survive a performance review; every number here is auditable.

## Accessibility floor

Non-negotiable on every screen:

- Visible keyboard focus on every interactive element (2px accent outline plus a 3px focus ring), and a skip-to-content link as the first focusable element.
- `prefers-reduced-motion` respected — animations collapse to 0.01ms in the base layer.
- Semantic landmarks, `aria-*` on custom controls, every form field labelled.
- Contrast: never `brand-500` as small text on white. Use `accent-text`.
- Responsive to 360px with no horizontal page scroll.

## Component inventory

`wireframe/ui/components.html` is the living gallery: every token, component and state. Consult it before building any new surface — the component almost certainly already exists there, with its empty, loading and error states already designed.

Components ship into `src/components/ui/` as the sessions that need them arrive, via `pnpm dlx shadcn@latest add <component>` and then restyled onto these tokens. shadcn's defaults are a starting structure, not a look: the look is this file.
