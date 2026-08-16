import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const WEB = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5180';
const API = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:5181/api/state';
const started = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function assertNoDocumentOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    height: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));
  if (dimensions.width > dimensions.clientWidth + 2) throw new Error(`${label}: horizontal overflow ${dimensions.width}px > ${dimensions.clientWidth}px`);
  if (dimensions.height > dimensions.clientHeight + 2) throw new Error(`${label}: document scroll ${dimensions.height}px > ${dimensions.clientHeight}px`);
}

async function main() {
  await ensureServices();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1706, height: 930 }, { width: 1440, height: 800 }, { width: 1366, height: 768 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.goto(`${WEB}/`, { waitUntil: 'networkidle' });
      await page.locator('.command-centre-page').waitFor();
      await assertNoDocumentOverflow(page, `Home ${viewport.width}x${viewport.height}`);

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

      await page.goto(`${WEB}/gameshow`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      await assertNoDocumentOverflow(page, `Kickoff Show ${viewport.width}x${viewport.height}`);
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
