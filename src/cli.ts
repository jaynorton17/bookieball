#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { Command } from 'commander';
import express from 'express';
import open from 'open';
import { createServer as createViteServer } from 'vite';
import { createApp } from './api/app.js';
import { createDatabaseBackup, initDatabase, resetDatabaseFile } from './db/database.js';
import { API_PORT, WEB_PORT } from './shared/constants.js';

const WEB_DIST_DIR = path.resolve(process.cwd(), 'dist-web');
const WEB_INDEX_FILE = path.join(WEB_DIST_DIR, 'index.html');

function startProdWebServer() {
  if (!fs.existsSync(WEB_INDEX_FILE)) {
    console.error('Missing web build at web/dist. Run `npm run build:web` first.');
    process.exit(1);
  }

  const webApp = express();
  webApp.use(express.static(WEB_DIST_DIR));
  webApp.get('*', (_req, res) => {
    res.sendFile(WEB_INDEX_FILE);
  });

  return webApp.listen(WEB_PORT, () => {
    console.log(`Web UI ready at http://localhost:${WEB_PORT}`);
  });
}

const program = new Command();

program
  .name('bookieball')
  .description('Bookieball CLI + local web app')
  .version('1.0.0');

program
  .command('init')
  .description('Create DB, run migrations, and seed data')
  .action(() => {
    const result = initDatabase();
    console.log(`Initialized database at ${result.dbPath}`);
    for (const warning of result.warnings) {
      console.warn(`WARNING: ${warning}`);
    }
  });

program
  .command('reset')
  .description('Delete local database and re-run init')
  .option('--yes', 'Skip confirmation prompt')
  .action((options: { yes?: boolean }) => {
    if (!options.yes) {
      console.error('Pass --yes to confirm reset.');
      process.exit(1);
    }

    resetDatabaseFile();
    const result = initDatabase();
    console.log(`Reset database at ${result.dbPath}`);
  });

program
  .command('backup')
  .description('Create a timestamped backup of the local database')
  .option('--label <label>', 'Label included in the backup file name', 'manual')
  .action((options: { label?: string }) => {
    const backupPath = createDatabaseBackup(options.label ?? 'manual');
    if (!backupPath) {
      console.error('No database found to back up.');
      process.exit(1);
    }
    console.log(`Database backup created at ${backupPath}`);
  });

program
  .command('start')
  .description('Start API + web UI and open browser')
  .option('--prod', 'Serve the built web UI instead of the Vite dev server')
  .action(async (options: { prod?: boolean }) => {
    const result = initDatabase();
    for (const warning of result.warnings) {
      console.warn(`WARNING: ${warning}`);
    }

    const app = createApp();
    const apiServer = app.listen(API_PORT, () => {
      console.log(`API ready at http://localhost:${API_PORT}`);
    });

    let vite: Awaited<ReturnType<typeof createViteServer>> | null = null;
    let webServer: ReturnType<typeof startProdWebServer> | null = null;

    if (options.prod) {
      webServer = startProdWebServer();
    } else {
      vite = await createViteServer({
        configFile: path.resolve(process.cwd(), 'web/vite.config.ts'),
        server: { port: WEB_PORT, strictPort: true },
      });
      await vite.listen();
      console.log(`Web UI ready at http://localhost:${WEB_PORT}`);
    }

    await open(`http://localhost:${WEB_PORT}`);

    const shutdown = async () => {
      apiServer.close();
      if (vite) {
        await vite.close();
      }
      if (webServer) {
        webServer.close();
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error);
  process.exit(1);
});
