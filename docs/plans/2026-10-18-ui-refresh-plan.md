# CampusHelper UI Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move all 13 pages and 59 components onto the existing semantic token system, restyle them under a "refined & crisp" direction, and add a working dark mode — without breaking a live site that has real users and working auth/upload/claim flows.

**Architecture:** Fix the foundation before the surface. Phase 1 replaces 1,058 hardcoded palette classes with the semantic tokens already defined in `globals.css`, adding the three domain semantics shadcn lacks (`success`, `warning`, `info`). Phase 2 restyles each page on that foundation, enforcing one type ladder, one spacing rhythm, one card treatment, and visible focus states. Dark mode falls out of Phase 1 nearly for free.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4 (CSS-first config), shadcn/ui (new-york, zinc), `next-themes` (one new dep), Playwright (for verification only — not a project dependency).

**Design doc:** `docs/plans/2026-10-18-ui-refresh-design.md`

---

## Constraints that shape every task

1. **The site is live** with 30 users, 19 items, working Google OAuth, Vercel Blob uploads, claims, and handover. Nothing ships to production until a **preview deployment** is verified.
2. **There is no UI test tooling.** Verification is `typecheck` + `lint` + 289 tests + **browser screenshots compared against a baseline**.
3. **1,058 mechanical edits** across 59 files. Every batch ends with a full `git diff` review, not a spot check.
4. Supabase is restored and `DATABASE_URL`/`DIRECT_URL` are configured in Vercel. Local dev needs `.env.local`; the values are in `.env.vercel` (gitignored).

---

## Task 0: Capture the baseline (must happen before any edit)

**Files:**
- Create: `/home/subhajit/project/.tools/shots/capture.mjs`
- Create: `/home/subhajit/project/.tools/shots/baseline/` (output)

**Step 1: Install Playwright into the tools dir, not the project** (it must not become a project dependency)

```bash
cd /home/subhajit/project/.tools && export npm_config_cache=/home/subhajit/project/.npm-cache
npm install playwright --no-audit --no-fund
npx playwright install chromium --with-deps 2>/dev/null || npx playwright install chromium
```

**Step 2: Write the capture script**

It must visit every route, at both breakpoints, and screenshot. Routes that require auth will
redirect; capture post-redirect state and note it, do not treat it as failure.

```js
// /home/subhajit/project/.tools/shots/capture.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'https://campushelper.vercel.app';
const OUT = process.argv[2] ?? 'baseline';
const ROUTES = ['/', '/lost-items', '/resolved', '/search', '/post', '/map',
  '/notifications', '/dashboard', '/admin/dashboard', '/auth/login',
  '/auth/signup', '/item/REPLACE_ME', '/does-not-exist'];
const SIZES = [{ n: 'mobile', w: 375, h: 900 }, { n: 'desktop', w: 1440, h: 1000 }];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h } });
  for (const route of ROUTES) {
    const file = `${OUT}/${route.replace(/\W+/g, '_') || 'root'}-${size.n}.png`;
    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
      await page.screenshot({ path: file, fullPage: true });
      console.log(`ok   ${route} ${size.n} -> final url ${page.url()}`);
    } catch (e) {
      console.log(`FAIL ${route} ${size.n}: ${e.message}`);
    }
  }
  await page.close();
}
await browser.close();
```

**Step 3: Capture baseline against production**

```bash
cd /home/subhajit/project/.tools/shots && node capture.mjs baseline
```

Expected: 26 PNGs. `/item/REPLACE_ME` will 404 (fine). Auth-gated routes will land on `/auth/login`.

**Step 4: Get a real item id for the detail-page capture**

```bash
cd /home/subhajit/project/campushelper && . /home/subhajit/project/.secrets/.direct.env
psql "$DIRECT_URL" -tAc "SELECT id FROM \"Item\" WHERE status <> 'DELETED' LIMIT 1"
```

Re-run the capture with that id substituted, so `/item/[id]` has a real baseline.

**Step 5: Commit only the script** (screenshots stay out of the repo — they are verification artifacts, not source)

```bash
cd /home/subhajit/project/campushelper
mkdir -p tools/ui-verify && cp /home/subhajit/project/.tools/shots/capture.mjs tools/ui-verify/capture.mjs
git add tools/ui-verify/capture.mjs
git commit -m "chore(ui-verify): add a Playwright page-capture script for visual regression"
```

---

## Task 1: Token layer

**Files:**
- Modify: `src/app/globals.css` (token blocks at `:root` ~line 60 and `.dark` line 81)

**Step 1: Add the domain semantics to both themes.** In `:root`:

```css
  /* Domain semantics: item lifecycle and moderation state. shadcn's vocabulary
     has no success/warning/info, so pages were hand-picking green-600/amber-600
     and drifting apart. */
  --success: oklch(0.55 0.15 155);
  --success-foreground: oklch(0.98 0.01 155);
  --warning: oklch(0.70 0.16 75);
  --warning-foreground: oklch(0.25 0.05 75);
  --info: oklch(0.58 0.16 250);
  --info-foreground: oklch(0.98 0.01 250);
```

Mirror them in `.dark` with lighter/desaturated variants for contrast on near-black.

**Step 2: Expose them to Tailwind** inside `@theme inline`:

```css
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
```

**Step 3: Verify the tokens emit CSS**

Run: `npm run build 2>&1 | tail -5`
Expected: build succeeds. Then confirm the utility exists:

```bash
grep -c "bg-success" .next/static/css/*.css
```
Expected: at least 1. If 0, the `@theme inline` mapping is wrong.

**Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(ui): add success, warning, and info design tokens"
```

---

## Task 2: Dark mode

**Files:**
- Create: `src/components/ThemeProvider.tsx`
- Create: `src/components/ThemeToggle.tsx`
- Modify: `src/app/layout.tsx` (wrap children)
- Modify: `src/components/Navbar.tsx` (mount the toggle)
- Modify: `package.json` (add `next-themes`)

**Step 1: Install**

```bash
npm install next-themes
```

**Step 2: Provider** — `attribute="class"` is required because `globals.css` keys dark off
`:is(.dark *)`. `disableTransitionOnChange` avoids a color-transition flash when toggling.

```tsx
'use client';
import { ThemeProvider as NextThemes } from 'next-themes';
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
```

**Step 3: Toggle** — must not render a mismatched icon before hydration. Gate on a `mounted`
flag and render a fixed-size placeholder so the navbar does not shift.

**Step 4: Mount** inside `layout.tsx`'s `<body>`, and add the toggle to `Navbar.tsx` beside the
notification bell (desktop actions + mobile menu, matching where the bell already renders).

**Step 5: Verify no flash** — this is the specific failure mode `next-themes` was chosen to avoid:

```bash
cd /home/subhajit/project/.tools/shots
BASE_URL=http://localhost:3000 node capture.mjs theme-check
```
Then inspect a screenshot: dark text must never render on a white background mid-load. Also verify
`document.documentElement.className` contains `dark` after the toggle, in the browser.

**Step 6: Commit**

```bash
git add package.json package-lock.json src/components/ThemeProvider.tsx src/components/ThemeToggle.tsx src/app/layout.tsx src/components/Navbar.tsx
git commit -m "feat(ui): add dark mode with a system-aware theme toggle"
```

---

## Task 3: The migration script

**Files:**
- Create: `/home/subhajit/project/.tools/migrate-ui.mjs` (a tool, not project source)

**Step 1: Write it with an explicit ordered mapping.** Order matters: longer/more specific
patterns first, or `bg-gray-500` gets clobbered by a `bg-gray-50` rule.

The script must:
- Handle state prefixes by preserving them: `hover:text-gray-900` → `hover:text-foreground`.
- Handle opacity modifiers: `bg-gray-50/60` → `bg-muted/60`.
- Only rewrite class *tokens*, never arbitrary text. Match on `\b(?:[a-z-]+:)*(?:bg|text|border|ring|fill|stroke|divide|from|to|via)-…` boundaries.
- Report a per-file count and a total, and **refuse to write** if the total is outside a sane
  range (guards against a runaway regex).
- Leave `dark:`-prefixed classes alone (there is exactly one file with them).

| Pattern | Replacement |
|---|---|
| `bg-white` | `bg-card` |
| `bg-gray-50`, `bg-slate-50` | `bg-muted/40` |
| `bg-gray-100`, `bg-gray-200` | `bg-muted` |
| `text-gray-900` | `text-foreground` |
| `text-gray-800`, `text-gray-700`, `text-gray-600`, `text-gray-500`, `text-gray-400` | `text-muted-foreground` |
| `border-gray-100`…`border-gray-300` | `border-border` |
| `bg-blue-600`, `bg-blue-700` | `bg-primary` |
| `text-blue-600`, `text-blue-700` | `text-primary` |
| `bg-blue-50` | `bg-primary/10` |
| `border-blue-200`, `border-blue-300` | `border-primary/30` |
| `bg-red-50` | `bg-destructive/10` |
| `text-red-600`, `text-red-700` | `text-destructive` |
| `border-red-200` | `border-destructive/30` |
| `bg-green-50`, `bg-green-100` | `bg-success/10` |
| `text-green-600`, `text-green-700`, `text-green-800` | `text-success` |
| `border-green-200`, `border-green-300` | `border-success/30` |
| `bg-amber-50`, `bg-yellow-50` | `bg-warning/10` |
| `text-amber-600`, `text-amber-700`, `text-amber-800` | `text-warning` |
| `border-amber-200`, `border-amber-300` | `border-warning/30` |

**Step 2: Dry run and read the report.** Do not apply blind:

```bash
node /home/subhajit/project/.tools/migrate-ui.mjs --dry-run
```
Expected: roughly 1,000 rewrites across ~50 files. A wildly different number means the regex is
wrong — stop and fix it.

**Step 3: Handle the 21 raw hex values by hand.** List them:

```bash
grep -rnoE '#[0-9a-fA-F]{6}\b' src/app src/components --include=*.tsx | sort -u
```
Most are inline SVG `stroke`/`fill` (e.g. `#2563eb`) or brand colors (Google's `#34A853`). Convert
SVG strokes to `currentColor` where the element already gets a text color; leave Google brand
colors alone — they are intentionally exact.

---

## Task 4: Batch 1 — apply migration to `ui/` primitives

**Files:** `src/components/ui/*.tsx` (22 files)

**Step 1:** `node /home/subhajit/project/.tools/migrate-ui.mjs src/components/ui`

**Step 2: Review the entire diff**, not a sample:

```bash
git diff --stat src/components/ui && git diff src/components/ui | head -200
```
Look specifically for lost meaning: a `bg-green-50` that signalled "resolved" must read
`bg-success/10`, not `bg-muted`.

**Step 3: Verify**

```bash
npm run typecheck && npm run lint && npm test 2>&1 | grep -E "Test Files|Tests "
```
Expected: typecheck clean, 0 lint errors, 270 passed / 19 skipped.

**Step 4: Screenshot compare** against baseline, both themes.

**Step 5: Commit**

```bash
git add src/components/ui
git commit -m "refactor(ui): move ui primitives onto semantic tokens"
```

---

## Task 5: Batches 2–5 — remaining components and pages

Apply the same five-step loop (migrate → review diff → verify → screenshot → commit) to:

| Batch | Scope | Files |
|---|---|---|
| 2 | List surfaces | `src/app/lost-items`, `resolved`, `search`, `src/components/ui/ItemCard.tsx`, `Pagination.tsx`, `EmptyState.tsx` |
| 3 | Detail + forms | `src/app/item/[id]`, `post`, `dashboard`, `src/components/ItemDetail.tsx`, `PostItemForm.tsx`, `ClaimsModal.tsx`, `HandoverPanel.tsx`, `CommentsSection.tsx` |
| 4 | Secondary | `src/app/notifications`, `map`, `admin/dashboard`, `src/components/admin/*`, `CampusMap.tsx`, `NotificationBell.tsx` |
| 5 | Shell + auth | `src/app/layout.tsx`, `page.tsx`, `auth/*`, `not-found.tsx`, `error.tsx`, `src/components/Navbar.tsx`, `Footer.tsx` |

One commit per batch, each independently revertable.

---

## Task 6: The "refined & crisp" pass

Token migration changes *what color*, not *how it looks*. This task is the actual restyle.
Work page by page, applying:

- **Type ladder** — `text-2xl tracking-tight font-semibold` (page title) / `text-lg font-semibold`
  (section) / `text-sm` (body) / `text-xs text-muted-foreground` (meta).
- **Spacing** — page shell `py-8` + `space-y-6`; one card padding (`p-5`).
- **Cards** — `rounded-xl border border-border bg-card shadow-sm`.
- **Focus** — `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
  on every interactive element.
- **States** — one empty/loading/error treatment shared across pages.

Highest-value targets, in order: `/` (hero currently renders **static sample items**),
`/item/[id]` (754 lines, one undifferentiated column), `/search` + `/lost-items` + `/resolved`
(should share one list shell), `/admin/dashboard` (needs room for the new tabs).

---

## Task 7: Dark-mode contrast pass

**Step 1:** Capture every route in both themes on a local dev server:

```bash
npm run dev &
cd /home/subhajit/project/.tools/shots
BASE_URL=http://localhost:3000 node capture.mjs after
```

**Step 2:** Inspect each dark screenshot for the failure modes light mode hides: muted text on
`--card` that no longer meets ~4.5:1, borders that vanish, status badges whose text and background
collapse together, and the SVG map's fills.

**Step 3:** Fix by adjusting the `.dark` token values, not by adding per-page `dark:` overrides —
one change at the token layer fixes every surface at once, which is the whole point of Task 1.

---

## Task 8: Verification and release

**Step 1: Full local gate**

```bash
npm run verify
```
Expected: migrations validate, typecheck clean, lint at the 3 pre-existing `<img>` warnings,
tests green.

**Step 2: Production build with the real env shape** (a build with no `NEXTAUTH_SECRET` fails by
design, so supply one):

```bash
DATABASE_URL=... DIRECT_URL=... NEXTAUTH_SECRET=build-check NEXTAUTH_URL=http://localhost:3000 npm run build
```

**Step 3: Deploy to preview — not production**

```bash
vercel --yes
```
Then exercise the flows that could break, on the preview URL: sign in with Google, post an item,
**upload an image** (Blob OIDC), file a claim, approve it, complete a handover, and check the
notifications bell and `/map`.

**Step 4: Promote only after the preview passes**

```bash
vercel --prod --yes
```

**Step 5: Confirm production** — the DB-backed public endpoint must return 200 with a numeric
`pagination.total`, and every page must render in both themes.

---

## Definition of done

- 0 hardcoded palette classes remain outside intentional brand colors (Google logo):
  `grep -rhoE '\b(bg|text|border)-(gray|blue|red|green|amber)-[0-9]{2,3}\b' src --include=*.tsx | wc -l` → 0.
- Dark mode works with no flash, persists across reloads, and honours the system preference.
- Every page screenshotted in both themes at 375px and 1440px, reviewed against the baseline.
- `npm run verify` green; production build compiles; preview verified before promotion.
- Auth, upload, claim, and handover flows exercised on the preview deployment.
