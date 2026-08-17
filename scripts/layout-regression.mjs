import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const API = 'http://127.0.0.1:5181';
const WEB = 'http://127.0.0.1:5180';
const started = [];
const ROUTES = [
  { path: '/', label: 'Home', ready: '.command-slide', fit: true },
  { path: '/gameshow', label: 'Gameshow', ready: '.gameshow-page', fit: true },
  { path: '/league', label: 'Divisions', ready: '.competition-page-league', fit: true },
  { path: '/master-league', label: 'Master League', ready: '.competition-page-master', fit: true },
  { path: '/trio-league', label: 'Trio League', ready: '.competition-page-trio', fit: true },
  { path: '/tier-league', label: 'Tier League', ready: '.competition-page-tier', fit: true },
  { path: '/leagues', label: 'Leagues Hub', ready: '.hub-page', fit: true },
  { path: '/cups', label: 'Cups Hub', ready: '.page-dashboard', fit: true },
  { path: '/cup-draw', label: 'Cup Draw', ready: '.page', fit: false },
  { path: '/master-cup', label: 'Master Cup', ready: '.page', fit: true },
  { path: '/super-cup', label: 'Super Cup', ready: '.page', fit: true },
  { path: '/fixtures', label: 'Fixtures', ready: '.page', fit: false },
  { path: '/entries', label: 'Manual Entry', ready: '.page', fit: false },
  { path: '/reports', label: 'Analytics', ready: '.analytics-v2', fit: true },
  { path: '/head-to-head', label: 'Head to Head', ready: '.head-to-head-page', fit: true },
  { path: '/trophy-room', label: 'Trophy Room', ready: '.trophy-room-page', fit: true },
  { path: '/all-time-league', label: 'All-Time Points', ready: '.all-time-leagues-page', fit: false },
  { path: '/all-time-spins-league', label: 'All-Time Spins', ready: '.all-time-leagues-page', fit: false },
  { path: '/all-time-profit-league', label: 'All-Time Profit', ready: '.all-time-leagues-page', fit: false },
  { path: '/settings-hub', label: 'Tools Hub', ready: '.tools-hub', fit: false },
  { path: '/settings', label: 'Settings', ready: '.page', fit: false },
  { path: '/insights', label: 'Gameweek Control Room', ready: '.page', fit: false },
  { path: '/matchday', label: 'Matchday', ready: '.page', fit: false },
  { path: '/reporting', label: 'Reporting', ready: '.page', fit: false },
  { path: '/sky-sports-news', label: 'SSN Hub', ready: '.page', fit: false },
  { path: '/sky-sports-news/show', label: 'SSN Show', ready: '.page', fit: false },
  { path: '/studio/sky-sports-news-new', label: 'SSN Studio', ready: '.page', fit: false },
  { path: '/studio/sny-news-new', label: 'SNY Studio Alias', ready: '.page', fit: false },
  { path: '/penalty-shootout', label: 'Penalties', ready: '.penalty-page', fit: true },
  { path: '/season-finale', label: 'Season Finale', ready: '.season-finale-page', fit: false },
];

async function reachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

function start(command, args) {
  const child = spawn(command, args, { stdio: 'ignore', shell: process.platform === 'win32' });
  started.push(child);
  return child;
}

async function waitFor(url, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await reachable(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} failed to start`);
}

async function ensureServices() {
  if (!(await reachable(`${API}/state`))) start('npm', ['run', 'dev:api']);
  if (!(await reachable(WEB))) start('npm', ['run', 'dev:web', '--', '--host', '127.0.0.1']);
  await Promise.all([waitFor(`${API}/state`, 'API'), waitFor(WEB, 'Web')]);
}

async function assertNoErrorBoundary(page, label) {
  const text = await page.locator('body').innerText();
  if (/something went wrong|application error|unexpected application error/i.test(text)) throw new Error(`${label}: error boundary visible`);
}

async function assertNoHorizontalOverflow(page, label) {
  const result = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  if (result.width > result.viewport + 2) throw new Error(`${label}: horizontal overflow ${result.width}px > ${result.viewport}px`);
}

async function assertNoDocumentOverflow(page, label) {
  const result = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, viewport: window.innerHeight }));
  if (result.height > result.viewport + 3) throw new Error(`${label}: document overflow ${result.height}px > ${result.viewport}px`);
}

async function assertVisibleControlsInsideViewport(page, label) {
  const controls = page.locator('button:visible, a:visible, select:visible, input:visible');
  const count = await controls.count();
  for (let index = 0; index < count; index += 1) {
    const box = await controls.nth(index).boundingBox();
    if (!box) continue;
    if (box.x < -2 || box.y < -2 || box.x + box.width > page.viewportSize().width + 2 || box.y + box.height > page.viewportSize().height + 2) {
      throw new Error(`${label}: visible control ${index + 1} outside viewport`);
    }
  }
}

async function assertPrimaryPanelsInsideViewport(page, label) {
  const panels = page.locator('.panel:visible, .analytics-tv-stage:visible, .command-slide:visible, .gameshow-page:visible');
  const count = await panels.count();
  for (let index = 0; index < count; index += 1) {
    const box = await panels.nth(index).boundingBox();
    if (!box) continue;
    if (box.y < -2 || box.y + box.height > page.viewportSize().height + 2) throw new Error(`${label}: primary panel ${index + 1} clipped vertically`);
  }
}

async function assertGameshowDrawFits(page, label) {
  const start = page.getByRole('button', { name: /start/i }).first();
  if (!(await start.count())) return;
  await start.click();
  const pick = page.getByRole('button', { name: /pick ball/i }).first();
  try { await pick.waitFor({ timeout: 8000 }); } catch { return; }
  await assertNoDocumentOverflow(page, `${label} · Tombola`);
  const box = await pick.boundingBox();
  if (!box || box.y + box.height > page.viewportSize().height + 2) throw new Error(`${label}: Pick Ball is outside viewport`);
}

async function assertHomeDeckFits(page, viewport) {
  await page.goto(WEB, { waitUntil: 'networkidle' });
  await page.locator('.command-slide').waitFor({ timeout: 15_000 });
  const text = await page.locator('.command-centre-controls').innerText();
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

async function assertAnalyticsModes(page, viewport) {
  await page.goto(`${WEB}/reports`, { waitUntil: 'networkidle' });
  await page.locator('.analytics-tv').waitFor({ timeout: 15_000 });
  for (const mode of ['Overview', 'Races', 'Form', 'Rivalries', 'History', 'Records']) {
    const button = page.locator('.analytics-tv-nav button').filter({ hasText: mode }).first();
    if (!(await button.count())) throw new Error(`Analytics ${viewport.width}x${viewport.height}: ${mode} channel missing`);
    await button.click();
    await page.waitForTimeout(220);
    const label = `Analytics ${viewport.width}x${viewport.height} · ${mode}`;
    await assertNoErrorBoundary(page, label);
    await assertNoDocumentOverflow(page, label);
    await assertVisibleControlsInsideViewport(page, label);
    const stage = await page.locator('.analytics-tv-stage').boundingBox();
    if (!stage || stage.y < -2 || stage.y + stage.height > viewport.height + 2) throw new Error(`${label}: analytics stage is outside viewport`);
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
        const lightLoad = route.path === '/gameshow' || route.path === '/season-finale' || route.path.includes('sky-sports-news') || route.path.includes('sny-news');
        await page.goto(`${WEB}${route.path}`, { waitUntil: lightLoad ? 'domcontentloaded' : 'networkidle' });
        if (route.ready) await page.locator(route.ready).waitFor({ timeout: 10_000 });
        if (lightLoad) await page.waitForTimeout(900);
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
      await assertAnalyticsModes(page, viewport);
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
