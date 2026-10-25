// Field usability at phone width, headless Chromium (Playwright) + axe-core. Run after the build:
//   npm install && node tools/a11y_check.mjs     (axe-core is the only dev dependency; Playwright as for offline_check)
//   node tools/a11y_check.mjs --quiet
// On every screen (home, search, unit details, diagnosis, the change-a-finding sheet, readings, a cause, every
// calculator, about), in the dark and the light theme, at 360 px wide:
//  - axe-core WCAG 2.1 A/AA rules, contrast included;
//  - every button, link, box and pick-list is at least 44 × 44 px (links inside running text excepted);
//  - nothing scrolls sideways.
// KNOWN lists what has been looked at and left (see cloud-reports/H1.md); anything else fails the run.
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize, sep } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const QUIET = process.argv.includes('--quiet');
const WIDTH = 360;
const require = createRequire(import.meta.url);
let chromium, axePath;
try { ({ chromium } = require('playwright')); } catch {
  console.log('Playwright is not installed: npm i -g playwright && npx playwright install chromium');
  process.exit(2);
}
try { axePath = require.resolve('axe-core/axe.min.js'); } catch {
  console.log('axe-core is not installed: npm install');
  process.exit(2);
}

// Looked at and left on purpose; each entry is [rule or check, a substring of the element's selector].
const KNOWN = [];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname.slice(1)) || 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  const file = normalize(join(DOCS, rel));
  if (!file.startsWith(DOCS + sep) || !existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

// screens: a name and how to get there from a fresh load
const TOOLS = ['pt', 'shsc', 'target', 'psy', 'split', 'glycol', 'combustion', 'flow', 'elec'];
const SCREENS = [
  ['home', async () => {}],
  ['home search', async (p) => { await p.fill('#homeq', 'walk-in freezer warm, coil iced'); await p.waitForSelector('#homeres .res'); }],
  ['unit details', async (p) => { await p.click('.tile >> nth=2'); await p.waitForSelector('.qrow'); }],
  ['diagnosis', async (p) => { await start(p); }],
  ['diagnosis + typed', async (p) => { await start(p); await p.fill('#diagq', 'fan not running'); await p.waitForSelector('#diagres .chip, #diagres .res'); }],
  ['change a finding', async (p) => { await start(p); await p.click('.chips .chip'); await p.waitForSelector('.sheet'); }],
  ['readings', async (p) => { await start(p); await nav(p, '#/readings'); await p.waitForSelector('.fields'); await p.fill('.fields input >> nth=0', '8,1 bar'); }],
  ['cause', async (p) => { await start(p); await p.click('.cause'); await p.waitForSelector('.prose'); }],
  ...TOOLS.map((t) => [`calculator ${t}`, async (p) => { await nav(p, `#/tool/${t}`); await p.waitForSelector('#toolout'); await p.fill('#toolout ~ * input, .fields input >> nth=1', '40').catch(() => {}); }]),
  ['about', async (p) => { await nav(p, '#/about'); await p.waitForSelector('.prose'); }],
];
async function start(p) {
  await p.fill('#homeq', 'walk-in freezer warm, coil iced, fans running');
  await p.press('#homeq', 'Enter');
  await p.waitForSelector('.cause .p');
}
async function nav(p, hash) { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(50); }

// in the page: small targets and sideways overflow
const measure = (width) => {
  const sel = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) return `${s}#${el.id}`;
    if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).join('.');
    for (const a of ['data-act', 'data-k', 'data-in', 'data-f', 'href']) if (el.getAttribute(a)) { s += `[${a}="${el.getAttribute(a)}"]`; break; }
    return s;
  };
  const small = [];
  for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button]')) {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    if (!r.width || !r.height || st.visibility === 'hidden' || st.display === 'none') continue;
    // a link inside running text is exempt (WCAG 2.5.5 / 2.5.8 inline exception)
    if (el.tagName === 'A' && el.closest('p, li') && el.closest('p, li').textContent.trim() !== el.textContent.trim()) continue;
    if (r.width < 44 - 0.5 || r.height < 44 - 0.5) small.push({ sel: sel(el), w: Math.round(r.width), h: Math.round(r.height), text: el.textContent.trim().slice(0, 30) });
  }
  const wide = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width && r.right > width + 1 && getComputedStyle(el).position !== 'fixed') wide.push({ sel: sel(el), right: Math.round(r.right) });
  }
  return { small, wide: wide.slice(0, 5), scroll: document.documentElement.scrollWidth > document.documentElement.clientWidth };
};

const issues = [];
const known = [];
const add = (theme, screen, kind, target, detail) => {
  const k = KNOWN.find(([rule, sub]) => rule === kind && target.includes(sub));
  (k ? known : issues).push(`${theme} · ${screen} · ${kind} · ${target}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
try {
  for (const theme of ['dark', 'light']) {
    for (const [name, go] of SCREENS) {
      const context = await browser.newContext({ viewport: { width: WIDTH, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
        colorScheme: theme, serviceWorkers: 'block' });
      await context.addInitScript((t) => { localStorage.setItem('fdx.theme', JSON.stringify(t)); }, theme);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(BASE);
      await page.waitForSelector('.tile');
      try { await go(page); } catch (e) { issues.push(`${theme} · ${name} · could not reach the screen: ${e.message.split('\n')[0]}`); await context.close(); continue; }
      await page.waitForTimeout(100);
      await page.addScriptTag({ path: axePath });
      const axe = await page.evaluate(async () => (await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] })).violations
        .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => ({ target: n.target.join(' '), why: n.failureSummary?.split('\n').slice(1, 2).join('').trim() })) })));
      for (const v of axe) for (const n of v.nodes) add(theme, name, `axe:${v.id}`, n.target, `${v.impact}; ${n.why || ''}`);
      const m = await page.evaluate(measure, WIDTH);
      for (const s of m.small) add(theme, name, 'tap<44', s.sel, `${s.w}×${s.h} "${s.text}"`);
      if (m.scroll) add(theme, name, 'scrolls-sideways', m.wide.map((w) => `${w.sel}→${w.right}px`).join(', ') || 'page');
      for (const e of errors) add(theme, name, 'page-error', e);
      if (!QUIET) console.log(`  ${theme.padEnd(5)} ${name.padEnd(22)} axe ${axe.length} rule(s) · small ${m.small.length} · sideways ${m.scroll ? 'yes' : 'no'}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

const uniq = (a) => [...new Set(a)];
if (known.length && !QUIET) {
  console.log(`\n${uniq(known).length} known and left (see KNOWN):`);
  for (const k of uniq(known)) console.log('  ~', k);
}
if (issues.length) {
  console.log(`\n${uniq(issues).length} problem(s):`);
  for (const p of uniq(issues)) console.log('  ✗', p);
  process.exit(1);
}
console.log(`\na11y check (${WIDTH} px, dark + light): OK`);
