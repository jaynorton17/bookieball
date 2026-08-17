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
  return page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    height: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await pageDimensions(page);
  if (dimensions.width > dimensions.clientWidth + 2) {
    throw new Error(`${label}: horizontal overflow ${dimensions.width}px > ${dimensions.clientWidth}px`);
  }
}

async function assertNoDocumentOverflow(page, label) {
  const dimensions = await pageDimensions(page);
  if (dimensions.width > dimensions.clientWidth + 2) throw new Error(`${label}: horizontal overflow ${dimensions.width}px > ${dimensions.clientWidth}px`);
  if (dimensions.height > dimensions.clientHeight + 2) throw new Error(`${label}: document scroll ${dimensions.height}px > ${dimensions.clientHeight}px`);
}

async function assertVisibleControlsInsideViewport(page, label) {
  const controls = page.locator('button:visible, a.button:visible, .tab-button:visible');
  const count = Math.min(await controls.count(), 30);
  for (let index = 0; index < count; index += 1) {
    const box = await controls.nth(index).boundingBox();
    if (!box) continue;
    const viewport = page.viewportSize();
    if (!viewport) continue;
    if (box.x < -2 || box.x + box.width > viewport.width + 2) {
      throw new Error(`${label}: control ${index + 1} is clipped horizontally`);
    }
  }
}

async function assertGameshowDrawFits(page, label) {
  const start = page.getByRole('button', { name: /start kick-off|start show|start/i }).first();
  if (!(await start.count())) return;
  if (!(await start.isEnabled().catch(() => false))) return;

  await start.click();
  const tombola = page.locator('.tombola-centrepiece').first();
  if (!(await tombola.count())) return;
  await tombola.waitFor({ state: 'visible', timeout: 10_000 });

  const box = await tombola.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) return;
  if (box.x < -2 || box.y < -2 || box.x + box.width > viewport.width + 2 || box.y + box.height > viewport.height + 2) {
    throw new Error(`${label}: tombola is outside the viewport`);
  }

  const pickBall = page.getByRole('button', { name: /pick ball/i }).first();
  if (await pickBall.count()) {
    const pickBox = await pickBall.boundingBox();
    if (!pickBox || pickBox.y + pickBox.height > viewport.height + 2) {
      throw new Error(`${label}: Pick Ball is not visible inside the viewport`);
    }
  }
}

async function main() {
  await ensureServices();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1706, height: 930 }, { width: 1440, height: 800 }, { width: 1366, height: 768 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();

      for (const route of ROUTES) {
        await page.goto(`${WEB}${route.path}`, { waitUntil: route.path === '/gameshow' ? 'domcontentloaded' : 'networkidle' });
        if (route.ready) await page.locator(route.ready).waitFor({ timeout: 10_000 });
        if (route.path === '/gameshow') await page.waitForTimeout(900);

        const label = `${route.label} ${viewport.width}x${viewport.height}`;
        await assertNoHorizontalOverflow(page, label);
        await assertVisibleControlsInsideViewport(page, label);
        if (route.fit) await assertNoDocumentOverflow(page, label);
        if (route.path === '/gameshow') await assertGameshowDrawFits(page, label);
      }

      await page.goto(`${WEB}/`, { waitUntil: 'networkidle' });
      const cards = page.locator('.command-fixture');
      if (await cards.count()) {
        for (let i = 0; i < Math.min(await cards.count(), 8); i += 1) {
          const card = cards.nth(i);
          const score = await card.locator('.command-fixture-scoreline').textContent();
          const h2h = await card.locator('.command-fixture-h2h').textContent();
          if (!score?.includes('VS')) throw new Error(`Home fixture ${i + 1}: scoreline is not centred around VS`);
          if (!h2h?.includes('ALL-TIME H2H')) throw new Error(`Home fixture ${i + 1}: H2H missing`);
        }
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
