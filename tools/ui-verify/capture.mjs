// Captures every route at mobile and desktop widths for visual comparison.
// Verification tooling only -- deliberately NOT a project dependency.
//
//   ITEM_ID=<id> [AUTH_EMAIL=... AUTH_PASSWORD=...] node capture.mjs <outdir>
//
// Pages behind auth are captured by signing in through the real credentials
// form first, because 8 of 13 routes redirect to sign-in when anonymous.
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const TOOLS = process.env.PW_TOOLS_DIR ?? '/home/subhajit/project/.tools';
const require = createRequire(TOOLS + '/');
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL ?? 'https://campushelper.vercel.app';
const OUT = process.argv[2] ?? 'baseline';
const ITEM = process.env.ITEM_ID ?? '';
const ROUTES = ['/', '/lost-items', '/resolved', '/search', '/post', '/map',
  '/notifications', '/dashboard', '/admin/dashboard', '/auth/login',
  '/auth/signup', ITEM ? `/item/${ITEM}` : null].filter(Boolean);
const SIZES = [{ n: 'mobile', w: 375, h: 900 }, { n: 'desktop', w: 1440, h: 1000 }];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
let ok = 0, fail = 0, skipped = 0;

for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h } });

  if (process.env.AUTH_EMAIL) {
    await page.goto(`${BASE}/auth/login`, { waitUntil: 'load', timeout: 30000 });
    await page.fill('input[name="email"]', process.env.AUTH_EMAIL);
    await page.fill('input[name="password"]', process.env.AUTH_PASSWORD);
    await Promise.all([
      page.waitForNavigation({ timeout: 30000 }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForTimeout(1500);
    const who = await page.evaluate(async () => {
      const r = await fetch('/api/auth/session'); const d = await r.json();
      return d?.user?.email ?? null;
    });
    console.log(`sign-in ${size.n}: ${who ? 'OK as ' + who : 'FAILED (still anonymous)'}`);
    if (!who) skipped++;
  }

  for (const route of ROUTES) {
    const name = (route.replace(/\W+/g, '_') || 'root') + '-' + size.n;
    try {
      // 'load' + a settle delay: 'networkidle' never settles because the app
      // polls (the notification bell runs on a 30s interval).
      await page.goto(BASE + route, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
      const landed = new URL(page.url()).pathname;
      const note = landed !== route ? ` (-> ${landed})` : '';
      console.log(`ok    ${route.padEnd(30)} ${size.n}${note}`);
      ok++;
    } catch (e) {
      console.log(`FAIL  ${route.padEnd(30)} ${size.n}: ${e.message.split('\n')[0]}`);
      fail++;
    }
  }
  await page.close();
}
await browser.close();
console.log(`\n${ok} captured, ${fail} failed${skipped ? `, sign-in failed ${skipped}x` : ''} -> ${OUT}/`);
