// Offline guarantee, driven headless in Chromium (Playwright). Run after `python3 tools/build.py`:
//   node tools/offline_check.mjs            everything
//   node tools/offline_check.mjs --quiet    only failures and the summary
// Checks:
//  1. sw.js precaches every file the app loads (a full online session: home, diagnosis, answers,
//     readings, a cause, every calculator, about) and the stamp matches the files in docs/.
//  2. Load online, go offline (network emulation and the server stopped), reload, run a diagnosis.
//  3. A new build (new stamp) replaces the cache on the next online launch, and the new cache holds the
//     new files byte for byte, even when the server says files may be cached for 10 minutes.
//  4. An update that fails halfway (one file errors, or the connection drops) leaves the old version
//     working, online and offline.
//  5. docs/field-dx-standalone.html runs from file:// with every network request blocked.
// Needs Playwright with Chromium (`npm i -g playwright && npx playwright install chromium`).
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, existsSync, mkdtempSync, cpSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, extname, normalize, sep } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const QUIET = process.argv.includes('--quiet');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.log('Playwright is not installed: npm i -g playwright && npx playwright install chromium');
  process.exit(2);
}

const problems = [];
const say = (...a) => { if (!QUIET) console.log(...a); };
const ok = (cond, msg) => { if (cond) say(`  ✓ ${msg}`); else problems.push(msg); return cond; };

// ---------------------------------------------------------------- a static server like GitHub Pages
// Serves `state.root` under /app/ with the 10-minute cache header GitHub Pages sends, so a service
// worker that fetches through the HTTP cache would pick up stale files.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const state = { root: DOCS, fail: null, hits: [] };
const sockets = new Set();
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  state.hits.push(url.pathname);
  if (!url.pathname.startsWith('/app/')) { res.writeHead(404).end(); return; }
  let rel = decodeURIComponent(url.pathname.slice('/app/'.length)) || 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  const file = normalize(join(state.root, rel));
  if (!file.startsWith(state.root + sep) || !existsSync(file)) { res.writeHead(404).end('not found'); return; }
  const f = state.fail?.(rel);
  if (f === 'drop') { req.socket.destroy(); return; }
  if (f) { res.writeHead(f).end('error'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
  res.end(readFileSync(file));
});
server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/app/`;
const stopServer = () => { for (const s of sockets) s.destroy(); return new Promise((r) => server.close(r)); };

// ---------------------------------------------------------------- helpers
const swInfo = (dir) => {
  const src = readFileSync(join(dir, 'sw.js'), 'utf8');
  return { version: /const VERSION = '([^']*)'/.exec(src)?.[1], assets: JSON.parse(/const ASSETS = (\[[^\]]*\]);/.exec(src)?.[1] || '[]') };
};
const relOf = (u) => {
  const url = new URL(u);
  return url.pathname.startsWith('/app/') ? url.pathname.slice(5) || './' : null;
};

// a copy of docs/ with a marker in kb.json, re-stamped by build.py itself
function makeVersion(tag) {
  const dir = mkdtempSync(join(tmpdir(), `fdx-${tag}-`));
  cpSync(DOCS, dir, { recursive: true });
  const kbFile = join(dir, 'data/kb.json');
  const kb = JSON.parse(readFileSync(kbFile, 'utf8'));
  kb.meta.built = `marker-${tag}`;
  writeFileSync(kbFile, JSON.stringify(kb));
  execFileSync('python3', [join(ROOT, 'tools/build.py'), '--stamp', dir]);
  return dir;
}

async function waitForVersion(page, version, ms = 20000) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < ms) {
    last = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return { keys: (await caches.keys()).filter((k) => k.startsWith('fdx-')), active: Boolean(reg?.active),
        busy: Boolean(reg?.installing || reg?.waiting), controlled: Boolean(navigator.serviceWorker.controller) };
    }).catch(() => null); // the page may be navigating
    if (last && last.keys.length === 1 && last.keys[0] === `fdx-${version}` && last.active && !last.busy && last.controlled) return;
    await page.waitForTimeout(200);
  }
  throw new Error(`timed out waiting for fdx-${version}: ${JSON.stringify(last)}`);
}

// every cached entry of the current cache, compared byte for byte with the files of a build
async function cacheMatches(page, dir) {
  const { version, assets } = swInfo(dir);
  const got = await page.evaluate(async (name) => {
    if (!(await caches.has(name))) return {};
    const c = await caches.open(name);
    const out = {};
    for (const req of await c.keys()) out[req.url] = Array.from(new Uint8Array(await (await c.match(req)).arrayBuffer()));
    return out;
  }, `fdx-${version}`);
  const missing = [], stale = [];
  for (const a of assets) {
    const url = new URL(a, BASE).href;
    if (!got[url]) { missing.push(a); continue; }
    const want = readFileSync(join(dir, a === './' ? 'index.html' : a));
    if (Buffer.compare(Buffer.from(got[url]), want) !== 0) stale.push(a);
  }
  return { missing, stale };
}

// type a complaint on the home screen and get to a ranked diagnosis
async function diagnose(page, text = 'walk-in freezer warm, coil iced, fans running') {
  await page.waitForSelector('#homeq', { timeout: 15000 });
  await page.fill('#homeq', text);
  await page.press('#homeq', 'Enter');
  await page.waitForSelector('.cause .p', { timeout: 15000 });
  const top = await page.$eval('.cause .n', (e) => e.textContent.trim());
  const p = await page.$eval('.cause .p', (e) => e.textContent.trim());
  const ans = await page.$('#nextcard .ans');
  if (ans) { await ans.click(); await page.waitForSelector('.cause .p'); }
  return { top, p, answered: Boolean(ans) };
}

async function freshPage(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { context, page, errors };
}

async function installed(page, version) {
  await page.goto(BASE);
  await page.waitForSelector('.tile');
  await waitForVersion(page, version);
}

const browser = await chromium.launch();
const tmpDirs = [];
try {
  // ---------------------------------------------------------------- 1 + 2: precache audit, offline launch
  say('\nprecache and offline launch');
  const cur = swInfo(DOCS);
  ok(cur.assets.every((a) => a === './' || existsSync(join(DOCS, a))), `every file in the cache list exists (${cur.assets.length})`);
  const restamp = makeVersion('stampcheck');
  tmpDirs.push(restamp);
  // the stamp in docs/sw.js matches what build.py computes from docs/ (only kb.json differs in the copy)
  writeFileSync(join(restamp, 'data/kb.json'), readFileSync(join(DOCS, 'data/kb.json')));
  execFileSync('python3', [join(ROOT, 'tools/build.py'), '--stamp', restamp]);
  ok(swInfo(restamp).version === cur.version, `docs/sw.js stamp ${cur.version} is current (rebuild if not)`);

  {
    const { context, page, errors } = await freshPage(browser);
    const requested = new Set();
    page.on('request', (r) => { const rel = relOf(r.url()); if (rel) requested.add(rel); });
    await installed(page, cur.version);
    // walk the whole app online so every file it can ask for gets requested
    await diagnose(page);
    await page.goto(`${BASE}#/readings`); await page.waitForSelector('.fields');
    const causeId = await page.evaluate(() => JSON.parse(localStorage.getItem('fdx.job'))?.system);
    ok(Boolean(causeId), 'a job was saved');
    await page.goto(`${BASE}#/diag`); await page.waitForSelector('.cause');
    await page.click('.cause'); await page.waitForSelector('h1');
    for (const t of ['pt', 'shsc', 'target', 'psy', 'split', 'glycol', 'combustion', 'flow', 'elec']) {
      await page.goto(`${BASE}#/tool/${t}`); await page.waitForSelector('#toolout');
    }
    await page.goto(`${BASE}#/about`); await page.waitForSelector('h1');
    // the manifest and icons are fetched by the browser, not the page: ask for them like it would
    await page.evaluate(() => Promise.all(['manifest.webmanifest', 'icons/icon-180.png', 'icons/icon.svg'].map((u) => fetch(u))));
    const extra = [...requested].filter((r) => r !== 'sw.js' && !cur.assets.includes(r));
    ok(!extra.length, `every file the app requested is precached${extra.length ? ` — not cached: ${extra.join(', ')}` : ` (${requested.size} requested)`}`);
    const m = await cacheMatches(page, DOCS);
    ok(!m.missing.length && !m.stale.length, `cache fdx-${cur.version} holds every asset, byte for byte${m.missing.length ? ` — missing ${m.missing.join(', ')}` : ''}${m.stale.length ? ` — stale ${m.stale.join(', ')}` : ''}`);

    await context.setOffline(true);
    await page.goto(BASE);
    const d = await diagnose(page);
    ok(/\d/.test(d.p) && d.answered, `offline (emulated): reload and diagnose → ${d.top} ${d.p}`);
    ok(!errors.length, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
    await context.close();
  }

  // ---------------------------------------------------------------- 3: an update replaces the cache
  say('\nupdate');
  const v1 = makeVersion('v1'), v2 = makeVersion('v2'), v3 = makeVersion('v3');
  tmpDirs.push(v1, v2, v3);
  const [i1, i2, i3] = [v1, v2, v3].map(swInfo);
  ok(new Set([i1.version, i2.version, i3.version]).size === 3, `a content change gives a new stamp (${i1.version}, ${i2.version}, ${i3.version})`);
  {
    const { context, page, errors } = await freshPage(browser);
    state.root = v1;
    await installed(page, i1.version);
    state.root = v2;
    await page.reload();
    await waitForVersion(page, i2.version).then(() => ok(true, `next online launch installs ${i2.version} and drops ${i1.version}`),
      (e) => ok(false, `update to ${i2.version} didn't take: ${e.message.split('\n')[0]}`));
    const m = await cacheMatches(page, v2);
    ok(!m.missing.length && !m.stale.length, `new cache holds the new files byte for byte${m.stale.length ? ` — stale from the HTTP cache: ${m.stale.join(', ')}` : ''}${m.missing.length ? ` — missing ${m.missing.join(', ')}` : ''}`);
    // relaunch (a full load, not a hash change in the open page)
    await page.goto(`${BASE}?relaunch#/about`);
    await page.waitForSelector('h1');
    ok((await page.textContent('main')).includes('marker-v2'), 'the relaunched app runs the new knowledge base');

    // ---------------------------------------------------------------- 4: half-finished updates
    say('\nupdate that fails halfway');
    for (const [label, how] of [['kb.json answers 500', 500], ['connection drops on kb.json', 'drop']]) {
      state.root = v3;
      state.fail = (rel) => (rel === 'data/kb.json' ? how : null);
      await page.goto(BASE);
      await page.waitForSelector('.tile');
      // give the new worker time to try and fail its install
      for (let i = 0; i < 50 && await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.installing)); i++) await page.waitForTimeout(200);
      await page.waitForTimeout(500);
      const keys = await page.evaluate(() => caches.keys());
      ok(keys.includes(`fdx-${i2.version}`) && !keys.includes(`fdx-${i3.version}`), `${label}: old cache kept, no partial new cache (${keys.join(', ')})`);
      const m2 = await cacheMatches(page, v2);
      ok(!m2.missing.length && !m2.stale.length, `${label}: old cache still complete`);
      await context.setOffline(true);
      await page.goto(BASE);
      const d = await diagnose(page);
      ok(/\d/.test(d.p), `${label}: offline launch still diagnoses → ${d.top} ${d.p}`);
      await context.setOffline(false);
    }
    // the fix ships: the next online launch completes the update
    state.fail = null;
    await page.goto(BASE);
    await waitForVersion(page, i3.version).then(() => ok(true, `once the server is fixed, the update completes (${i3.version})`),
      (e) => ok(false, `update to ${i3.version} after the fix didn't take: ${e.message.split('\n')[0]}`));
    ok(!errors.filter((e) => !/Failed to load resource|ERR_INTERNET_DISCONNECTED|status of 500/.test(e)).length, `no page errors${errors.length ? ` (${errors.length} network messages)` : ''}`);

    // the real thing: no server at all
    await stopServer();
    await page.goto(BASE);
    const d = await diagnose(page);
    ok(/\d/.test(d.p), `server stopped: launch and diagnose → ${d.top} ${d.p}`);
    await context.close();
  }

  // ---------------------------------------------------------------- 5: single file from file://
  say('\nstandalone file');
  {
    const { context, page, errors } = await freshPage(browser);
    const net = [];
    await context.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : (net.push(r.request().url()), r.abort())));
    await page.goto(pathToFileURL(join(DOCS, 'field-dx-standalone.html')).href);
    const d = await diagnose(page);
    ok(/\d/.test(d.p) && d.answered, `file:// with the network blocked: diagnose → ${d.top} ${d.p}`);
    await page.evaluate(() => { location.hash = '#/tool/pt'; });
    await page.waitForSelector('[data-k="temp"]');
    await page.fill('[data-k="temp"]', '40');
    ok(/psig/.test(await page.textContent('#toolout')), 'file://: PT calculator answers');
    ok(!net.length, `no network requests${net.length ? `: ${net.slice(0, 3).join(', ')}` : ''}`);
    ok(!errors.length, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
    await context.close();
  }
} catch (e) {
  problems.push(`crashed: ${e.stack || e}`);
} finally {
  await browser.close();
  if (server.listening) await stopServer();
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
}

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log('  ✗', p);
  process.exit(1);
}
console.log('\noffline check: OK');
