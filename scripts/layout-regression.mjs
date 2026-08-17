import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const WEB = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5180';
const API = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:5181/api/state';
const started = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ROUTES = [
  { path: '/', label: 'Home', fit: true, ready: '.command-centre-page' },
  { path: '/gameshow', label: 'Gameshow', fit: true },
  { path: '/league', label: 'Divisions', fit: true },
  { path: '/master-league', label: 'Master League', fit: true },
  { path: '/trio-league', label: 'Trio League', fit: true },
  { path: '/tier-league', label: 'Tier League', fit: true },
  { path: '/cups', label: 'Cups', fit: true },
  { path: '/master-cup', label: 'Master Cup', fit: true },
  { path: '/super-cup', label: 'Super Cup', fit: true },
  { path: '/head-to-head', label: 'Head to Head', fit: true },
  { path: '/reports', label: 'Analytics', fit: true },
  { path: '/trophy-room', label: 'Trophy Room', fit: true },
  { path: '/fixtures', label: 'Fixtures', allowDocumentScroll: true },
  { path: '/insights', label: 'Insights', allowDocumentScroll: true },
  { path: '/entries', label: 'Manual Entry', allowDocumentScroll: true },
  { path: '/settings', label: 'Settings', allowDocumentScroll: true },
];
const PRIMARY_FIT_SELECTOR = [
  '.competition-page-hero:visible', '.h2h-fight-card:visible', '.trophy-cabinet-stat:visible', '.trophy-shelf:visible',
  '.cup-quick-tile:visible', '.analytics-pass .panel:visible', '.tier-pyramid:visible', '.trio-group-visual:visible',
  '.kickoff-flow-panel:visible', '.kickoff-step-content:visible', '.kickoff-results-panel:visible', '.kickoff-picks-panel:visible',
].join(', ');

async function ready(url, timeout = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { const response = await fetch(url); if (response.ok) return true; } catch {}
    await sleep(400);
  }
  return false;
}
async function ensureServices() {
  if (!(await ready(API, 1200))) started.push(spawn('npm', ['run', 'dev:api'], { stdio: 'ignore', shell: true }));
  if (!(await ready(WEB, 1200))) started.push(spawn('npm', ['run', 'dev:web', '--', '--host', '127.0.0.1'], { stdio: 'ignore', shell: true }));
  if (!(await ready(API)) || !(await ready(WEB))) throw new Error('BookieBall services did not start');
}
async function pageDimensions(page) {
  return page.evaluate(() => ({ width: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, height: document.documentElement.scrollHeight, clientHeight: document.documentElement.clientHeight }));
}
async function assertNoHorizontalOverflow(page, label) {
  const d = await pageDimensions(page);
  if (d.width > d.clientWidth + 2) throw new Error(`${label}: horizontal overflow ${d.width}px > ${d.clientWidth}px`);
}
async function assertNoDocumentOverflow(page, label) {
  const d = await pageDimensions(page);
  if (d.width > d.clientWidth + 2) throw new Error(`${label}: horizontal overflow ${d.width}px > ${d.clientWidth}px`);
  if (d.height > d.clientHeight + 2) throw new Error(`${label}: document scroll ${d.height}px > ${d.clientHeight}px`);
}
async function assertVisibleControlsInsideViewport(page, label) {
  const controls = page.locator('button:visible, a.button:visible, .tab-button:visible');
  const count = Math.min(await controls.count(), 30);
  for (let index = 0; index < count; index += 1) {
    const box = await controls.nth(index).boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) continue;
    if (box.x < -2 || box.x + box.width > viewport.width + 2) throw new Error(`${label}: control ${index + 1} is clipped horizontally`);
  }
}
async function assertPrimaryPanelsInsideViewport(page, label) {
  const viewport = page.viewportSize();
  if (!viewport) return;
  const panels = page.locator(PRIMARY_FIT_SELECTOR);
  const count = Math.min(await panels.count(), 80);
  for (let index = 0; index < count; index += 1) {
    const box = await panels.nth(index).boundingBox();
    if (!box) continue;
    if (box.x < -3 || box.x + box.width > viewport.width + 3) throw new Error(`${label}: primary panel ${index + 1} is clipped horizontally`);
    if (box.y < -3 || box.y + box.height > viewport.height + 3) throw new Error(`${label}: primary panel ${index + 1} is clipped vertically (${Math.round(box.y + box.height)}px > ${viewport.height}px)`);
  }
}
async function assertNoErrorBoundary(page, label) {
  const body = (await page.locator('body').innerText()).toLowerCase();
  const bad = ['usebookieballdata must be used inside', 'something went wrong', 'application error', 'uncaught runtime error'].find((phrase) => body.includes(phrase));
  if (bad) throw new Error(`${label}: error UI rendered (${bad})`);
}
async function assertGameshowDrawFits(page, label) {
  const start = page.getByRole('button', { name: /start kick-off|start show|start/i }).first();
  if (!(await start.count()) || !(await start.isEnabled().catch(() => false))) return;
  await start.click();
  const tombola = page.locator('.tombola-centrepiece').first();
  if (!(await tombola.count())) return;
  await tombola.waitFor({ state: 'visible', timeout: 10_000 });
  const box = await tombola.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) return;
  if (box.x < -2 || box.y < -2 || box.x + box.width > viewport.width + 2 || box.y + box.height > viewport.height + 2) throw new Error(`${label}: tombola is outside the viewport`);
  const pickBall = page.getByRole('button', { name: /pick ball/i }).first();
  if (await pickBall.count()) {
    const pickBox = await pickBall.boundingBox();
    if (!pickBox || pickBox.y + pickBox.height > viewport.height + 2) throw new Error(`${label}: Pick Ball is not visible inside the viewport`);
  }
}
async function assertHomeDeckFits(page, viewport) {
  await page.goto(`${WEB}/`, { waitUntil: 'networkidle' });
  await page.locator('.command-centre-page').waitFor({ timeout: 10_000 });
  const progress = page.locator('.command-progress-row > span').last();
  const text = (await progress.textContent()) ?? '';
  const total = Math.max(1, Number(text.match(/\/\s*(\d+)/)?.[1] ?? 1));
  const next = page.getByRole('button', { name: /next/i }).first();
  for (let index = 0; index < total; index += 1) {
    const title = (await page.locator('.command-slide-title').textContent())?.trim() || `slide ${index + 1}`;
    const label = `Home ${viewport.width}x${viewport.height} · ${title}`;
    await assertNoDocumentOverflow(page, label);
    const slide = await page.locator('.command-slide').boundingBox();
    if (!slide || slide.y < -2 || slide.y + slide.height > viewport.height + 2) throw new Error(`${label}: slide is outside viewport`);
    if (index < total - 1) { await next.click(); await page.waitForTimeout(70); }
  }
}

async function main() {
  await ensureServices();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1706, height: 930 }, { width: 1440, height: 800 }, { width: 1366, height: 768 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const runtimeErrors = [];
      page.on('pageerror', (error) => runtimeErrors.push(error.message));

      for (const route of ROUTES) {
        runtimeErrors.length = 0;
        await page.goto(`${WEB}${route.path}`, { waitUntil: route.path === '/gameshow' ? 'domcontentloaded' : 'networkidle' });
        if (route.ready) await page.locator(route.ready).waitFor({ timeout: 10_000 });
        if (route.path === '/gameshow') await page.waitForTimeout(900);
        const label = `${route.label} ${viewport.width}x${viewport.height}`;
        if (runtimeErrors.length) throw new Error(`${label}: browser runtime error: ${runtimeErrors[0]}`);
        await assertNoErrorBoundary(page, label);
        await assertNoHorizontalOverflow(page, label);
        await assertVisibleControlsInsideViewport(page, label);
        if (route.fit) {
          await assertNoDocumentOverflow(page, label);
          await assertPrimaryPanelsInsideViewport(page, label);
        }
        if (route.path === '/gameshow') await assertGameshowDrawFits(page, label);
      }

      await assertHomeDeckFits(page, viewport);
      const cards = page.locator('.command-fixture');
      for (let i = 0; i < Math.min(await cards.count(), 8); i += 1) {
        const card = cards.nth(i);
        const score = await card.locator('.command-fixture-scoreline').textContent();
        const h2h = await card.locator('.command-fixture-h2h').textContent();
        if (!score?.includes('VS')) throw new Error(`Home fixture ${i + 1}: scoreline is not centred around VS`);
        if (!h2h?.includes('ALL-TIME H2H')) throw new Error(`Home fixture ${i + 1}: H2H missing`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    started.forEach((child) => child.kill('SIGTERM'));
  }
}

main().catch((error) => {
  console.error(error);
  started.forEach((child) => child.kill('SIGTERM'));
  process.exitCode = 1;
});
