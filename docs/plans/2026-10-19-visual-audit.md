# Visual audit — 2026-10-19

What the rendered product actually looks like. Written **before** any change, from
52 screenshots (13 routes × 2 themes × 2 widths) captured with
`tools/ui-verify/capture.mjs` against a local Postgres seeded with 14 users,
35 photo-backed reports, claims, comments and notifications.

The previous session's metrics were all true and the product still does not look
good, so this document deliberately records no metrics — only what is visible.

## How this was captured

```
docker run -d --name ch-visual-pg -e POSTGRES_PASSWORD=verify -e POSTGRES_USER=verify \
  -e POSTGRES_DB=campushelper_verify -p 55433:5432 postgres:16-alpine
npx prisma migrate deploy && npx tsx .tmp-visual/seed.ts
npx next dev -p 3100
BASE_URL=http://localhost:3100 ITEM_ID=<id> AUTH_EMAIL=… AUTH_PASSWORD=… \
  node tools/ui-verify/capture.mjs .tmp-visual/before
```

Two tool changes were needed to make that trustworthy; both are in `capture.mjs`
now. It signs in **once** and reuses the session (signing in per theme×size
walked into the app's own 10-per-15-minute login limiter, and the failure mode
is `authorize()` returning null — indistinguishable from a wrong password, so
three of four themes silently captured signed-out pages). It also asserts the
requested theme actually applied and that the route did not redirect, and prints
`!theme=` / `->` when either is untrue.

## Defects found by looking

Each of these is a straight bug, not a matter of taste.

1. **Icons collide with their labels in every `Button`.** `buttonVariants` has
   `inline-flex items-center` and `[&_svg]:shrink-0` but **no `gap`**, so
   `<Button><Pencil/>Edit item</Button>` renders the pencil touching the `E`.
   Visible on the item page ("Edit item", "Delete item"), the dashboard
   ("Edit profile", "Search all items"), and the navbar. A handful of call sites
   patched it locally with `mr-2`, which is why it is inconsistent.
2. **Every file in `public/` is behind the auth middleware.** The matcher
   excluded the literal segment `public`, but `public/logo.png` is served at
   `/logo.png`. Verified against production: `GET /next.svg` → **307** to
   `/api/auth/signin`. Latent only because `public/` holds five unused starter
   SVGs; it breaks the first real asset. Fixed in this session.
3. **The search input's placeholder is cut mid-word** — "Search by title,
   description, or lo" at 1440px, with no ellipsis.
4. **Card meta truncates mid-word** — "Academic Blo…" instead of
   "Academic Block 1". Repeated on every card in the grid.
5. **Unread notifications are marked with a solid near-black 3px left bar**,
   which reads as a table-row artefact rather than a state.
6. **A statistic renders as "30.0 hours"** — one decimal place on a headline
   number in a layout that otherwise uses whole numbers.
7. **`scroll-behavior: smooth` on `<html>` without `data-scroll-behavior`** —
   Next.js logs a warning on every client navigation.
8. The dev overlay reports **"1 Issue"** on every page: the CSP omits
   `'unsafe-eval'`, which React's development build requires. Harmless in
   production, but it means the overlay is permanently red and real errors are
   invisible. (Also `i.pravatar.cc` was not in `images.remotePatterns` in the
   seed data and crashed the item page into the error boundary — seed-only,
   already removed.)

## Why it does not look premium

Ordered by how much each one costs, largest first.

### 1. Chrome eats the first screen

On `/lost-items` at 1440×900 the page title, a two-line description, a count, a
floating "Report a lost item" button, a divider, a type select, a location
input, a "Category" label and **ten** category pills occupy the top **585px**.
The first report starts below the fold. On mobile it is worse: header chrome
runs to **770px of an 812px viewport** and the first item is a single card.
`/search` stacks five controls in one row and pushes its results to y≈770.

The user came to look at items. This is the single biggest reason the product
feels like an admin panel.

The primary action also *floats*: on both `/lost-items` and `/search` the
"Report an item" button is right-aligned at an arbitrary vertical offset against
a multi-line description, so it is aligned to nothing.

### 2. White cards on a white page

`--card` and `--background` are both `oklch(1 0 0)` in light mode. A card is
distinguished only by a hairline `--border-subtle` (0.945) and a shadow whose
first stop is 10% opacity. The result is that the grid reads as a spreadsheet
with drawn boxes rather than as objects on a surface, and the "42 → 6 bordered
containers" win is invisible: the borders are still doing all the work, just
more quietly.

### 3. There is no colour anywhere

Every surface, every control and every icon is on the zinc hue (285) with
chroma ≤ 0.02. The only chromatic pixels on most pages are the three status
pills. `--primary` is near-black. The result is technically restrained and
emotionally dead — it is the shadcn/ui default theme with better spacing.

Premium products are usually *either* strongly art-directed (colour, imagery,
a display face) *or* near-monochrome with one confident accent used at
meaningful moments. This is neither: it is monochrome with **no** accent.

Related: the status colours do not pull their weight. `LOST` renders as a
washed-out tan pill that looks disabled; `PENDING` and `FOUND` are barely
distinguishable at a glance.

### 4. No focal point on any screen

Nothing on a page is clearly the most important thing.

- **Home** — a text-only hero and a bordered "Platform activity" card compete
  for attention, and the card actually wins because it has four big numbers and
  a container. Neither is a focal point, and ~230px of dead space separates the
  hero from the section divider.
- **Item detail** — the photo is the one genuinely good element and it is locked
  into a narrow left column whose text runs 6 lines while the right column sits
  half empty. The right column's label/value rows are right-aligned, so
  "Central Library, 2nd floor reading room" wraps and right-aligns mid-phrase.
- **Map** — the worst page. A grey rounded blob with faint white line-art, a dot
  grid, dark circles with numbers in them, and labels in low-contrast grey. It
  reads as an unfinished wireframe, not a designed campus. A bordered legend box
  sits on top of it, and a quarter-width card holding four words ("No zone
  selected") takes the right rail.
- **Admin overview** — four stat figures followed by ~700px of nothing.

### 5. The homepage never shows the product

The homepage — the only page an anonymous visitor can see — contains no item
photo, no card, and no evidence the thing works. `queryRecent()` does not even
`select` `images`, so the three "Recent reports" cards it renders **cannot** show
a photo even though 30 of 35 seeded reports have one. That is a bug with a
design consequence: the most persuasive asset in the product is invisible on the
page that has to sell it.

### 6. Typography is consistent but voiceless

Geist at a flat ladder: display sizes use the same tracking and the same weight
ceiling as body. There is no optical tightening at 36–48px, no contrast between
a display moment and UI text. It is *correct* type, not *designed* type.

### 7. Small cheapness signals that add up

- A full-width "I found this" button on every card in the grid — four identical
  ghost buttons in a row, on a page whose items are *lost*, to be claimed by
  finders.
- "Placed by" / label-value dumps in the detail rail.
- Section descriptions that explain the obvious ("3 reports posted. Edit or
  remove them here.").
- "Posted by" vs "POSTED BY" vs "Placed by" — the same idea in three voices.

## What this implies

The foundation is sound and should not be thrown away: the token layer, the type
scale, the component set and the 42→6 border reduction are all good work. What is
missing is **art direction** plus **layout discipline**:

1. Cut header chrome so content starts in the first screen.
2. Separate surface from page (tinted canvas, white cards) so cards stop relying
   on borders.
3. Introduce one accent, used at meaningful moments, and make status colours legible.
4. Give each screen a focal point — and on the homepage, make the product itself
   the focal point.
5. Tighten display typography so big text looks *designed*.
6. Fix the defects above, which are what a person notices first.
