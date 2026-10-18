# CampusHelper UI — Redesign Brief

**Date:** 2026-10-18
**Status:** Direction agreed (refined & crisp). Foundation done. Layout work outstanding.
**Read first:** `docs/plans/2026-10-18-ui-refresh-design.md` (the token layer is already built).

---

## 1. Where this actually stands

Phase 1 shipped: 1,058 hardcoded palette classes → 0, semantic tokens in use, dark mode working
with no flash, 18/18 page-theme combinations passing WCAG AA, and the homepage genuinely rebuilt.

**That is a foundation, not a redesign.** Tokenising changes *what colour*; it does not change
*how anything looks*. Concretely:

| Measured now | Problem |
|---|---|
| **12 of 13 pages** received tokens only | Their layouts are untouched from the original build |
| **42** `rounded-* + border + shadow` containers | Everything is a bordered box — this *is* the generic-template look |
| **353 of 427** text elements are `text-sm` or `text-xs` (12–14px) | Only 5 use `text-base`. There is no type scale |
| `font-medium` ×136, `font-semibold` ×60, `font-bold` ×35 | Weight is applied at random, so it conveys no hierarchy |
| 1 file uses framer-motion, 6 use images | No motion, no imagery, no personality |

The homepage is the only page that shows what the target looks like. Every other page should be
brought to that standard and then pushed further.

---

## 2. The type scale — do this first

This is the single highest-leverage change. Nothing can feel designed at 14px.

Replace the current de-facto "everything is `text-sm`" with a real ladder, applied through a small
set of components rather than per-element classes:

| Role | Size | Weight | Tracking | Colour |
|---|---|---|---|---|
| Page title | `text-3xl` → `text-4xl` (30–36px) | 600 | `tracking-tight` | `text-foreground` |
| Section title | `text-xl` (20px) | 600 | `tracking-tight` | `text-foreground` |
| Subsection / card title | `text-base` (16px) | 500 | normal | `text-foreground` |
| **Body** | **`text-base` (16px)** | 400 | normal | `text-foreground/85` |
| Meta / label | `text-sm` (14px) | 400 | normal | `text-muted-foreground` |
| Micro (timestamps, counts) | `text-xs` (12px) | 500 | normal | `text-muted-foreground` |

**Rules:** body copy is 16px, not 14px. Never go below 12px. One page title per page. Do not use
`font-bold` at all — 600 is the maximum weight in the interface. If two things need to differ, make
them differ in size or colour before weight.

Build `PageHeader`, `SectionHeader`, and `Prose` components so this is enforced in one place.

---

## 3. Surfaces — delete most of the borders

42 bordered boxes is the core visual problem. Borders on everything means nothing is emphasised.

**New rules:**
- **A card is only for a discrete object** — an item in a list, a notification, a stat. Target: ~8
  card usages across the whole app, not 42.
- **Group with proximity and dividers, not containers.** A section is a heading plus content plus
  whitespace. Use `border-t border-border` on a heading block, not a box around it.
- **One elevation level.** `shadow-sm` only, and only on interactive cards. Remove `shadow`,
  `shadow-md`, `shadow-lg` except on modals.
- **Radius: `rounded-xl` for cards, `rounded-lg` for controls, `rounded-full` for pills.** No mixing.
- **Page background vs card:** the page is `bg-background`; cards are `bg-card`. Never nest a card
  inside a card — if you need grouping inside a card, use a divider.

**Anti-pattern to delete on sight:** a bordered box whose only content is a heading and a short
paragraph. That should be a heading and a paragraph with whitespace around it.

---

## 4. Per-page briefs

### 4.1 `/item/[id]` — the worst page, do this second

Currently a single long column of bordered boxes: header, description, comments on the left; Posted
By, Statistics, Actions on the right. The description is one line of text in a large box; there is
~250px of dead space below; comments are a nested grey box with a disabled button and the empty
state rendered *below* the form.

**Target:**
- **Two-column, image-led.** Left (2/3): the item photo at a large fixed aspect ratio (4:3) as the
  hero. No photo → a neutral placeholder with the category icon, not an empty gap.
- **Immediately under the title:** a single meta row — status badge, item type, zone, relative date
  ("2 days ago"). Drop the redundant "Lost" + `LOST` badge pairing.
- **Description as body text**, `text-base`, max 65ch, no container.
- **Owner + actions move to a sticky right rail** (desktop). On mobile they stack below the meta.
  Right rail: owner (avatar, name, reputation badge, verified badge), then a spec list
  (location, category, tags, posted date, claim count) as label/value rows with dividers — **not** a
  bordered Statistics box with three rows.
- **Actions:** primary (Claim / Edit) filled, secondary (Delete) ghost with destructive text. Already
  fixed; keep it. Never a full-width red block.
- **Comments:** heading + form + list, no wrapping container. Disabled submit should be visually
  obvious (`bg-muted text-muted-foreground`, already fixed). Empty state replaces the list, does not
  sit beneath the form.
- **Remove the dead space** — the page ends where the content ends.

### 4.2 `/search`, `/lost-items`, `/resolved` — one shared shell

These are three near-duplicate implementations of the same thing. Build **one** `ItemListShell`:

- `PageHeader` (title, count, one-line description).
- A **filter bar**: search input, then selects/chips inline on one row. Full-height, `rounded-lg`,
  `border-input`. On mobile it collapses into a single "Filters" disclosure with an active-filter
  count badge.
- **Results as image-led cards** in a responsive grid (1 / 2 / 3 / 4 columns). Each card: photo
  (4:3, `object-cover`), title (`text-base font-medium`), location + relative date (meta), status
  badge. Fixed card height so the grid aligns. No description on the card — it truncates anyway.
- **Empty state** distinct for "nothing yet" vs "no results for these filters", with a
  clear-filters action in the latter.
- **Loading**: skeleton cards matching the real card's geometry, not a spinner.
- **Pagination** below, centred, with the count.

`/resolved` gets one addition: a small "returned in N days" line per card, since that is the point
of the page.

### 4.3 `/post` — a form that does not look like a form dump

- Single column, max-width ~`max-w-2xl`, generous vertical rhythm (`space-y-8` between fields).
- **One field per row.** No two-up field grids.
- Labels above inputs, `text-sm font-medium`, always `htmlFor`.
- The image uploader is the **hero of the page** — a large dashed drop zone at the top, not a small
  control below the fold.
- The duplicate-warning panel is a proper inline alert with the candidate items as small cards, not
  a bordered paragraph.
- Sticky submit bar at the bottom on mobile.

### 4.4 `/dashboard` — tabs that read as sections

- `PageHeader` with the user's name and reputation badge.
- Tabs: underline style (`border-b-2 border-primary` on active), not pill-în-box. Give each tab an
  `aria-selected` and `role="tab"`.
- Each tab's content starts with a `SectionHeader`, and its list reuses the shared item card.
- Stats strip at the top: 3–4 numbers, large, no boxes around each.

### 4.5 `/notifications`

- Rows, not cards. Full-width list with `divide-y divide-border`.
- Unread = a 2px left accent bar plus `font-medium` title; read = plain. No background fills.
- Type icon in a muted circle, 32px.
- Group by day with small date dividers ("Today", "Yesterday").
- Mark-all-read as a quiet text button in the header, not a bordered button in the body.

### 4.6 `/map`

- The map should be the **hero**: full-width, tall, with the legend overlaid bottom-left rather than
  stacked above it.
- Selected zone panel becomes a right rail (desktop) / bottom sheet (mobile), not a card below.
- Zone shapes need a hover state that is legible in both themes — verify in dark.
- The "schematic, not to scale" note stays, but as a small caption near the legend.

### 4.7 `/admin/dashboard`

- `PageHeader`, then tabs (Overview / Items / Users / Claims / Analytics / Audit Log) as underlines.
- Give each tab real table treatment: `border-b` row dividers, `text-sm`, sticky header on scroll,
  a right-aligned actions column. Currently it is a stack of cards per record — at scale that is
  unreadable.
- Bulk selection: checkbox column, and the bulk bar appears as a **sticky footer bar** (already
  built), not inline.
- Analytics: the stat cards become a plain 4-up numbers strip; charts already exist and are fine.

### 4.8 `/auth/login`, `/auth/signup`

- Centred card, `max-w-sm`, on `bg-background` with **no gradient**.
- Product identity above the card: wordmark + one line of what this is.
- One primary action. Google sign-in as a secondary outlined button with the real Google mark.
- Error state inline above the form, `text-destructive`, `text-sm`.
- Focus rings visible on every control.

### 4.9 `/not-found`, `error.tsx`, all `loading.tsx`

- Centred, `max-w-md`, one sentence, one action. No gradients (already replaced), no cards.
- Loading states should be **skeletons of the real layout**, not a centred spinner.

---

## 5. Component-level work

| Component | Change |
|---|---|
| `Navbar` | Add an active-route indicator (`aria-current` + colour). Wordmark weight 600, tighter. Reduce to 4 primary links; move the rest into an overflow menu. |
| `ItemCard` | Rebuild image-led as described in 4.2. Fixed height, `object-cover`, no description. |
| `EmptyState` | Larger icon (48px, muted), title `text-base font-medium`, one-line body, optional action. Currently plain centred text. |
| `Pagination` | Centred, `text-sm`, current page as a filled chip. |
| `StatusBadge` | Keep — it is now the single source of truth for status colour. |
| `Button` | Add a `quiet` variant for tertiary actions. Audit for the 1-file-in-5 that has a custom className overriding the variant. |
| Skeletons | One `SkeletonCard` matching the real card geometry; use everywhere. |

---

## 6. Motion

`framer-motion` is installed and used in exactly one file; 18 keyframes sit unused in `globals.css`.
Add, with restraint:

- Section/list entrance: 150ms fade + 4px rise, **once** per page, not per card.
- Card hover: `transition-shadow` only (already present). No scale transforms.
- Modal: 120ms fade + 8px rise.
- Skeletons: shimmer, not pulse.
- Respect `prefers-reduced-motion` — wrap in the media query, do not ship motion unconditionally.

---

## 7. How to verify (non-negotiable)

`tools/ui-verify/capture.mjs` and `tools/ui-verify/contrast.mjs` already exist. For every page:

1. `node capture.mjs <out>` at 375px and 1440px, both themes.
2. `node contrast.mjs` — must report 0 failures.
3. **Look at the screenshots.** This is not optional: the automated contrast audit cannot detect a
   light surface in dark mode, which is exactly how a broken "Posted By" card passed an "18/18"
   report and was caught only by eye.
4. `npm run typecheck && npm run lint && npm test`.

---

## 8. Definition of done

- Bordered containers: **42 → under 10**, and every survivor wraps a discrete object.
- `text-sm`/`text-xs` share of text: **353/427 → under 60%**, with body copy at 16px.
- `font-bold`: **0 uses**. Maximum weight 600.
- Every page has exactly one `PageHeader`.
- Every list page shares `ItemListShell`.
- Skeleton loading on every page that fetches.
- 0 contrast failures across both themes, verified by screenshot **and** audit.
- Preview deployment exercised end to end (login → post → upload → claim → approve → handover)
  **before** `main` is pushed. `main` is currently 24 commits behind local and must not be pushed
  until this passes — Vercel's GitHub integration auto-deploys it to production.
