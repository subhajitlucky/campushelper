// Captures every route at mobile and desktop widths, in both themes, for
// visual comparison.
// Verification tooling only -- deliberately NOT a project dependency.
//
//   ITEM_ID=<id> [AUTH_EMAIL=... AUTH_PASSWORD=...] node capture.mjs <outdir>
//
// Pages behind auth are captured by signing in through the real credentials
// form first, because 8 of 13 routes redirect to sign-in when anonymous.
//
// Themes: the app switches on a `.dark` class on <html> driven by next-themes,
// which persists to localStorage under "theme". Setting that key before the
// document boots is the only way to capture a theme the server did not render,
// so it is primed with an init script rather than clicked through the toggle.
//
// Env knobs:
//   THEMES=light,dark     which themes to capture (default both)
//   SIZES=mobile,desktop  which widths to capture (default both)
//   FULL=1                also save a full-page shot (default: viewport only)
import { mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const TOOLS = process.env.PW_TOOLS_DIR ?? '/home/subhajit/project/.tools';
const require = createRequire(TOOLS + '/');
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL ?? 'https://campushelper.vercel.app';
const OUT = process.argv[2] ?? 'baseline';
const ITEM = process.env.ITEM_ID ?? '';
const ALL_ROUTES = [
  '/',
  '/lost-items',
  '/resolved',
  '/search',
  '/post',
  '/map',
  '/notifications',
  '/dashboard',
  '/admin/dashboard',
  '/auth/login',
  '/auth/signup',
  '/not-found',
  ITEM ? `/item/${ITEM}` : null,
].filter(Boolean);
const ROUTES = process.env.ROUTES
  ? process.env.ROUTES.split(',').map((s) => s.trim()).filter(Boolean)
  : ALL_ROUTES;

const ALL_SIZES = [
  { n: 'mobile', w: 375, h: 812 },
  { n: 'desktop', w: 1440, h: 900 },
];
const SIZES = process.env.SIZES
  ? ALL_SIZES.filter((s) => process.env.SIZES.split(',').includes(s.n))
  : ALL_SIZES;
const THEMES = (process.env.THEMES ?? 'light,dark').split(',').map((s) => s.trim());
const FULL = process.env.FULL === '1';

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
let ok = 0, fail = 0;

// --- authenticate once, reuse the cookies ----------------------------------
// Signing in per (theme, size) context meant four credential POSTs per run,
// which walked straight into the app's own login limiter (10 per 15 min per
// email) and silently degraded later themes to anonymous -- the failure mode
// is `authorize()` returning null, i.e. it looks like a wrong password.
// One sign-in, persisted as storage state, keeps every context authenticated.
// One sign-in, persisted as storage state, keeps every context authenticated.
// The state file holds a live session cookie, so it is written to a .tmp-*
// path (gitignored) rather than into the screenshot directory, which may be
// one of the committed baseline folders.
const STATE = process.env.AUTH_STATE ?? `${process.cwd()}/.tmp-ui-verify/auth.json`;
if (process.env.AUTH_EMAIL && (!existsSync(STATE) || process.env.REAUTH === '1')) {
  mkdirSync(STATE.slice(0, STATE.lastIndexOf('/')), { recursive: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // A cold `next dev` compiles the [...nextauth] route on first touch, and the
  // credentials POST races that compile: it answers 200 and bounces straight
  // back to /api/auth/signin, which is indistinguishable from a bad password.
  // Warm the auth endpoints first, then retry the form a few times.
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(async () => {
    await fetch('/api/auth/csrf').catch(() => {});
    await fetch('/api/auth/providers').catch(() => {});
  }).catch(() => {});
  await page.waitForTimeout(600);

  let who = null;
  for (let attempt = 1; attempt <= 4 && !who; attempt++) {
    await page.goto(`${BASE}/auth/login`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(400 * attempt);
    await page.fill('input[name="email"]', process.env.AUTH_EMAIL);
    await page.fill('input[name="password"]', process.env.AUTH_PASSWORD);
    await Promise.all([
      page.waitForNavigation({ timeout: 30000 }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForTimeout(1500);
    who = await page.evaluate(async () => {
      const r = await fetch('/api/auth/session'); const d = await r.json();
      return d?.user?.email ?? null;
    });
    console.log(`sign-in attempt ${attempt}: ${who ? 'OK as ' + who : 'still anonymous'}`);
  }

  if (!who) {
    console.log(`sign-in FAILED after 4 attempts — refusing to capture an anonymous baseline`);
    process.exitCode = 1;
    await ctx.close();
    await browser.close();
    throw new Error('sign-in failed; refusing to capture an anonymous baseline');
  }
  await ctx.storageState({ path: STATE });
  await ctx.close();
}

for (const theme of THEMES) {
  for (const size of SIZES) {
    const context = await browser.newContext({
      viewport: { width: size.w, height: size.h },
      deviceScaleFactor: 2,
      colorScheme: theme,
      storageState: process.env.AUTH_EMAIL ? STATE : undefined,
    });
    // next-themes reads this key during hydration; priming it here means the
    // very first paint is already in the requested theme (no flash, no toggle).
    await context.addInitScript((t) => {
      try { window.localStorage.setItem('theme', t); } catch { /* ignore */ }
    }, theme);

    const page = await context.newPage();

    for (const route of ROUTES) {
      const name = (route.replace(/\W+/g, '_') || 'root') + '-' + size.n + '-' + theme;
      try {
        // 'load' + a settle delay: 'networkidle' never settles because the app
        // polls (the notification bell runs on a 30s interval).
        await page.goto(BASE + route, { waitUntil: 'load', timeout: 30000 });
        await page.waitForTimeout(1400);
        await page.screenshot({ path: `${OUT}/${name}.png` });
        if (FULL) {
          await page.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true });
        }
        const landed = new URL(page.url()).pathname;
        const applied = await page.evaluate(() =>
          document.documentElement.classList.contains('dark') ? 'dark' : 'light'
        );
        const notes = [];
        if (landed !== route) notes.push(`-> ${landed}`);
        if (applied !== theme) notes.push(`!theme=${applied}`);
        console.log(`ok    ${route.padEnd(20)} ${size.n}/${theme} ${notes.join(' ')}`);
        ok++;
      } catch (e) {
        console.log(`FAIL  ${route.padEnd(20)} ${size.n}/${theme}: ${e.message.split('\n')[0]}`);
        fail++;
      }
    }
    await context.close();
  }
}
await browser.close();
console.log(`\n${ok} captured, ${fail} failed -> ${OUT}/`);
