import { spawn } from 'node:child_process';
import process from 'node:process';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const WEB_URL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5180';
const API_URL = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:5181/api/state';
const START_SERVERS = process.env.SMOKE_USE_EXISTING !== '1';
const WAIT_TIMEOUT_MS = 90_000;
const ROUTE_TIMEOUT_MS = 20_000;
const QUIET_ROUTE_ERRORS = [
  /favicon\.ico/i,
  /Download the React DevTools/i,
  /Could not establish connection/i,
];

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function appendLog(logs, chunk) {
  chunk
    .toString('utf8')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .forEach((line) => {
      logs.push(line);
      if (logs.length > 40) {
        logs.shift();
      }
    });
}

function startService(name, command, args) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: {
      ...process.env,
      FORCE_COLOR: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  child.stdout.on('data', (chunk) => appendLog(logs, chunk));
  child.stderr.on('data', (chunk) => appendLog(logs, chunk));
  return { name, child, logs };
}

async function waitForUrl(url, label) {
  const started = Date.now();
  let lastError = 'unknown error';
  while (Date.now() - started < WAIT_TIMEOUT_MS) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(500);
  }
  throw new Error(`${label} did not become ready at ${url} within ${WAIT_TIMEOUT_MS}ms: ${lastError}`);
}

async function maybeStartServices() {
  if (!START_SERVERS) {
    return [];
  }

  const running = [];

  let apiReady = false;
  try {
    await waitForUrl(API_URL, 'API');
    apiReady = true;
  } catch {
    apiReady = false;
  }
  if (!apiReady) {
    running.push(startService('api', 'npm', ['run', 'dev:api']));
  }

  let webReady = false;
  try {
    await waitForUrl(WEB_URL, 'Web');
    webReady = true;
  } catch {
    webReady = false;
  }
  if (!webReady) {
    running.push(startService('web', 'npm', ['run', 'dev:web', '--', '--host', '127.0.0.1']));
  }

  await waitForUrl(API_URL, 'API');
  await waitForUrl(WEB_URL, 'Web');
  return running;
}

function stopServices(services) {
  services.forEach((service) => {
    if (!service.child.killed) {
      service.child.kill('SIGTERM');
    }
  });
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function verifyHeading(page, text) {
  const exactHeading = new RegExp(`^\\s*${escapeRegex(text)}\\s*$`);
  await page.locator('h1').filter({ hasText: exactHeading }).first().waitFor({ timeout: ROUTE_TIMEOUT_MS });
}

async function verifySsnShow(page) {
  await page.locator('.roundup-show-shell').waitFor({ timeout: ROUTE_TIMEOUT_MS });
  await page.locator('.roundup-lower-third').waitFor({ timeout: ROUTE_TIMEOUT_MS });
}

async function verifyHomeNavigation(page) {
  await page.goto(`${WEB_URL}/`, { waitUntil: 'domcontentloaded' });
  await verifyHeading(page, 'bookieball Dashboard');

  const flows = [
    { label: 'Sky Sports News', marker: 'Studio Control Panel' },
    { label: 'Kick-Off Show', marker: 'The Kick-Off Show' },
    { label: 'Trophy Room', marker: 'Trophy Room' },
  ];

  for (const flow of flows) {
    await page.getByRole('link', { name: flow.label }).click();
    await verifyHeading(page, flow.marker);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await verifyHeading(page, 'bookieball Dashboard');
  }
}

function collectRouteErrors(page) {
  const errors = [];

  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`);
  });

  page.on('console', (message) => {
    if (message.type() !== 'error') {
      return;
    }
    const text = message.text();
    if (QUIET_ROUTE_ERRORS.some((pattern) => pattern.test(text))) {
      return;
    }
    errors.push(`console: ${text}`);
  });

  page.on('response', (response) => {
    if (response.status() < 400) {
      return;
    }
    const url = response.url();
    if (url.endsWith('/favicon.ico')) {
      return;
    }
    errors.push(`response ${response.status()}: ${url}`);
  });

  return errors;
}

const ROUTES = [
  { name: 'Dashboard', path: '/', verify: (page) => verifyHeading(page, 'bookieball Dashboard') },
  { name: 'Leagues Hub', path: '/leagues', verify: (page) => verifyHeading(page, 'Leagues') },
  { name: 'Cups Hub', path: '/cups', verify: (page) => verifyHeading(page, 'Cups') },
  { name: 'Division Tables', path: '/league', verify: (page) => verifyHeading(page, 'Division Tables') },
  { name: 'Master League', path: '/master-league', verify: (page) => verifyHeading(page, 'Master League') },
  { name: 'Master Cup', path: '/master-cup', verify: (page) => verifyHeading(page, 'Master Cup') },
  { name: 'Trio League', path: '/trio-league', verify: (page) => verifyHeading(page, 'Trio League') },
  { name: 'All-Time Points', path: '/all-time-league', verify: (page) => verifyHeading(page, 'All-Time League') },
  { name: 'All-Time Profit', path: '/all-time-profit-league', verify: (page) => verifyHeading(page, 'All-Time Profit League') },
  { name: 'All-Time Spins', path: '/all-time-spins-league', verify: (page) => verifyHeading(page, 'All-Time Spins League') },
  { name: 'Sky Sports News Hub', path: '/sky-sports-news', verify: (page) => verifyHeading(page, 'Studio Control Panel') },
  { name: 'Sky Sports News Show', path: '/sky-sports-news/show?primary=full', verify: verifySsnShow },
  { name: 'Kick-Off Show', path: '/gameshow', verify: (page) => verifyHeading(page, 'The Kick-Off Show') },
  { name: 'Settings Hub', path: '/settings-hub', verify: (page) => verifyHeading(page, 'Settings') },
  { name: 'Settings', path: '/settings', verify: (page) => verifyHeading(page, 'Settings') },
  { name: 'Manual Entry', path: '/entries', verify: (page) => verifyHeading(page, 'Entry Manager') },
  { name: 'Trophy Room', path: '/trophy-room', verify: (page) => verifyHeading(page, 'Trophy Room') },
  { name: 'Matchday Wall', path: '/matchday', verify: (page) => verifyHeading(page, 'Matchday Wall') },
  { name: 'Reporting Desk', path: '/reporting', verify: (page) => verifyHeading(page, 'Reporting Desk') },
  { name: 'Insights', path: '/insights', verify: (page) => verifyHeading(page, 'Insights & Tools') },
  { name: 'Cup Draw', path: '/cup-draw', verify: (page) => verifyHeading(page, 'Bookie Trophy Draw Studio') },
  {
    name: 'Penalty Shootout',
    path: '/penalty-shootout',
    verify: (page) => page.getByRole('heading', { name: 'Penalty Shootout', exact: true }).waitFor({ timeout: ROUTE_TIMEOUT_MS }),
  },
];

async function runRoute(context, route) {
  const page = await context.newPage();
  const errors = collectRouteErrors(page);
  try {
    await page.goto(`${WEB_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: ROUTE_TIMEOUT_MS });
    await route.verify(page);
    await page.waitForTimeout(600);
    if (errors.length > 0) {
      throw new Error(errors.join('\n'));
    }
  } finally {
    await page.close();
  }
}

async function main() {
  const services = await maybeStartServices();
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const failures = [];

  try {
    const homePage = await context.newPage();
    const homeErrors = collectRouteErrors(homePage);
    try {
      await verifyHomeNavigation(homePage);
      await homePage.waitForTimeout(400);
      if (homeErrors.length > 0) {
        throw new Error(homeErrors.join('\n'));
      }
      console.log('✓ Home navigation');
    } catch (error) {
      failures.push({
        name: 'Home navigation',
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`✗ Home navigation\n${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await homePage.close();
    }

    for (const route of ROUTES) {
      try {
        await runRoute(context, route);
        console.log(`✓ ${route.name}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ name: route.name, error: message });
        console.error(`✗ ${route.name}\n${message}`);
      }
    }
  } finally {
    await context.close();
    await browser.close();
    stopServices(services);
  }

  if (failures.length > 0) {
    const summary = failures.map((failure) => `- ${failure.name}: ${failure.error}`).join('\n');
    throw new Error(`Browser smoke failed on ${failures.length} checks:\n${summary}`);
  }

  console.log(`Browser smoke passed for ${ROUTES.length + 1} checks.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
