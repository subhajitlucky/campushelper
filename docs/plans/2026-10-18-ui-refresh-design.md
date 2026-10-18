# CampusHelper UI Refresh — Design

**Date:** 2026-10-18
**Status:** Approved
**Scope:** every page (13) and component (59) — 13,242 lines of UI.

---

## 1. Why this is a foundation job, not a repaint

Measured before designing anything:

| Metric | Count |
|---|---|
| Page files | 13 |
| Components | 59 |
| UI lines | 13,242 |
| **Hardcoded palette classes** (`text-gray-600`, `bg-blue-600`, …) | **1,058** |
| **Semantic token classes** (`text-muted-foreground`, `bg-card`, …) | **82** |
| Raw hex values in TSX | 21 distinct |
| Files using any `dark:` class | **1 of 59** |

A complete light *and* dark token set already exists in `src/app/globals.css` (line 81), wired
through `@theme inline`, with `@custom-variant dark (&:is(.dark *))`. The design system is
therefore already built — **93% of the styling simply bypasses it.**

That single fact explains the symptoms: dark mode is impossible, spacing and radii drift page to
page, and status colors disagree between `StatusBadge`, the admin tables, and the claim panels.
Restyling 13 pages on top of 1,058 hardcoded colors would relocate the problem rather than solve
it, so the foundation is fixed first.

## 2. Direction: refined & crisp

Light, functional, confident. The reference feel is Linear/Stripe-docs restraint rather than
decoration: strong hierarchy, generous but disciplined spacing, one depth level, no gratuitous
color. A campus lost-and-found is a utility students use on phones in daylight — it should read as
trustworthy and fast, not as a marketing page.

## 3. Phase 1 — Token layer

**Tune the existing tokens; do not invent a parallel system.** shadcn's vocabulary already covers
surfaces, text, borders, and interactive states, and it is already mapped in `@theme inline`.

**Add the semantics shadcn lacks**, because the domain needs them:

```
--success / --success-foreground
--warning / --warning-foreground
--info    / --info-foreground
```

These replace the ad-hoc `green-600` / `amber-600` / `red-600` scattered across a dozen files, and
map directly to item lifecycle: `RESOLVED`/`FOUND` → success, `FLAGGED`/`PENDING` → warning,
`LOST` → primary, `REMOVED`/`REJECTED` → destructive. Defined for both themes.

**Migration mapping** (mechanical, applied by script, reviewed by diff):

| Hardcoded | Token |
|---|---|
| `bg-white` | `bg-card` |
| `bg-gray-50` (page shell) | `bg-background` |
| `bg-gray-100` (subtle fill) | `bg-muted` |
| `text-gray-900` | `text-foreground` |
| `text-gray-700` / `600` / `500` | `text-muted-foreground` |
| `border-gray-200` / `300` | `border-border` |
| `bg-blue-600`, `text-blue-600` | `bg-primary`, `text-primary` |
| `bg-red-*`, `text-red-*` | `bg-destructive/10`, `text-destructive` |
| `bg-green-*`, `text-green-*` | `bg-success/10`, `text-success` |
| `bg-amber-*`, `text-amber-*` | `bg-warning/10`, `text-warning` |

The script must preserve opacity modifiers (`bg-gray-50/60`), state prefixes (`hover:`, `focus:`,
`group-hover:`), and convert the 21 raw hex values to the nearest token.

## 4. Phase 2 — Page restyle

"Refined & crisp" is enforced as a system, replacing per-page improvisation:

- **Type ladder** — page title `text-2xl tracking-tight font-semibold`; section `text-lg
  font-semibold`; body `text-sm`; meta `text-xs text-muted-foreground`. Today section headers are
  `text-sm font-bold` in some files and `text-xl font-semibold` in others.
- **Spacing rhythm** — one page shell (`py-8`, `space-y-6`), one card padding (currently a mix of
  `p-3`, `p-4`, `p-5`, `p-6`).
- **Card treatment** — one: `rounded-xl border border-border bg-card shadow-sm`. Today it is a mix
  of `rounded-lg`/`rounded-xl`, `shadow`/`shadow-sm`, `border-gray-200`/`border-gray-200/60`.
- **Depth** — one shadow level; hover lift only on interactive cards.
- **Focus** — visible `focus-visible:ring-2 ring-ring ring-offset-2` on every interactive element;
  largely absent today.
- **States** — one shared empty / loading / error treatment; each list page currently invents one.
- **Navigation** — unified navbar with active-route highlighting and a consistent mobile menu.

### Per-page notes

| Page | Work |
|---|---|
| `/` | The hero renders **static sample items**, not real data. Rebuild hierarchy, real CTA, stats strip. |
| `/lost-items`, `/resolved`, `/search` | One shared list shell: filter bar, grid, pagination, empty state. |
| `/item/[id]` | Largest surface (754 lines) — restructure into header, gallery, details, matches, comments, and an actions sidebar. |
| `/dashboard` | Consistent tab shell across items/claims/profile. |
| `/post` | Form field styling; the duplicate-warning panel. |
| `/notifications` | Row layout, unread treatment. |
| `/map` | SVG map, legend, and zone panel coherence. |
| `/admin/dashboard` | Tab shell accommodating the new Audit, Analytics, and Bulk panels. |
| `/auth/login`, `/auth/signup` | Centred card, focus states, error presentation. |
| `/not-found`, `error` | Consistent with the system. |

## 5. Dark mode

The `.dark` palette exists, so this is nearly free once pages use tokens. One new dependency:
**`next-themes`** (~3KB), chosen over hand-rolling because it correctly prevents the
flash-of-wrong-theme before first paint, which hand-rolled implementations usually get wrong.
Navbar toggle with light / dark / system, keyboard accessible and labelled.

## 6. Verification

There is **no UI test tooling**, and the site is **live with real data** (30 users, 19 items). So:

1. **Baseline first** — install Playwright (chromium already cached) and capture every page in both
   themes at 375px and 1440px *before any change*.
2. After each batch: re-capture, compare, plus `typecheck` + `lint` + the 289 existing tests.
3. Deploy to a **Vercel preview** and exercise the flows that could break — login, post, image
   upload, claim, handover. **Production is not touched until preview is verified.**

## 7. Batches

1. Tokens + `ThemeProvider` + toggle + `ui/*` primitives
2. List surfaces: `/lost-items`, `/resolved`, `/search`
3. `/item/[id]`, `/post`, `/dashboard`
4. `/notifications`, `/map`, `/admin/dashboard`
5. `/auth/*`, `/not-found`, `error`, `/`
6. Full-page screenshot comparison → preview deploy → promote

## 8. Explicitly out of scope

The user chose not to fold these in. They remain outstanding in
`docs/audit/2026-10-18-v2-adversarial-review.md`:

- Accessibility defects: unnamed filter `<select>`s on `/search` and `/lost-items` (m13), missing
  `aria` state on admin tabs, unassociated labels in the post form.
- UI bugs: silent no-op on invalid post-form submit (M8), dismissed match suggestions lingering
  (m9), guests seeing an `Authentication required` box in the category filter (M11).

The theme toggle itself will be properly labelled, since it is new work.

## 9. Risks

1. **Meaning loss during migration.** Where a color *is* the signal (status badges), a naive mapping
   can flatten distinctions. Mitigation: the mapping is explicit per semantic, and every batch gets
   a visual diff.
2. **Dark mode exposes contrast problems** invisible in light — muted grays that pass on white do
   not on near-black. Mitigation: both themes captured at every step.
3. **A live site with real users and working auth/upload/claims flows.** Mitigation: preview
   deployment gating, and no production deploy until the preview passes.
4. **1,058 edits across 59 files** is a large mechanical diff where a scripting mistake could
   silently drop a class. Mitigation: script + full diff review, plus `lint`/`typecheck`/tests.
