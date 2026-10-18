// WCAG AA contrast audit across both themes.
//
//   AUTH_EMAIL=... AUTH_PASSWORD=... ITEM_ID=... node contrast.mjs [baseUrl]
//
// Resolves every colour to sRGB through a canvas before comparing, because
// computed styles come back as lab()/oklab()/oklch() and subtracting their
// channels directly is meaningless.
import { createRequire } from 'node:module';
const require = createRequire((process.env.PW_TOOLS_DIR ?? '/home/subhajit/project/.tools') + '/');
const { chromium } = require('playwright');
const BASE = process.argv[2] ?? process.env.BASE_URL ?? 'http://localhost:3100';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(BASE + '/auth/login', { waitUntil: 'load' });
await page.fill('input[name="email"]', process.env.AUTH_EMAIL);
await page.fill('input[name="password"]', process.env.AUTH_PASSWORD);
await Promise.all([page.waitForNavigation({ timeout: 30000 }).catch(()=>{}), page.click('button[type="submit"]')]);
await page.waitForTimeout(1500);

// Proper WCAG ratio: resolve every colour to sRGB via canvas (browser handles
// lab/oklab/oklch), then compare relative luminance. The earlier attempt
// subtracted lab components from oklab components, which is meaningless.
const AUDIT = `(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const toRGB = (css) => {
    ctx.clearRect(0,0,1,1); ctx.fillStyle = '#000'; ctx.fillStyle = css;
    ctx.fillRect(0,0,1,1);
    const d = ctx.getImageData(0,0,1,1).data;
    return [d[0], d[1], d[2], d[3]/255];
  };
  const lum = ([r,g,b]) => {
    const f = (v) => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
    return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b);
  };
  const bgOf = (el) => {
    let n = el;
    while (n) {
      const c = getComputedStyle(n).backgroundColor;
      const p = toRGB(c);
      if (p[3] > 0.5) return p;
      n = n.parentElement;
    }
    return [255,255,255,1];
  };
  const out = [];
  for (const el of document.querySelectorAll('p,span,h1,h2,h3,a,button,td,th,label,li')) {
    const txt = el.textContent?.trim();
    if (!txt || el.children.length > 0 || el.offsetParent === null) continue;
    const s = getComputedStyle(el);
    const fg = toRGB(s.color); if (fg[3] < 0.5) continue;
    const bg = bgOf(el);
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1,L2) + 0.05) / (Math.min(L1,L2) + 0.05);
    const px = parseFloat(s.fontSize);
    const bold = parseInt(s.fontWeight) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (ratio < need) out.push({ txt: txt.slice(0,34), ratio: +ratio.toFixed(2), need, px, color: s.color });
  }
  return out;
})()`;

for (const theme of ['dark', 'light']) {
  await page.evaluate((t) => localStorage.setItem('theme', t), theme);
  console.log(`\n=== ${theme.toUpperCase()} ===`);
  for (const r of ['/', '/search', `/item/${process.env.ITEM_ID}`, '/admin/dashboard', '/dashboard', '/notifications', '/map', '/post', '/auth/login']) {
    await page.goto(BASE + r, { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const fails = await page.evaluate(AUDIT);
    console.log(`  ${r.padEnd(34)} ${fails.length === 0 ? 'ok' : fails.length + ' below WCAG AA'}${fails.length ? '  e.g. ' + JSON.stringify(fails.slice(0,3)) : ''}`);
  }
}
await browser.close();
